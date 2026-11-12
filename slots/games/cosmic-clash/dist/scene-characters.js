import {SCENE_ACTORS} from './scene-actor-art.js?v=77';

// Place full figures on the same road plane as the bottom-anchored wide art.
// The outer placement stays independent from future breathing/recoil motion.
export const SCENE_GROUND={width:1672,height:941,footline:.885};
export function groundLine(game){
 const scale=Math.max(game.width/SCENE_GROUND.width,game.height/SCENE_GROUND.height);
 return Math.max(game.height*.72,Math.min(game.height*.94,game.height-(1-SCENE_GROUND.footline)*SCENE_GROUND.height*scale));
}
export function actorPlacement({game,reels,art,side}){
 const [x0,y0,x1,y1]=art.bounds,inkWidth=x1-x0,inkHeight=y1-y0,gap=18,edge=16;
 const available=side==='left'?reels.left-game.left-gap-edge:game.right-reels.right-gap-edge;
 const height=Math.max(0,Math.min(reels.height*.82,game.height*.56,560,available*inkHeight/inkWidth));
 const scale=height/inkHeight,width=inkWidth*scale;
 const inkLeft=side==='left'?reels.left-game.left-gap-width:reels.right-game.left+gap;
 const floor=groundLine(game),left=inkLeft-x0*scale,top=floor-y1*scale;
 const contacts=(art.feet||[]).map(([x,y,w])=>({left:left+(x-w*.6)*scale,top:top+y*scale-2,width:w*1.2*scale,height:Math.max(5,height*.02)}));
 return {left,top,contacts,floor,width:art.width*scale,height:art.height*scale,
  ink:{left:inkLeft,top:floor-height,width,height},shadowLeft:left,shadowTop:floor-y1*scale*.18,shadowWidth:art.width*scale,shadowHeight:art.height*scale*.18,visible:height>=180};
}
export function sceneControlPlacement({game,reels,controller}){
 if(game.width<1000||game.height<541||game.width/game.height<3/2||!controller)return null;
 const size=88,buy={x:reels.left-83,y:controller.top+(controller.height-size)/2,size};
 if(buy.x-size/2<game.left+10)return null;
 return {buy};
}
export function mountSceneCharacters(game,{onControlsLayout=()=>{}}={}){
 const layer=game.querySelector('.scene-cast'),reels=game.querySelector('#reel-stage'),controller=game.querySelector('#controller');
 if(!layer||!reels)return ()=>{};
 const wide=matchMedia('(min-width:1000px) and (min-height:541px) and (min-aspect-ratio:3/2)');
 const actors=Object.entries(SCENE_ACTORS).map(([name,art])=>{
  const root=document.createElement('div'),motion=document.createElement('div'),shadow=document.createElement('div');
  shadow.className='scene-actor-shadow';
  shadow.style.setProperty('--shadow-art',`url("${art.src}")`);
  shadow.style.setProperty('--shadow-skew',art.side==='left'?'-38deg':'38deg');
  const contacts=(art.feet||[]).map(()=>{const el=document.createElement('div');el.className='scene-foot-shadow';return el;});
  root.className='scene-actor';root.dataset.actor=name;root.dataset.state='rest';motion.className='scene-actor-motion';
  motion.style.transformOrigin=`${art.origin[0]/art.width*100}% ${art.origin[1]/art.height*100}%`;
  const image=new Image(art.width,art.height);image.alt='';image.draggable=false;image.decoding='async';
  image.addEventListener('load',()=>{root.dataset.ready=shadow.dataset.ready='true';contacts.forEach(el=>el.dataset.ready='true');},{once:true});
  motion.append(image);root.append(motion);layer.append(shadow,...contacts,root);return {root,image,art,shadow,contacts};
 });
 let frame=0;
 const update=()=>{
  frame=0;layer.hidden=!wide.matches||controller?.dataset.layout==='mobile';
  const origin=game.getBoundingClientRect(),rect=reels.getBoundingClientRect();
  layer.style.setProperty('--scene-dust-top',`${groundLine(origin)-origin.height*.07}px`);
  const controls=layer.hidden?null:sceneControlPlacement({game:origin,reels:rect,controller:controller?.getBoundingClientRect()});
  onControlsLayout(controls);if(layer.hidden)return;
  for(const {root,image,art,shadow,contacts} of actors){
   const p=actorPlacement({game:origin,reels:rect,art,side:art.side});root.hidden=shadow.hidden=!p.visible;contacts.forEach(el=>el.hidden=!p.visible);if(!p.visible)continue;
   if(!image.getAttribute('src'))image.src=art.src;
   Object.assign(root.style,{left:`${p.left}px`,top:`${p.top}px`,width:`${p.width}px`,height:`${p.height}px`});
   Object.assign(shadow.style,{left:`${p.shadowLeft}px`,top:`${p.shadowTop}px`,width:`${p.shadowWidth}px`,height:`${p.shadowHeight}px`});
   contacts.forEach((el,index)=>{const c=p.contacts[index];Object.assign(el.style,{left:`${c.left}px`,top:`${c.top}px`,width:`${c.width}px`,height:`${c.height}px`});});
  }
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const observer=new ResizeObserver(schedule);observer.observe(game);observer.observe(reels);if(controller)observer.observe(controller);
 wide.addEventListener('change',schedule);update();
 return ()=>{observer.disconnect();wide.removeEventListener('change',schedule);if(frame)cancelAnimationFrame(frame);layer.replaceChildren();onControlsLayout(null);};
}
