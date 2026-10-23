import {drawRig,clipDuration} from './region-rig.js';
// Region-only playback for our prepared art; not a general Spine runtime.
let assets;
function load(){return assets??=(async()=>{
 const response=await fetch('assets/rig/zombie.json');if(!response.ok)throw Error('Rig unavailable');
 const data=await response.json(),images={};
 await Promise.all(Object.values(data.skins[0].attachments).flatMap(slot=>Object.values(slot)).map(part=>new Promise((resolve,reject)=>{
  const image=new Image(),path=part.path;image.onload=()=>{images[path]=image;resolve();};image.onerror=reject;image.src=`assets/rig/images/${path}.png`;
 })));
 return {data,images};
})().catch(()=>null);}
void load();
export async function mountWalkingRig(host){
 const rig=await load();if(!rig)return null;
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=640;canvas.style.cssText='width:100%;height:100%;object-fit:contain';
 host.style.setProperty('background','none','important');host.append(canvas);
 const ctx=canvas.getContext('2d');let clip='walk',start=performance.now(),frame,stopped=false;
 function paint(now){if(stopped)return;ctx.clearRect(0,0,320,640);drawRig(ctx,rig.data,rig.images,clip,((now-start)/1000)%clipDuration(rig.data,clip),1,160,610);frame=requestAnimationFrame(paint);}
 frame=requestAnimationFrame(paint);
 return {setClip(next){clip=next;start=performance.now();},stop(){stopped=true;cancelAnimationFrame(frame);canvas.remove();}};
}
