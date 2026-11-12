// Foreground first-person arm: constrained aim poses, no orbiting/spinning pistol.
export const MOBILE_ART=Object.freeze({pivot:{x:.46,y:.61},muzzle:{x:.87,y:.145},boreDegrees:-38,maxAimDegrees:65});
export const MOBILE_MOTION=Object.freeze({enter:300,aim:210,settle:55,recoil:260,flash:65,impact:260,smoke:390,exit:260,easing:'cubic-bezier(.2,.7,.2,1)'});
export const MOBILE_RECOIL=Object.freeze([{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-7px,9px) rotate(-3deg)',offset:.16},{transform:'translate(-2px,3px) rotate(-.7deg)',offset:.54},{transform:'translate(.5px,-.6px) rotate(.2deg)',offset:.82},{transform:'translate(0,0) rotate(0deg)'}]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function foregroundPose({surface,reels,target,art=MOBILE_ART}){
 const width=Math.min(410,surface.width*.92),height=width;
 const nx=clamp((target.x-(reels.left-surface.left))/reels.width,0,1);
 // Keep the barrel below every reel row. Solve its bore angle toward the
 // actual target, then place the wrist so the sleeve exits the lower edge.
 const muzzle={x:surface.width*(.10+nx*.42),y:Math.min(surface.height-surface.width*.22,reels.bottom-surface.top+surface.width*.14)};
 const heading=Math.atan2(target.y-muzzle.y,target.x-muzzle.x)*180/Math.PI;
 const degrees=clamp(heading-art.boreDegrees,-art.maxAimDegrees,art.maxAimDegrees);
 const angle=degrees*Math.PI/180,p={x:art.pivot.x*width,y:art.pivot.y*height};
 const dx=(art.muzzle.x-art.pivot.x)*width,dy=(art.muzzle.y-art.pivot.y)*height;
 const x=muzzle.x-p.x-dx*Math.cos(angle)+dy*Math.sin(angle),y=muzzle.y-p.y-dx*Math.sin(angle)-dy*Math.cos(angle);
 return {x,y,width,height,degrees,transform:`translate(${x}px,${y}px) rotate(${degrees}deg)`,muzzle};
}
export async function presentMobileCrossfire({surface,reels,placements,getTarget,onPlacement,onShot=()=>{},signal,instant=()=>false,motions=new Set(),speed=1,assetUrl='../characters/mobile-crossfire/images/parts.png'}){
 if(!(speed>0&&speed<=4))throw Error('Speed must be between 0 and 4.');
 if(!placements.length)return {canceled:false};
 const doc=surface.ownerDocument,layer=doc.createElement('div');layer.className='mobile-crossfire';layer.setAttribute('aria-hidden','true');
 const rig=doc.createElement('div'),body=doc.createElement('div'),image=doc.createElement('img'),flash=doc.createElement('i');
 rig.className='mobile-crossfire-arm';body.className='mobile-crossfire-grip';flash.className='mobile-crossfire-flash';image.src=assetUrl;image.alt='';image.draggable=false;
 rig.style.transformOrigin=`${MOBILE_ART.pivot.x*100}% ${MOBILE_ART.pivot.y*100}%`;body.style.transformOrigin=rig.style.transformOrigin;
 flash.style.left=`${MOBILE_ART.muzzle.x*100}%`;flash.style.top=`${MOBILE_ART.muzzle.y*100}%`;body.append(image,flash);rig.append(body);layer.append(rig);
 let resized=false,assetFailed=false,observer;const active=new Set(),applied=new Set();
 const canceled=()=>!!signal?.aborted,skip=()=>canceled()||instant()||resized||assetFailed||!!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const stop=()=>{for(const a of active)a.cancel();};
 const resize=()=>{resized=true;stop();};
 const view=doc.defaultView||globalThis;
 const place=(p,i)=>{if(!applied.has(i)){applied.add(i);onPlacement(p,i);}};
 const center=node=>{const r=node.getBoundingClientRect(),s=surface.getBoundingClientRect();return{x:r.left+r.width/2-s.left,y:r.top+r.height/2-s.top};};
 const animate=async(node,frames,ms)=>{
  if(skip()||!node.animate)return;
   const a=node.animate(frames,{duration:ms/speed,fill:'both',easing:MOBILE_MOTION.easing});active.add(a);motions.add(a);
  try{await a.finished;}catch{}finally{active.delete(a);motions.delete(a);a.cancel();}
 };
 const imageReady=()=>new Promise(resolve=>{
  if(image.complete){assetFailed=!image.naturalWidth;resolve();return;}
  let timer;const finish=()=>{clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',failed);signal?.removeEventListener('abort',finish);resolve();};
  const loaded=()=>finish(),failed=()=>{assetFailed=true;finish();};
  image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',finish,{once:true});timer=setTimeout(failed,3500);
 });
 try{
  if(!skip())await imageReady();
  if(canceled())return {canceled:true};
  surface.append(layer);signal?.addEventListener('abort',stop,{once:true});view.addEventListener?.('resize',resize,{once:true});
  if(view.ResizeObserver){const initial=[surface,reels].map(n=>n.getBoundingClientRect());observer=new view.ResizeObserver(()=>{if([surface,reels].some((n,i)=>{const r=n.getBoundingClientRect();return Math.abs(r.width-initial[i].width)>.5||Math.abs(r.height-initial[i].height)>.5;}))resize();});observer.observe(surface);observer.observe(reels);}
  const first=placements.map(getTarget).find(Boolean);
  let previous;
  if(first&&!skip()){
   previous=foregroundPose({surface:surface.getBoundingClientRect(),reels:reels.getBoundingClientRect(),target:center(first)});
   Object.assign(rig.style,{width:`${previous.width}px`,height:`${previous.height}px`,transform:previous.transform});
   await animate(rig,[{transform:`translate(${previous.x}px,${previous.y+previous.height*.65}px) rotate(${previous.degrees}deg)`,opacity:0},{transform:previous.transform,opacity:1}],MOBILE_MOTION.enter);
  }
  for(const [index,placement]of placements.entries()){
   if(canceled())return {canceled:true};
   const cell=getTarget(placement);
   if(skip()||!cell||!previous){place(placement,index);continue;}
   const target=center(cell),pose=foregroundPose({surface:surface.getBoundingClientRect(),reels:reels.getBoundingClientRect(),target});
   const from=previous.transform;rig.style.transform=pose.transform;previous=pose;
   await animate(rig,[{transform:from},{transform:pose.transform}],MOBILE_MOTION.aim);
   // Briefly settle the sights. The firearm never spins around a central point.
   await animate(body,[{transform:'translate(0,2px)'},{transform:'translate(0,0)'}],MOBILE_MOTION.settle);
   if(canceled())return {canceled:true};
   if(skip()){place(placement,index);continue;}
   const impact=doc.createElement('i');impact.className='mobile-crossfire-impact';Object.assign(impact.style,{left:`${target.x}px`,top:`${target.y}px`});layer.append(impact);
   const smoke=doc.createElement('i');smoke.className='mobile-crossfire-smoke';Object.assign(smoke.style,{left:`${pose.muzzle.x}px`,top:`${pose.muzzle.y}px`});layer.append(smoke);
   void animate(smoke,[{opacity:0,transform:'translate(-50%,-50%) scale(.4)'},{opacity:.28,transform:'translate(-55%,-75%) scale(.8)',offset:.18},{opacity:0,transform:'translate(-75%,-140%) scale(1.8)'}],MOBILE_MOTION.smoke).finally(()=>smoke.remove());
   onShot({placement,index,muzzle:pose.muzzle,target});place(placement,index);
   await Promise.all([
    animate(body,MOBILE_RECOIL,MOBILE_MOTION.recoil),
    animate(flash,[{opacity:0,scale:'.6'},{opacity:1,scale:'1',offset:.1},{opacity:0,scale:'1.4'}],MOBILE_MOTION.flash),
    animate(impact,[{opacity:0,scale:'.35'},{opacity:1,scale:'.55',offset:.12},{opacity:0,scale:'1.3'}],MOBILE_MOTION.impact)
   ]);impact.remove();
  }
  if(!skip()&&previous)await animate(rig,[{transform:previous.transform,opacity:1},{transform:`translate(${previous.x}px,${previous.y+previous.height*.65}px) rotate(${previous.degrees}deg)`,opacity:0}],MOBILE_MOTION.exit);
  return {canceled:canceled()};
 }finally{stop();observer?.disconnect();for(const a of active)motions.delete(a);signal?.removeEventListener('abort',stop);view.removeEventListener?.('resize',resize);layer.remove();}
}
