const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const AdmZip = require('adm-zip');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require('msmc');

// ---------- settings & accounts ----------
const CFG = path.join(app.getPath('userData'), 'settings.json');
const ACC = path.join(app.getPath('userData'), 'accounts.json');
let S = { gameDir: path.join(app.getPath('appData'), '.jern'), javaPath: '', ramMax: 4096, cfKey: '', afterLaunch: 'keep', restoreOnExit: true };
let minimized = false;
let A = { list: [], sel: null };
try { S = { ...S, ...JSON.parse(fs.readFileSync(CFG, 'utf8')) }; } catch {}
try { A = JSON.parse(fs.readFileSync(ACC, 'utf8')); } catch {}
const wr = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const saveS = () => wr(CFG, S), saveA = () => wr(ACC, A);
// tokens are encrypted with the OS keychain (DPAPI on Windows) when available
const enc = o => { const s = JSON.stringify(o); return safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(s).toString('base64') : 'p:' + Buffer.from(s).toString('base64'); };
const dec = t => JSON.parse(t.startsWith('e:') ? safeStorage.decryptString(Buffer.from(t.slice(2), 'base64')) : Buffer.from(t.slice(2), 'base64').toString());
const pub = a => ({ id: a.id, type: a.type, name: a.name, uuid: a.uuid });
const upsert = a => { const i = A.list.findIndex(x => x.id === a.id); if (i < 0) A.list.push(a); else A.list[i] = a; A.sel = a.id; saveA(); return pub(a); };

let win;
const send = (c, d) => win?.webContents.send(c, d);
const log = m => send('log', String(m));
const h = (c, f) => ipcMain.handle(c, async (_, a) => { try { return { ok: true, data: await f(a) }; } catch (e) { return { ok: false, error: e.message }; } });

// ---------- http helpers ----------
const UA = { 'User-Agent': 'JernClient/1.1' };
const J = async (u, hd = {}) => { const r = await fetch(u, { headers: { ...UA, ...hd } }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const dl = async (u, dest) => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); return dest; };
const CF = p => J('https://api.curseforge.com/v1' + p, { 'x-api-key': S.cfKey });
const DIR = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };
const LT = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

// ---------- instances (each has its own mods/saves/configs; assets+libraries are shared) ----------
const IFILE = () => path.join(S.gameDir, 'jern-instances.json');
const loadI = () => { try { return JSON.parse(fs.readFileSync(IFILE(), 'utf8')); } catch { return []; } };
const saveI = l => wr(IFILE(), l);
const getI = id => { const i = loadI().find(x => x.id === id); if (!i) throw new Error('Instance not found'); return i; };
const idir = i => path.join(S.gameDir, 'instances', i.id);
const inside = (i, rel) => { const root = path.resolve(idir(i)), f = path.resolve(root, rel); if (f !== root && !f.startsWith(root + path.sep)) throw new Error('Blocked path: ' + rel); return f; };
function newInstance({ name, mc, loader = 'vanilla', loaderVer = null, perf = false, autoUpdate = true }) {
  name = (name || '').trim(); if (!name) throw new Error('Give the instance a name');
  if (perf && loader === 'vanilla') loader = 'fabric';
  const i = { id: crypto.randomUUID().slice(0, 8), name, mc, loader, loaderVer, perf, autoUpdate };
  saveI([...loadI(), i]); fs.mkdirSync(idir(i), { recursive: true }); return i;
}
function extractOverrides(i, z, prefixes) {
  for (const e of z.getEntries()) for (const p of prefixes)
    if (e.entryName.startsWith(p) && !e.isDirectory) { const d = inside(i, e.entryName.slice(p.length)); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, e.getData()); }
}

