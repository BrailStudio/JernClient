'use strict';
/* ================= core helpers ================= */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const c=async(k,a)=>{const r=await window.jern.call(k,a);if(!r.ok)throw new Error(r.error);return r.data};
const E=(t,p={},...k)=>{const e=document.createElement(t);for(const[a,v]of Object.entries(p)){if(a==='class')e.className=v;else if(a==='text')e.textContent=v;else if(a.startsWith('on'))e[a]=v;else if(a==='style')e.style.cssText=v;else if(v===false||v==null){}else e.setAttribute(a,v===true?'':v)}e.append(...k.flat(Infinity).filter(x=>x!=null&&x!==false&&x!==true&&x!==0));return e};
for(const m of ['replaceChildren','append','prepend']){const o=Element.prototype[m];Element.prototype[m]=function(...k){return o.apply(this,k.flat(Infinity).filter(x=>x!=null&&x!==false&&x!==true&&x!==0))}}
const PATHS={
 play:'<path d="M7 4.5v15l13-7.5z"/>',playf:'<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
 cubes:'<path d="M12 2.8l4.2 2.4v4.8L12 12.4 7.8 10V5.2zM6.4 12.6l4.2 2.4v4.8L6.4 22.2 2.2 19.8V15zM17.6 12.6l4.2 2.4v4.8l-4.2 2.4-4.2-2.4V15z"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
 logs:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 download:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',
 first:'<path d="m11 6-6 6 6 6M19 6l-6 6 6 6"/>',last:'<path d="m13 6 6 6-6 6M5 6l6 6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',up:'<path d="m6 15 6-6 6 6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',share:'<path d="M12 15V3M7 8l5-5 5 5M5 14v6h14v-6"/>',refresh:'<path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 upc:'<circle cx="12" cy="12" r="9"/><path d="M12 16V8M8.5 11.5 12 8l3.5 3.5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
 dl:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
 import:'<path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',cube:'<path d="M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',pack:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>'};
const I=(k,s)=>{const e=document.createElement('span');e.className='ic';e.innerHTML=`<svg viewBox="0 0 24 24"${s?` style="width:${s}px;height:${s}px"`:''}>${PATHS[k]||''}</svg>`;return e};
const Bt=(label,o={})=>E('button',{class:'btn '+(o.cls||''),title:o.title,onclick:o.onclick,disabled:o.disabled===true},o.icon&&I(o.icon),label&&E('span',{text:label}));
const IB=(icon,title,onclick,cls='')=>E('button',{class:'ibtn '+cls,title,'aria-label':title,onclick},I(icon));
const toggle=(on,fn)=>{const t=E('button',{class:'tgl'+(on?' on':''),role:'switch','aria-checked':on?'true':'false',onclick:e=>{e.stopPropagation();const v=!t.classList.contains('on');t.classList.toggle('on',v);t.setAttribute('aria-checked',String(v));fn&&fn(v)}},E('i'));return t};
const seg=(opts,val,fn)=>E('div',{class:'seg'},...opts.map(([v,l,n])=>E('button',{class:v===val?'on':'',title:l.startsWith('@')?v:l,'aria-label':l.startsWith('@')?v:l,onclick:()=>fn(v)},typeof l==='string'&&l.startsWith('@')?I(l.slice(1)):E('span',{text:l}),n!=null&&E('b',{text:String(n)}))));
const sel=(opts,val,fn,cls='')=>{const s=E('select',{class:cls,onchange:()=>fn(s.value)},...opts.map(([v,l])=>E('option',{value:v,text:l})));s.value=val;return s};
const chip=(t,k='')=>E('span',{class:'chip '+k,text:t});
const empty=(h,p,...k)=>E('div',{class:'empty'},E('b',{text:h}),p&&E('p',{text:p}),...k);
const fmt=n=>n==null?'':n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(n>=1e8?1:2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':''+n;
const ago=d=>{const s=(Date.now()-new Date(d))/1000;if(isNaN(s))return'';for(const[k,n]of [[31536e3,'y'],[2592e3,'mo'],[86400,'d'],[3600,'h'],[60,'m']])if(s>=k)return Math.floor(s/k)+n+' ago';return'just now'};
const agoL=d=>{const s=(Date.now()-new Date(d))/1000;if(isNaN(s))return'';for(const[k,n]of [[31536e3,'year'],[2592e3,'month'],[86400,'day'],[3600,'hour'],[60,'minute']])if(s>=k){const v=Math.floor(s/k);return v+' '+n+(v>1?'s':'')+' ago'}return'just now'};
const fsize=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const hue=s=>[...s].reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7)%360;
const loaderName=i=>({vanilla:'Vanilla',fabric:'Fabric',quilt:'Quilt',forge:'Forge',neoforge:'NeoForge'})[i.loader]||i.loader;
const played=i=>i.lastPlayed?'Played '+ago(i.lastPlayed):'Never played';
const ACCENTS={orange:['#f26b21','#ff8a3d'],blue:['#2b6de0','#4a85ee'],cyan:['#0fb5cc','#3fd3e8'],violet:['#7a5cf5','#9a82ff'],green:['#2fb67c','#4fd69b'],rose:['#e0527a','#f07a9b']};
function setAccent(k){const a=ACCENTS[k]||ACCENTS.orange,s=document.documentElement.style;s.setProperty('--acc',a[0]);s.setProperty('--acc2',a[1]);try{localStorage.setItem('accent',k)}catch{}}
try{setAccent(localStorage.getItem('accent')||'orange')}catch{setAccent('orange')}

/* ================= state ================= */
let V={latest:{release:''},versions:[]},ACC={list:[],sel:null},INST=[],CFG={},LOG='',TAGS=null,IMAP={};
let view='home',cur=null,tab='mod';
const state={},TK=[];
const DS={src:'modrinth',type:'mod',q:'',sort:'relevance',page:1,per:20,loaders:[],versions:[],cats:[],env:[],target:null,mode:'list',filters:true,open:{loaders:true,versions:true,env:false,cats:true},allV:false,vq:''};
const byPlayed=(a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0);

/* ================= visuals ================= */
const coverStyle=i=>{const h=hue(i.name);return i.cover?`background-image:url("${i.cover}")`:`background-image:radial-gradient(120% 100% at 15% 0%,hsl(${h} 60% 32%/.6),transparent 62%),radial-gradient(90% 90% at 100% 100%,hsl(${(h+40)%360} 55% 22%/.5),transparent 60%),linear-gradient(160deg,#15151a,#050506)`};
function avatarEl(i,s=40,cls=''){const d=E('div',{class:'iav '+cls,style:`width:${s}px;height:${s}px;font-size:${Math.round(s*.42)}px;border-radius:${Math.round(s*.28)}px`});
 if(i.icon)d.style.backgroundImage=`url("${i.icon}")`;else{const h=hue(i.name);d.style.background=`linear-gradient(135deg,hsl(${h} 55% 34%),hsl(${(h+45)%360} 55% 20%))`;d.textContent=i.name[0].toUpperCase()}return d}
function accAvatar(a,s=40){const d=E('div',{class:'av',style:`width:${s}px;height:${s}px;border-radius:${Math.round(s*.28)}px;font-size:${Math.round(s*.4)}px;background-color:#1c1c22`});
 if(!a){d.append(I('user'));return d}d.textContent=a.name[0].toUpperCase();const hh=hue(a.name);
 if(a.type==='ms'){d.style.backgroundImage=`url(https://mc-heads.net/avatar/${a.uuid}/${s*2})`;d.textContent=''}
 else if(a.type==='ely'){const u=`https://skinsystem.ely.by/skins/${encodeURIComponent(a.name)}.png`,im=new Image();d.style.background=`hsl(${hh} 45% 30%)`;
  im.onload=()=>{d.textContent='';d.style.cssText+=`;background-color:#1c1c22;background-image:url(${u}),url(${u});background-size:${s*8}px ${s*8}px;background-position:-${s}px -${s}px,-${s*5}px -${s}px;image-rendering:pixelated`};im.src=u}
 else d.style.background=`linear-gradient(135deg,hsl(${hh} 50% 34%),hsl(${(hh+40)%360} 50% 20%))`;return d}

/* ================= modal / toast / tasks ================= */
let askRes=null;
const close=()=>{$('#veil').classList.remove('on');if(askRes){askRes(false);askRes=null}};
const modal=(...k)=>{$('#modal').replaceChildren(...k);$('#veil').classList.add('on')};
$('#veil').onclick=e=>{if(e.target.id==='veil')close()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();$('#pop').classList.remove('on')}});
const ask=(title,text,ok='OK')=>new Promise(res=>{askRes=res;const done=v=>{askRes=null;close();res(v)};modal(E('h2',{text:title}),E('p',{class:'msg',text}),E('div',{class:'row'},Bt(ok,{cls:'bad',onclick:()=>done(true)}),Bt('Cancel',{onclick:()=>done(false)})))});
const toast=(m,k='')=>{const t=E('div',{class:'toast '+k,text:m});document.body.append(t);setTimeout(()=>t.remove(),k==='err'?5200:3000)};
function task(title,fn){const t={title,s:'run'};TK.unshift(t);TK.length=Math.min(TK.length,10);drawTop();return fn().then(r=>{t.s='done';drawTop();return r},e=>{t.s='err';t.msg=e.message;drawTop();throw e})}

