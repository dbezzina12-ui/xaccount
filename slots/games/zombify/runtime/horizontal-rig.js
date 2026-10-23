import {drawRig,clipDuration} from './region-rig.js';
// Playback for this authored region rig only; final Spine exports replace it.
let assets;
const mounts=new WeakMap();
function load(){return assets??=(async()=>{
 const response=await fetch('assets/rig/horizontal.json');if(!response.ok)throw Error('Horizontal rig unavailable');
 const data=await response.json(),images={};
 const paths=[...new Set(Object.values(data.skins[0].attachments).flatMap(slot=>Object.values(slot).map(a=>a.path)))];
 await Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[path]=image;resolve();};image.onerror=reject;image.src=`assets/rig/images/${path}.png`;})));
 return {data,images};
})().catch(()=>null);}
export async function mountHorizontalRig(host,{span=3,direction='right',clip,loop=true,rate=1}={}){
 // One owner per host, including mounts still waiting for their images.
 mounts.get(host)?.stop();
 let stopped=false,canvas,frame=null;
 const owner={stop(){stopped=true;if(frame!==null)cancelAnimationFrame(frame);frame=null;canvas?.remove();if(mounts.get(host)===owner)mounts.delete(host);}};
 mounts.set(host,owner);
 host.style.backgroundImage=`url('assets/rig/side-${direction}-${span}.png')`;host.style.backgroundSize='100% 100%';host.style.backgroundRepeat='no-repeat';
 const rig=await load();if(!rig||!host.isConnected||stopped){owner.stop();return null;}
 canvas=document.createElement('canvas');canvas.className='horizontal-rig-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);host.style.backgroundImage='none';
 const ctx=canvas.getContext('2d');let start=performance.now();
 let current=clip||`hold_${direction}_${span}_cells`;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function paint(now){
  frame=null;
  if(stopped||!host.isConnected){owner.stop();return;}
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  // Clear the entire backing buffer before applying the display scale.
  // Reset also removes any leftover clip/compositing state between poses.
  if(ctx.reset)ctx.reset();else{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const duration=clipDuration(rig.data,current),elapsed=(now-start)/1000*rate,time=reduced?duration:loop?elapsed%duration:Math.min(elapsed,duration);
  // Clip poses are authored in cells of 160 units; never stretch the face to fit.
  const scale=w/(span*160);drawRig(ctx,rig.data,rig.images,current,time,scale,w/2,h-host.clientHeight/2+scale*65);
  if(!reduced&&(loop||elapsed<duration))frame=requestAnimationFrame(paint);
 }
 paint(start);
 return {setClip(next,repeat=false){if(stopped)return;current=next;loop=repeat;start=performance.now();if(frame!==null)cancelAnimationFrame(frame);frame=null;paint(start);},stop:owner.stop};
}
