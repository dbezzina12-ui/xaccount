import {occludingCells} from './zombie-layout.js';
import {copySymbolPaint} from './symbol-paint.js';
import {getZombieAnimator} from './zombie-jump.js';
import {createApprovedAnimator,ZOMBIE_ACTION_SPEED} from './approved-rig.js';
import {HIT_STOP} from './rig-geometry.js';
// Presentation only: outcomes, bite values and awarded cells come from math.js.
const fallbackAnimator=createApprovedAnimator();
export function debrisDirection(direction){return direction==='up'?'left':direction;}
export function swatTrajectory(source,target,viewport,direction='right'){
 const flight=debrisDirection(direction),left=flight==='left';
 if(flight==='down')return {dx:-target.width*1.15,dy:Math.max(target.height*.6,(viewport.height-target.top)*.34),endY:viewport.height-target.top+target.height*1.5,rotation:-110};
 return {dx:left?-(target.right??target.left+target.width)-target.width:viewport.width-target.left+target.width,dy:-Math.max(40,target.height*.75),endY:target.height*.5,rotation:left?-125:125};
}
export function debrisFrames(f){return [
 {transform:'translate(0,0) rotate(0)'},
 {transform:`translate(${f.dx*.45}px,${f.dy}px) rotate(${f.rotation*.45}deg)`,offset:.45},
 {transform:`translate(${f.dx}px,${f.endY}px) rotate(${f.rotation}deg)`}
];}
function flyingTile(target){
 const copy=target.cloneNode(true),style=getComputedStyle(target);
 copy.className='swatted-symbol flying-tile';copy.querySelectorAll('.carrier-value').forEach(n=>n.remove());
 Object.assign(copy.style,{background:style.background,border:style.border,borderRadius:style.borderRadius,boxShadow:style.boxShadow});
 copySymbolPaint(target.firstElementChild,copy.firstElementChild);
 copy.setAttribute('aria-hidden','true');
 target.style.background='transparent';target.style.borderColor='transparent';target.style.boxShadow='none';
 return copy;
}
export async function playSwatStep({event,board,layer,animate,rate=1,shouldSkip,onContact}){
 if(shouldSkip())return;
 const source=board.children[event.source],target=board.children[event.target],a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
 const value=target.querySelector('.multiplier-digits');if(value&&event.gain>0)value.textContent=`+${event.gain}×`;
 const registered=getZombieAnimator(),adapter=registered?.playStep?registered:fallbackAnimator;
 let contactTask=null;
 const contact=()=>contactTask||(contactTask=(async()=>{
  if(shouldSkip())return;
  const flying=flyingTile(target);
  if(event.type==='heart'){
   flying.className='heart-pickup';
   Object.assign(flying.style,{background:'transparent',border:'0',boxShadow:'none'});
  }
  Object.assign(flying.style,{left:`${b.left}px`,top:`${b.top}px`,width:`${b.width}px`,height:`${b.height}px`});
  document.body.append(flying);target.firstElementChild.style.visibility='hidden';target.classList.add('multiplier-revealed');onContact?.();
  if(event.type==='heart'){
   try{await animate(flying,[{transform:'scale(1)',opacity:1},{transform:'translateY(-18px) scale(1.35)',opacity:1,offset:.35},{transform:`translate(${(a.left-b.left)*.35}px,${(a.top-b.top)*.35-20}px) scale(.12)`,opacity:0}],450/ZOMBIE_ACTION_SPEED,{fill:'forwards',easing:'ease-in'});}finally{flying.remove();}
   return;
  }
  const f=swatTrajectory(a,b,{width:window.innerWidth,height:window.innerHeight},event.direction);
  try{
   // The hit: while the zombie holds its contact pose, the block pops and
   // flashes, and a bite nudges the board the way it was struck. Then it flies.
   const hold=HIT_STOP*1000/Math.max(.25,rate),tilt=f.rotation>0?4:-4;
   if(event.human&&board.animate){
    const push=event.direction==='left'?[-1.5,0]:event.direction==='right'?[1.5,0]:event.direction==='up'?[0,-1.5]:[0,1.5];
    board.animate([{transform:'translate(0,0)'},{transform:`translate(${push[0]}px,${push[1]}px)`,offset:.3},{transform:'translate(0,0)'}],{duration:150/Math.max(.25,rate),easing:'ease-out'});
   }
   await animate(flying,[{transform:'scale(1)',filter:'brightness(1)'},{transform:`scale(1.12) rotate(${tilt}deg)`,filter:'brightness(1.6)'}],hold,{fill:'forwards',easing:'cubic-bezier(.2,.8,.3,1)'});
   await animate(flying,debrisFrames(f).map((k,i)=>({...k,transform:`${k.transform} scale(${i?1:1.12})`,filter:`brightness(${i?1:1.6})`})),470/ZOMBIE_ACTION_SPEED,{fill:'forwards',easing:'linear'});
  }finally{flying.remove();}
 })());
 source.style.opacity='0';
 try{
  await adapter.playStep({board,occludedCells:occludingCells(event),source:{x:a.left,y:a.top,width:a.width,height:a.height},target:{x:b.left,y:b.top,width:b.width,height:b.height},direction:event.direction,layer,rate,shouldSkip,onEvent:name=>(name==='swat_contact'||name==='impact')?contact():undefined});
  await contact();
 }finally{await contactTask;source.style.opacity='';}
}
