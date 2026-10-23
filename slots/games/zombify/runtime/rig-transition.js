import {pose,slotAttachment} from './approved-rig-renderer.js';
import {attachmentGeometry} from './rig-geometry.js';

// Match UV locations once, then unfold the SAME character mesh into its claim.
// This avoids a cross-fade, duplicate bodies or an instant long-body pose swap.
function uvMap(uv,g){
 return Array.from({length:uv.length/2},(_,i)=>{
  const x=uv[i*2],y=uv[i*2+1];
  for(let j=0;j<g.indices.length;j+=3){
   const ids=g.indices.slice(j,j+3),[a,b,c]=ids.map(k=>[g.uv[k*2],g.uv[k*2+1]]);
   const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-9)continue;
   const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;
   if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)return {ids,weights:[u,v,1-u-v]};
  }
  throw Error('Rig transition has incompatible texture coordinates');
 });
}
export function createRigTransition(rig,fromClip,toClip){
 const data=rig.data,sourceWorld=pose(data,fromClip,0),targetWorld=pose(data,toClip,0),skin=data.skins[0].attachments;
 const out={...rig,data:{bones:[{name:'root'}],slots:[],skins:[{attachments:{}}],animations:{transition:{}}}},entries=[];
 for(const slot of data.slots){
  const from=skin[slot.name]?.[slotAttachment(data,fromClip,slot,0)],to=skin[slot.name]?.[slotAttachment(data,toClip,slot,0)];if(!from||!to)continue;
  const a=attachmentGeometry(from,sourceWorld,data.bones,slot.bone),b=attachmentGeometry(to,targetWorld,data.bones,slot.bone);
  const art={type:'mesh',path:to.path,uvs:a.uv,triangles:a.indices,vertices:a.xy.flatMap((_,i)=>i%2?[]:[1,0,a.xy[i],a.xy[i+1],1])};
  out.data.slots.push({...slot,bone:'root',attachment:'morph'});out.data.skins[0].attachments[slot.name]={morph:art};
  entries.push({slot,to,a,map:uvMap(a.uv,b),art});
 }
 return (time,progress)=>{
  const world=pose(data,toClip,time),p=Math.max(0,Math.min(1,progress));
  for(const {slot,to,a,map,art}of entries){
   const b=attachmentGeometry(to,world,data.bones,slot.bone);
   for(let i=0;i<map.length;i++){
    const {ids,weights}=map[i];
    for(let axis=0;axis<2;axis++){
     const target=ids.reduce((sum,k,j)=>sum+b.xy[k*2+axis]*weights[j],0);
     art.vertices[i*5+2+axis]=a.xy[i*2+axis]+(target-a.xy[i*2+axis])*p;
    }
   }
  }
  return out;
 };
}
