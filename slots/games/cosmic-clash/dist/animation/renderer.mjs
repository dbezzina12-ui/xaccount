import * as Spine from './vendor/spine-core.mjs';
import {paintGPU} from './gpu.mjs';
export {Spine};
const cache=new Map();
const root=new URL('../assets/spine-v96/',import.meta.url);
const fetchText=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`Animation asset ${r.status}`);return r.text();};
const image=url=>new Promise((resolve,reject)=>{const im=new Image();let timer=setTimeout(()=>reject(Error('Animation image timed out')),12000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(Error('Animation image failed'));};im.src=url;});
export function loadRig(name){
 if(!cache.has(name))cache.set(name,(async()=>{
  const base=name==='vs-symbol'?new URL('../assets/spine-v97/vs-symbol/',import.meta.url):new URL(name+'/',root);
  const artUrl=path=>{const url=new URL(path,base);if(name==='fs-vault')url.searchParams.set('art','foundry');return url;};
  const [json,manifest,atlasText]=await Promise.all([fetchText(new URL(name+'.json',base)).then(JSON.parse),fetchText(artUrl('rig-manifest.json')).then(JSON.parse),fetchText(artUrl('parts.atlas'))]);
  const atlas=new Spine.TextureAtlas(atlasText),textures=new Map();
  await Promise.all(atlas.pages.map(async p=>textures.set(p.name,await image(artUrl(p.name)))));
  const data=new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas)).readSkeletonData(json);
  return {manifest,data,textures};
 })().catch(e=>{cache.delete(name);throw e;}));
 return cache.get(name);
}
export function instance(asset){
 const skeleton=new Spine.Skeleton(asset.data),state=new Spine.AnimationState(new Spine.AnimationStateData(asset.data));
 skeleton.updateWorldTransform(Spine.Physics.none);
 return {...asset,skeleton,state,step(dt){state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform(Spine.Physics.none);}};
}
export function affine(s,d){
 const [[x0,y0],[x1,y1],[x2,y2]]=s,[[u0,v0],[u1,v1],[u2,v2]]=d;
 const det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(det)<1e-8)return null;
 const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/det,c=((x1-x0)*(u2-u0)-(x2-x0)*(u1-u0))/det;
 const b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/det,dv=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/det;
 return [a,b,c,dv,u0-a*x0-c*y0,v0-b*x0-dv*y0];
}
// Native 4.3 timelines and weighted meshes; Canvas is only the raster backend.
// Every shipped attachment is a mesh. The source atlases use straight alpha.
export function drawRig(ctx,rig,view,{exclude=new Set()}={}){
 if(paintGPU(ctx,rig,view,exclude))return;
 for(const slot of rig.skeleton.drawOrder.appliedPose){
  if(exclude.has(slot.data.name))continue;
  const pose=slot.appliedPose,mesh=pose.getAttachment(),alpha=pose.color.a*(mesh?.color.a??1);
  if(!mesh||alpha<.001||!(mesh instanceof Spine.MeshAttachment))continue;
  const si=mesh.sequence.resolveIndex(pose),uv=mesh.sequence.getUVs(si),tex=rig.textures.get(mesh.sequence.regions[si].page.name);
  if(!tex)continue;
  const world=[];mesh.computeWorldVertices(rig.skeleton,slot,0,mesh.worldVerticesLength,world,0,2);
  const pts=[],src=[];
  for(let i=0;i<world.length;i+=2){pts.push([view.x+world[i]*view.scale,view.y-world[i+1]*view.scale]);src.push([uv[i]*tex.width,uv[i+1]*tex.height]);}
  const ids=mesh.triangles;let map=null;
  for(let i=0;i<ids.length&&!map;i+=3)map=affine(ids.slice(i,i+3).map(j=>src[j]),ids.slice(i,i+3).map(j=>pts[j]));
  if(!map)continue;
  const rigid=pts.every(([x,y],i)=>Math.hypot(map[0]*src[i][0]+map[2]*src[i][1]+map[4]-x,map[1]*src[i][0]+map[3]*src[i][1]+map[5]-y)<.025);
  const paint=(indices,m,expand)=>{
   ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation=slot.data.blendMode===1?'lighter':'source-over';ctx.beginPath();
   for(let i=0;i<indices.length;i+=3){let p=indices.slice(i,i+3).map(j=>pts[j]);
    if(expand){const cx=p.reduce((n,v)=>n+v[0],0)/3,cy=p.reduce((n,v)=>n+v[1],0)/3;p=p.map(([x,y])=>{const n=Math.max(.001,Math.hypot(x-cx,y-cy));return[x+(x-cx)/n*.38,y+(y-cy)/n*.38];});}
    ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();
   }
   ctx.clip();ctx.transform(...m);ctx.drawImage(tex,0,0);ctx.restore();
  };
  if(rigid)paint(ids,map,false);else for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3),m=affine(tri.map(j=>src[j]),tri.map(j=>pts[j]));if(m)paint(tri,m,true);}
 }
}
export function canvasFor(host,className='spine-canvas'){
 const canvas=document.createElement('canvas');canvas.className=className;canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();throw Error('Animation canvas unavailable');}
 return {canvas,ctx,begin(){const width=host.clientWidth,height=host.clientHeight,dpr=Math.min(1.5,devicePixelRatio||1);if(!width||!height)return null;
  const w=Math.ceil(width*dpr),h=Math.ceil(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);return {width,height};
 },dispose(){canvas.remove();}};
}
const tickers=new Set();let frame=0,last=0;
export function tick(fn){tickers.add(fn);if(!frame)frame=requestAnimationFrame(loop);return()=>{tickers.delete(fn);if(!tickers.size&&frame){cancelAnimationFrame(frame);frame=0;last=0;}};}
function loop(now){frame=requestAnimationFrame(loop);if(document.hidden){last=now;return;}if(last&&now-last<1000/30)return;const dt=last?Math.min(.15,(now-last)/1000):0;last=now;for(const fn of [...tickers])try{fn(dt);}catch(e){tickers.delete(fn);console.error('Animation stopped',e);}if(!tickers.size){cancelAnimationFrame(frame);frame=0;last=0;}}