/* ================= navigation ================= */
const H={list:[],i:-1};
const snap=()=>({view,cur,tab,dtype:DS.type,target:DS.target});
function setTarget(id){DS.target=id;const i=INST.find(x=>x.id===id);if(i){DS.versions=[i.mc];DS.loaders=i.loader!=='vanilla'&&['mod','modpack'].includes(DS.type)?[i.loader]:[]}DS.page=1}
function apply(s){view=s.view;cur=s.cur;tab=s.tab;if(DS.type!==s.dtype){DS.type=s.dtype;DS.cats=[];DS.page=1;if(!['mod','modpack'].includes(DS.type))DS.loaders=[]}if(DS.target!==s.target)setTarget(s.target)}
function navigate(p){const s={...snap(),...p},last=H.list[H.i];if(!last||JSON.stringify(last)!==JSON.stringify(s)){H.list=H.list.slice(0,H.i+1);H.list.push(s);H.i++}apply(s);draw()}
function step(d){const n=H.i+d;if(n<0||n>=H.list.length)return;H.i=n;apply(H.list[n]);draw()}
window.addEventListener('mouseup',e=>{if(e.button===3)step(-1);if(e.button===4)step(1)});
document.addEventListener('keydown',e=>{if(e.altKey&&e.key==='ArrowLeft')step(-1);if(e.altKey&&e.key==='ArrowRight')step(1);
 if(e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){const s=$('.field input');if(s){e.preventDefault();s.focus()}}});
async function refreshInst(){INST=await c('inst:list')}

/* ================= chrome: rail + top bar ================= */
function drawRail(){const cu=ACC.list.find(a=>a.id===ACC.sel);
 const rb=(v,ic,t)=>E('button',{class:'rbtn'+(view===v?' on':''),title:t,'aria-label':t,onclick:async()=>{await refreshInst();navigate({view:v})}},I(ic));
 const logo=E('img',{class:'rlogo',src:'logo.png',alt:'Jern Client',onclick:()=>navigate({view:'home'})});
 $('#rail').replaceChildren(logo,E('div',{class:'rsep'}),rb('home','play','Home'),rb('inst','cubes','Instances'),rb('discover','compass','Discover'),E('div',{class:'rsep'}),
  ...INST.slice().sort(byPlayed).slice(0,6).map(i=>E('button',{class:'rpin'+(view==='detail'&&cur===i.id?' on':''),title:i.name,'aria-label':i.name,onclick:()=>navigate({view:'detail',cur:i.id,tab:'mod'})},avatarEl(i,42))),
  E('div',{class:'rgrow'}),E('div',{class:'rsep'}),rb('logs','logs','Logs'),rb('settings','gear','Settings'),
  E('button',{class:'rbtn'+(view==='accounts'?' on':''),title:cu?cu.name:'Accounts','aria-label':'Accounts',onclick:()=>navigate({view:'accounts'})},accAvatar(cu,38)))}
function drawTop(){const run=TK.filter(t=>t.s==='run').length,err=TK.filter(t=>t.s==='err').length,i=view==='detail'?INST.find(x=>x.id===cur):null;
 const tb=(ic,t,fn,dis)=>E('button',{class:'tbb',title:t,'aria-label':t,onclick:fn,disabled:dis===true},I(ic,16));
 $('#top').replaceChildren(E('div',{class:'tl'},tb('left','Back (Alt+Left)',()=>step(-1),H.i<=0),tb('right','Forward (Alt+Right)',()=>step(1),H.i>=H.list.length-1),
  i&&E('div',{class:'crumb'},E('button',{text:'Instances',onclick:()=>navigate({view:'inst'})}),E('span',{text:'›'}),avatarEl(i,18),E('b',{text:i.name}))),
  E('div',{class:'ttl',text:'JERN'}),
  E('div',{class:'tr'},E('button',{class:'tbtn',title:'Tasks','aria-label':'Tasks',onclick:e=>{e.stopPropagation();tasksPop()}},I('download',17),(run+err)>0&&E('i',{class:'badge',text:String(run||err)}))))}
function tasksPop(){const p=$('#pop');if(p.classList.toggle('on'))p.replaceChildren(...(TK.length?TK.map(t=>E('div',{class:'ti '+t.s},E('i',{class:'d'}),E('span',{text:t.title+(t.msg?' - '+t.msg:'')}))):[E('p',{class:'msg',style:'padding:8px',text:'No recent tasks.'})]))}
document.addEventListener('click',e=>{if(!$('#pop').contains(e.target))$('#pop').classList.remove('on')});

/* ================= accounts: add / login modals ================= */
const TL={ms:'Microsoft',ely:'Ely.by',offline:'Offline'};
const PROV=[['ms','Microsoft','Premium account: online servers, your skin and capes.'],['ely','Ely.by','Ely.by account with custom skins.'],['offline','Offline','No login. Singleplayer and offline-mode servers.']];
async function loadAcc(){ACC=await c('acc:list');drawRail()}
function addAccountModal(){modal(E('h2',{text:'Add account'}),E('p',{class:'msg',text:'Choose how you want to sign in.'}),
 ...PROV.map(([k,n,d])=>E('button',{class:'prov',onclick:()=>loginForm(k)},E('div',{class:'pi',text:n[0]}),E('div',{class:'t'},E('b',{text:n}),E('small',{text:d})),I('right'))),Bt('Cancel',{onclick:close}))}
