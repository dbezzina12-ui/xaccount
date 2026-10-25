import {mountMascot,mascotPlacement} from '../games/zombify/runtime/subway-mascot.js';
import {loadImage} from '../games/zombify/runtime/asset-cache.js';
const plate=name=>new URL('../games/zombify/runtime/assets/studio/'+name,import.meta.url).href;
export function createSceneMascot(game){
 const doc=game.ownerDocument,host=doc.createElement('div');host.className='scene-mascot';host.setAttribute('aria-hidden','true');host.style.cssText='position:absolute;pointer-events:none;z-index:1;display:none';game.append(host);
 let rig=null,scene=null,enabled=false,revision=0,loading=null;
 const position=()=>{if(!scene)return;const p=mascotPlacement(scene,game.hasAttribute('data-free-spins'));Object.assign(host.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:p.h+'px'});const b=scene.background||{};host.style.filter=`brightness(${b.brightness??100}%) contrast(${b.contrast??100}%) saturate(${b.saturation??100}%) hue-rotate(${b.hue??0}deg) blur(${b.blur??0}px)`;};
 const activity=()=>rig?.setPaused(!enabled||!!doc.documentElement.dataset.entry);
 const observer=new MutationObserver(()=>{position();activity();});observer.observe(game,{attributes:true,attributeFilter:['data-free-spins']});observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-entry']});
 async function configure(next,isEnabled){
  scene=next;enabled=isEnabled;const token=++revision;position();activity();
  host.style.display=enabled?'block':'none';delete game.dataset.mascotReady;
  if(!enabled)return;
  // Keep the old baked character until every replacement piece is decoded.
  const mobile=scene.width<scene.height;
  try{
   await Promise.all([loadImage(plate(mobile?'subway-background-clean.webp':'subway-desktop-clean.webp')),loadImage(plate(mobile?'subway-lab-clean.webp':'subway-lab-desktop-clean.webp'))]);
   if(token!==revision||!enabled)return;
   if(!rig){loading||=(mountMascot(host,{paused:!!doc.documentElement.dataset.entry}).finally(()=>{loading=null;}));rig=await loading;}
   if(token!==revision||!enabled)return;
   if(rig){game.dataset.mascotReady='true';position();activity();}
  }catch{host.style.display='none';}
 }
 return {configure,destroy(){revision++;enabled=false;rig?.stop();observer.disconnect();host.remove();delete game.dataset.mascotReady;}};
}