// ---------- Java (auto-downloads the runtime each MC version needs) ----------
function findJava(d) {
  if (!fs.existsSync(d)) return null;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { const r = findJava(p); if (r) return r; }
    else if (e.name === 'javaw.exe' || e.name === 'java') return p;
  }
  return null;
}
async function ensureJava(mc) {
  if (S.javaPath) return S.javaPath;
  const man = await J('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const v = man.versions.find(x => x.id === mc); if (!v) throw new Error('Unknown version ' + mc);
  const major = (await J(v.url)).javaVersion?.majorVersion || 8;
  const dir = path.join(S.gameDir, 'runtime', 'java' + major);
  let exe = findJava(dir); if (exe) return exe;
  log(`Downloading Java ${major}…`);
  const o = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform], ar = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const z = await dl(`https://api.adoptium.net/v3/binary/latest/${major}/ga/${o}/${ar}/jre/hotspot/normal/eclipse`, path.join(dir, 'jre.zip'));
  new AdmZip(z).extractAllTo(dir, true); fs.unlinkSync(z);
  exe = findJava(dir); if (!exe) throw new Error('Java extraction failed'); return exe;
}

// ---------- Fabric / Quilt ----------
async function ensureLoader(i) {
  if (i.loader === 'vanilla') return undefined;
  const base = i.loader === 'fabric' ? 'https://meta.fabricmc.net/v2' : 'https://meta.quiltmc.org/v3';
  let lv = i.loaderVer;
  if (!lv) {
    const l = await J(`${base}/versions/loader/${i.mc}`);
    if (!l.length) throw new Error(`${i.loader} does not support Minecraft ${i.mc}`);
    lv = (l.find(x => x.loader.stable !== false) || l[0]).loader.version;
  }
  const p = await J(`${base}/versions/loader/${i.mc}/${lv}/profile/json`);
  const f = path.join(S.gameDir, 'versions', p.id, p.id + '.json');
  if (!fs.existsSync(f)) wr(f, p);
  return p.id;
}
const PERF = ['sodium', 'lithium', 'ferrite-core', 'modernfix', 'entityculling', 'immediatelyfast'];
async function ensurePerfMods(i) {
  const mark = inside(i, 'mods/.jern-perf'); if (fs.existsSync(mark)) return;
  const seen = new Set();
  for (const s of PERF) { try { log('Installed ' + (await mrInstall(i, s, 'mod', seen)).join(', ')); } catch (e) { log(`Skipped ${s}: ${e.message}`); } }
  fs.mkdirSync(path.dirname(mark), { recursive: true }); fs.writeFileSync(mark, '');
}

// ---------- Modrinth ----------
async function mrInstall(i, id, type, seen = new Set()) {
  if (seen.has(id)) return []; seen.add(id);
  const q = new URLSearchParams({ game_versions: JSON.stringify([i.mc]) });
  if (type === 'mod' && i.loader !== 'vanilla') q.set('loaders', JSON.stringify([i.loader]));
  const vs = await J(`https://api.modrinth.com/v2/project/${id}/version?${q}`);
  if (!vs.length) throw new Error(`no build for ${i.mc} (${i.loader})`);
  const f = vs[0].files.find(x => x.primary) || vs[0].files[0];
  await dl(f.url, inside(i, path.join(DIR[type], f.filename)));
  const out = [f.filename];
  if (type === 'mod') for (const d of vs[0].dependencies || [])
    if (d.dependency_type === 'required' && d.project_id) { try { out.push(...await mrInstall(i, d.project_id, 'mod', seen)); } catch (e) { log('Dependency skipped: ' + e.message); } }
  return out;
}
async function packFromMr(pid) {
  const v = (await J(`https://api.modrinth.com/v2/project/${pid}/version`))[0]; if (!v) throw new Error('Modpack has no versions');
  const f = v.files.find(x => x.primary) || v.files[0];
  const z = new AdmZip(await dl(f.url, path.join(os.tmpdir(), 'jern-mr.zip'))), idx = JSON.parse(z.readAsText('modrinth.index.json')), d = idx.dependencies;
  const lk = ['fabric-loader', 'quilt-loader'].find(k => d[k]);
  if (!lk && (d.forge || d.neoforge)) throw new Error('Forge/NeoForge modpacks are not supported yet');
  const i = newInstance({ name: idx.name, mc: d.minecraft, loader: lk ? lk.split('-')[0] : 'vanilla', loaderVer: lk ? d[lk] : null, autoUpdate: false });
  for (const x of idx.files) { if (x.env?.client === 'unsupported') continue; await dl(x.downloads[0], inside(i, x.path)); log('✓ ' + x.path); }
  extractOverrides(i, z, ['overrides/', 'client-overrides/']); return i;
}