function loginForm(kind){
 const err=E('p',{class:'msg e'}),u=E('input',{placeholder:kind==='ely'?'Username or email':'Username (3-16 letters, numbers, _)',autocomplete:'off'}),pw=E('input',{type:'password',placeholder:'Password   (with 2FA: password:CODE)'}),label=kind==='ms'?'Sign in with Microsoft':'Add account',go=Bt(label,{cls:'pri'});
 const submit=async()=>{go.disabled=true;err.textContent='';if(kind==='ms')go.textContent='Waiting for the Microsoft window…';
  try{const a=await c(kind==='ms'?'login:ms':kind==='ely'?'login:ely':'login:offline',kind==='ely'?{user:u.value,pass:pw.value}:u.value);await loadAcc();close();toast('Signed in as '+a.name);if(view==='accounts')draw()}
  catch(e){err.textContent=e.message;go.disabled=false;go.textContent=label}};
 go.onclick=submit;u.onkeydown=pw.onkeydown=e=>{if(e.key==='Enter')submit()};
 modal(E('button',{class:'crumbb',text:'‹ Back',onclick:addAccountModal}),E('h2',{text:TL[kind]+' account'}),
  E('p',{class:'msg',text:kind==='ms'?'A Microsoft window opens. Sign in with the account that owns Minecraft. You stay signed in.':kind==='ely'?'Sign in with your Ely.by account. Your Ely.by skin works in game.':'Offline accounts only work in singleplayer and on servers with online-mode off.'}),
  kind!=='ms'&&E('label',{class:'f',text:kind==='ely'?'Account':'Username'}),kind!=='ms'&&u,kind==='ely'&&E('label',{class:'f',text:'Password'}),kind==='ely'&&pw,
  E('div',{style:'height:16px'}),err,E('div',{class:'row'},go,Bt('Cancel',{onclick:close})));setTimeout(()=>u.focus(),50)}

/* ================= launching ================= */
async function play(id){const n=INST.find(x=>x.id===id)?.name||'instance';try{LOG='';await task('Launch '+n,()=>c('inst:launch',id))}catch(e){toast(e.message,'err');LOG+='ERROR: '+e.message+'\n'}}

/* ================= home ================= */
function icard(i){const go=()=>navigate({view:'detail',cur:i.id,tab:'mod'}),st=state[i.id]||'closed';
 return E('div',{class:'icard',tabindex:'0',role:'button',onclick:go,onkeydown:e=>{if(e.key==='Enter')go()}},
  E('div',{class:'icover',style:coverStyle(i)},E('div',{class:'ib'},avatarEl(i,40)),E('div',{class:'it'},E('h3',{text:i.name}),E('div',{class:'tags'},chip(i.mc),chip(loaderName(i)),i.perf&&chip('Boost','loader')))),
  E('div',{class:'ifoot'},E('span',{text:played(i)}),Bt(st==='closed'?'Play':st==='launching'?'Launching…':'Running',{cls:'sm',icon:'playf',disabled:st!=='closed',onclick:e=>{e.stopPropagation();play(i.id)}})))}
function pageHome(){const cu=ACC.list.find(a=>a.id===ACC.sel),rec=INST.slice().sort(byPlayed),last=rec[0];
 $('#page').replaceChildren(E('div',{class:'view'},
  E('div',{class:'vhead'},E('div',{},E('h1',{style:'font-size:26px',text:cu?'Welcome back, '+cu.name:'Welcome to Jern Client'}),E('div',{class:'sub',text:last?'Pick up where you left off.':'Create your first instance to get started.'})),E('span',{class:'sp'}),
   last?Bt('Play '+last.name,{cls:'pri big',icon:'playf',onclick:()=>play(last.id)}):Bt('Create instance',{cls:'pri big',icon:'plus',onclick:createModal})),
  !cu&&E('div',{class:'note warn'},E('div',{style:'flex:1'},E('b',{text:'No account yet'}),E('div',{class:'sub',text:'Add a Microsoft, Ely.by or offline account to play.'})),Bt('Add account',{cls:'pri',onclick:addAccountModal})),
  rec.length>0&&E('h2',{class:'sec',text:'Jump back in'}),rec.length>0&&E('div',{class:'igrid',style:'margin-bottom:30px'},...rec.slice(0,3).map(icard)),
  E('h2',{class:'sec',text:'Discover'}),
  E('div',{class:'tiles'},...[['mod','cube','Mods','Browse mods from Modrinth and CurseForge.'],['resourcepack','pack','Resource packs & shaders','Change how your game looks.'],['modpack','plus','Modpacks','Install a full pack as its own instance.']].map(([ty,ico,n,d])=>
   E('button',{class:'tile',onclick:()=>navigate({view:'discover',dtype:ty,target:null})},I(ico),E('b',{text:n}),E('span',{class:'sub',text:d})))),
  E('div',{class:'note'},I('bolt',22),E('div',{},E('b',{text:'Boost mode'}),E('div',{class:'sub',text:'Installs Sodium, Lithium, FerriteCore, ModernFix, Entity Culling and ImmediatelyFast, with tuned Java flags. Gains depend on your hardware.'})))))}

/* ================= instances ================= */
let iq='',isort='played',iview='grid';
function pageInst(){const grid=E('div',{class:iview==='grid'?'igrid':'ilist'});
 const q=E('input',{placeholder:'Filter instances…',value:iq,oninput:()=>{iq=q.value;fill()}});
 function fill(){const l=INST.filter(i=>i.name.toLowerCase().includes(iq.toLowerCase()));l.sort(isort==='name'?(a,b)=>a.name.localeCompare(b.name):byPlayed);
  grid.className=iview==='grid'?'igrid':'ilist';
  grid.replaceChildren(...l.map(i=>iview==='grid'?icard(i):E('div',{class:'irow',onclick:()=>navigate({view:'detail',cur:i.id,tab:'mod'})},avatarEl(i,44),E('div',{class:'t'},E('b',{text:i.name}),E('div',{class:'sub',text:`${i.mc} · ${loaderName(i)} · ${played(i)}`})),Bt('Play',{cls:'sm',icon:'playf',onclick:e=>{e.stopPropagation();play(i.id)}}))),
   iview==='grid'?E('button',{class:'icard add',onclick:createModal},E('span',{class:'plus'},I('plus',20)),E('span',{text:'New instance'})):null)}
 $('#page').replaceChildren(E('div',{class:'view'},E('div',{class:'vhead'},E('h1',{text:'Instances'}),E('span',{class:'sub',text:INST.length+' instance'+(INST.length===1?'':'s')}),E('span',{class:'sp'}),
  E('div',{class:'field',style:'width:220px;height:36px'},I('search',16),q),sel([['played','Last played'],['name','Name']],isort,v=>{isort=v;fill()}),
  seg([['grid','@grid'],['list','@list']],iview,v=>{iview=v;pageInst()}),
  IB('import','Import modpack (.mrpack / CurseForge zip)',importPack),Bt('New instance',{cls:'pri',icon:'plus',onclick:createModal})),grid));fill()}
