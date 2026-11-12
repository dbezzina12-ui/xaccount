import {loadRig,instance,Spine,drawRig,canvasFor,tick} from './renderer.mjs?v=foundry';
import {createActorDriver} from './actor-driver.mjs';
import {createCrossfireBridge} from './crossfire-bridge.mjs';
import {presentMobileCrossfire} from './mobile-crossfire.mjs';
import {createFeatureDriver,createEnvironmentDriver} from './feature-driver.mjs';
import {createShotEffects,rigShotToCanvas} from './shot-effects.mjs';

export function mountGameAnimation({game,reels,motions,reduced=false}){
 const actors={},fs=new Map(),pendingFs=new Map(),cleanups=[],wide=matchMedia('(min-width:1000px) and (min-height:541px) and (min-aspect-ratio:3/2)');
 let disposed=false,actorGeneration=0,environment,actorsReady=Promise.resolve();
 const optionalCue=(name,detail={})=>game.dispatchEvent(new CustomEvent('cosmic:animation-cue',{detail:{name,...detail}}));
 const fx=createShotEffects(),effects=canvasFor(game,'spine-shot-canvas');
 cleanups.push(tick(dt=>{const size=effects.begin();if(!size)return;fx.update(dt);fx.draw(effects.ctx);}));
 const warn=e=>{if(e?.name!=='AbortError')console.warn('Cosmic Clash animation fallback:',e);};
 async function mountActors(){
  const generation=++actorGeneration;
  for(const name of Object.keys(actors)){actors[name].dispose();delete actors[name];}
  if(!wide.matches||disposed)return;
  await Promise.all(['hunter','outlaw'].map(async name=>{
   let surface,stop,driver;
   try{
    const asset=await loadRig(name);if(disposed||generation!==actorGeneration)return;
    const host=game.querySelector(`[data-actor="${name}"] .scene-actor-motion`);if(!host)return;
    const rig=instance(asset),original=host.querySelector('img');surface=canvasFor(host);
    driver=createActorDriver({...rig,physicsNone:Spine.Physics.none,onEvent:event=>optionalCue(event,{actor:name})});
    const render=dt=>{if(!host.getBoundingClientRect().width)return;if(!reduced){rig.step(dt);driver.updateAim();}else rig.step(0);
     const size=surface.begin();if(size)drawRig(surface.ctx,rig,{x:asset.manifest.origin[0]*size.width/asset.manifest.canvas[0],y:asset.manifest.origin[1]*size.height/asset.manifest.canvas[1],scale:size.width/asset.manifest.canvas[0]});};
    render(0);if(original)original.style.visibility='hidden';host.classList.add('spine-ready');
    stop=tick(render);actors[name]={element:host,driver,dispose(){stop();driver.dispose();surface.dispose();host.classList.remove('spine-ready');host.style.removeProperty('--fs-orbit-pose');if(original)original.style.visibility='';}};
   }catch(e){stop?.();driver?.dispose();surface?.dispose();warn(e);}
  }));
 }
 const change=()=>{actorsReady=mountActors();};wide.addEventListener('change',change);change();
 void (async()=>{try{
  const asset=await loadRig('environment');if(disposed)return;
  const rig=instance(asset),host=document.createElement('div');host.className='spine-atmosphere';game.prepend(host);
  const surface=canvasFor(host),driver=createEnvironmentDriver({...rig,physicsNone:Spine.Physics.none,reducedMotion:reduced});environment=driver;
  // Reuse cloud/dust and combat flashes. Old lamp positions belong to the
  // previous street; the spaceport plate supplies its own practical lights.
  const excludes=new Set(['scene','lamp_left','lamp_right']);
  const stop=tick(dt=>{const size=surface.begin();if(!size)return;const landscape=size.width/size.height>1;
   driver.setVisible(landscape&&!document.hidden);if(!landscape)return;driver.update(dt);
   const scale=Math.max(size.width/1672,size.height/941);drawRig(surface.ctx,rig,{x:(size.width-1672*scale)/2,y:size.height,scale},{exclude:excludes});
  });cleanups.push(()=>{stop();driver.dispose();surface.dispose();host.remove();});
 }catch(e){warn(e);}})();
 void loadRig('vs-symbol').catch(warn);void loadRig('signal-fs').catch(warn);
 const mobileAsset=new URL('../assets/spine-v96/mobile-crossfire/images/parts.png',import.meta.url).href;
 const mobileImage=new Image();mobileImage.src=mobileAsset;
 function presentation(run){
  const abort=new AbortController(),token={finish:()=>abort.abort(),cancel:()=>abort.abort()},resize=()=>abort.abort();
  motions.add(token);window.addEventListener('resize',resize,{once:true});
  return Promise.resolve().then(()=>run(abort.signal)).catch(e=>{warn(e);}).finally(()=>{motions.delete(token);window.removeEventListener('resize',resize);fx.clear();});
 }
 function shot(detail){
  const actor=actors[detail.actor];if(!actor)return;
  const surface=game.getBoundingClientRect(),rect=actor.element.getBoundingClientRect();
  const converted=rigShotToCanvas(detail,rect,actor.driver.manifest,surface);
  fx.spawn({...converted,color:detail.actor==='hunter'?'#ffc76b':'#59deff',followMuzzle:()=>rigShotToCanvas({...detail,muzzle:actor.driver.muzzle()},actor.element.getBoundingClientRect(),actor.driver.manifest,game.getBoundingClientRect()).muzzle});
  environment?.flash(detail.actor==='hunter'?'left':'right');optionalCue('shot',detail);
 }
 async function crossfire({placements,sources,mobile,instant,speed,getTarget,onPlacement}){
  await actorsReady;
  return presentation(async signal=>{
   const presenter=createCrossfireBridge({actors,getCell:getTarget,onPlacement,onShot:shot,onError:warn,
    mobilePresenter:args=>presentMobileCrossfire({...args,surface:game,reels,getTarget,assetUrl:mobileAsset,motions,onShot:detail=>optionalCue('shot',detail)})});
   return presenter({placements,sources,mobile:mobile||!wide.matches,instant,speed,signal});
  });
 }
 function clearScatters(){for(const item of fs.values())item.dispose();fs.clear();}
 async function syncScatters({land=false}={}){
  for(const [host,item]of fs)if(!host.isConnected){item.dispose();fs.delete(host);}
  const nodes=[...reels.querySelectorAll('.reel:not(:has(.reel-track)) .fs-vault-art')];
  await Promise.all(nodes.map(host=>{
   if(fs.has(host))return;if(pendingFs.has(host))return pendingFs.get(host);
   const task=(async()=>{let surface,stop,driver;try{
    const asset=await loadRig('signal-fs');if(disposed||!host.isConnected||host.closest('.reel-track'))return;
    const rig=instance(asset);surface=canvasFor(host);driver=createFeatureDriver({...rig,physicsNone:Spine.Physics.none,onEvent:optionalCue});
    rig.state.setAnimation(0,reduced?'reset':'idle',true);
    const slot=rig.skeleton.drawOrder.appliedPose.find(s=>s.data.name==='letters'),corners=[];
    let lastPose='';
    const render=dt=>{driver.update(reduced?0:dt);const size=surface.begin();if(!size)return;
     const scale=Math.min(size.width,size.height)/512;
     drawRig(surface.ctx,rig,{x:size.width/2,y:size.height/2,scale});
     if(reduced||!slot)return;
     // Mesh order: top right, bottom right, bottom left, top left.
     const mesh=slot.appliedPose.getAttachment();if(!mesh)return;
     mesh.computeWorldVertices(rig.skeleton,slot,0,8,corners,0,2);
     const dx=(corners[0]+corners[4])*scale/2,dy=-(corners[1]+corners[5])*scale/2;
     const fit=Math.min(size.width*.92/384,size.height*.92/278);
     const pose='matrix('+[(corners[0]-corners[6])*scale/(384*fit),(corners[7]-corners[1])*scale/(384*fit),(corners[2]-corners[0])*scale/(278*fit),(corners[1]-corners[3])*scale/(278*fit),dx,dy].map(v=>v.toFixed(4)).join(',')+')';
     if(pose!==lastPose){host.style.setProperty('--fs-orbit-pose',pose);lastPose=pose;}};
    render(0);host.classList.add('spine-ready');stop=tick(render);
    const item={rig,driver,dispose(){stop();driver.dispose();surface.dispose();host.classList.remove('spine-ready');host.style.removeProperty('--fs-orbit-pose');}};fs.set(host,item);
    if(land&&!reduced){await driver.play('land');if(fs.get(host)===item)rig.state.setAnimation(0,'idle',true);}
   }catch(e){stop?.();driver?.dispose();surface?.dispose();host.classList.remove('spine-ready');host.style.removeProperty('--fs-orbit-pose');fs.delete(host);warn(e);}
   })().finally(()=>pendingFs.delete(host));pendingFs.set(host,task);return task;
  }));
 }
 function tease(active){for(const [host,item]of fs)if(!reduced&&!pendingFs.has(host))item.rig.state.setAnimation(0,active?'tease':'idle',true);}
 async function trigger({instant=()=>false,speed=1}={}){
  await syncScatters();if(instant())return;
  return presentation(signal=>Promise.all([...fs.values()].map(async item=>{
   item.driver.cancel();try{await item.driver.play('bonus_trigger',{signal,speed});}finally{if(!disposed)item.rig.state.setAnimation(0,'idle',true);}
  })));
 }
 return {crossfire,syncScatters,clearScatters,tease,trigger,ready:()=>actorsReady,
  dispose(){disposed=true;actorGeneration++;wide.removeEventListener('change',change);for(const a of Object.values(actors))a.dispose();clearScatters();for(const fn of cleanups)fn();effects.dispose();}
 };
}
