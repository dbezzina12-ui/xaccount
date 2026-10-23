// Runs inside the imported, real Zombify runtime. All coordinates come from
// the same project displayed by the editor; original outcome logic is retained.
import {validateProject,compatible,SYMBOLS} from './project.js';
import {Reel} from '../engine/client/reels.js';
const rootURL=new URL('../',import.meta.url),game=document.getElementById('game');
const style=document.createElement('style');style.id='studio-presentation';document.head.append(style);
const background=document.createElement('div');background.className='studio-background';
const tint=document.createElement('div');tint.className='studio-tint';background.append(tint);game.prepend(background);
const dividers=document.createElement('div');dividers.className='studio-dividers';document.querySelector('.board-wrap').append(dividers);
const extras=document.createElement('div');extras.className='studio-extras';game.append(extras);
let current=null,sceneKey='desktop',generation=0,wasCompatible=true,previewBusy=false;
const cssURL=url=>`url(${JSON.stringify(url)})`;
const src=id=>{const asset=current.assets.find(a=>a.id===id);return new URL(asset.src,rootURL).href;};
const notify=(type,payload={})=>parent.postMessage({source:'slot-runtime',type,...payload},location.origin);
const rect=l=>`position:absolute!important;left:${l.x}px!important;top:${l.y}px!important;width:${l.w}px!important;height:${l.h}px!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;transform:none!important;opacity:${l.opacity}!important;display:${l.visible?'block':'none'}!important;`;
function apply(project,key){
 validateProject(project);current=project;sceneKey=key;const s=project.scenes[key],g=project.grid,reels=s.layers.find(l=>l.id==='reels'),title=s.layers.find(l=>l.id==='title'),controls=s.layers.find(l=>l.id==='controls'),mobile=s.width<s.height;
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
 #game .board{position:relative!important;width:100%!important;height:100%!important;display:grid!important;grid-template-columns:repeat(${g.columns},minmax(0,1fr))!important;grid-template-rows:repeat(${g.rows},minmax(0,1fr))!important;gap:0!important;padding:0!important;margin:0!important;border:0!important;background:${g.fill} ${g.texture?cssURL(src('enamel')):'none'} center / 100% 100% no-repeat!important;overflow:hidden!important;box-shadow:inset 0 6px 14px #0004!important}
 #game .board .tile{width:100%!important;height:100%!important;min-height:0!important;min-width:0!important;aspect-ratio:auto!important;border:0!important;background:none!important;box-shadow:none!important;overflow:hidden!important}
 #game .tile>.symbol,#game .reel-strip .tile>.symbol{transform:scale(${g.symbolScale})!important}
 #game .symbol{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}
 ${artRules}
 #game .tile[data-infection="0"] .symbol{background-size:contain!important}
 #game .stack-layer{inset:0!important;padding:0!important;gap:0!important;grid-template-columns:repeat(${g.columns},minmax(0,1fr))!important;grid-template-rows:repeat(${g.rows},minmax(0,1fr))!important}
 #game .spinning-reel{background-color:${g.fill}!important;background-image:${g.texture?cssURL(src('enamel')):'none'}!important}
 .studio-dividers{position:absolute;inset:0;z-index:18;pointer-events:none;opacity:${g.divider};background:linear-gradient(90deg,transparent calc(100% - 1px),#a9d7e7 0) 0 0 / ${100/g.columns}% 100%,linear-gradient(0deg,transparent calc(100% - 1px),#a9d7e7 0) 0 0 / 100% ${100/g.rows}%;box-shadow:inset 0 0 0 1px #a9d7e7}
 #game .cabinet-supports{display:${g.supports?'flex':'none'}!important;height:${reels.w*.075}px!important;margin:-2px 3% 0!important}
 #game .brand{${rect(title)}z-index:${s.layers.indexOf(title)+2}!important;text-align:left!important}
 #game .brand h1.peek-title{position:static!important;width:100%!important;height:100%!important;max-width:none!important;transform:none!important;margin:0!important;padding:0!important}
 #game .brand img{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important}
 #game .console{visibility:visible!important;pointer-events:auto;position:absolute!important;left:${controls.x}px!important;top:${controls.y}px!important;bottom:auto!important;width:880px!important;height:100px!important;max-width:none!important;min-height:0!important;margin:0!important;transform:scale(${controls.w/880},${controls.h/100})!important;transform-origin:0 0!important;display:${!mobile&&controls.visible?'flex':'none'}!important;align-items:center!important;justify-content:space-evenly!important;gap:14px!important;padding:8px 18px!important;border:0!important;background:#06121baa!important;border-radius:16px!important;z-index:10!important;opacity:${controls.opacity}!important}
 #game #mobile-controller{position:absolute!important;left:${controls.x}px!important;top:${controls.y}px!important;right:auto!important;bottom:auto!important;width:390px!important;height:214px!important;max-width:none!important;margin:0!important;transform:scale(${controls.w/390},${controls.h/214})!important;transform-origin:0 0!important;display:${mobile&&controls.visible?'block':'none'}!important;z-index:10!important;opacity:${controls.opacity}!important}
 #game .infection-tracker{position:absolute!important;top:${reels.h+reels.w*.08+8}px!important;left:0!important;right:auto!important;width:100%!important;max-width:none!important;z-index:20!important}
 #game .infection-people{display:flex!important;justify-content:center!important}.infection-tube{max-height:65px!important}.infection-heading{font-size:9px!important}.tube-name{display:none!important}
 #game .free-spins-counter{--counter-size:${mobile?88:140}px;right:0!important;top:-65px!important}
 #game .studio-preview-column{position:relative;overflow:hidden;height:100%;min-width:0}.studio-preview-tile{position:absolute;left:0;width:100%;display:grid;place-items:center}.studio-preview-tile img{width:100%;height:100%;object-fit:contain;transform:scale(${g.symbolScale});pointer-events:none}
 #welcome{display:none!important}.studio-extra{position:absolute;pointer-events:none;object-fit:contain}.studio-extras{position:absolute;inset:0;z-index:4;pointer-events:none}
 `;
 document.getElementById('zombify-title').src=src(title.assetId);
 extras.replaceChildren(...s.layers.filter(l=>l.kind==='image'&&l.id!=='title').map(l=>{const img=new Image();img.src=src(l.assetId);img.className='studio-extra';img.style.cssText=rect(l);return img;}));
 const valid=compatible(project);
 if(!valid){document.getElementById('stack-layer').style.display='none';document.querySelector('.console').style.pointerEvents='none';document.getElementById('mobile-controller').style.pointerEvents='none';renderGrid();}
 else {generation++;previewBusy=false;document.getElementById('stack-layer').style.display='';document.querySelector('.console').style.pointerEvents='';document.getElementById('mobile-controller').style.pointerEvents='';if(!wasCompatible)window.ZombifyStudioRuntime?.resetBoard();}
 wasCompatible=valid;notify('applied',{grid:g,compatible:valid});
}
function renderGrid(){
 generation++;previewBusy=false;const g=current.grid,board=document.getElementById('board');board.setAttribute('aria-label',`${g.columns} reels with ${g.rows} rows. Presentation-only layout test; no bets or payouts.`);board.style.setProperty('display','flex','important');board.replaceChildren();
 for(let r=0;r<g.rows;r++)for(let c=0;c<g.columns;c++){const div=document.createElement('div');div.className='tile';const img=document.createElement('span');img.className='symbol';img.style.cssText=`width:100%;height:100%;background-image:${cssURL(src(current.symbols[SYMBOLS[(r*7+c*3)%SYMBOLS.length]]))};transform:scale(${g.symbolScale})`;div.append(img);board.append(div);}
 board.style.removeProperty('display');
}
async function testReels(){
 if(previewBusy)return;previewBusy=true;const token=++generation,g=current.grid,board=document.getElementById('board');
 const strip=Int16Array.from({length:60},(_,i)=>i%SYMBOLS.length),reels=Array.from({length:g.columns},(_,i)=>new Reel(i,strip,g.rows));
 board.replaceChildren();board.style.setProperty('display','flex','important');const cols=reels.map(()=>{const el=document.createElement('div');el.className='studio-preview-column';el.style.width=100/g.columns+'%';board.append(el);return el;});
 const start=performance.now();reels.forEach((r,i)=>r.start(start,{speed:18,delay:i*60}));
 let last=start,stops=0;
 await new Promise(resolve=>{function frame(ms){if(token!==generation){resolve();return;}const now=ms,dt=Math.min(.04,(now-last)/1000);last=now;
 reels.forEach((r,i)=>{if(now-start>1100+i*130&&stops<=i){r.stop(Math.floor(Math.random()*strip.length),{travel:3});stops++;}r.update(now,dt);const fragment=document.createDocumentFragment();for(let row=-1;row<g.rows+1;row++){const d=document.createElement('div');d.className='studio-preview-tile';d.style.height=100/g.rows+'%';d.style.top=(row-(r.pos-Math.floor(r.pos)))*100/g.rows+'%';const img=new Image();const id=SYMBOLS[r.symbol(row)??0];img.src=src(current.symbols[id]||current.symbols.j);d.append(img);fragment.append(d);}cols[i].replaceChildren(fragment);});
 if(stops===g.columns&&reels.every(r=>!r.spinning)){previewBusy=false;notify('spin-complete',{presentationOnly:true});resolve();return;}requestAnimationFrame(frame);}requestAnimationFrame(frame);});
}
window.addEventListener('message',async e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='slot-studio')return;const {type,id}=e.data;
 try{if(type==='apply'){if(!['desktop','mobile'].includes(e.data.scene))throw Error('Unknown scene.');if(window.ZombifyStudioRuntime?.read().busy)throw Error('Finish the current round before editing.');apply(e.data.project,e.data.scene);}
 else if(type==='spin'){if(!current)throw Error('Project is loading.');if(compatible(current)){await window.ZombifyStudioRuntime.start(e.data.mode||'base');notify('spin-complete');}else await testReels();}
 else if(type==='continue')window.ZombifyStudioRuntime?.continue();
 else if(type==='read')notify('state',{id,state:window.ZombifyStudioRuntime?.read(),presentationOnly:!compatible(current)});
 else if(type==='speed')window.ZombifyStudioRuntime?.speed(e.data.value);
 }catch(error){notify('error',{id,message:error.message});}});
notify('ready');