// ---------- CurseForge ----------
async function cfFile(id, i) {
  const p = new URLSearchParams({ pageSize: 1 });
  if (i) { p.set('gameVersion', i.mc); if (LT[i.loader]) p.set('modLoaderType', LT[i.loader]); }
  const f = (await CF(`/mods/${id}/files?${p}`)).data[0]; if (!f) throw new Error('No compatible file');
  if (!f.downloadUrl) throw new Error('The author disabled third-party downloads for this file');
  return f;
}
async function cfInstall(i, id, type) { const f = await cfFile(id, type === 'mod' ? i : { mc: i.mc, loader: 'vanilla' }); await dl(f.downloadUrl, inside(i, path.join(DIR[type], f.fileName))); return [f.fileName]; }
async function packFromCf(pid) {
  const f = await cfFile(pid, null);
  const z = new AdmZip(await dl(f.downloadUrl, path.join(os.tmpdir(), 'jern-cf.zip'))), m = JSON.parse(z.readAsText('manifest.json'));
  const ml = (m.minecraft.modLoaders.find(x => x.primary) || m.minecraft.modLoaders[0])?.id || '', ln = ml.split('-')[0], lv = ml.split('-').slice(1).join('-');
  if (ml && !['fabric', 'quilt'].includes(ln)) throw new Error('Forge/NeoForge modpacks are not supported yet');
  const i = newInstance({ name: m.name, mc: m.minecraft.version, loader: ln || 'vanilla', loaderVer: lv || null, autoUpdate: false });
  for (const x of m.files) {
    const d = (await CF(`/mods/${x.projectID}/files/${x.fileID}`)).data;
    if (d.downloadUrl) { await dl(d.downloadUrl, inside(i, 'mods/' + d.fileName)); log('✓ ' + d.fileName); } else log('✗ download manually: ' + d.fileName);
  }
  extractOverrides(i, z, [(m.overrides || 'overrides') + '/']); return i;
}

