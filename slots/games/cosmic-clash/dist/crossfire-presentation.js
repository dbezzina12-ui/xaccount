// Visuals consume recorded placements. They never choose a target or a payout.
export const CROSSFIRE_PISTOL='./assets/crossfire-v91/pistol.png';
export const PISTOL_ART={ratio:1.5,pivot:{x:.26,y:.326},muzzle:{x:.972,y:.326}};
export function pistolAim({pivot,target,width,art=PISTOL_ART}){
 const dx=target.x-pivot.x,dy=target.y-pivot.y,height=width/art.ratio;
 const barrel={x:(art.muzzle.x-art.pivot.x)*width,y:(art.muzzle.y-art.pivot.y)*height};
 const angle=Math.atan2(dy,dx)-Math.atan2(barrel.y,barrel.x);
 return {left:pivot.x-art.pivot.x*width,top:pivot.y-art.pivot.y*height,width,height,angle,
  muzzle:{x:pivot.x+barrel.x*Math.cos(angle)-barrel.y*Math.sin(angle),y:pivot.y+barrel.x*Math.sin(angle)+barrel.y*Math.cos(angle)}};
}
export function pistolLayout({surface,reels,targets,art=PISTOL_ART}){
 const pivot={x:-surface.width*.045,y:Math.min(surface.height-20,reels.bottom-surface.top+surface.width*.20)};
 const reach=Math.hypot(art.muzzle.x-art.pivot.x,(art.muzzle.y-art.pivot.y)/art.ratio);
 const nearest=Math.min(...targets.map(p=>Math.hypot(p.x-pivot.x,p.y-pivot.y)));
 const width=Math.max(1,Math.min(340,surface.width*.72,nearest*.78/reach));
 return {pivot,width};
}
export async function presentCrossfire({surface,reels,placements,getTarget,onPlacement,mobile=false,wait,instant=()=>false,canceled=()=>false,motions=new Set(),pace=1,onShot=()=>{},onActorShot=()=>{}}){
 const doc=surface.ownerDocument,layer=doc.createElement('div');layer.className='crossfire-effects';layer.setAttribute('aria-hidden','true');
 const active=new Set();let resized=false,gun,frame,flame;
 const skip=()=>instant()||canceled()||resized;
 const stop=()=>{resized=true;for(const a of active)a.cancel();};
 const animate=async(node,keyframes,duration)=>{
  if(skip()||!node.animate)return;
  const a=node.animate(keyframes,{duration:Math.max(50,duration*pace),easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});active.add(a);motions.add(a);
  try{await a.finished;}catch{}finally{active.delete(a);motions.delete(a);a.cancel();}
 };
 const center=node=>{const r=node.getBoundingClientRect(),s=surface.getBoundingClientRect();return {x:r.left+r.width/2-s.left,y:r.top+r.height/2-s.top};};
 try{
  if(!placements.length)return;
  surface.append(layer);globalThis.addEventListener?.('resize',stop,{once:true});
  let layout;
  if(mobile&&!skip()){
   const targets=placements.map(getTarget).filter(Boolean).map(center);
   if(targets.length){
    layout=pistolLayout({surface:surface.getBoundingClientRect(),reels:reels.getBoundingClientRect(),targets});
    gun=doc.createElement('div');gun.className='crossfire-pistol';gun.style.transformOrigin=`${PISTOL_ART.pivot.x*100}% ${PISTOL_ART.pivot.y*100}%`;
    frame=doc.createElement('div');frame.className='crossfire-pistol-body';
    const image=doc.createElement('img');image.src=CROSSFIRE_PISTOL;image.alt='';image.draggable=false;frame.append(image);
    flame=doc.createElement('i');flame.className='crossfire-muzzle';flame.style.left=`${PISTOL_ART.muzzle.x*100}%`;flame.style.top=`${PISTOL_ART.muzzle.y*100}%`;frame.append(flame);gun.append(frame);layer.append(gun);
    image.addEventListener('error',()=>gun?.remove(),{once:true});
    const aim=pistolAim({...layout,target:targets[0]});Object.assign(gun.style,{left:`${aim.left}px`,top:`${aim.top}px`,width:`${aim.width}px`,height:`${aim.height}px`,transform:`rotate(${aim.angle}rad)`});
    await animate(frame,[{transform:'translateX(-120%)',opacity:0},{transform:'translateX(0)',opacity:1}],180);
   }
  }
  for(const [index,placement] of placements.entries()){
   if(canceled())return;
   const node=getTarget(placement);if(!node){onPlacement(placement);continue;}
   if(!skip()){
    const target=center(node),impact=doc.createElement('div');impact.className='crossfire-hit';Object.assign(impact.style,{left:`${target.x}px`,top:`${target.y}px`});layer.append(impact);
    if(gun?.isConnected){
     const aim=pistolAim({...layout,target}),from=gun.style.transform,to=`rotate(${aim.angle}rad)`;
     gun.style.transform=to;await animate(gun,[{transform:from},{transform:to}],75);
    }
    if(!skip()){
     onActorShot({placement,index,target});onShot(placement,index);
     // One muzzle flash and one impact per recorded placement, no laser lines.
     const recoil=gun?.isConnected?animate(frame,[{transform:'translateX(0)'},{transform:'translateX(-10px)',offset:.22},{transform:'translateX(0)'}],150):Promise.resolve();
     const flash=gun?.isConnected?animate(flame,[{opacity:0,scale:'.5'},{opacity:1,scale:'1',offset:.15},{opacity:0,scale:'1.25'}],85):Promise.resolve();
     onPlacement(placement);
     await Promise.all([recoil,flash,animate(impact,[{opacity:1,transform:'translate(-50%,-50%) scale(.3)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.3)'}],170)]);
     impact.remove();
     if(!skip())await wait(55*pace);
     continue;
    }
    impact.remove();
   }
   if(canceled())return;
   onPlacement(placement);
  }
  if(!skip()&&gun?.isConnected)await animate(frame,[{transform:'translateX(0)',opacity:1},{transform:'translateX(-120%)',opacity:0}],160);
 }finally{for(const a of active){motions.delete(a);a.cancel();}globalThis.removeEventListener?.('resize',stop);layer.remove();}
}
