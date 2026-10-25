import {loadImage} from './asset-cache.js';
export const MASCOT_ATLAS=new URL('./assets/studio/subway-mascot-parts.webp',import.meta.url).href;
// Trim rectangles from the generated transparent puppet sheet. No reel art is reused.
// The raised arm keeps its torn cuff (from x 652, just past the cuff's open
// end): the cuff covers the body's empty sleeve, so the arm comes out of it.
const PARTS={head:[59,67,442,402],blink:[558,67,442,402],body:[1024,196,492,300],waveBody:[39,662,446,302],arm:[652,584,341,345]};
export function mascotPose(seconds,mode='idle',reduced=false){
 if(reduced)return {breath:0,head:0,blink:false,arm:0};
 const t=Math.max(0,seconds),cycle=t%8.4;
 return {breath:Math.sin(t*Math.PI*2/4.8)*1.5,head:Math.sin(t*Math.PI*2/6.2)*.012,
 blink:(cycle>2.35&&cycle<2.49)||(cycle>6.6&&cycle<6.74),
 arm:mode==='wave'?Math.sin(t*Math.PI*2/1.05)*.13:0};
}
export function mascotPlacement(scene,bonus=false){
 const mobile=scene.width<scene.height;
 const b=mobile?(bonus?[.684,.060,.27,.139]:[.621,.611,.346,.179]):(bonus?[.812,.213,.142,.24]:[.827,.390,.148,.25]);
 const bg=scene.background||{},iw=mobile?853:1586,ih=mobile?1844:992;
 const width=(bg.zoom??100)===100?Math.max(scene.width/iw,scene.height/ih)*iw:scene.width*(bg.zoom/100),height=width*ih/iw;
 const scale=1+(bg.blur||0)*.004;
 const x=(scene.width-width)*(bg.positionX??50)/100+b[0]*width,y=(scene.height-height)*(bg.positionY??50)/100+b[1]*height;
 return {x:scene.width/2+(x-scene.width/2)*scale,y:scene.height/2+(y-scene.height/2)*scale,w:b[2]*width*scale,h:b[3]*height*scale};
}
// With its cuff the arm is longer, so it rests a little higher (radians,
// counter-clockwise) to keep the whole wave inside the 520-wide canvas.
export const ARM_LIFT=-.14;
// The arm's cuff starts inside a shaded tube; feather that cut edge so it
// melts into the sleeve under it instead of showing a vertical seam.
const feathered=new WeakMap();
function armSprite(image,doc){
 if(feathered.has(image))return feathered.get(image);
 const [x,y,w,h]=PARTS.arm,sprite=doc?.createElement?.('canvas'),context=sprite?.getContext?.('2d');
 if(!context)return null;
 sprite.width=w;sprite.height=h;context.drawImage(image,x,y,w,h,0,0,w,h);
 const fade=context.createLinearGradient(0,0,16,0);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'#000');
 context.globalCompositeOperation='destination-in';context.fillStyle=fade;context.fillRect(0,0,w,h);
 feathered.set(image,sprite);return sprite;
}
export function paintMascot(canvas,image,{mode='idle',seconds=0,reduced=false}={}){
 const context=canvas.getContext('2d'),worldWidth=mode==='wave'?520:420,worldHeight=450;
 if(!context)return;
 const p=mascotPose(seconds,mode,reduced);
 const part=(name,x,y,w,h)=>context.drawImage(image,...PARTS[name],x,y,w,h);
  context.setTransform(canvas.width/worldWidth,0,0,canvas.height/worldHeight,0,0);context.clearRect(0,0,worldWidth,worldHeight);
  context.save();context.translate(0,p.breath*.45);context.translate(200,430);context.scale(1,1+p.breath*.0014);context.translate(-200,-430);
  if(mode==='wave')part('waveBody',15,220,334,226);else part('body',15,220,370,226);context.restore();
  // The cuff sits over the sleeve's open end (world 312-344, centre y 320)
  // and the arm pivots inside it, so the shoulder stays attached at every phase.
  if(mode==='wave'){
   context.save();context.translate(317,320+p.breath*.45);context.rotate(p.arm+ARM_LIFT);const arm=armSprite(image,canvas.ownerDocument);if(arm)context.drawImage(arm,-4.8,-165.2,205.1,208);else part('arm',-4.8,-165.2,205.1,208);context.restore();
  }
  context.save();context.translate(200,231+p.breath);context.rotate(p.head);context.translate(-200,-231);
  part(p.blink?'blink':'head',54,0,280,255);context.restore();
}
export async function mountMascot(host,{mode='idle',paused=false,env=host.ownerDocument.defaultView,load=loadImage}={}){
 const doc=host.ownerDocument,canvas=doc.createElement('canvas');canvas.className='subway-mascot-canvas';canvas.setAttribute('aria-hidden','true');
 canvas.style.cssText='display:block;width:100%;height:100%;pointer-events:none';host.replaceChildren(canvas);
 const image=await load(MASCOT_ATLAS);if(!host.isConnected)return null;
 const context=canvas.getContext('2d');if(!context)return null;
 const reduced=env.matchMedia('(prefers-reduced-motion: reduce)');
 let stopped=false,frame=0,last=0,elapsed=0,lastPaint=-1000,hidden=false;
 function paint(){paintMascot(canvas,image,{mode,seconds:elapsed/1000,reduced:reduced.matches});}
 function resize(){
  const box=host.getBoundingClientRect(),dpr=Math.min(env.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));paint();
 }
 function tick(now){
  frame=0;if(stopped||paused||hidden||doc.hidden||reduced.matches)return;
  if(last)elapsed+=Math.min(64,now-last);last=now;
  if(now-lastPaint>=1000/30){lastPaint=now;paint();}
  frame=env.requestAnimationFrame(tick);
 }
 function sync(){
  if(frame)env.cancelAnimationFrame(frame);frame=0;last=0;paint();
  if(!stopped&&!paused&&!hidden&&!doc.hidden&&!reduced.matches)frame=env.requestAnimationFrame(tick);
 }
 const observer=new env.ResizeObserver(resize);observer.observe(host);resize();
 const hide=()=>{hidden=true;sync();},show=()=>{hidden=false;sync();};
 doc.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 env.addEventListener('pagehide',hide);env.addEventListener('pageshow',show);sync();host.dataset.mascotReady='true';
 return {setPaused(value){paused=!!value;sync();},stop(){if(stopped)return;stopped=true;if(frame)env.cancelAnimationFrame(frame);observer.disconnect();doc.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);env.removeEventListener('pagehide',hide);env.removeEventListener('pageshow',show);canvas.remove();delete host.dataset.mascotReady;}};
}