// ---------- authentication ----------
const ELY = 'https://authserver.ely.by';
async function ely(ep, body) {
  const r = await fetch(`${ELY}/auth/${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...UA }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.errorMessage || j.error || 'Ely.by error ' + r.status);
  return j;
}
async function ensureAuthlib() {
  const f = path.join(S.gameDir, 'runtime', 'authlib-injector.jar');
  if (!fs.existsSync(f)) await dl((await J('https://authlib-injector.yushi.moe/artifact/latest.json')).download_url, f);
  return f;
}
async function resolveAuth(a) {
  if (a.type === 'offline') return Authenticator.getAuth(a.name);
  if (a.type === 'ms') {
    const x = await new Auth('select_account').refresh(dec(a.secret).t);
    const mc = await x.getMinecraft(); a.secret = enc({ t: x.save() }); saveA(); return mc.mclc();
  }
  const s = dec(a.secret);
  let j; try { j = await ely('refresh', { accessToken: s.accessToken, clientToken: s.clientToken }); } catch { throw new Error('Ely.by session expired - sign in again'); }
  a.secret = enc({ accessToken: j.accessToken, clientToken: s.clientToken }); saveA();
  return { access_token: j.accessToken, client_token: s.clientToken, uuid: a.uuid, name: a.name, user_properties: '{}', meta: { type: 'mojang', demo: false } };
}

h('acc:list', () => ({ list: A.list.map(pub), sel: A.sel }));
h('acc:select', id => { A.sel = id; saveA(); return true; });
h('acc:remove', id => { A.list = A.list.filter(x => x.id !== id); if (A.sel === id) A.sel = A.list[0]?.id || null; saveA(); return true; });
h('login:offline', n => {
  n = (n || '').trim(); if (!/^\w{3,16}$/.test(n)) throw new Error('Username must be 3-16 letters, numbers or _');
  return upsert({ id: 'off:' + n, type: 'offline', name: n, uuid: Authenticator.getAuth(n).uuid });
});
h('login:ms', async () => {
  const x = await new Auth('select_account').launch('electron'), mc = await x.getMinecraft();
  return upsert({ id: 'ms:' + mc.profile.id, type: 'ms', name: mc.profile.name, uuid: mc.profile.id, secret: enc({ t: x.save() }) });
});
h('login:ely', async ({ user, pass }) => {
  const ct = crypto.randomUUID().replace(/-/g, '');
  let j; try { j = await ely('authenticate', { username: user, password: pass, clientToken: ct, requestUser: true }); }
  catch (e) { if (/two.?factor/i.test(e.message)) throw new Error('Two-factor is on: type  password:CODE  in the password field'); throw e; }
  const p = j.selectedProfile; if (!p) throw new Error('This Ely.by account has no profile');
  return upsert({ id: 'ely:' + p.id, type: 'ely', name: p.name, uuid: p.id, secret: enc({ accessToken: j.accessToken, clientToken: j.clientToken || ct }) });
});

// ---------- IPC ----------
h('cfg:get', () => S);
h('cfg:set', p => { S = { ...S, ...p }; saveS(); return S; });
h('pick-dir', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
h('versions', async () => { const m = await J('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'); return { latest: m.latest, versions: m.versions.map(v => ({ id: v.id, type: v.type })) }; });
h('versions:installed', () => { const d = path.join(S.gameDir, 'versions'); return fs.existsSync(d) ? fs.readdirSync(d) : []; });
h('versions:remove', n => { const d = path.resolve(S.gameDir, 'versions'), f = path.resolve(d, n); if (!f.startsWith(d + path.sep)) throw new Error('Blocked'); fs.rmSync(f, { recursive: true, force: true }); return true; });

h('inst:list', () => loadI().map(i => { let mods = 0; try { mods = fs.readdirSync(path.join(idir(i), 'mods')).filter(n => n.endsWith('.jar')).length; } catch {} return { ...i, mods }; }));
h('inst:update', ({ id, patch }) => {
  const l = loadI(), i = l.find(x => x.id === id); if (!i) throw new Error('Instance not found');
  if (patch.name !== undefined) { if (!String(patch.name).trim()) throw new Error('Name cannot be empty'); i.name = String(patch.name).trim(); }
  if (patch.ram !== undefined) i.ram = patch.ram ? Math.max(1024, +patch.ram) : null;
  if (patch.perf !== undefined) { i.perf = !!patch.perf; if (i.perf && i.loader === 'vanilla') i.loader = 'fabric'; }
  if (patch.autoUpdate !== undefined) i.autoUpdate = !!patch.autoUpdate;
  saveI(l); return i;
});
h('open', u => { if (!/^https:\/\/(modrinth\.com|www\.curseforge\.com)\//.test(u)) throw new Error('Blocked link'); return shell.openExternal(u); });
h('inst:create', a => newInstance(a));
h('inst:delete', id => { const i = getI(id); fs.rmSync(idir(i), { recursive: true, force: true }); saveI(loadI().filter(x => x.id !== id)); return true; });
h('inst:open', id => { const i = getI(id); fs.mkdirSync(idir(i), { recursive: true }); return shell.openPath(idir(i)); });
// ---------- content metadata + safe updates (Modrinth hash lookup) ----------
const sha1 = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const HC = new Map();
const hashOf = p => { const st = fs.statSync(p), k = `${p}|${st.mtimeMs}|${st.size}`; if (!HC.has(k)) HC.set(k, sha1(p)); return HC.get(k); };
const MRP = async (p, b) => { const r = await fetch('https://api.modrinth.com/v2' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...UA }, body: JSON.stringify(b) }); if (!r.ok) throw new Error('Modrinth ' + r.status); return r.json(); };
function listFiles(i, type) {
  const d = inside(i, DIR[type]); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(n => !n.startsWith('.')).map(n => ({ name: n, path: path.join(d, n) })).filter(f => fs.statSync(f.path).isFile());
}
async function lookup(i, type) {
  const files = listFiles(i, type).map(f => ({ ...f, hash: hashOf(f.path) }));
  const vers = files.length ? await MRP('/version_files', { hashes: files.map(f => f.hash), algorithm: 'sha1' }) : {};
  return { files, vers };
}
const installedPids = async (i, type) => new Set(Object.values((await lookup(i, type)).vers).map(v => v.project_id));
const updBody = (i, type, hashes) => { const b = { hashes, algorithm: 'sha1', game_versions: [i.mc] }; if (type === 'mod' && i.loader !== 'vanilla') b.loaders = [i.loader]; return b; };
const isNewer = (u, v) => u && v && u.id !== v.id && new Date(u.date_published) > new Date(v.date_published);
async function metaFor(i, type) {
  const { files, vers } = await lookup(i, type); if (!files.length) return {};
  const pids = [...new Set(Object.values(vers).map(v => v.project_id))], projs = [];
  for (let k = 0; k < pids.length; k += 50) projs.push(...await J(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(pids.slice(k, k + 50)))}`));
  const P = Object.fromEntries(projs.map(p => [p.id, p]));
  let ups = {}; try { ups = await MRP('/version_files/update', updBody(i, type, files.map(f => f.hash))); } catch {}
  const out = {};
  for (const f of files) {
    const v = vers[f.hash]; if (!v) continue; const p = P[v.project_id] || {}, u = ups[f.hash];
    out[f.name] = { pid: v.project_id, title: p.title, icon: p.icon_url, desc: p.description, version: v.version_number, url: p.slug ? `https://modrinth.com/${p.project_type || 'mod'}/${p.slug}` : null, update: isNewer(u, v) ? { version: u.version_number } : null };
  }
  return out;
}
// keep game settings pointing at a renamed pack/shader so nothing is "lost" after an update
function renameRefs(i, type, o, n) {
  const clean = s => s.replace(/\.disabled$/, ''); o = clean(o); n = clean(n); if (o === n) return;
  const fix = (f, a, b) => { try { const p = inside(i, f); if (!fs.existsSync(p)) return; const t = fs.readFileSync(p, 'utf8'); if (t.includes(a)) fs.writeFileSync(p, t.split(a).join(b)); } catch {} };
  if (type === 'resourcepack') fix('options.txt', 'file/' + o, 'file/' + n);
  if (type === 'shader') fix('config/iris.properties', 'shaderPack=' + o, 'shaderPack=' + n);
}
function pruneBackups(i) {
  const d = inside(i, '.jern-backups'); if (!fs.existsSync(d)) return;
  for (const n of fs.readdirSync(d)) { try { const p = path.join(d, n); if (Date.now() - fs.statSync(p).mtimeMs > 14 * 864e5) fs.rmSync(p, { recursive: true, force: true }); } catch {} }
}
// Download + verify first, back up the old file, only then swap. Worlds, configs and options are never touched.
async function updateOne(i, type, name, stamp) {
  const f = inside(i, path.join(DIR[type], name)), hash = hashOf(f);
  const cur = (await MRP('/version_files', { hashes: [hash], algorithm: 'sha1' }))[hash];
  const u = (await MRP('/version_files/update', updBody(i, type, [hash])))[hash];
  if (!isNewer(u, cur)) return null;
  const nf = u.files.find(x => x.primary) || u.files[0];
  const tmp = await dl(nf.url, path.join(os.tmpdir(), 'jern-up-' + crypto.randomUUID().slice(0, 8)));
  try {
    if (nf.hashes?.sha1 && sha1(tmp) !== nf.hashes.sha1) throw new Error('Checksum mismatch for ' + nf.filename);
    const newName = nf.filename + (name.endsWith('.disabled') ? '.disabled' : ''), dest = inside(i, path.join(DIR[type], newName));
    const bdir = inside(i, path.join('.jern-backups', stamp, DIR[type])); fs.mkdirSync(bdir, { recursive: true }); fs.copyFileSync(f, path.join(bdir, name));
    fs.copyFileSync(tmp, dest); if (dest !== f) fs.unlinkSync(f);
    renameRefs(i, type, name, newName);
    if (type === 'mod') {
      const have = await installedPids(i, 'mod').catch(() => new Set());
      for (const d of u.dependencies || []) if (d.dependency_type === 'required' && d.project_id && !have.has(d.project_id)) { try { await mrInstall(i, d.project_id, 'mod', new Set(have)); } catch (e) { log('Dependency skipped: ' + e.message); } }
    }
    return { from: name, to: newName, version: u.version_number };
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}
async function updateAllFor(i, types = ['mod', 'resourcepack', 'shader']) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'), done = [], fail = [];
  for (const type of types) {
    let meta; try { meta = await metaFor(i, type); } catch (e) { fail.push(type + ': ' + e.message); continue; }
    for (const [name, m] of Object.entries(meta)) if (m.update) {
      try { const r = await updateOne(i, type, name, stamp); if (r) { done.push(r); log(`Updated ${m.title || name} → ${r.version}`); } }
      catch (e) { fail.push((m.title || name) + ': ' + e.message); log(`Update failed: ${m.title || name} - ${e.message}`); }
    }
  }
  pruneBackups(i); return { done, fail };
}
h('content:meta', ({ id, type }) => metaFor(getI(id), type));
h('content:update', ({ id, type, name }) => { const i = getI(id); return updateOne(i, type, name, new Date().toISOString().replace(/[:.]/g, '-')).then(r => { pruneBackups(i); return r; }); });
h('content:updateAll', ({ id, types }) => updateAllFor(getI(id), types));
h('content:list', ({ id, type }) => {
  const d = inside(getI(id), DIR[type]); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(n => !n.startsWith('.')).map(n => { const st = fs.statSync(path.join(d, n)); return { name: n, size: st.isDirectory() ? 0 : st.size, disabled: n.endsWith('.disabled') }; });
});
h('content:toggle', ({ id, type, name }) => { const i = getI(id), to = name.endsWith('.disabled') ? name.slice(0, -9) : name + '.disabled'; fs.renameSync(inside(i, path.join(DIR[type], name)), inside(i, path.join(DIR[type], to))); return to; });
h('content:remove', ({ id, type, name }) => { fs.rmSync(inside(getI(id), path.join(DIR[type], name)), { recursive: true, force: true }); return true; });

