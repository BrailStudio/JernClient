const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, nativeImage } = require('electron');
const zlib = require('zlib');
const { spawn } = require('child_process');
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
// ---- data-folder hand-off with the installer: datadir.txt mirrors the folder, datadir.pending = "installer picked a new one" ----
const DD = path.join(app.getPath('userData'), 'datadir.txt'), PEND = path.join(app.getPath('userData'), 'datadir.pending');
const readDD = () => { try { const b = fs.readFileSync(DD); return (b[0] === 0xFF && b[1] === 0xFE ? b.slice(2).toString('utf16le') : b.toString('utf8')).replace(/^\uFEFF/, '').trim(); } catch { return ''; } };
const writeDD = p => { try { fs.mkdirSync(path.dirname(DD), { recursive: true }); fs.writeFileSync(DD, Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(p, 'utf16le')])); } catch {} };
if (fs.existsSync(PEND)) { const p = readDD(); if (p) { S.gameDir = p; saveS(); } try { fs.rmSync(PEND); } catch {} }
writeDD(S.gameDir);
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
const DIR = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks', schematic: 'schematics' };
const LT = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

// ---------- instances (each has its own mods/saves/configs; assets+libraries are shared) ----------
const IFILE = () => path.join(S.gameDir, 'jern-instances.json');
const loadI = () => { try { return JSON.parse(fs.readFileSync(IFILE(), 'utf8')); } catch { return []; } };
const saveI = l => wr(IFILE(), l);
const getI = id => { const i = loadI().find(x => x.id === id); if (!i) throw new Error('Instance not found'); return i; };
const idir = i => path.join(S.gameDir, 'instances', i.id);
const inside = (i, rel) => { const root = path.resolve(idir(i)), f = path.resolve(root, rel); if (f !== root && !f.startsWith(root + path.sep)) throw new Error('Blocked path: ' + rel); return f; };
function newInstance({ name, mc, loader = 'vanilla', loaderVer = null, perf = false, autoUpdate = true, modpack = false }) {
  name = (name || '').trim(); if (!name) throw new Error('Give the instance a name');
  if (perf && loader === 'vanilla') loader = 'fabric';
  if (loader === 'forge' && mcMinor(mc) < 13) throw new Error('Forge for Minecraft older than 1.13 is not supported yet');
  const i = { id: crypto.randomUUID().slice(0, 8), name, mc, loader, loaderVer, perf, autoUpdate, modpack };
  saveI([...loadI(), i]); fs.mkdirSync(idir(i), { recursive: true }); return i;
}
function extractOverrides(i, z, prefixes) {
  const names = [];
  for (const e of z.getEntries()) for (const p of prefixes)
    if (e.entryName.startsWith(p) && !e.isDirectory) { const d = inside(i, e.entryName.slice(p.length)); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, e.getData()); names.push(path.basename(d)); }
  return names;
}
const writePack = (i, names) => fs.writeFileSync(inside(i, '.jern-pack.json'), JSON.stringify(names));
const readPack = i => { try { return new Set(JSON.parse(fs.readFileSync(inside(i, '.jern-pack.json'), 'utf8'))); } catch { return new Set(); } };

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
// ---------- Forge / NeoForge (official installer, run once per loader version) ----------
function mcMinor(mc) { return String(mc).startsWith('1.') ? parseInt(String(mc).split('.')[1]) : 99; }
async function latestForge(mc) {
  const p = await J('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
  const v = p.promos[`${mc}-recommended`] || p.promos[`${mc}-latest`];
  if (!v) throw new Error(`Forge has no build for Minecraft ${mc}`); return v;
}
async function latestNeo(mc) {
  const r = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml', { headers: UA }); if (!r.ok) throw new Error('NeoForge metadata ' + r.status);
  const vs = [...(await r.text()).matchAll(/<version>([^<]+)<\/version>/g)].map(x => x[1]);
  const rest = String(mc).startsWith('1.') ? String(mc).slice(2) : String(mc), pre = (rest.split('.').length === 1 ? rest + '.0' : rest) + '.';
  const c = vs.filter(v => v.startsWith(pre)); if (!c.length) throw new Error(`NeoForge has no build for Minecraft ${mc}`);
  const stable = c.filter(v => !/alpha|beta|rc/i.test(v)); return (stable.length ? stable : c).pop();
}
function runInstaller(java, args) {
  return new Promise(res => {
    let tail = ''; const p = spawn(java, args, { cwd: S.gameDir });
    const on = d => { const s = d.toString(); tail = (tail + s).slice(-2000); s.split(/\r?\n/).filter(Boolean).forEach(l => log('[installer] ' + l.slice(0, 160))); };
    p.stdout.on('data', on); p.stderr.on('data', on);
    p.on('error', e => res({ code: -1, tail: e.message })); p.on('close', code => res({ code, tail }));
  });
}
// MCLC builds its own JVM args and ignores the ones in the loader's version file, which modern Forge/NeoForge need.
// So: merge vanilla + loader game args once, and return the loader's JVM args with every placeholder resolved.
async function prepLoaderJson(jf, id, mc) {
  const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
  if (!j._jernMerged) {
    const man = await J('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'), v = man.versions.find(x => x.id === (j.inheritsFrom || mc));
    if (v && j.arguments?.game) { const van = await J(v.url); j.arguments.game = [...(van.arguments?.game || []), ...j.arguments.game]; }
    j._jernMerged = true; fs.writeFileSync(jf, JSON.stringify(j));
  }
  return j;
}
function loaderJvmArgs(j, id) {
  const lib = path.resolve(S.gameDir, 'libraries'), plat = process.platform;
  const sub = s => s.replaceAll('${library_directory}', lib).replaceAll('${classpath_separator}', path.delimiter).replaceAll('${version_name}', id).replaceAll('${launcher_name}', 'JernClient').replaceAll('${launcher_version}', '1.2');
  const ok = a => !a.rules || a.rules.every(r => { const os_ = r.os?.name, m = !os_ || (os_ === 'windows' ? plat === 'win32' : os_ === 'osx' ? plat === 'darwin' : plat === 'linux'); return r.action === 'allow' ? m : !m; });
  const list = []; for (const a of j.arguments?.jvm || []) { if (typeof a === 'string') list.push(a); else if (ok(a)) list.push(...[].concat(a.value)); }
  const out = [];
  for (let k = 0; k < list.length; k++) {
    const s = list[k]; if (s === '-cp' || s === '-classpath') { k++; continue; }
    if (s.includes('${classpath}') || s.includes('${natives_directory}')) continue;
    const r = sub(s); if (!r.includes('${')) out.push(r);
  }
  return out;
}
async function ensureForgeLike(i) {
  const forge = i.loader === 'forge', label = forge ? 'Forge' : 'NeoForge';
  if (forge && mcMinor(i.mc) < 13) throw new Error('Forge for Minecraft older than 1.13 is not supported yet');
  const v = i.loaderVer || (forge ? await latestForge(i.mc) : await latestNeo(i.mc)), id = forge ? `${i.mc}-forge-${v}` : `neoforge-${v}`;
  const jf = path.join(S.gameDir, 'versions', id, id + '.json');
  if (!fs.existsSync(jf)) {
    log(`Installing ${label} ${v} (first time only - this can take a few minutes)…`);
    const url = forge ? `https://maven.minecraftforge.net/net/minecraftforge/forge/${i.mc}-${v}/forge-${i.mc}-${v}-installer.jar` : `https://maven.neoforged.net/releases/net/neoforged/neoforge/${v}/neoforge-${v}-installer.jar`;
    const jar = await dl(url, path.join(S.gameDir, 'installers', path.basename(url)));
    const lp = path.join(S.gameDir, 'launcher_profiles.json'); if (!fs.existsSync(lp)) wr(lp, { profiles: {}, selectedProfile: '', version: 3 });
    const java = (await ensureJava(i.mc)).replace(/javaw\.exe$/i, 'java.exe');
    let last = '';
    for (const flag of forge ? ['--installClient'] : ['--install-client', '--installClient']) { last = (await runInstaller(java, ['-jar', jar, flag, S.gameDir])).tail; if (fs.existsSync(jf)) break; }
    if (!fs.existsSync(jf)) throw new Error(`${label} installer failed: ${last.slice(-300).trim()}`);
  }
  return { id, jvm: loaderJvmArgs(await prepLoaderJson(jf, id, i.mc), id) };
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
async function installMrpack(file) {
  const z = new AdmZip(file), idx = JSON.parse(z.readAsText('modrinth.index.json')), d = idx.dependencies;
  const lk = ['fabric-loader', 'quilt-loader', 'neoforge', 'forge'].find(k => d[k]);
  const i = newInstance({ name: idx.name, mc: d.minecraft, loader: lk ? lk.replace('-loader', '') : 'vanilla', loaderVer: lk ? d[lk] : null, autoUpdate: false, modpack: true }), names = [];
  for (const x of idx.files) { if (x.env?.client === 'unsupported') continue; await dl(x.downloads[0], inside(i, x.path)); names.push(path.basename(x.path)); log('✓ ' + x.path); }
  names.push(...extractOverrides(i, z, ['overrides/', 'client-overrides/'])); writePack(i, names); return i;
}
async function packFromMr(pid) {
  const v = (await J(`https://api.modrinth.com/v2/project/${pid}/version`))[0]; if (!v) throw new Error('Modpack has no versions');
  const f = v.files.find(x => x.primary) || v.files[0];
  return installMrpack(await dl(f.url, path.join(os.tmpdir(), 'jern-mr.zip')));
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
async function installCfpack(file) {
  const z = new AdmZip(file), man = JSON.parse(z.readAsText('manifest.json'));
  const ml = (man.minecraft.modLoaders.find(x => x.primary) || man.minecraft.modLoaders[0])?.id || '', ln = ml.split('-')[0], lv = ml.split('-').slice(1).join('-');
  if (ml && !['fabric', 'quilt', 'forge', 'neoforge'].includes(ln)) throw new Error('Unsupported mod loader: ' + ln);
  const i = newInstance({ name: man.name, mc: man.minecraft.version, loader: ln || 'vanilla', loaderVer: lv || null, autoUpdate: false, modpack: true }), names = [];
  for (const x of man.files) {
    const d = (await CF(`/mods/${x.projectID}/files/${x.fileID}`)).data;
    if (d.downloadUrl) { await dl(d.downloadUrl, inside(i, 'mods/' + d.fileName)); names.push(d.fileName); log('✓ ' + d.fileName); } else log('✗ download manually: ' + d.fileName);
  }
  names.push(...extractOverrides(i, z, [(man.overrides || 'overrides') + '/'])); writePack(i, names); return i;
}
async function packFromCf(pid) { const f = await cfFile(pid, null); return installCfpack(await dl(f.downloadUrl, path.join(os.tmpdir(), 'jern-cf.zip'))); }

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
h('cfg:set', p => {
  if (p.gameDir && app.isPackaged && path.resolve(p.gameDir) === path.resolve(path.dirname(process.execPath))) throw new Error("Choose a sub-folder - not the launcher's own folder (an update would clear it).");
  S = { ...S, ...p }; saveS(); writeDD(S.gameDir); return S;
});
h('pick-dir', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
h('versions', async () => { const m = await J('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'); return { latest: m.latest, versions: m.versions.map(v => ({ id: v.id, type: v.type })) }; });
h('versions:installed', () => { const d = path.join(S.gameDir, 'versions'); return fs.existsSync(d) ? fs.readdirSync(d) : []; });
h('versions:remove', n => { const d = path.resolve(S.gameDir, 'versions'), f = path.resolve(d, n); if (!f.startsWith(d + path.sep)) throw new Error('Blocked'); fs.rmSync(f, { recursive: true, force: true }); return true; });

const IMGC = new Map();
const imgData = (i, kind) => { const f = path.join(idir(i), kind === 'icon' ? 'icon.png' : 'cover.jpg'); try { const st = fs.statSync(f), k = f + st.mtimeMs; if (!IMGC.has(k)) IMGC.set(k, `data:image/${kind === 'icon' ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64')); return IMGC.get(k); } catch { return null; } };
function saveImg(i, kind, src) {
  const img = Buffer.isBuffer(src) ? nativeImage.createFromBuffer(src) : nativeImage.createFromPath(src);
  if (img.isEmpty()) throw new Error('Could not read that image');
  const sz = img.getSize(); fs.mkdirSync(idir(i), { recursive: true });
  if (kind === 'icon') { const s = Math.min(sz.width, sz.height); fs.writeFileSync(path.join(idir(i), 'icon.png'), img.crop({ x: Math.floor((sz.width - s) / 2), y: Math.floor((sz.height - s) / 2), width: s, height: s }).resize({ width: 128, height: 128, quality: 'best' }).toPNG()); }
  else { const r = sz.width > 1280 ? img.resize({ width: 1280, quality: 'good' }) : img; fs.writeFileSync(path.join(idir(i), 'cover.jpg'), r.toJPEG(82)); }
}
const cnt = (d, f = () => true) => { try { return fs.readdirSync(d).filter(n => !n.startsWith('.') && f(n)).length; } catch { return 0; } };
h('inst:list', () => loadI().map(i => {
  const d = idir(i), counts = { mod: cnt(path.join(d, 'mods'), n => /\.jar(\.disabled)?$/.test(n)), resourcepack: cnt(path.join(d, 'resourcepacks')), shader: cnt(path.join(d, 'shaderpacks')), schematic: cnt(path.join(d, 'schematics')), world: cnt(path.join(d, 'saves'), n => fs.existsSync(path.join(d, 'saves', n, 'level.dat'))) };
  return { ...i, mods: counts.mod, counts, icon: imgData(i, 'icon'), cover: imgData(i, 'cover') };
}));
h('inst:image', ({ id, kind, file }) => { const i = getI(id); if (file) saveImg(i, kind, file); else fs.rmSync(path.join(idir(i), kind === 'icon' ? 'icon.png' : 'cover.jpg'), { force: true }); return true; });
h('pick-file', async ({ filters, title }) => { const r = await dialog.showOpenDialog(win, { title, properties: ['openFile'], filters }); return r.canceled ? null : r.filePaths[0]; });
h('inst:import', async ({ file }) => {
  const z = new AdmZip(file), names = z.getEntries().map(e => e.entryName);
  if (names.includes('modrinth.index.json')) return installMrpack(file);
  if (names.includes('manifest.json')) return installCfpack(file);
  throw new Error('Not a Modrinth (.mrpack) or CurseForge modpack');
});
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
h('inst:delete', id => { IM.t = 0; const i = getI(id); fs.rmSync(idir(i), { recursive: true, force: true }); saveI(loadI().filter(x => x.id !== id)); return true; });
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
h('content:update', ({ id, type, name }) => { IM.t = 0; const i = getI(id); return updateOne(i, type, name, new Date().toISOString().replace(/[:.]/g, '-')).then(r => { pruneBackups(i); return r; }); });
h('content:updateAll', ({ id, types }) => { IM.t = 0; return updateAllFor(getI(id), types); });
h('content:list', ({ id, type }) => {
  const d = inside(getI(id), DIR[type]); if (!fs.existsSync(d)) return [];
  const pk = readPack(getI(id));
  return fs.readdirSync(d).filter(n => !n.startsWith('.')).map(n => { const st = fs.statSync(path.join(d, n)); return { name: n, size: st.isDirectory() ? 0 : st.size, disabled: n.endsWith('.disabled'), pack: pk.has(n.replace(/\.disabled$/, '')) }; });
});
h('content:import', ({ id, type, file }) => { const i = getI(id), d = inside(i, path.join(DIR[type], path.basename(file))); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(file, d); return path.basename(d); });
h('content:toggle', ({ id, type, name }) => { const i = getI(id), to = name.endsWith('.disabled') ? name.slice(0, -9) : name + '.disabled'; fs.renameSync(inside(i, path.join(DIR[type], name)), inside(i, path.join(DIR[type], to))); return to; });
h('content:remove', ({ id, type, name }) => { IM.t = 0; fs.rmSync(inside(getI(id), path.join(DIR[type], name)), { recursive: true, force: true }); return true; });

let TAGS = null;
h('mr:tags', async () => {
  if (!TAGS) { const [v, c] = await Promise.all([J('https://api.modrinth.com/v2/tag/game_version'), J('https://api.modrinth.com/v2/tag/category')]); TAGS = { releases: v.filter(x => x.version_type === 'release').map(x => x.version), all: v.map(x => x.version), cats: c.map(x => ({ n: x.name, t: x.project_type })) }; }
  return TAGS;
});
const IM = { t: 0, v: null, k: '' };
h('installed:map', async ({ types = ['mod'] }) => {
  if (Date.now() - IM.t < 300000 && IM.v && IM.k === types.join()) return IM.v;
  const out = {};
  for (const i of loadI()) for (const type of types) { try { const { vers } = await lookup(i, type); for (const v of Object.values(vers)) (out[v.project_id] ??= []).push(i.id); } catch {} }
  IM.t = Date.now(); IM.v = out; IM.k = types.join(); return out;
});
h('browse', async ({ src, type, q, page = 1, per = 20, sort = 'relevance', loaders = [], versions = [], cats = [], env = [] }) => {
  const off = (page - 1) * per;
  if (src === 'modrinth') {
    const f = [[`project_type:${type}`]];
    if (versions.length) f.push(versions.map(v => `versions:${v}`));
    if (loaders.length && (type === 'mod' || type === 'modpack')) f.push(loaders.map(l => `categories:${l}`));
    cats.forEach(c => f.push([`categories:${c}`]));
    if (env.includes('client')) f.push(['client_side:required', 'client_side:optional']);
    if (env.includes('server')) f.push(['server_side:required', 'server_side:optional']);
    const r = await J(`https://api.modrinth.com/v2/search?limit=${per}&offset=${off}&index=${sort}&query=${encodeURIComponent(q || '')}&facets=${encodeURIComponent(JSON.stringify(f))}`);
    const LD = ['fabric', 'forge', 'neoforge', 'quilt'];
    return { total: r.total_hits, hits: r.hits.map(x => {
      const cs = (x.display_categories || x.categories || []).filter(c => !LD.includes(c)).slice(0, 3).map(c => ({ t: c.replace(/-/g, ' '), k: 'cat' }));
      const ld = (x.categories || []).filter(c => LD.includes(c)).map(c => ({ t: c, k: 'loader' }));
      return { id: x.project_id, title: x.title, desc: x.description, icon: x.icon_url, author: x.author, downloads: x.downloads, follows: x.follows, updated: x.date_modified, tags: [...ld, ...cs], url: `https://modrinth.com/${x.project_type}/${x.slug}` };
    }) };
  }
  if (!S.cfKey) throw new Error('Add your CurseForge API key in Settings (free at console.curseforge.com)');
  const sf = { relevance: 2, downloads: 6, follows: 2, newest: 11, updated: 3 }[sort] || 2;
  const p = new URLSearchParams({ gameId: 432, classId: { mod: 6, resourcepack: 12, modpack: 4471, shader: 6552 }[type], searchFilter: q || '', pageSize: per, index: off, sortField: sf, sortOrder: 'desc' });
  if (versions[0]) p.set('gameVersion', versions[0]); if (loaders[0] && LT[loaders[0]] && type === 'mod') p.set('modLoaderType', LT[loaders[0]]);
  const r = await CF('/mods/search?' + p);
  return { total: Math.min(r.pagination.totalCount, 10000), hits: r.data.map(x => ({ id: x.id, title: x.name, desc: x.summary, icon: x.logo?.thumbnailUrl, author: x.authors?.[0]?.name, downloads: x.downloadCount, follows: null, updated: x.dateModified, tags: (x.categories || []).slice(0, 4).map(c => ({ t: c.name, k: 'cat' })), url: x.links?.websiteUrl })) };
});
h('install', async ({ src, type, pid, id, icon }) => {
  IM.t = 0;
  if (type === 'modpack') {
    const i = await (src === 'modrinth' ? packFromMr : packFromCf)(pid);
    if (icon) { try { saveImg(i, 'icon', await dl(icon, path.join(os.tmpdir(), 'jern-icon-' + i.id))); } catch {} }
    return [i.name];
  }
  const i = getI(id);
  if (src === 'modrinth') { const have = await installedPids(i, type).catch(() => new Set()); if (have.has(pid)) throw new Error('Already installed in this instance'); return mrInstall(i, pid, type, new Set(type === 'mod' ? have : [])); }
  return cfInstall(i, pid, type);
});

// ---------- worlds ----------
function nbt(buf) {
  let p = 0;
  const str = () => { const n = buf.readUInt16BE(p); p += 2; const s = buf.toString('utf8', p, p + n); p += n; return s; };
  const val = t => {
    switch (t) {
      case 1: return buf.readInt8(p++);
      case 2: { const v = buf.readInt16BE(p); p += 2; return v; }
      case 3: { const v = buf.readInt32BE(p); p += 4; return v; }
      case 4: { const v = buf.readBigInt64BE(p); p += 8; return Number(v); }
      case 5: { const v = buf.readFloatBE(p); p += 4; return v; }
      case 6: { const v = buf.readDoubleBE(p); p += 8; return v; }
      case 7: { const n = buf.readInt32BE(p); p += 4 + n; return null; }
      case 8: return str();
      case 9: { const it = buf.readInt8(p++), n = buf.readInt32BE(p); p += 4; const a = []; for (let k = 0; k < n; k++) a.push(val(it)); return a; }
      case 10: { const o = {}; for (;;) { const tt = buf.readInt8(p++); if (tt === 0) break; const k = str(); o[k] = val(tt); } return o; }
      case 11: { const n = buf.readInt32BE(p); p += 4 + n * 4; return null; }
      case 12: { const n = buf.readInt32BE(p); p += 4 + n * 8; return null; }
      default: throw new Error('bad nbt tag ' + t);
    }
  };
  const t = buf.readInt8(p++); str(); return val(t);
}
function worldInfo(i, dir) {
  const base = path.join(idir(i), 'saves', dir), f = path.join(base, 'level.dat'); if (!fs.existsSync(f)) return null;
  let d = {}; try { d = nbt(zlib.gunzipSync(fs.readFileSync(f))).Data || {}; } catch {}
  const ip = path.join(base, 'icon.png');
  return { dir, name: d.LevelName || dir, mode: ['Survival', 'Creative', 'Adventure', 'Spectator'][d.GameType] || 'Survival', hardcore: !!d.hardcore, diff: ['Peaceful', 'Easy', 'Normal', 'Hard'][d.Difficulty] || null, played: d.LastPlayed || fs.statSync(f).mtimeMs, version: d.Version?.Name || null, icon: fs.existsSync(ip) ? 'data:image/png;base64,' + fs.readFileSync(ip).toString('base64') : null };
}
h('worlds:list', ({ id }) => { const i = getI(id), d = path.join(idir(i), 'saves'); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).map(n => worldInfo(i, n)).filter(Boolean).sort((a, b) => b.played - a.played); });
h('worlds:open', ({ id, dir }) => shell.openPath(inside(getI(id), path.join('saves', dir))));
h('worlds:delete', ({ id, dir }) => { fs.rmSync(inside(getI(id), path.join('saves', dir)), { recursive: true, force: true }); return true; });
h('worlds:backup', ({ id, dir }) => {
  const i = getI(id), src = inside(i, path.join('saves', dir)), z = new AdmZip(); z.addLocalFolder(src, dir);
  const out = inside(i, path.join('backups', `${dir}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`)); fs.mkdirSync(path.dirname(out), { recursive: true }); z.writeZip(out); return out;
});
h('worlds:import', ({ id, file }) => {
  const i = getI(id), z = new AdmZip(file), es = z.getEntries().filter(e => !e.isDirectory), flat = es.some(e => e.entryName === 'level.dat');
  const lv = es.find(e => /(^|\/)level\.dat$/.test(e.entryName)); if (!lv) throw new Error('No level.dat found - is this a Minecraft world?');
  const root = flat ? '' : lv.entryName.replace(/level\.dat$/, ''), name = flat ? path.basename(file, path.extname(file)) : (root.split('/').filter(Boolean).pop() || path.basename(file, path.extname(file)));
  let dest = name, n = 1; while (fs.existsSync(inside(i, path.join('saves', dest)))) dest = `${name} (${++n})`;
  for (const e of es) if (e.entryName.startsWith(root)) { const t = inside(i, path.join('saves', dest, e.entryName.slice(root.length))); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, e.getData()); }
  return dest;
});

// ---------- skins & capes (Microsoft accounts) ----------
const MCS = 'https://api.minecraftservices.com';
const SK = path.join(app.getPath('userData'), 'skins');
const SKJ = path.join(SK, 'skins.json');
const loadSk = () => { try { return JSON.parse(fs.readFileSync(SKJ, 'utf8')); } catch { return []; } };
const saveSk = l => wr(SKJ, l);
const pngSize = b => (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
function addSkin(buf, name, variant, srcUrl) {
  const sz = pngSize(buf); if (!sz || sz[0] !== 64 || ![32, 64].includes(sz[1])) throw new Error('A skin must be a 64x64 (or 64x32) PNG');
  const l = loadSk(), id = crypto.randomUUID().slice(0, 8); fs.mkdirSync(SK, { recursive: true }); fs.writeFileSync(path.join(SK, id + '.png'), buf);
  l.unshift({ id, name, variant: variant || 'classic', src: srcUrl || null }); saveSk(l); return id;
}
const rawGet = async u => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return Buffer.from(await r.arrayBuffer()); };
async function msAuth(accId) { const a = A.list.find(x => x.id === accId); if (!a || a.type !== 'ms') throw new Error('Skins and capes can only be changed on Microsoft accounts'); return { Authorization: 'Bearer ' + (await resolveAuth(a)).access_token, ...UA }; }
h('skin:profile', async accId => {
  const r = await fetch(MCS + '/minecraft/profile', { headers: await msAuth(accId) }); if (!r.ok) throw new Error('Could not load profile (' + r.status + ')');
  const p = await r.json(), cur = (p.skins || []).find(s => s.state === 'ACTIVE');
  if (cur && !loadSk().some(s => s.src === cur.url)) { try { addSkin(await rawGet(cur.url), 'Current skin', (cur.variant || 'classic').toLowerCase(), cur.url); } catch {} }
  return { skin: cur ? { url: cur.url, variant: (cur.variant || 'classic').toLowerCase() } : null, capes: (p.capes || []).map(c => ({ id: c.id, alias: c.alias, url: c.url, active: c.state === 'ACTIVE' })) };
});
h('skin:lib', () => loadSk().map(s => { let data = null; try { data = 'data:image/png;base64,' + fs.readFileSync(path.join(SK, s.id + '.png')).toString('base64'); } catch {} return { ...s, data }; }).filter(s => s.data));
h('skin:add', async ({ q, file }) => {
  if (file) return addSkin(fs.readFileSync(file), path.basename(file, path.extname(file)), 'classic');
  q = (q || '').trim(); if (!q) throw new Error('Type a player name, UUID or texture link');
  const um = q.match(/namemc\.com\/(?:profile\/)?([\w.-]+)/i); if (um) q = um[1];
  if (/^https:\/\/textures\.minecraft\.net\//.test(q)) return addSkin(await rawGet(q), 'Texture', 'classic', q);
  let uuid = q.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(uuid)) { const u = await J('https://api.mojang.com/users/profiles/minecraft/' + encodeURIComponent(q)).catch(() => null); if (!u) throw new Error('Player not found'); uuid = u.id; q = u.name; }
  const prof = await J('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid), tex = JSON.parse(Buffer.from(prof.properties.find(x => x.name === 'textures').value, 'base64').toString()).textures.SKIN;
  if (!tex) throw new Error('That player has no custom skin');
  return addSkin(await rawGet(tex.url), prof.name || q, tex.metadata?.model === 'slim' ? 'slim' : 'classic', tex.url);
});
h('skin:remove', id => { saveSk(loadSk().filter(s => s.id !== id)); fs.rmSync(path.join(SK, id + '.png'), { force: true }); return true; });
h('skin:apply', async ({ acc, id, variant }) => {
  const s = loadSk().find(x => x.id === id); if (!s) throw new Error('Skin not found');
  const fd = new FormData(); fd.append('variant', variant || s.variant || 'classic'); fd.append('file', new Blob([fs.readFileSync(path.join(SK, id + '.png'))], { type: 'image/png' }), 'skin.png');
  const r = await fetch(MCS + '/minecraft/profile/skins', { method: 'POST', headers: await msAuth(acc), body: fd }); if (!r.ok) throw new Error('Minecraft rejected the skin (' + r.status + ')'); return true;
});
h('skin:reset', async acc => { const r = await fetch(MCS + '/minecraft/profile/skins/active', { method: 'DELETE', headers: await msAuth(acc) }); if (!r.ok) throw new Error('Reset failed (' + r.status + ')'); return true; });
h('skin:cape', async ({ acc, capeId }) => {
  const hd = await msAuth(acc), r = capeId ? await fetch(MCS + '/minecraft/profile/capes/active', { method: 'PUT', headers: { ...hd, 'Content-Type': 'application/json' }, body: JSON.stringify({ capeId }) }) : await fetch(MCS + '/minecraft/profile/capes/active', { method: 'DELETE', headers: hd });
  if (!r.ok) throw new Error('Cape change failed (' + r.status + ')'); return true;
});

const JVM = ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=100', '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC', '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40', '-XX:G1HeapRegionSize=8M', '-XX:G1ReservePercent=20', '-XX:InitiatingHeapOccupancyPercent=15', '-XX:+PerfDisableSharedMem'];
h('inst:launch', async id => {
  const i = getI(id), acc = A.list.find(x => x.id === A.sel);
  if (!acc) throw new Error('Add an account first (bottom-left)');
  send('state', { id, s: 'launching' });
  try {
    const auth = await resolveAuth(acc), javaPath = await ensureJava(i.mc);
    let custom, loaderArgs = [];
    if (i.loader === 'forge' || i.loader === 'neoforge') { const r = await ensureForgeLike(i); custom = r.id; loaderArgs = r.jvm; } else custom = await ensureLoader(i);
    if (i.perf && i.loader === 'fabric') await ensurePerfMods(i);
    if (i.autoUpdate) { log('Checking for mod and pack updates…'); try { const r = await updateAllFor(i); log(r.done.length ? `Updated ${r.done.length} item(s)` : 'Everything is up to date'); } catch (e) { log('Auto-update skipped: ' + e.message); } }
    const args = [...(i.perf ? JVM : []), ...loaderArgs];
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
    const p = await L.launch({ authorization: auth, root: S.gameDir, javaPath, overrides: { gameDirectory: idir(i), detached: true }, version: { number: i.mc, type: 'release', custom }, memory: { max: (i.ram || S.ramMax) + 'M', min: '1024M' }, customArgs: args });
    if (!p) throw new Error('Launch failed - see the Log tab');
    { const l = loadI(), x = l.find(y => y.id === id); if (x) { x.lastPlayed = Date.now(); saveI(l); } }
    send('state', { id, s: 'running' }); setTimeout(after, 20000); return true;
  } catch (e) { send('state', { id, s: 'closed' }); throw e; }
});

app.whenReady().then(() => {
  const ico = path.join(__dirname, 'build', 'icon.ico');
  win = new BrowserWindow({ width: 1280, height: 800, minWidth: 980, minHeight: 620, backgroundColor: '#000000', title: 'Jern Client', titleBarStyle: 'hidden', titleBarOverlay: { color: '#000000', symbolColor: '#ffffff', height: 36 }, icon: fs.existsSync(ico) ? ico : undefined, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.removeMenu(); win.loadFile('renderer/index.html');
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && i.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools(); });
});
app.on('window-all-closed', () => app.quit());
