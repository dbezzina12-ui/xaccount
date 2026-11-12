import {loadRig,instance,Spine,drawRig,canvasFor} from './animation/renderer.mjs?v=foundry';
import {createFeatureDriver} from './animation/feature-driver.mjs';
import {vsReelGeometry,createVsReelModifier,vsPlateMotion,drawVsFight,drawVsSweep,drawVsFrame} from './animation/vs-reel-opening.mjs?v=97';
export {vsReelGeometry as revealGeometry};
export const REVEAL_DURATION=600;
// Native whole-emblem punch; one control bone drives every part of the reveal.
export async function revealDuel({card,symbol,pace=1,instant=()=>false,motions=new Set()}){
 const unlock=()=>{card.classList.remove('pending-duel','vs-opening');card.classList.add('vs-unlocked');};
 if(instant()||!symbol?.isConnected||!card.isConnected){unlock();return;}
 let asset;try{asset=await loadRig('vs-symbol');}catch{unlock();return;}
 if(instant()||!symbol.isConnected||!card.isConnected){unlock();return;}
 const r=card.getBoundingClientRect(),bounds={left:r.left+card.clientLeft,top:r.top+card.clientTop,width:card.clientWidth,height:card.clientHeight};
 let geometry;try{geometry=vsReelGeometry({reel:bounds,symbol:symbol.getBoundingClientRect()});}catch{unlock();return;}
 const rig=instance(asset),modifier=createVsReelModifier({skeleton:rig.skeleton,geometry,progressSourcePixels:asset.manifest.progressSourcePixels});
 const overlay=document.createElement('div');overlay.className='vs-doors spine-vs-screen';card.append(overlay);
 let surface;try{surface=canvasFor(overlay);}catch{overlay.remove();unlock();return;}
 const fight=card.querySelector('.reel-fight'),oldVisibility=symbol.style.visibility,oldClip=fight?.style.clipPath;
 const video=fight?.querySelector('.duel-motion'),arena=fight?.querySelector('.arena-face');let fightSurface;
 if(video?.readyState>=2&&arena)try{fightSurface=canvasFor(arena,'spine-canvas vs-video-reveal');}catch{}
 const plates=['hunter-value','outlaw-value'].map(name=>fight?.querySelector(`[data-fight="${name}"]`));
 const previous=plates.map(el=>el?{transform:el.style.transform,opacity:el.style.opacity,transformOrigin:el.style.transformOrigin}:null);
 const plateHeight=Math.max(...plates.map(el=>el?.offsetHeight||0),bounds.width*.36);
 const abort=new AbortController();let frame=0,last=0,elapsed=0,finished=false,resolve;
 const speed=Math.min(4,1/Math.max(.25,pace)),complete=new Promise(r=>resolve=r);
 const driver=createFeatureDriver({...rig,physicsNone:Spine.Physics.none,afterApply:modifier.afterApply});
 const finish=()=>{
  if(finished)return;finished=true;abort.abort();cancelAnimationFrame(frame);driver.dispose();surface.dispose();fightSurface?.dispose();overlay.remove();
  symbol.style.visibility=oldVisibility;if(fight)fight.style.clipPath=oldClip||'';
  plates.forEach((el,i)=>{if(el)Object.assign(el.style,previous[i]);});
  motions.delete(token);window.removeEventListener('resize',finish);unlock();resolve();
 };
 const token={finish,cancel:finish};motions.add(token);window.addEventListener('resize',finish,{once:true});
 try{
  const playing=driver.play('open',{signal:abort.signal,speed,onCue:name=>{
   card.dispatchEvent(new CustomEvent('cosmic:animation-cue',{bubbles:true,detail:{name}}));
   if(name==='vs_reveal')queueMicrotask(finish);
  }});
  const render=dt=>{
   if(instant()||!card.isConnected){finish();return;}elapsed+=dt*speed;driver.update(dt);if(finished)return;
   const size=surface.begin();if(!size){finish();return;}
   const w=modifier.window(),top=Math.max(0,w.top-bounds.top),bottom=Math.max(0,bounds.height-top-w.height);
   if(fight)fight.style.clipPath=`inset(${top}px 0px ${bottom}px 0px)`;
   if(fightSurface?.begin())drawVsFight(fightSurface.ctx,video,{left:0,top:0,width:bounds.width,height:bounds.height},{left:0,top,width:bounds.width,height:w.height},{flipped:fight.dataset.incumbent==='outlaw'});
   const plate=vsPlateMotion({height:bounds.height,windowTop:top,windowHeight:w.height,plateHeight,progress:modifier.progress});
   plates.forEach((el,i)=>{if(!el)return;el.style.transformOrigin=i?'50% 100%':'50% 0';el.style.transform=`translateY(${i?plate.bottom:plate.top}px) scale(${plate.scale})`;el.style.opacity=String(plate.alpha);});
   const ctx=surface.ctx,x=geometry.center.x-bounds.left,y=geometry.center.y-bounds.top;
   // The fight window grows OVER the emblem, continuously covering it.
   ctx.save();ctx.beginPath();ctx.rect(0,0,size.width,size.height);if(w.height>0)ctx.rect(0,top,size.width,w.height);ctx.clip('evenodd');
   drawRig(ctx,rig,{x,y,scale:geometry.scale});ctx.restore();
   drawVsSweep(ctx,{x,y,size:geometry.size,time:elapsed});
   drawVsFrame(ctx,{left:0,top,width:bounds.width,height:w.height},elapsed);
  };
  const advance=now=>{if(finished)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
   try{render(dt);}catch(e){console.warn('VS reveal fallback',e);finish();}if(!finished)frame=requestAnimationFrame(advance);
  };
  card.classList.remove('pending-duel');card.classList.add('vs-opening');symbol.style.visibility='hidden';render(0);if(!finished)frame=requestAnimationFrame(advance);
  playing.then(finish,e=>{if(e.name!=='AbortError')console.warn('VS fallback',e);finish();});
  await complete;
 }finally{finish();}
}