h('browse', async ({ src, type, q, id, page = 1, per = 20, sort = 'relevance', cat = '', compat = true }) => {
  const i = id ? getI(id) : null, off = (page - 1) * per, LD = ['fabric', 'forge', 'neoforge', 'quilt'];
  if (src === 'modrinth') {
    const f = [[`project_type:${type}`]];
    if (i && compat && type !== 'modpack') f.push([`versions:${i.mc}`]);
    if (i && compat && type === 'mod' && i.loader !== 'vanilla') f.push([`categories:${i.loader}`]);
    if (cat) f.push([`categories:${cat}`]);
    const r = await J(`https://api.modrinth.com/v2/search?limit=${per}&offset=${off}&index=${sort}&query=${encodeURIComponent(q || '')}&facets=${encodeURIComponent(JSON.stringify(f))}`);
    return { total: r.total_hits, hits: r.hits.map(x => {
      const ok = v => v !== 'unsupported', env = ok(x.client_side) && ok(x.server_side) ? 'Client or server' : ok(x.client_side) ? 'Client' : 'Server';
      const cats = (x.display_categories || x.categories || []).filter(c => !LD.includes(c));
      const tags = [...(type === 'mod' ? [{ t: env, k: 'env' }] : []), ...cats.slice(0, 3).map(c => ({ t: c.replace(/-/g, ' '), k: 'cat' })), ...(x.categories || []).filter(c => LD.includes(c)).map(c => ({ t: c, k: 'loader' }))];
      return { id: x.project_id, title: x.title, desc: x.description, icon: x.icon_url, author: x.author, downloads: x.downloads, follows: x.follows, updated: x.date_modified, tags, url: `https://modrinth.com/${x.project_type}/${x.slug}` };
    }) };
  }
  if (!S.cfKey) throw new Error('Add your CurseForge API key in Settings (free at console.curseforge.com)');
  const sf = { relevance: 2, downloads: 6, follows: 2, newest: 11, updated: 3 }[sort] || 2;
  const p = new URLSearchParams({ gameId: 432, classId: { mod: 6, resourcepack: 12, modpack: 4471, shader: 6552 }[type], searchFilter: q || '', pageSize: per, index: off, sortField: sf, sortOrder: 'desc' });
  if (i && compat && type !== 'modpack') p.set('gameVersion', i.mc);
  if (i && compat && type === 'mod' && LT[i.loader]) p.set('modLoaderType', LT[i.loader]);
  const r = await CF('/mods/search?' + p);
  return { total: Math.min(r.pagination.totalCount, 10000), hits: r.data.map(x => ({ id: x.id, title: x.name, desc: x.summary, icon: x.logo?.thumbnailUrl, author: x.authors?.[0]?.name, downloads: x.downloadCount, follows: null, updated: x.dateModified, tags: (x.categories || []).slice(0, 4).map(c => ({ t: c.name, k: 'cat' })), url: x.links?.websiteUrl })) };
});
h('install', async ({ src, type, pid, id }) => {
  if (type === 'modpack') return [(await (src === 'modrinth' ? packFromMr : packFromCf)(pid)).name];
  const i = getI(id);
  if (src === 'modrinth') { const have = await installedPids(i, type).catch(() => new Set()); if (have.has(pid)) throw new Error('Already installed in this instance'); return mrInstall(i, pid, type, new Set(type === 'mod' ? have : [])); }
  return cfInstall(i, pid, type);
});

