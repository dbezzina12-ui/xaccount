import {gameReady} from './game-ready.js?v=125';
import {loadImage} from './asset-cache.js';
import {townArtFrame} from './living-town-layout.js';
import {TOWN_ART} from './scene-character-art.js';
import {createSceneBlink} from './scene-character-timing.js';

const scene=document.querySelector('.city-scene'),root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const layer=document.createElement('div');layer.className='scene-character-sprites';layer.setAttribute('aria-hidden','true');scene.append(layer);
let ready=false,disposed=false,loading=false,epoch=0,current=null,cells=[],decoded=false;
const player=createSceneBlink({draw:amount=>{
 // Reveal the painted lid from top to bottom, rather than scaling the face.
 for(const cell of cells)cell.style.clipPath=`inset(0 0 ${(1-amount)*100}% 0)`;
}});
function updatePlayback(){player.setActive(ready&&decoded&&!disposed&&!document.hidden&&!root.hasAttribute('data-entry')&&!reduced.matches);}
async function prepare(){
 if(!ready||disposed||decoded||loading)return;
 loading=true;const token=epoch,art=current;
 try{
  const image=await loadImage(art.blink);
  if(token!==epoch||disposed)return;
  if(image.naturalWidth!==art.width||image.naturalHeight!==art.height)throw Error('Unregistered background sprite');
  const prepared=art.eyes.map(([x,y,width,height])=>{
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   canvas.className='scene-character-eyelid';
   Object.assign(canvas.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px',clipPath:'inset(0 0 100% 0)'});
   const context=canvas.getContext('2d');if(!context)throw Error('Decorative canvas unavailable');
   context.drawImage(image,x,y,width,height,0,0,width,height);
   return canvas;
  });
  cells=prepared;layer.replaceChildren(...cells);decoded=true;updatePlayback();
 }catch{/* The complete painted still is always present, including offline/reduced motion. */}
 finally{loading=false;if(token!==epoch)void prepare();}
}
function fit(){
 if(disposed)return;
 const frame=townArtFrame(scene.clientWidth,scene.clientHeight),art=TOWN_ART[frame.portrait?'portrait':'desktop'];
 if(current!==art){epoch++;player.stop();current=art;decoded=false;cells=[];layer.replaceChildren();}
 layer.style.cssText=`width:${frame.width}px;height:${frame.height}px;transform:translate(${frame.x}px,${frame.y}px) scale(${frame.scale})`;
 void prepare();updatePlayback();
}
new ResizeObserver(fit).observe(scene);
new MutationObserver(updatePlayback).observe(root,{attributes:true,attributeFilter:['data-entry']});
gameReady.subscribe(state=>{ready=state.status==='ready';fit();});
document.addEventListener('visibilitychange',updatePlayback);
reduced.addEventListener('change',updatePlayback);
window.addEventListener('pagehide',()=>{disposed=true;epoch++;player.stop();});
window.addEventListener('pageshow',()=>{disposed=false;fit();});
fit();