async function importPack(){try{const f=await c('pick-file',{title:'Import modpack',filters:[{name:'Modpack',extensions:['mrpack','zip']}]});if(!f)return;const i=await task('Import modpack',()=>c('inst:import',{file:f}));await refreshInst();drawRail();toast('Created '+i.name);navigate({view:'inst'})}catch(e){toast(e.message,'err')}}
function createModal(){
 const name=E('input',{placeholder:'My instance'}),ver=E('select'),sn=E('input',{type:'checkbox'}),ld=sel([['vanilla','Vanilla'],['fabric','Fabric'],['quilt','Quilt'],['neoforge','NeoForge'],['forge','Forge (1.13+)']],'vanilla',()=>{}),err=E('p',{class:'msg e'});
 const perf=toggle(false,v=>{if(v&&ld.value==='vanilla')ld.value='fabric'});
 const fill=()=>{ver.replaceChildren(...V.versions.filter(v=>sn.checked||v.type==='release').map(v=>E('option',{value:v.id,text:v.id})));ver.value=V.latest.release};fill();sn.onchange=fill;
 modal(E('h2',{text:'New instance'}),E('label',{class:'f',text:'Name'}),name,E('label',{class:'f',text:'Minecraft version'}),ver,E('label',{class:'ck',style:'margin-top:8px'},sn,'Show snapshots and old versions'),
  E('label',{class:'f',text:'Mod loader'}),ld,E('div',{class:'set-opt'},perf,E('div',{},E('b',{text:'Boost'}),E('div',{class:'sub',text:'Tuned Java flags, plus FPS mods on Fabric'}))),
  E('div',{style:'height:14px'}),err,E('div',{class:'row'},Bt('Create',{cls:'pri',onclick:async()=>{try{await c('inst:create',{name:name.value,mc:ver.value,loader:ld.value,perf:perf.classList.contains('on')});await refreshInst();drawRail();close();toast('Instance created');navigate({view:'inst'})}catch(e){err.textContent=e.message}}}),Bt('Cancel',{onclick:close})));setTimeout(()=>name.focus(),50)}
function editModal(i){
 let useDef=!i.ram;const name=E('input',{value:i.name}),perf=toggle(i.perf),au=toggle(i.autoUpdate),ram=E('input',{type:'range',min:1024,max:16384,step:512,value:i.ram||CFG.ramMax||4096,style:'width:100%;padding:0;height:20px;accent-color:var(--acc)'}),rv=E('b');
 const lab=()=>rv.textContent=useDef?'Default ('+(CFG.ramMax||4096)+' MB)':ram.value+' MB';lab();ram.oninput=()=>{useDef=false;lab()};
 const pick=async kind=>{try{const f=await c('pick-file',{title:'Choose an image',filters:[{name:'Images',extensions:['png','jpg','jpeg','webp']}]});if(!f)return;await c('inst:image',{id:i.id,kind,file:f});await refreshInst();drawRail();draw();toast(kind==='icon'?'Icon updated':'Cover updated')}catch(e){toast(e.message,'err')}};
 const opt=(sw,t,d)=>E('div',{class:'set-opt'},sw,E('div',{},E('b',{text:t}),E('div',{class:'sub',text:d})));
 modal(E('h2',{text:'Edit instance'}),E('label',{class:'f',text:'Name'}),name,
  E('div',{class:'row',style:'margin-top:14px'},Bt('Change icon',{icon:'import',onclick:()=>pick('icon')}),Bt('Change cover',{icon:'import',onclick:()=>pick('cover')}),Bt('Reset images',{onclick:async()=>{await c('inst:image',{id:i.id,kind:'icon'});await c('inst:image',{id:i.id,kind:'cover'});await refreshInst();drawRail();draw()}})),
  opt(au,'Auto-update mods and packs','Before each launch, installs newer builds for the same Minecraft version. Worlds and configs are never touched; old files are kept 14 days.'),
  opt(perf,'Boost','Performance mods and tuned Java flags (switches to Fabric if Vanilla)'),
  E('label',{class:'f'},'Memory: ',rv),ram,E('div',{class:'row',style:'margin-top:6px'},Bt('Use default',{cls:'sm',onclick:()=>{useDef=true;lab()}})),
  E('div',{class:'row',style:'margin-top:18px'},Bt('Save',{cls:'pri',onclick:async()=>{try{await c('inst:update',{id:i.id,patch:{name:name.value,perf:perf.classList.contains('on'),autoUpdate:au.classList.contains('on'),ram:useDef?null:+ram.value}});await refreshInst();drawRail();close();toast('Saved');draw()}catch(e){toast(e.message,'err')}}}),Bt('Cancel',{onclick:close})))}

/* ================= instance detail ================= */
function pageDetail(){const i=INST.find(x=>x.id===cur);if(!i){view='inst';return draw()}
 const st=state[i.id]||'closed',dot=E('span',{class:'dot',text:'·'});
 const hero=E('div',{class:'hero',style:coverStyle(i)},E('div',{class:'hero-in'},avatarEl(i,64),
  E('div',{class:'hm'},E('h1',{text:i.name}),E('div',{class:'meta'},E('span',{text:i.mc}),dot.cloneNode(true),E('span',{text:loaderName(i).toUpperCase()}),i.modpack&&[dot.cloneNode(true),E('span',{text:'MODPACK'})],i.perf&&[dot.cloneNode(true),E('span',{text:'BOOST'})],E('span',{class:'pl',text:played(i)}))),
  E('div',{class:'hact'},IB('folder','Open folder',()=>c('inst:open',i.id),'glass'),IB('edit','Edit instance',()=>editModal(i),'glass'),
   IB('trash','Delete instance',async()=>{if(await ask('Delete instance','Delete "'+i.name+'" with all its worlds and mods? This cannot be undone.','Delete')){await c('inst:delete',i.id);await refreshInst();drawRail();navigate({view:'inst'})}},'glass'),
   Bt(st==='closed'?'Play':st==='launching'?'Launching…':'Running',{cls:'pri big',icon:'playf',disabled:st!=='closed',onclick:()=>play(i.id)}))),
  st==='launching'&&E('div',{class:'lp'},E('i',{id:'pg'})),st==='launching'&&E('div',{class:'lpt',id:'pst',text:'Preparing…'}));
 const k=i.counts||{},TABS=[['mod','Mods',k.mod],['resourcepack','Resource Packs',k.resourcepack],['shader','Shaders',k.shader],['schematic','Schematics'],['world','Worlds']];
 const tools=E('div',{class:'tools'}),body=E('div',{class:'dbody'});
 $('#page').replaceChildren(hero,E('div',{class:'tabrow'},...TABS.map(([t,n,ct])=>E('button',{class:'tab'+(tab===t?' on':''),onclick:()=>navigate({tab:t})},E('span',{text:n}),ct>0&&E('b',{text:String(ct)}))),E('span',{class:'sp'}),tools),body);
 (tab==='world'?worldsTab:contentTab)(i,tab,body,tools)}