const JVM = ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=100', '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC', '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40', '-XX:G1HeapRegionSize=8M', '-XX:G1ReservePercent=20', '-XX:InitiatingHeapOccupancyPercent=15', '-XX:+PerfDisableSharedMem'];
h('inst:launch', async id => {
  const i = getI(id), acc = A.list.find(x => x.id === A.sel);
  if (!acc) throw new Error('Add an account first (bottom-left)');
  send('state', { id, s: 'launching' });
  try {
    const auth = await resolveAuth(acc), javaPath = await ensureJava(i.mc), custom = await ensureLoader(i);
    if (i.perf && i.loader === 'fabric') await ensurePerfMods(i);
    if (i.autoUpdate) { log('Checking for mod and pack updates…'); try { const r = await updateAllFor(i); log(r.done.length ? `Updated ${r.done.length} item(s)` : 'Everything is up to date'); } catch (e) { log('Auto-update skipped: ' + e.message); } }
    const args = [...(i.perf ? JVM : [])];
    if (acc.type === 'ely') args.push(`-javaagent:${await ensureAuthlib()}=${ELY}/api/authlib-injector`);
    const L = new Client();
    // "after launch" behaviour: wait until the game window is coming up (or 20 s), then minimise / close the launcher
    let applied = false;
    const after = () => {
      if (applied) return; applied = true;
      if (S.afterLaunch === 'minimize') { minimized = true; win?.minimize(); }
      else if (S.afterLaunch === 'close') { log('Closing launcher - the game keeps running'); setTimeout(() => app.quit(), 600); }
    };
    L.on('debug', log); L.on('progress', p => send('progress', p));
    L.on('data', d => { log(d); if (!applied && /LWJGL|Backend library|Sound engine started|OpenAL initialized/i.test(String(d))) after(); });
    L.on('close', c => {
      log('Game exited (' + c + ')'); send('state', { id, s: 'closed' });
      if (minimized && S.restoreOnExit !== false && win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
      minimized = false;
    });
    const p = await L.launch({ authorization: auth, root: S.gameDir, javaPath, overrides: { gameDirectory: idir(i) }, version: { number: i.mc, type: 'release', custom }, memory: { max: (i.ram || S.ramMax) + 'M', min: '1024M' }, customArgs: args, detached: true });
    if (!p) throw new Error('Launch failed - see the Log tab');
    { const l = loadI(), x = l.find(y => y.id === id); if (x) { x.lastPlayed = Date.now(); saveI(l); } }
    send('state', { id, s: 'running' }); setTimeout(after, 20000); return true;
  } catch (e) { send('state', { id, s: 'closed' }); throw e; }
});

app.whenReady().then(() => {
  const ico = path.join(__dirname, 'build', 'icon.ico');
  win = new BrowserWindow({ width: 1100, height: 720, minWidth: 900, minHeight: 600, backgroundColor: '#1d2026', title: 'Jern Client', titleBarStyle: 'hidden', titleBarOverlay: { color: '#171a1f', symbolColor: '#ffffff', height: 40 }, icon: fs.existsSync(ico) ? ico : undefined, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.removeMenu(); win.loadFile('renderer/index.html');
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && i.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools(); });
});
app.on('window-all-closed', () => app.quit());
