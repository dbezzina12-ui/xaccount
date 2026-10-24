import {screenRuntime} from './screens-runtime.js';
const screens=screenRuntime(status=>notify('screen-preview-status',{status}));
// Runs inside the imported, real Zombify runtime. All coordinates come from
// the same project displayed by the editor; original outcome logic is retained.
//
// Protocol (studio → runtime messages carry source 'slot-studio', replies 'slot-runtime'):
//   apply {project,scene,rev}  → applied {rev}, or deferred {rev} while a round runs (applied when it ends)
//   spin {id,mode}             → round {id,phase:'started'} … round {id,phase:'finished',played,message}
//                                or round {id,phase:'rejected',message}
//   continue · skip · speed {value} · retry · ping {id} → pong {id} · read {id} → state
// Pushed unprompted: ready (bridge installed), game {status,loaded,total,message}
// whenever loading changes, and state {busy,awaitingOutbreak,…} whenever a round
// starts, pauses or ends — including rounds started from the game's own controls.
import {sceneAppearance,validateProject,compatible,SYMBOLS} from './project.js';
import {Reel} from '../engine/client/reels.js';
const rootURL=new URL('../',import.meta.url),game=document.getElementById('game'),runtime=()=>window.ZombifyStudioRuntime;
const style=document.createElement('style');style.id='studio-presentation';document.head.append(style);
const background=document.createElement('div');background.className='studio-background';
const tint=document.createElement('div');tint.className='studio-tint';background.append(tint);game.prepend(background);
const boardWrap=document.querySelector('.board-wrap');
const dividers=document.createElement('div');dividers.className='studio-dividers';boardWrap.append(dividers);
// Non-6×5 layout tests draw into their own board; Zombify's #board is never touched.
const preview=document.createElement('div');preview.className='studio-preview-board';boardWrap.append(preview);
// Image layers live inside the play area so their z-order interleaves with the reels and title.
const extras=document.createElement('div');extras.className='studio-extras';(document.querySelector('.play-area')||game).append(extras);
const MISSING="Zombify's game code didn't load in this checkout. From slots/, run npm run studio:prepare, then reload the studio.";
const STRIP=Int16Array.from({length:60},(_,i)=>(i*7+(i/12|0))%SYMBOLS.length);
let current=null,sceneKey='desktop',round=null,pending=null,lastState='',lastGame='',spinToken=0,hurry=false,previewShape='',columns=[],landed=null,bootFailed=false;
const extraImages=new Map();
const cssURL=url=>`url(${JSON.stringify(url)})`;
const src=id=>{const asset=current.assets.find(a=>a.id===id);return new URL(asset.src,rootURL).href;};
const notify=(type,payload={})=>parent.postMessage({source:'slot-runtime',type,...payload},location.origin);
const rect=l=>`position:absolute!important;left:${l.x}px!important;top:${l.y}px!important;width:${l.w}px!important;height:${l.h}px!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;transform:none!important;opacity:${l.opacity}!important;display:${l.visible?'block':'none'}!important;`;

function runtimeStatus(){
 const rt=runtime();if(!rt)return {busy:false,awaitingOutbreak:false,autoplay:false};
 if(rt.status)return rt.status();
 const s=rt.read();return {busy:!!s.busy,awaitingOutbreak:!!s.awaitingOutbreak,autoplay:!!s.autoplay?.active};
}
const locked=()=>{const s=runtimeStatus();return !!round||s.busy||s.awaitingOutbreak||s.autoplay;};
function pushState(force=false){
 const s=runtimeStatus(),state={busy:!!round||s.busy||s.autoplay,awaitingOutbreak:s.awaitingOutbreak,autoplay:s.autoplay,round:round?.id??null,presentationOnly:current?!compatible(current):false};
 const key=JSON.stringify(state);
 if(force||key!==lastState){lastState=key;notify('state',state);}
 if(pending&&!locked())flush();
}
function pushGame(){
 const rt=runtime(),l=rt?.loading?.()??(rt?{status:'ready',loaded:1,total:1}:null);
 const g=!rt?{status:bootFailed?'missing':'starting',message:bootFailed?MISSING:''}:{status:l.status==='idle'?'loading':l.status,loaded:l.loaded,total:l.total,message:l.status==='error'?'Some Zombify files failed to load. Retry, or run npm run studio:prepare.':''};
 const key=JSON.stringify(g);if(key!==lastGame){lastGame=key;notify('game',g);}
}
function flush(){
 const p=pending;pending=null;
 try{notify('applied',{rev:p.rev,...apply(p.project,p.scene)});}catch(error){notify('error',{context:'apply',rev:p.rev,message:error.message});}
}