async function contentTab(i,type,body,tools){
 const F={q:'',f:'all',sort:'name'},list=E('div',{class:'mlist'}),cnt=E('span',{class:'cnt'}),fr=E('div',{class:'frow'}),upAll=Bt('',{cls:'accl',icon:'upc'});upAll.style.display='none';
 let items=[],meta={};const hasMeta=type!=='schematic';
 const ups=()=>Object.values(meta).filter(m=>m.update).length;
 const q=E('input',{placeholder:'Filter '+(type==='mod'?'mods':'files')+'…',oninput:()=>{F.q=q.value;show()}});
 const addBtn=type==='schematic'?Bt('Import',{cls:'pri',icon:'import',onclick:async()=>{try{const f=await c('pick-file',{title:'Import schematic'});if(!f)return;await c('content:import',{id:i.id,type,file:f});await refreshInst();load()}catch(e){toast(e.message,'err')}}}):Bt('Add content',{cls:'pri',icon:'plus',onclick:()=>navigate({view:'discover',dtype:type,target:i.id})});
 tools.replaceChildren(upAll,IB('refresh','Check for updates',()=>load()),addBtn);
 const row=x=>{const m=meta[x.name]||{},upd=!!m.update,nm=x.name.replace(/\.disabled$/,'');
  return E('div',{class:'mrow'+(upd?' upd':'')+(x.disabled?' off':'')},E('img',{class:'micon',src:m.icon||'logo.png',alt:''}),
   E('div',{class:'mt'},E('div',{class:'mn'},E('b',{class:m.url?'nl':'',text:m.title||nm,onclick:m.url?()=>c('open',m.url).catch(()=>{}):null}),hasMeta&&chip(m.pid?'MODRINTH':'LOCAL','src'),x.pack&&chip('PACK','pack')),
    E('div',{class:'ms',text:[nm,m.version&&'v'+m.version,fsize(x.size)].filter(Boolean).join(' · ')})),
   E('div',{class:'macts'},upd&&Bt('Update',{cls:'accl sm',icon:'upc',title:'Update to '+m.update.version,onclick:async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await task('Update '+(m.title||nm),()=>c('content:update',{id:i.id,type,name:x.name}));toast('Updated '+(m.title||nm)+(r?' to '+r.version:''));await refreshInst();await load()}catch(er){toast(er.message,'err');b.disabled=false}}}),
    type==='mod'&&toggle(!x.disabled,async()=>{try{const to=await c('content:toggle',{id:i.id,type,name:x.name});items=items.map(y=>y===x?{...y,name:to,disabled:to.endsWith('.disabled')}:y);if(meta[x.name]){meta[to]=meta[x.name];delete meta[x.name]}show()}catch(e){toast(e.message,'err');show()}}),
    IB('trash','Uninstall',async()=>{if(await ask('Uninstall','Remove '+(m.title||nm)+'? Your worlds and configs are not touched.','Uninstall')){await c('content:remove',{id:i.id,type,name:x.name});items=items.filter(y=>y!==x);await refreshInst();show()}},'flat')))};
 function bar(){const en=items.filter(x=>!x.disabled).length;q.placeholder='Filter '+(type==='mod'?'mods':'files')+'…';
  fr.replaceChildren(E('div',{class:'field'},I('search',16),q),hasMeta&&type==='mod'?seg([['all','All'],['on','Enabled',en],['upd','Updates',ups()]],F.f,v=>{F.f=v;bar();show()}):hasMeta?seg([['all','All'],['upd','Updates',ups()]],F.f,v=>{F.f=v;bar();show()}):null,
   sel([['name','Sort  Name'],['size','Sort  Size'],['status','Sort  Status']],F.sort,v=>{F.sort=v;show()}),cnt)}
 function show(){const ql=F.q.toLowerCase();let l=items.filter(x=>(meta[x.name]?.title||x.name).toLowerCase().includes(ql));
  if(F.f==='on')l=l.filter(x=>!x.disabled);if(F.f==='upd')l=l.filter(x=>meta[x.name]?.update);
  l.sort(F.sort==='size'?(a,b)=>b.size-a.size:F.sort==='status'?(a,b)=>(!!meta[b.name]?.update)-(!!meta[a.name]?.update)||a.name.localeCompare(b.name):(a,b)=>(meta[a.name]?.title||a.name).localeCompare(meta[b.name]?.title||b.name));
  cnt.textContent=items.length+' file'+(items.length===1?'':'s');
  list.replaceChildren(...(l.length?l.map(row):[empty(items.length?'No matches':'Nothing here yet',items.length?'':type==='schematic'?'Import schematic files to keep them with this instance.':'Use "Add content" to browse Modrinth and CurseForge.')]))}
 async function load(){try{items=await c('content:list',{id:i.id,type});bar();show();const n0=0;
   if(!hasMeta||!items.length){upAll.style.display='none';return}
   try{meta=await c('content:meta',{id:i.id,type});const n=ups();bar();show();upAll.style.display=n?'':'none';upAll.replaceChildren(I('upc'),E('span',{text:`Update all (${n})`}))}catch(e){cnt.textContent=items.length+' files · could not check for updates'}}
  catch(e){list.replaceChildren(E('p',{class:'msg e',text:e.message}))}}
 upAll.onclick=async()=>{upAll.disabled=true;try{const r=await task('Update all '+type+'s',()=>c('content:updateAll',{id:i.id,types:[type]}));toast(`Updated ${r.done.length} item${r.done.length===1?'':'s'}`+(r.fail.length?`, ${r.fail.length} failed`:''),r.fail.length?'err':'');await refreshInst();await load()}catch(e){toast(e.message,'err')}upAll.disabled=false};
 body.append(fr,list);await load()}
async function worldsTab(i,type,body,tools){
 const grid=E('div',{class:'wgrid'}),cnt=E('span',{class:'cnt'}),q=E('input',{placeholder:'Filter worlds…',oninput:()=>show()});let ws=[];
 tools.replaceChildren(IB('refresh','Refresh',()=>load()),Bt('Import world',{cls:'pri',icon:'import',onclick:async()=>{try{const f=await c('pick-file',{title:'Import world',filters:[{name:'World zip',extensions:['zip']}]});if(!f)return;const n=await task('Import world',()=>c('worlds:import',{id:i.id,file:f}));toast('Imported '+n);await refreshInst();load()}catch(e){toast(e.message,'err')}}}));
 const card=w=>E('div',{class:'wcard'},E('div',{class:'wthumb',style:w.icon?`background-image:url("${w.icon}")`:''}),
  E('div',{style:'min-width:0;flex:1'},E('b',{text:w.name}),E('div',{class:'tags'},chip(w.hardcore?'Hardcore':w.mode),w.diff&&chip(w.diff),w.version&&chip(w.version)),E('div',{class:'ms',text:`Played ${agoL(w.played)} · ${w.dir}`})),
  E('div',{class:'wact'},IB('folder','Open folder',()=>c('worlds:open',{id:i.id,dir:w.dir}),'glass'),
   IB('share','Back up world',async()=>{try{await task('Back up '+w.name,()=>c('worlds:backup',{id:i.id,dir:w.dir}));toast('Backup saved in the instance "backups" folder')}catch(e){toast(e.message,'err')}},'glass'),
   IB('trash','Delete world',async()=>{if(await ask('Delete world','Delete "'+w.name+'" permanently? Consider backing it up first.','Delete')){await c('worlds:delete',{id:i.id,dir:w.dir});await refreshInst();load()}},'glass')));
 function show(){const ql=q.value.toLowerCase(),l=ws.filter(w=>w.name.toLowerCase().includes(ql)||w.dir.toLowerCase().includes(ql));cnt.textContent=ws.length+' world'+(ws.length===1?'':'s');grid.replaceChildren(...(l.length?l.map(card):[empty(ws.length?'No matches':'No worlds yet','Worlds appear here after you play, or use "Import world".')]))}
 async function load(){try{ws=await c('worlds:list',{id:i.id});show()}catch(e){grid.replaceChildren(E('p',{class:'msg e',text:e.message}))}}
 body.append(E('div',{class:'frow'},E('div',{class:'field'},I('search',16),q),cnt),grid);await load()}

