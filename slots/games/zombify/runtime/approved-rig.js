import {loadImage} from './asset-cache.js';
import {clipDuration} from './approved-rig-renderer.js';
import {fitRig,rigBounds,stepPlan,stepEvents,downwardJumpPose,stepPath,holdAt,jumpArc,APPROACH,RECOVER,HIT_STOP} from './rig-geometry.js';
import {rigSurface} from './rig-gpu.js';
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
function surface(host){
 const canvas=document.createElement('canvas');canvas.className='approved-rig-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
 const view=rigSurface(canvas);
 // The host's size, refreshed after layout by a ResizeObserver: reading
 // clientWidth on every frame forced a layout per rig per frame.
 const size={width:host.clientWidth,height:host.clientHeight};
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{size.width=host.clientWidth;size.height=host.clientHeight;}):null;
 observer?.observe(host);
 const measure=()=>observer?size:{width:host.clientWidth,height:host.clientHeight};
 return {canvas,measure,draw(rig,clip,time,fit){
  const {width,height}=measure(),dpr=Math.min(globalThis.devicePixelRatio||1,2);if(!width||!height)return;
  view.paint(rig,clip,time,fit,width,height,dpr);
 },remove(){observer?.disconnect();canvas.remove();}};
}
function scheduleIdle(){if(idleFrame===null&&active.size&&!document.hidden)idleFrame=requestAnimationFrame(tickIdle);}
function tickIdle(now){idleFrame=null;for(const owner of [...active])owner.paint(now);scheduleIdle();}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
 document.documentElement.dataset.backgroundPaused=String(document.hidden);
 if(document.hidden&&idleFrame!==null){cancelAnimationFrame(idleFrame);idleFrame=null;}else scheduleIdle();
});
export async function mountApprovedRig(host,{horizontal=false,span=2,direction='right',walking=false,staticPose=false,rate=1,view:customView,clip:customClip,fit:customFit,phase=0,ambient=false}={}){
 mounts.get(host)?.stop();let stopped=false,drawSurface,last=-Infinity;
 const owner={host,stop(){stopped=true;active.delete(owner);drawSurface?.remove();if(mounts.get(host)===owner)mounts.delete(host);if(!active.size&&idleFrame!==null){cancelAnimationFrame(idleFrame);idleFrame=null;}}};
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
  const {width,height}=drawSurface.measure();
  const fit=customFit?customFit(width,height):fitRig(rig.data,clip==='headless'?'idle':clip,width,height,{horizontal:horizontal||walking,padding:.035});
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
// The smallest box (layer coordinates) holding the rig at every station of a
// move, in every pose of its clips, plus the cells it starts or ends in.
// Positions and scale interpolate linearly between stations, so every frame in
// between stays inside it. A board-sized motion canvas spent most of its
// pixels on transparency: about 0.45 MP per frame on a phone, for one zombie.
export function motionBox(data,{stations,clips,rects=[]}){
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const clip of clips){
  const duration=clipDuration(data,clip);
  for(let i=0;i<=12;i++){
   const b=rigBounds(data,clip,duration*i/12);
   for(const p of stations){left=Math.min(left,p.x+b.left*p.scale);right=Math.max(right,p.x+b.right*p.scale);top=Math.min(top,p.y-b.top*p.scale);bottom=Math.max(bottom,p.y-b.bottom*p.scale);}
  }
 }
 for(const r of rects){left=Math.min(left,r.x);top=Math.min(top,r.y);right=Math.max(right,r.x+r.width);bottom=Math.max(bottom,r.y+r.height);}
 const margin=4+.06*Math.max(right-left,bottom-top);
 return {x:Math.floor(left-margin),y:Math.floor(top-margin),width:Math.ceil(right-left+margin*2),height:Math.ceil(bottom-top+margin*2)};
}
// The motion host sits in the layer, sized to `box` when given (the whole
// layer otherwise); claims of other zombies are masked out of it.
function motionHost(layer,board,occludedCells,box){
 const host=document.createElement('div');host.className='approved-rig-motion';
 if(box)Object.assign(host.style,{inset:'auto',left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`});
 layer.append(host);maskZombieMotion(host,board,occludedCells);return host;
}
function overlay(layer,box,board,occludedCells){
 // Overlay dimensions follow the move. They never participate in layout.
 const host=motionHost(layer,board,occludedCells,box),drawSurface=surface(host);
 const draw=box?(rig,clip,time,fit)=>drawSurface.draw(rig,clip,time,{...fit,x:fit.x-box.x,y:fit.y-box.y}):drawSurface.draw;
 // Weight on landing: a quick squash and settle about the feet, composited
 // (transform only), never under reduced motion. It moves the canvas, not the
 // host, so the occlusion mask stays on the board.
 const land=(x,y,rate=1)=>{
  const canvas=drawSurface.canvas;
  if(!canvas.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  canvas.style.transformOrigin=`${x-(box?.x||0)}px ${y-(box?.y||0)}px`;
  canvas.animate([{transform:'scale(1,1)'},{transform:'scale(1.045,.93)',offset:.22},{transform:'scale(.985,1.02)',offset:.6},{transform:'scale(1,1)'}],{duration:230/Math.max(.5,rate/ZOMBIE_ACTION_SPEED),easing:'cubic-bezier(.2,.7,.3,1)'});
 };
 return {host,draw,land,remove(){drawSurface.remove();host.remove();}};
}
export function createApprovedAnimator(){
 return {
  async playStep({source,target,direction,layer,board,occludedCells,rate=1,shouldSkip,onEvent}){
   rate*=ZOMBIE_ACTION_SPEED;
   const view=direction==='up'?'rear':direction==='down'?'front':'side';
   const rig=await loadApprovedRig(view);if(shouldSkip())return;
   const turning=direction==='up'?await Promise.all(['front','side'].map(loadApprovedRig)):null;if(shouldSkip())return;
   const bounds=layer.getBoundingClientRect(),local=r=>({...r,x:r.x-bounds.left,y:r.y-bounds.top});
   const plan=stepPlan({[view]:rig},local(source),local(target),direction),path=stepPath(plan);
   const at$=p=>({...p,scale:plan.scale});
   // A jump's apex is above both ends; include it so the canvas holds the arc.
   const apex=plan.action==='jump'?[{x:plan.start.x,y:Math.min(plan.start.y,plan.strike.y)-plan.scale*24}]:[];
   const motion=overlay(layer,motionBox(rig.data,{stations:[plan.start,plan.strike,plan.end,...apex].map(at$),clips:[plan.rest,plan.clip,plan.move].filter(c=>rig.data.animations[c]),rects:[local(source),local(target)]}),board,occludedCells);
   const at=(p,clip,time)=>motion.draw(rig,clip,time,{scale:plan.scale,rotation:plan.rotation,...p});
   // Contact holds for a beat (shorter at Quick/Turbo) so the bite lands.
   const strike=holdAt({duration:clipDuration(rig.data,plan.clip),events:stepEvents(rig.data,plan)},plan.contact,HIT_STOP*ZOMBIE_ACTION_SPEED);
   try{
    if(plan.action==='jump'){
     const jumpRate=rate*1.6,feet=()=>({x:plan.strike.x,y:plan.strike.y});
     await runRigTimeline({duration:strike.duration,rate:jumpRate,shouldSkip,events:strike.events,onEvent:name=>{if(name==='swat_contact'||name==='impact')motion.land(feet().x,feet().y,jumpRate);onEvent(name);},paint:t=>{const time=strike.time(t);at(downwardJumpPose(plan,time),plan.clip,time);}});
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
    }else await runRigTimeline({duration:APPROACH,rate,shouldSkip,paint:t=>at(path.approach(t),plan.rest,0)});
    await runRigTimeline({duration:strike.duration,rate,shouldSkip,events:strike.events,onEvent,paint:t=>at(plan.strike,plan.clip,strike.time(t))});
    // The swat recovers before climbing into the freshly revealed multiplier.
    await runRigTimeline({duration:RECOVER,rate,shouldSkip,paint:t=>at(path.recover(t),plan.move,t*(plan.action==='crawl'?1.2/RECOVER:2))});
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
   const events=rig.data.animations[clip].events,hit=events.find(e=>e.name==='impact').time,takeoff=events.find(e=>e.name==='takeoff')?.time??0;
   const lift=target.height*.08,apex={x:start.x,y:Math.min(start.y,end.y)-lift,scale:end.scale};
   const motion=overlay(layer,motionBox(rig.data,{stations:[start,end,apex],clips:[clip],rects:[{x:source.x,y:source.y,width:source.width,height:source.height},{x:target.x-target.width/2,y:target.y-target.height,width:target.width,height:target.height}]}),board,occludedCells);
   const landing=holdAt({duration:clipDuration(rig.data,clip),events},hit,HIT_STOP*ZOMBIE_EXPAND_SPEED);
   try{
    await runRigTimeline({duration:landing.duration,rate,shouldSkip,events:landing.events,onEvent:name=>{if(name==='impact')motion.land(target.x,target.y,rate);onEvent(name);},paint:t=>{
     // Still through the crouch, then an arc into the stack that is fastest
     // as it lands; it grows as it flies.
     const time=landing.time(t),p=Math.max(0,Math.min(1,(time-takeoff)/(hit-takeoff))),at=jumpArc(start,end,{takeoff,land:hit,lift},time);
     motion.draw(rig,clip,time,{scale:mix(start.scale,end.scale,p),x:at.x,y:at.y});
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
   for(const {layer}of exits){const {width,height}=layer.measure();layer.draw(rig,'head_drop',t,fitRig(rig.data,'idle',width,height,{padding:.035}));}
  }});
 }finally{
  // Keep the final headless body for the reel-strip handoff, including Skip.
  for(const {layer}of exits){const {width,height}=layer.measure();layer.draw(rig,'headless',0,fitRig(rig.data,'idle',width,height,{padding:.035}));}
 }
 return finished;
}