function apply(project,key){
 validateProject(project,{preview:true});
 current=project;sceneKey=key;
 runtime()?.configureAudio?.(project.sounds||{},project.assets.filter(a=>a.kind==='audio').map(a=>({...a,src:new URL(a.src,rootURL).href})));
 const s=project.scenes[key],g=sceneAppearance(project,key),reels=s.layers.find(l=>l.id==='reels'),title=s.layers.find(l=>l.id==='title'),controls=s.layers.find(l=>l.id==='controls'),mobile=s.width<s.height;
 const rackTop=mobile?reels.h+(g.supports?reels.w*.075:0)+6:Math.max(-reels.y,-100);
 const rackWidth=mobile?reels.w:Math.max(120,reels.w-160);
 const tubeHeight=mobile?Math.max(32,Math.min(65,controls.y-reels.y-rackTop-12)):60;
 const b=s.background,fw=Math.min(g.frameWidth,Math.floor(Math.min(reels.w,reels.h)/7));
 background.style.cssText=`position:absolute;inset:0;z-index:0;background-image:${cssURL(src(b.assetId))};background-size:${b.zoom===100?'cover':b.zoom+'% auto'};background-position:${b.positionX}% ${b.positionY}%;filter:brightness(${b.brightness}%) contrast(${b.contrast}%) saturate(${b.saturation}%) hue-rotate(${b.hue}deg) blur(${b.blur}px);transform:scale(${1+b.blur*.004});`;
 tint.style.cssText=`position:absolute;inset:0;background:${b.tint};opacity:${b.tintOpacity};`;
 const artRules=SYMBOLS.map(id=>`#game .symbol.art-${id}{background-image:${cssURL(src(project.symbols[id]))}!important;}`).join('\n');
 style.textContent=`
 html,body{width:100%;height:100%;overflow:hidden!important;background:#09131d!important}body{margin:0!important}
 #game{position:relative!important;width:100%!important;height:100%!important;min-height:0!important;padding:0!important;margin:0!important;overflow:hidden!important;display:block!important;background:#071827!important;--frame-width:${fw}px;--frame-top:${fw}px;--frame-bottom:${fw}px;--cabinet-width:${reels.w}px;--reel-texture:${g.texture?cssURL(src('enamel')):'none'};isolation:isolate}
 #game .city-backdrop,#game .clean-cel-mascot,#game .mobile-zombie-mascot,#game .topbar,#game .left-rail,#game .right-rail,#game .bottom-note,#game .brand-overline,#game .brand-tag,#game .preview-notice,#game .machine-foot,#game .machine-head,#game .title-o-backing{display:none!important}
 #game .play-area{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;padding:0!important;margin:0!important;display:block!important;z-index:2}
 #game .machine{${rect(reels)}z-index:${s.layers.indexOf(reels)+2}!important;filter:none!important;isolation:auto!important;box-shadow:none!important}
 #game .machine:before,#game .machine:after,#game .board-wrap:before,#game .board-wrap:after,#game .brand:before,#game .brand:after{display:none!important}
 #game .machine-crown{height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:none!important}
 #game .reel-stage{width:100%!important;height:100%!important;position:relative!important;transform:none!important}
 #game .board-wrap{position:relative!important;width:100%!important;height:100%!important;box-sizing:border-box!important;border:${fw}px solid transparent!important;border-image:${cssURL(src(g.frameAsset))} 150 160 190 160 / 1 / 0 stretch!important;overflow:visible!important;box-shadow:0 9px 20px #0005!important;background:${g.fill}!important;filter:none!important}
 #game .board{position:relative!important;width:100%!important;height:100%!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;grid-template-rows:repeat(5,minmax(0,1fr))!important;gap:0!important;padding:0!important;margin:0!important;border:0!important;background:${g.fill} ${g.texture?cssURL(src('enamel')):'none'} center / 100% 100% no-repeat!important;overflow:hidden!important;box-shadow:inset 0 6px 14px #0004!important}
 #game .board .tile{width:100%!important;height:100%!important;min-height:0!important;min-width:0!important;aspect-ratio:auto!important;border:0!important;background:none!important;box-shadow:none!important;overflow:hidden!important}
 #game .tile>.symbol,#game .reel-strip .tile>.symbol{transform:scale(${g.symbolScale})!important}
 #game .symbol{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}
 ${artRules}
 #game .tile[data-infection="0"] .symbol{background-size:contain!important}
 #game .stack-layer{inset:0!important;padding:0!important;gap:0!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;grid-template-rows:repeat(5,minmax(0,1fr))!important}
 #game .spinning-reel{background-color:${g.fill}!important;background-image:${g.texture?cssURL(src('enamel')):'none'}!important}
 .studio-dividers{position:absolute;inset:0;z-index:18;pointer-events:none;opacity:${g.divider};background:linear-gradient(90deg,transparent calc(100% - 1px),#a9d7e7 0) 0 0 / ${100/g.columns}% 100%,linear-gradient(0deg,transparent calc(100% - 1px),#a9d7e7 0) 0 0 / 100% ${100/g.rows}%;box-shadow:inset 0 0 0 1px #a9d7e7}
 #game .cabinet-supports{display:${g.supports?'flex':'none'}!important;height:${reels.w*.075}px!important;margin:-2px 3% 0!important}
 #game .brand{${rect(title)}z-index:${s.layers.indexOf(title)+2}!important;text-align:left!important}
 #game .brand h1.peek-title{position:static!important;width:100%!important;height:100%!important;max-width:none!important;transform:none!important;margin:0!important;padding:0!important}
 #game .brand img{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important}
 #game .console{visibility:visible!important;pointer-events:auto;position:absolute!important;left:${controls.x}px!important;top:${controls.y}px!important;bottom:auto!important;width:880px!important;height:100px!important;max-width:none!important;min-height:0!important;margin:0!important;transform:scale(${controls.w/880},${controls.h/100})!important;transform-origin:0 0!important;display:${!mobile&&controls.visible?'flex':'none'}!important;align-items:center!important;justify-content:space-evenly!important;gap:14px!important;padding:8px 18px!important;border:0!important;background:#06121baa!important;border-radius:16px!important;z-index:10!important;opacity:${controls.opacity}!important}
 #game #mobile-controller{position:absolute!important;left:${controls.x}px!important;top:${controls.y}px!important;right:auto!important;bottom:auto!important;width:390px!important;height:214px!important;max-width:none!important;margin:0!important;transform:scale(${controls.w/390},${controls.h/214})!important;transform-origin:0 0!important;display:${mobile&&controls.visible?'block':'none'}!important;z-index:10!important;opacity:${controls.opacity}!important}
 #game .infection-tracker{position:absolute!important;top:${rackTop}px!important;bottom:auto!important;left:0!important;right:auto!important;width:${rackWidth}px!important;max-width:none!important;margin:0!important;z-index:20!important}
 #game .infection-people{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important}#game .infection-tube{height:${tubeHeight}px!important;width:${tubeHeight*977/1610}px!important;max-width:100%!important;max-height:none!important}.infection-heading{font-size:9px!important}.tube-name{display:none!important}
 #game .free-spins-counter{--counter-size:${mobile?88:140}px;right:0!important;top:-65px!important}
 #game .studio-preview-board{position:absolute;inset:0;z-index:1;display:none;overflow:hidden;background:${g.fill} ${g.texture?cssURL(src('enamel')):'none'} center / 100% 100% no-repeat;box-shadow:inset 0 6px 14px #0004}
 #game.studio-layout-test .studio-preview-board{display:flex}
 #game.studio-layout-test #board,#game.studio-layout-test #stack-layer{visibility:hidden!important}
 #game.studio-layout-test .console,#game.studio-layout-test #mobile-controller{pointer-events:none!important}
 #game .studio-preview-column{position:relative;overflow:hidden;height:100%;flex:1 1 0;min-width:0}.studio-preview-tile{position:absolute;left:0;width:100%;display:grid;place-items:center}.studio-preview-tile img{width:100%;height:100%;object-fit:contain;transform:scale(${g.symbolScale});pointer-events:none}
 #game .studio-preview-column.fast img{filter:blur(1.4px);transform:scale(${g.symbolScale}) scaleY(1.1)}
 #welcome{display:none!important}.studio-extra{position:absolute;pointer-events:none;object-fit:contain}.studio-extras{position:absolute;inset:0;pointer-events:none}
 `;
 const titleImage=document.getElementById('zombify-title'),titleURL=src(title.assetId);if(titleImage.src!==titleURL)titleImage.src=titleURL;
 syncExtras(s);
 const valid=compatible(project);
 game.classList.toggle('studio-layout-test',!valid);
 if(!valid)renderPreview();
 else{spinToken++;hurry=false;}
 screens.update(project,key);
 return {grid:g,compatible:valid};
}
// One <img> per image layer, reused across edits so dragging doesn't reload art.
function syncExtras(s){
 const want=s.layers.filter(l=>l.kind==='image'&&l.id!=='title');
 const nodes=want.map(l=>{
  let img=extraImages.get(l.id);
  if(!img){img=new Image();img.className='studio-extra';img.alt='';img.draggable=false;extraImages.set(l.id,img);}
  const url=src(l.assetId);if(img.dataset.url!==url){img.src=url;img.dataset.url=url;}
  img.style.cssText=rect(l)+`z-index:${s.layers.indexOf(l)+2}!important;`;
  return img;
 });
 for(const id of [...extraImages.keys()])if(!want.some(l=>l.id===id))extraImages.delete(id);
 if(nodes.length!==extras.children.length||nodes.some((n,i)=>extras.children[i]!==n))extras.replaceChildren(...nodes);
}