/* ================= discover (Modrinth / CurseForge) ================= */
let dseq=0,lastRes=null;
const DTYPES=[['mod','Mods'],['modpack','Modpacks'],['resourcepack','Resource Packs'],['shader','Shaders']];
const toggleIn=(a,v,on)=>{const k=a.indexOf(v);if(on&&k<0)a.push(v);if(!on&&k>=0)a.splice(k,1)};
async function pageDiscover(){
 if(!TAGS){try{TAGS=await c('mr:tags')}catch{TAGS={releases:[],all:[],cats:[]}}if(view!=='discover')return}
 const isPack=DS.type==='modpack',tgt=INST.find(i=>i.id===DS.target);
 const res=E('div'),head=E('div',{class:'rhead'});
 const q=E('input',{placeholder:'Search '+DS.type.replace('pack',' packs').replace('mod ','mod')+'…',value:DS.q});
 const sec=(key,title,content)=>E('div',{class:'fsec'},E('button',{class:'fsh',onclick:()=>{DS.open[key]=!DS.open[key];pageDiscover()}},E('span',{text:title}),I(DS.open[key]?'up':'down',14)),DS.open[key]&&content);
 const chk=(arr,val,label)=>E('label',{class:'fopt'},E('input',{type:'checkbox',checked:arr.includes(val),onchange:e=>{toggleIn(arr,val,e.target.checked);run()}}),E('span',{text:label}));
 const vlist=(DS.allV?TAGS.all:TAGS.releases.slice(0,8)).filter(v=>v.includes(DS.vq));
 const side=E('div',{class:'side'},E('h4',{text:'Filters'}),
  ['mod','modpack'].includes(DS.type)&&sec('loaders','LOADERS',['fabric','forge','neoforge','quilt'].map(l=>chk(DS.loaders,l,l))),
  sec('versions','GAME VERSIONS',[E('input',{class:'fin',placeholder:'Filter',value:DS.vq,oninput:e=>{DS.vq=e.target.value;pageDiscover()}}),...vlist.map(v=>chk(DS.versions,v,v)),E('button',{class:'flink',text:DS.allV?'Show releases only':`Show all ${TAGS.all.length}`,onclick:()=>{DS.allV=!DS.allV;pageDiscover()}})]),
  DS.type==='mod'&&sec('env','ENVIRONMENT',[chk(DS.env,'client','Client'),chk(DS.env,'server','Server')]),
  sec('cats','CATEGORIES',TAGS.cats.filter(x=>x.t===DS.type).map(x=>x.n).filter((v,i,a)=>a.indexOf(v)===i).map(n=>chk(DS.cats,n,n.replace(/-/g,' ')))));
 const tsel=E('select',{onchange:()=>navigate({target:tsel.value||null})},E('option',{value:'',text:'Browsing only'}),...INST.map(i=>E('option',{value:i.id,text:i.name})));tsel.value=DS.target||'';
 let tm;q.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{DS.q=q.value;run()},420)};q.onkeydown=e=>{if(e.key==='Enter'){clearTimeout(tm);DS.q=q.value;run()}};
 $('#page').replaceChildren(E('div',{style:'padding-top:36px'},
  E('div',{class:'dtabs'},...DTYPES.map(([k,n])=>E('button',{class:'tab'+(DS.type===k?' on':''),onclick:()=>navigate({dtype:k})},E('span',{text:n}))),E('span',{class:'sp',style:'flex:1'}),E('div',{class:'pill'},I('compass',16),tsel)),
  E('div',{class:'dbar'},IB('sliders','Filters',()=>{DS.filters=!DS.filters;pageDiscover()},DS.filters?'':'flat'),seg([['modrinth','Modrinth'],['curseforge','CurseForge']],DS.src,v=>{DS.src=v;DS.page=1;pageDiscover()}),
   E('div',{class:'field'},I('search',16),q),sel([['relevance','Relevance'],['downloads','Downloads'],['follows','Follows'],['newest','Newest'],['updated','Recently updated']],DS.sort,v=>{DS.sort=v;run()}),seg([['list','@list'],['grid','@grid']],DS.mode,v=>{DS.mode=v;renderHits()})),
  E('div',{class:'dwrap'},DS.filters&&side,E('div',{class:'dres'},head,res))));
 const instNames=id=>(IMAP[id]||[]).map(n=>INST.find(i=>i.id===n)?.name).filter(Boolean);
 async function install(x,b,target){const id=target||DS.target;
  if(!isPack&&!id){if(!INST.length){toast('Create an instance first','err');return}
   modal(E('h2',{text:'Install '+x.title}),E('p',{class:'msg',text:'Choose an instance to install into.'}),...INST.map(i=>E('button',{class:'prov',onclick:()=>{close();install(x,b,i.id)}},avatarEl(i,40),E('div',{class:'t'},E('b',{text:i.name}),E('small',{text:i.mc+' · '+loaderName(i)})),I('right'))),Bt('Cancel',{onclick:close}));return}
  b.disabled=true;
  try{const o=await task('Install '+x.title,()=>c('install',{src:DS.src,type:DS.type,pid:x.id,id,icon:x.icon}));await refreshInst();drawRail();toast('Installed '+o.join(', ').slice(0,90));if(!isPack){IMAP=await c('installed:map',{types:[DS.type]}).catch(()=>IMAP)}renderHits()}
  catch(e){b.disabled=false;toast(e.message,'err')}}
 function hit(x){const inT=tgt&&(IMAP[x.id]||[]).includes(tgt.id),where=instNames(x.id),b=Bt('Install',{cls:'pri',icon:'dl',disabled:inT});b.onclick=()=>install(x,b);if(inT)b.querySelector('span').textContent='Installed';
  const stats=E('div',{class:'rs'},E('span',{class:'st'},I('dl',14),E('span',{text:fmt(x.downloads)})),x.follows!=null&&E('span',{class:'st'},I('heart',14),E('span',{text:fmt(x.follows)})),...(x.tags||[]).map(t=>chip(t.t,t.k==='loader'?'loader':'')),x.updated&&E('span',{text:'Updated '+ago(x.updated)}));
  const title=E('div',{class:'rt'},E('b',{class:x.url?'nl':'',text:x.title,onclick:x.url?()=>c('open',x.url).catch(()=>{}):null}),x.author&&E('span',{text:'by '+x.author}));
  const inst=where.length>0&&E('div',{class:'inst-in',text:'Installed in '+where.join(', ')});
  return DS.mode==='grid'?E('div',{class:'rcard'},E('div',{class:'top2'},E('img',{src:x.icon||'logo.png',alt:''}),E('div',{class:'rinfo'},title)),E('p',{class:'rd',text:x.desc||''}),stats,inst,b)
   :E('div',{class:'rrow'},E('img',{src:x.icon||'logo.png',alt:''}),E('div',{class:'rinfo'},title,E('p',{class:'rd',text:x.desc||''}),stats,inst),b)}
 function renderHits(){const r=lastRes;if(!r||view!=='discover')return;const pages=Math.max(1,Math.ceil(r.total/DS.per)),go=n=>{DS.page=n;run(true);$('#page').scrollTop=0};
  const pb=(ic,t,n,dis)=>E('button',{class:'ibtn flat',title:t,'aria-label':t,disabled:dis===true,onclick:()=>go(n)},I(ic,16));
  head.replaceChildren(E('span',{},E('b',{text:r.total.toLocaleString()}),' results · page ',E('b',{text:String(DS.page)}),' of '+pages.toLocaleString()),E('span',{class:'sp'}),
   E('div',{class:'pager'},pb('first','First page',1,DS.page<=1),pb('left','Previous page',DS.page-1,DS.page<=1),pb('right','Next page',DS.page+1,DS.page>=pages),pb('last','Last page',pages,DS.page>=pages)));
  res.className=DS.mode==='grid'?'rgrid':'';res.replaceChildren(...(r.hits.length?r.hits.map(hit):[empty('No results','Try another search or remove some filters.')]))}
 async function run(keep){const my=++dseq;if(!keep)DS.page=1;res.className='';res.replaceChildren(...[1,2,3,4,5].map(()=>E('div',{class:'sk'})));
  try{const r=await c('browse',{src:DS.src,type:DS.type,q:DS.q,page:DS.page,per:DS.per,sort:DS.sort,loaders:DS.loaders,versions:DS.versions,cats:DS.cats,env:DS.env});if(my!==dseq)return;lastRes=r;renderHits()}
  catch(e){if(my!==dseq)return;res.className='';head.replaceChildren();res.replaceChildren(empty('Could not load results',e.message))}}
 if(!isPack)c('installed:map',{types:[DS.type]}).then(m=>{IMAP=m;renderHits()}).catch(()=>{});
 run(true)}

