import {loadImage} from './asset-cache.js';
import {clipDuration} from './approved-rig-renderer.js';
import {fitRig,stepPlan,stepEvents,downwardJumpPose} from './rig-geometry.js';
import {paintRig} from './rig-gpu.js';
import {createRecliningArt,recliningArtReady} from './reclining-art.js';
import {fullReelExitIds,maskZombieMotion} from './zombie-layout.js';

const loads=new Map(),mounts=new WeakMap(),active=new Set();
export const ZOMBIE_ACTION_SPEED=1.7;
export const ZOMBIE_EXPAND_SPEED=1.6;
let idleFrame=null;
export function loadApprovedRig(view){
 if(!loads.has(view))loads.set(view,(async()=>{
  const base=`assets/approved-rig/${view}/`,response=await fetch(base+'rig.json',{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Cannot load ${view} rig`);
  const data=await response.json(),images={};
  const paths=[...new Set(Object.values(data.skins[0].attachments).flatMap(g=>Object.values(g).map(a=>a.path)))];
  await Promise.all(paths.map(async path=>{images[path]=await loadImage(base+'images/'+path+'.png');}));
  return {data,images};
 })().catch(error=>{loads.delete(view);throw error;}));
 return loads.get(view);
}
export function preloadApprovedRigs(){return Promise.all(['front','side','rear'].map(loadApprovedRig));}
function clear(ctx,canvas,dpr){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(dpr,0,0,dpr,0,0);}
function surface(host){
 const canvas=document.createElement('canvas');canvas.className='approved-rig-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
 const ctx=canvas.getContext('2d');
 return {canvas,draw(rig,clip,time,fit){
  const width=host.clientWidth,height=host.clientHeight,dpr=Math.min(globalThis.devicePixelRatio||1,2);if(!width||!height)return;
  const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  clear(ctx,canvas,dpr);paintRig(ctx,rig,clip,time,fit,width,height,dpr);
 }};
}
function scheduleIdle(){if(idleFrame===null&&active.size&&!document.hidden)idleFrame=requestAnimationFrame(tickIdle);}
function tickIdle(now){idleFrame=null;for(const owner of [...active])owner.paint(now);scheduleIdle();}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
 document.documentElement.dataset.backgroundPaused=String(document.hidden);
 if(document.hidden&&idleFrame!==null){cancelAnimationFrame(idleFrame);idleFrame=null;}else scheduleIdle();
});
export async function mountApprovedRig(host,{horizontal=false,span=2,direction='right',walking=false,staticPose=false,rate=1,view:customView,clip:customClip,fit:customFit,phase=0,ambient=false}={}){
 mounts.get(host)?.stop();let stopped=false,drawSurface,last=-Infinity;
 const owner={host,stop(){stopped=true;active.delete(owner);drawSurface?.canvas.remove();if(mounts.get(host)===owner)mounts.delete(host);if(!active.size&&idleFrame!==null){cancelAnimationFrame(idleFrame);idleFrame=null;}}};
 mounts.set(host,owner);
 const view=customView||(horizontal||walking?'side':'front'),face=direction==='left'?'left':'right';
 let rig;try{rig=await loadApprovedRig(view);}catch{owner.stop();return null;}
 if(stopped||!host.isConnected){owner.stop();return null;}
 drawSurface=surface(host);host.classList.add('approved-rig-ready');
 const clip=customClip||(walking?`walk_${face}`:horizontal?`row_hold_${face}_${Math.max(2,Math.min(6,span))}`:rig.data.animations.settled_idle?'settled_idle':'idle'),duration=clipDuration(rig.data,clip),start=performance.now();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 owner.paint=now=>{
  if(stopped||!host.isConnected){owner.stop();return;}
  if(ambient&&document.documentElement?.dataset.backgroundPaused==='true')return;
  if(now-last<1000/(ambient?24:walking?60:30)-1)return;last=now;
  const time=reduced||staticPose?0:((now-start)/1000*rate+phase)%duration;
  const fit=customFit?customFit(host.clientWidth,host.clientHeight):fitRig(rig.data,clip==='headless'?'idle':clip,host.clientWidth,host.clientHeight,{horizontal:horizontal||walking,padding:.035});
  drawSurface.draw(rig,clip,time,fit);
 };
 owner.paint(start);
 if(!reduced&&!staticPose){active.add(owner);scheduleIdle();}
 return owner;
}
export function stopApprovedRigs(root){
 for(const owner of [...active])if(!root||root.contains(owner.host))owner.stop();
 // Disconnected hosts are also pruned on the next shared animation frame.
}
const ease=t=>t*t*(3-2*t),mix=(a,b,p)=>a+(b-a)*p;
export function crossedEvents(events,previous,time){return (events||[]).filter(e=>e.time>previous&&e.time<=time);}
export function runRigTimeline({duration,rate=1,shouldSkip=()=>false,events=[],paint,onEvent=()=>{}}){
 return new Promise((resolve,reject)=>{
  const start=performance.now();let previous=-1,raf=null,timer=null,done=false;
  const finish=error=>{if(done)return;done=true;if(raf!==null)cancelAnimationFrame(raf);if(timer!==null)clearTimeout(timer);error?reject(error):resolve();};
  function frame(now){
   raf=null;timer=null;
   try{
    if(shouldSkip()){finish();return;}
    const time=Math.min(duration,(now-start)/1000*rate);
    if(!document.hidden)paint(time);
    for(const e of crossedEvents(events,previous,time))onEvent(e.name);previous=time;
    if(time>=duration){finish();return;}
    if(document.hidden)timer=setTimeout(()=>frame(performance.now()),40);else raf=requestAnimationFrame(frame);
   }catch(error){finish(error);}
  }
  frame(start);
 });
}
function motionHost(layer,board,occludedCells){
 const host=document.createElement('div');host.className='approved-rig-motion';
 layer.append(host);maskZombieMotion(host,board,occludedCells);return host;
}
function overlay(layer,board,occludedCells){
 // Overlay dimensions follow the existing board. They never participate in layout.
 const host=motionHost(layer,board,occludedCells),drawSurface=surface(host);
 return {host,draw:drawSurface.draw,remove(){host.remove();}};
}
export function createApprovedAnimator(){
 return {
  async playStep({source,target,direction,layer,board,occludedCells,rate=1,shouldSkip,onEvent}){
   rate*=ZOMBIE_ACTION_SPEED;
   const view=direction==='up'?'rear':direction==='down'?'front':'side';
   const rig=await loadApprovedRig(view);if(shouldSkip())return;
   const turning=direction==='up'?await Promise.all(['front','side'].map(loadApprovedRig)):null;if(shouldSkip())return;
   const bounds=layer.getBoundingClientRect(),local=r=>({...r,x:r.x-bounds.left,y:r.y-bounds.top});
   const plan=stepPlan({[view]:rig},local(source),local(target),direction),motion=overlay(layer,board,occludedCells);
   const at=(p,clip,time)=>motion.draw(rig,clip,time,{scale:plan.scale,rotation:plan.rotation,...p});
   try{
    if(plan.action==='jump'){
     await runRigTimeline({duration:clipDuration(rig.data,plan.clip),rate:rate*1.6,shouldSkip,events:stepEvents(rig.data,plan),onEvent,paint:t=>at(downwardJumpPose(plan,t),plan.clip,t)});
     return;
    }
    if(turning){
     // Three approved views turn on one planted pivot; no sidestep or body sway.
     await runRigTimeline({duration:.18,rate,shouldSkip,paint:t=>{
      if(t>=.12){at(plan.start,plan.rest,0);return;}
      const front=t<.065,model=turning[front?0:1],clip=front?'idle':'idle_right';
      const localSource=local(source),fit=fitRig(model.data,clip,localSource.width,localSource.height,{padding:.035});
      motion.draw(model,clip,0,{scale:fit.scale,x:localSource.x+fit.x,y:localSource.y+fit.y});
     }});
    }else await runRigTimeline({duration:.18,rate,shouldSkip,paint:t=>{const p=ease(t/.18);at({x:mix(plan.start.x,plan.strike.x,p),y:mix(plan.start.y,plan.strike.y,p)},plan.rest,0);}});
    await runRigTimeline({duration:clipDuration(rig.data,plan.clip),rate,shouldSkip,events:stepEvents(rig.data,plan),onEvent,paint:t=>at(plan.strike,plan.clip,t)});
    // The swat recovers before climbing into the freshly revealed multiplier.
    await runRigTimeline({duration:.46,rate,shouldSkip,paint:t=>{const p=ease(t/.46);at({x:mix(plan.strike.x,plan.end.x,p),y:mix(plan.strike.y,plan.end.y,p)},plan.move,t*(plan.action==='crawl'?1.2/.46:2));}});
   }finally{motion.remove();}
  },
  async play({rig:kind,cells,target,layer,source,direction,board,occludedCells,rate=1,shouldSkip,onEvent}){
   rate*=ZOMBIE_EXPAND_SPEED;
   if(kind==='horizontal'){
    // Crawl/swat remains skeletal. The awarded row resolves into the full artwork.
    const image=createRecliningArt(direction,cells.length);await recliningArtReady(image);if(shouldSkip())return;
    const host=document.createElement('div');host.className='reclining-resolve-motion';
    Object.assign(host.style,{left:`${target.x-target.width/2}px`,top:`${target.y-target.height}px`,width:`${target.width}px`,height:`${target.height}px`});
    const motion=motionHost(layer,board,occludedCells);host.append(image);motion.append(host);
    try{
     await runRigTimeline({duration:.56,rate,shouldSkip,events:[{time:.3,name:'impact'},{time:.56,name:'settle'}],onEvent,paint:t=>{
      const p=ease(Math.min(1,t/.3)),bounce=t>.3?Math.sin((t-.3)/.26*Math.PI)*2:0;
      host.style.transform=`translateY(${-8*(1-p)-bounce}px) scale(${.88+.12*p})`;
     }});
    }finally{motion.remove();}
    return;
   }
   const rig=await loadApprovedRig('front');if(shouldSkip())return;
   const clip='jump_land',fit=fitRig(rig.data,'idle',target.width,target.height,{padding:.035});
   const end={scale:fit.scale,x:target.x-target.width/2+fit.x,y:target.y-target.height+fit.y};
   const small=fitRig(rig.data,'idle',source.width,source.height,{padding:.035});
   const start={scale:small.scale,x:source.x+small.x,y:source.y+small.y};
   const duration=clipDuration(rig.data,clip),events=rig.data.animations[clip].events,hit=events.find(e=>e.name==='impact').time;
   const motion=overlay(layer,board,occludedCells);
   try{
    await runRigTimeline({duration,rate,shouldSkip,events,onEvent,paint:t=>{
     const p=ease(Math.min(1,t/hit));
     motion.draw(rig,clip,t,{scale:mix(start.scale,end.scale,p),x:mix(start.x,end.x,p),y:mix(start.y,end.y,p)});
    }});
   }finally{motion.remove();}
  }
 };
}

export async function playFullReelExit(root,{board=[],rate=1,shouldSkip=()=>false,onEvent=()=>{}}={}){
 const eligible=fullReelExitIds(board);
 const frames=[...root.querySelectorAll('.expanded-zombie.full-reel[data-span="5"]:not(.horizontal-zombie)')].filter(frame=>eligible.has(frame.dataset.headId));
 const finished=new Set();
 if(!frames.length||shouldSkip())return finished;
 let rig;try{rig=await loadApprovedRig('front');}catch{return finished;}
 if(shouldSkip())return finished;
 const exits=frames.flatMap(frame=>{
  const host=frame.querySelector('.stack-art');if(!host)return [];
  mounts.get(host)?.stop();const layer=surface(host);host.classList.add('approved-rig-ready');
  finished.add(frame.dataset.headId);
  return [{host,layer}];
 });
 if(!exits.length)return finished;
 try{
  await runRigTimeline({duration:clipDuration(rig.data,'head_drop'),rate:rate*1.25,shouldSkip,events:rig.data.animations.head_drop.events,onEvent,paint:t=>{
   for(const {host,layer}of exits)layer.draw(rig,'head_drop',t,fitRig(rig.data,'idle',host.clientWidth,host.clientHeight,{padding:.035}));
  }});
 }finally{
  // Keep the final headless body for the reel-strip handoff, including Skip.
  for(const {host,layer}of exits)layer.draw(rig,'headless',0,fitRig(rig.data,'idle',host.clientWidth,host.clientHeight,{padding:.035}));
 }
 return finished;
}