// ---- presentation-only reels for non-6×5 layouts (no bets, no payouts) ----
function renderPreview(){
 const g=current.grid,shape=`${g.columns}x${g.rows}`;
 preview.setAttribute('aria-label',`${g.columns} reels with ${g.rows} rows. Presentation-only layout test; no bets or payouts.`);
 if(shape!==previewShape){
  spinToken++;hurry=false;previewShape=shape;landed=null;
  columns=Array.from({length:g.columns},()=>{
   const el=document.createElement('div');el.className='studio-preview-column';
   const tiles=Array.from({length:g.rows+2},()=>{const t=document.createElement('div');t.className='studio-preview-tile';const img=new Image();img.alt='';img.draggable=false;t.append(img);el.append(t);return {t,img,url:''};});
   return {el,tiles};
  });
  preview.replaceChildren(...columns.map(c=>c.el));
 }
 columns.forEach((c,i)=>paint(c,landed?.[i]??(i*11)%STRIP.length,false));
}
const stripAt=j=>STRIP[(j%STRIP.length+STRIP.length)%STRIP.length];
// tape: the reel's own symbol lookup, which includes the landing splice.
function paint(column,pos,fast,tape=stripAt){
 const rows=current.grid.rows,base=Math.floor(pos),f=pos-base;
 column.el.classList.toggle('fast',fast);
 column.tiles.forEach((tile,k)=>{
  const row=k-1,id=SYMBOLS[tape(base+row)],url=src(current.symbols[id]);
  if(tile.url!==url){tile.img.src=url;tile.url=url;}
  tile.t.style.cssText=`height:${100/rows}%;top:${(row-f)*100/rows}%`;
 });
}
function previewSpin(){
 const token=++spinToken,g=current.grid,start=performance.now();hurry=false;
 const reels=columns.map((c,i)=>{const r=new Reel(i,STRIP,g.rows);r.setStrip(STRIP,landed?.[i]??(i*11)%STRIP.length);return r;});
 const stops=reels.map(()=>Math.floor(Math.random()*STRIP.length));
 reels.forEach((r,i)=>r.start(start,{speed:18,delay:i*60}));
 let last=start,requested=0;
 return new Promise(resolve=>{
  const frame=now=>{
   if(token!==spinToken)return resolve(false);
   const dt=Math.min(.04,(now-last)/1000);last=now;
   reels.forEach((r,i)=>{
    if(requested===i&&(hurry||now-start>1100+i*130)){r.stop(stops[i],{travel:3,quick:hurry});requested++;}
    r.update(now,dt);paint(columns[i],r.pos,Math.abs(r.vel)>6,j=>r.tape(j));
   });
   if(requested===reels.length&&reels.every(r=>!r.spinning)){landed=stops;resolve(true);return;}
   requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
 });
}

// ---- rounds ----
async function spin(id,mode){
 screens.close();
 const reject=message=>notify('round',{id,phase:'rejected',message});
 if(!current)return reject('The project is still loading.');
 if(locked())return reject('A round is already running.');
 const playable=compatible(current),rt=runtime();
 if(playable){
  if(!rt)return reject(MISSING);
  const l=rt.loading?.();
  if(l&&l.status!=='ready')return reject(l.status==='error'?'Some Zombify files failed to load. Retry loading, then spin again.':`Zombify artwork is still loading (${Math.round(100*l.loaded/Math.max(1,l.total))}%).`);
 }
 // Mark the round before anything async (Zombify decodes audio before it
 // reports busy), so no state message can make the editor think it's idle.
 round={id,mode};notify('round',{id,phase:'started',playable});pushState(true);
 let played=false,message='';
 try{
  played=playable?(await rt.start(mode))===true:await previewSpin();
  if(!played)message=playable?'Zombify did not start this round. See the message in the game preview.':'The layout test was interrupted.';
 }catch(error){message=error.message;}
 finally{round=null;notify('round',{id,phase:'finished',played,message});pushState(true);}
}

window.addEventListener('message',e=>{
 if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='slot-studio')return;
 const d=e.data,{type,id}=d;
 try{
  if(type==='apply'){
   if(!['desktop','mobile'].includes(d.scene))throw Error('Unknown scene.');
   if(locked()){pending={project:d.project,scene:d.scene,rev:d.rev};notify('deferred',{rev:d.rev});return;}
   notify('applied',{rev:d.rev,...apply(d.project,d.scene)});
  }
  else if(type==='screen-adjust'){if(locked())throw Error('Finish the current round before editing screens.');screens.adjust(d.settings);}
  else if(type==='screen-preview'){if(locked())throw Error('Finish the current round before previewing screens.');screens.show(d.screen,{tier:d.tier,winTier:d.winTier,guidePage:d.guidePage});}
  else if(type==='spin')void spin(id,d.mode||'base');
  else if(type==='continue')runtime()?.continue();
  else if(type==='skip'){if(round&&!compatible(current))hurry=true;else runtime()?.skip?.();}
  else if(type==='speed')runtime()?.speed(d.value);
  else if(type==='retry')void runtime()?.retryLoading?.().catch(()=>{}).finally(pushGame);
  else if(type==='ping')notify('pong',{id});
  else if(type==='read')notify('state',{id,state:runtime()?.read(),presentationOnly:current?!compatible(current):false});
 }catch(error){notify('error',{id,context:type,message:error.message});}
});
notify('ready');
pushGame();
// app.js runs before this module, so a missing facade means it failed to load.
setTimeout(()=>{if(!runtime()){bootFailed=true;pushGame();}},1500);
setInterval(pushState,100);
setInterval(pushGame,250);