/* ================= accounts, skins, capes ================= */
const SK={profile:null,lib:[],err:'',variant:'classic',sel:null,loadedFor:null};
function drawSkin(cv,url,slim,sc){const ctx=cv.getContext&&cv.getContext('2d');if(!ctx)return;cv.width=16*sc;cv.height=32*sc;ctx.imageSmoothingEnabled=false;const im=new Image();
 im.onload=()=>{ctx.clearRect(0,0,cv.width,cv.height);const legacy=im.height===32,aw=slim?3:4;
  const d=(sx,sy,sw,sh,dx,dy,flip)=>{if(flip){ctx.save();ctx.translate((dx+sw)*sc,0);ctx.scale(-1,1);ctx.drawImage(im,sx,sy,sw,sh,0,dy*sc,sw*sc,sh*sc);ctx.restore()}else ctx.drawImage(im,sx,sy,sw,sh,dx*sc,dy*sc,sw*sc,sh*sc)};
  d(8,8,8,8,4,0);d(20,20,8,12,4,8);d(44,20,aw,12,4-aw,8);legacy?d(44,20,aw,12,12,8,true):d(36,52,aw,12,12,8);d(4,20,4,12,4,20);legacy?d(4,20,4,12,8,20,true):d(20,52,4,12,8,20);
  if(!legacy){d(20,36,8,12,4,8);d(44,36,aw,12,4-aw,8);d(52,52,aw,12,12,8);d(4,36,4,12,4,20);d(4,52,4,12,8,20)}d(40,8,8,8,4,0)};im.src=url}
const faceCanvas=url=>{const cv=E('canvas',{width:40,height:40});const ctx=cv.getContext&&cv.getContext('2d');if(ctx){ctx.imageSmoothingEnabled=false;const im=new Image();im.onload=()=>{ctx.drawImage(im,8,8,8,8,0,0,40,40);ctx.drawImage(im,40,8,8,8,0,0,40,40)};im.src=url}return cv};
const capeCanvas=url=>{const cv=E('canvas',{width:40,height:64});const ctx=cv.getContext&&cv.getContext('2d');if(ctx){ctx.imageSmoothingEnabled=false;const im=new Image();im.onload=()=>ctx.drawImage(im,1,1,10,16,0,0,40,64);im.src=url}return cv};
async function pageAccounts(){
 const cu=ACC.list.find(a=>a.id===ACC.sel),P=$('#page');
 const cards=ACC.list.map(a=>{const on=a.id===ACC.sel;return E('div',{class:'acard'+(on?' on':''),onclick:async()=>{if(!on){await c('acc:select',a.id);await loadAcc();SK.loadedFor=null;draw()}}},
  E('div',{class:'ar'},accAvatar(a,52),E('div',{style:'flex:1;min-width:0'},E('b',{text:a.name}),E('div',{class:'row',style:'gap:6px;margin-top:4px'},on&&E('span',{class:'tag on',text:'ACTIVE'}),E('span',{class:'tag',text:TL[a.type].toUpperCase()})))),
  E('div',{class:'af'},E('span',{text:on?'Used for every launch':'Click to use'}),IB('trash','Remove account',async e=>{e.stopPropagation();if(await ask('Remove account','Remove '+a.name+' ('+TL[a.type]+') from Jern Client?','Remove')){await c('acc:remove',a.id);await loadAcc();SK.loadedFor=null;draw()}},'flat')))});
 P.replaceChildren(E('div',{class:'view'},E('div',{class:'vhead'},E('h1',{text:'Accounts'}),E('span',{class:'sub',text:ACC.list.length+' signed in'}),E('span',{class:'sp'}),Bt('Add account',{cls:'pri',icon:'plus',onclick:addAccountModal})),
  E('div',{class:'agrid'},...(cards.length?cards:[empty('No accounts yet','Add a Microsoft, Ely.by or offline account.')])),cu&&E('div',{class:'skwrap',id:'skw'})));
 if(cu)skinSection(cu)}
async function skinSection(cu){
 const w=$('#skw');if(!w)return;const ms=cu.type==='ms',cv=E('canvas',{class:'skc'});
 if(SK.loadedFor!==cu.id){SK.profile=null;SK.err='';SK.sel=null;SK.loadedFor=cu.id;
  if(ms){try{SK.profile=await c('skin:profile',cu.id)}catch(e){SK.err=e.message}}SK.variant=SK.profile?.skin?.variant||'classic';try{SK.lib=await c('skin:lib')}catch{SK.lib=[]}if(!$('#skw'))return}
 const slim=SK.variant==='slim',cur=SK.sel?SK.lib.find(s=>s.id===SK.sel):null;
 const url=cur?cur.data:cu.type==='ely'?`https://skinsystem.ely.by/skins/${encodeURIComponent(cu.name)}.png`:SK.profile?.skin?.url||null;
 if(url)drawSkin(cv,url,slim,11);
 const reload=async()=>{SK.loadedFor=null;SK.sel=null;skinSection(cu)};
 const msg=!ms?E('div',{class:'dash',text:cu.type==='ely'?'Change your Ely.by skin on ely.by - it shows here automatically.':'Offline accounts have no skin to edit.'}):SK.err?E('div',{class:'dash',text:SK.err}):null;
 const input=E('input',{placeholder:'Player name, UUID, texture link or NameMC link'});
 const addQ=async()=>{try{await c('skin:add',{q:input.value});SK.lib=await c('skin:lib');skinSection(cu)}catch(e){toast(e.message,'err')}};input.onkeydown=e=>{if(e.key==='Enter')addQ()};
 const tile=s=>E('button',{class:'sktile'+(SK.sel===s.id?' on':''),title:s.name,onclick:()=>{SK.sel=s.id;SK.variant=s.variant||'classic';skinSection(cu)}},faceCanvas(s.data),E('span',{text:s.name.slice(0,10)}),E('i',{class:'x',title:'Remove',onclick:async e=>{e.stopPropagation();await c('skin:remove',s.id);SK.lib=await c('skin:lib');if(SK.sel===s.id)SK.sel=null;skinSection(cu)}},I('x',12)));
 w.replaceChildren(
  E('div',{class:'skview'},E('div',{class:'skcan'},cv),E('div',{class:'skfoot'},seg([['classic','Classic'],['slim','Slim']],SK.variant,v=>{SK.variant=v;skinSection(cu)}),
   E('div',{class:'row'},Bt('Upload PNG',{icon:'import',disabled:false,onclick:async()=>{try{const f=await c('pick-file',{title:'Choose a skin PNG',filters:[{name:'PNG',extensions:['png']}]});if(!f)return;await c('skin:add',{file:f});SK.lib=await c('skin:lib');skinSection(cu)}catch(e){toast(e.message,'err')}}}),
    ms&&Bt('Reset',{icon:'refresh',onclick:async()=>{try{await c('skin:reset',cu.id);toast('Skin reset');reload()}catch(e){toast(e.message,'err')}}}),
    ms&&cur&&Bt('Apply skin',{cls:'pri',onclick:async()=>{try{await task('Apply skin',()=>c('skin:apply',{acc:cu.id,id:cur.id,variant:SK.variant}));toast('Skin applied');reload()}catch(e){toast(e.message,'err')}}})))),
  E('div',{},msg,E('div',{class:'shead'},E('span',{text:'SKIN LIBRARY'}),E('small',{text:SK.lib.length+' saved'})),
   E('div',{class:'row',style:'margin-bottom:14px'},E('div',{class:'field',style:'flex:1'},I('search',16),input),Bt('Import',{onclick:addQ})),
   SK.lib.length?E('div',{class:'skgrid'},...SK.lib.map(tile)):E('div',{class:'dash',text:'Your current skin is saved here automatically. Upload a PNG or pull one in by player name, then click a face to try it on.'}),
   ms&&E('div',{class:'shead'},E('span',{text:'CAPES'})),
   ms&&E('div',{class:'skgrid'},(()=>{const capes=SK.profile?.capes||[],none=!capes.some(x=>x.active);
    const ct=(label,node,active,id)=>E('button',{class:'sktile'+(active?' on':''),title:label,onclick:async()=>{try{await c('skin:cape',{acc:cu.id,capeId:id});toast(id?'Cape equipped':'Cape removed');reload()}catch(e){toast(e.message,'err')}}},node,E('span',{text:label.slice(0,10)}));
    return [ct('None',E('div',{style:'width:40px;height:64px;display:grid;place-items:center;color:var(--dim)'},I('x',18)),none,null),...capes.map(x=>ct(x.alias||'Cape',capeCanvas(x.url),x.active,x.id))]})())))}

/* ================= logs, settings ================= */
function pageLogs(){const pre=E('pre',{id:'log',text:LOG||'Launch output appears here.'});
 $('#page').replaceChildren(E('div',{class:'view'},E('div',{class:'vhead'},E('h1',{text:'Logs'}),E('span',{class:'sp'}),Bt('Clear',{onclick:()=>{LOG='';pre.textContent='Launch output appears here.'}})),pre));pre.scrollTop=pre.scrollHeight}
async function pageSettings(){CFG=await c('cfg:get');const vs=await c('versions:installed').catch(()=>[]);if(view!=='settings')return;
 const dir=E('input',{value:CFG.gameDir,readonly:true}),java=E('input',{value:CFG.javaPath,placeholder:'Auto-download the right Java'}),
  ram=E('input',{type:'range',min:1024,max:16384,step:512,value:CFG.ramMax,style:'width:100%;padding:0;height:20px;accent-color:var(--acc)'}),rv=E('b',{text:CFG.ramMax+' MB'}),cf=E('input',{type:'password',value:CFG.cfKey,placeholder:'console.curseforge.com'});
 ram.oninput=()=>rv.textContent=ram.value+' MB';
 const rs=toggle(CFG.restoreOnExit!==false),rsRow=E('div',{class:'set-opt'},rs,E('div',{},E('b',{text:'Bring the launcher back when the game closes'}),E('div',{class:'sub',text:'Only applies when minimizing.'})));
 const al=sel([['keep','Keep the launcher open'],['minimize','Minimize the launcher'],['close','Close the launcher']],CFG.afterLaunch||'keep',()=>sync());const sync=()=>{rsRow.style.opacity=al.value==='minimize'?'1':'.45'};sync();
 const cur3=(()=>{try{return localStorage.getItem('accent')||'orange'}catch{return'orange'}})();
 const sw=E('div',{class:'swatches'},...Object.entries(ACCENTS).map(([k,v])=>E('button',{class:'sw'+(k===cur3?' on':''),title:k,'aria-label':k+' accent',style:'background:'+v[0],onclick:()=>{setAccent(k);$$('.sw',sw).forEach(s=>s.classList.toggle('on',s.title===k))}})));
 const card=(t,d,...k)=>E('div',{class:'scard'},E('h3',{text:t}),d&&E('p',{class:'msg',text:d}),...k);
 const vl=E('div',{});if(!vs.length)vl.append(E('p',{class:'msg',text:'No game versions downloaded yet.'}));
 vs.forEach(n=>vl.append(E('div',{class:'item'},E('div',{class:'t mono',text:n}),Bt('Uninstall',{cls:'bad sm',onclick:async()=>{if(await ask('Uninstall version','Delete downloaded files for '+n+'? Instances using it download it again.','Uninstall')){await c('versions:remove',n);pageSettings()}}}))));
 $('#page').replaceChildren(E('div',{class:'view'},E('div',{class:'vhead'},E('h1',{text:'Settings'})),
  card('Appearance','Pick an accent colour.',sw),
  card('Game',null,E('label',{class:'f',text:'Data folder (instances, game files, Java)'}),E('div',{class:'row'},E('div',{style:'flex:1'},dir),Bt('Change…',{onclick:async()=>{const d=await c('pick-dir');if(d)dir.value=d}})),E('p',{class:'sub',style:'margin:6px 0 0',text:'Changing this does not move existing files. Updating the launcher never touches this folder.'}),E('label',{class:'f',text:'Java path'}),java,E('label',{class:'f'},'Default max RAM: ',rv),ram),
  card('When Minecraft starts','Choose what the launcher does once the game window is opening.',al,rsRow,E('p',{class:'sub',style:'margin:12px 0 0',text:'"Close" quits the launcher; the game keeps running on its own, but you lose the live log.'})),
  card('CurseForge','A free API key is needed to search CurseForge.',cf),
  E('div',{class:'row',style:'margin:0 0 26px'},Bt('Save settings',{cls:'pri',onclick:async()=>{CFG=await c('cfg:set',{gameDir:dir.value,javaPath:java.value.trim(),ramMax:+ram.value,cfKey:cf.value.trim(),afterLaunch:al.value,restoreOnExit:rs.classList.contains('on')});await refreshInst();drawRail();toast('Settings saved')}})),
  card('Downloaded game versions',null,vl),card('About','Jern Client 1.2. Boost installs well-known performance mods; real FPS gains depend on your hardware and settings.')))}

/* ================= shell / boot ================= */
let lastKey='';
function draw(){drawRail();drawTop();const P=$('#page'),key=[view,cur,tab,DS.type].join('|');if(key!==lastKey){P.classList.remove('fade');void P.offsetWidth;P.classList.add('fade');lastKey=key;P.scrollTop=0}
 ({home:pageHome,inst:pageInst,detail:pageDetail,discover:pageDiscover,accounts:pageAccounts,logs:pageLogs,settings:pageSettings})[view]()}
window.jern.on('log',m=>{LOG+=m+'\n';const l=$('#log');if(l){l.textContent=LOG;l.scrollTop=l.scrollHeight}const s=$('#pst');if(s)s.textContent=String(m).slice(0,90)});
window.jern.on('progress',p=>{const g=$('#pg'),s=$('#pst');if(g)g.style.width=(p.total?p.task/p.total*100:0)+'%';if(s&&p.total)s.textContent=`Downloading ${p.type}: ${p.task}/${p.total}`});
window.jern.on('state',({id,s})=>{state[id]=s;if(s==='launching'){if(['detail','home','inst'].includes(view))draw();return}
 refreshInst().then(()=>{if(['detail','home','inst'].includes(view))draw();else drawRail()})});
(async()=>{try{V=await c('versions').catch(()=>V);CFG=await c('cfg:get');await loadAcc();await refreshInst();navigate({view:'home'})}catch(e){$('#page').textContent='Startup error: '+e.message}})();
