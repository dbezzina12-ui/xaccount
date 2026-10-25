// Authoring geometry only. Links preserve offsets when a parent moves.
export const guideSettings=s=>({snap:true,safe:false,margin:24,grid:10,...s.guides});
export function validateLayout(s){
 if(s.guides!==undefined){const g=s.guides;if(!g||typeof g!=='object'||Array.isArray(g)||Object.keys(g).some(k=>!['snap','safe','margin','grid'].includes(k)))throw Error('Invalid canvas guides.');
  for(const k of ['snap','safe'])if(g[k]!==undefined&&typeof g[k]!=='boolean')throw Error('Invalid guide toggle.');
  for(const [k,min,max] of [['margin',0,Math.min(s.width,s.height)/3],['grid',1,100]])if(g[k]!==undefined&&(!Number.isFinite(g[k])||g[k]<min||g[k]>max))throw Error('Invalid guide spacing.');
 }
 const byId=new Map(s.layers.map(l=>[l.id,l]));
 for(const l of s.layers){const seen=new Set([l.id]);let next=l;
  while(next.anchorId!==undefined&&next.anchorId!==null&&next.anchorId!==''){
   if(typeof next.anchorId!=='string'||!byId.has(next.anchorId)||seen.has(next.anchorId))throw Error('A layer must link to an existing layer without a cycle.');
   seen.add(next.anchorId);next=byId.get(next.anchorId);
  }
 }
}
export function follows(s,childId,parentId){
 const byId=new Map(s.layers.map(l=>[l.id,l]));let l=byId.get(childId);const seen=new Set();
 while(l?.anchorId&&!seen.has(l.id)){seen.add(l.id);if(l.anchorId===parentId)return true;l=byId.get(l.anchorId);}return false;
}
export function moveLinked(s,id,values){
 const l=s.layers.find(l=>l.id===id);if(!l)throw Error('Unknown layer.');
 const dx=(values.x??l.x)-l.x,dy=(values.y??l.y)-l.y;
 if(dx||dy)for(const child of s.layers)if(follows(s,child.id,id)){
  if(child.locked)throw Error('Unlock linked layers before moving this group.');
  child.x+=dx;child.y+=dy;
 }
 Object.assign(l,values);
}
export function alignment(s,l,action){
 if(l.locked)throw Error('Unlock this layer before aligning it.');
 const g=guideSettings(s),m=g.safe?g.margin:0;
 const values={left:{x:m},center:{x:(s.width-l.w)/2},right:{x:s.width-m-l.w},top:{y:m},middle:{y:(s.height-l.h)/2},bottom:{y:s.height-m-l.h}}[action];
 if(!values)throw Error('Unknown alignment.');return Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Math.round(v)]));
}
export function snapPosition(s,l,x,y){
 const g=guideSettings(s);if(!g.snap)return {x:Math.round(x),y:Math.round(y)};
 const m=g.safe?g.margin:0;
 const others=s.layers.filter(o=>o.id!==l.id&&o.visible&&!follows(s,o.id,l.id));
 const axis=(v,size,extent,key,dim)=>{
  const targets=[m,extent/2,extent-m,...others.flatMap(o=>[o[key],o[key]+o[dim]/2,o[key]+o[dim]])];
  let best=null;for(const edge of [0,size/2,size])for(const t of targets){const d=t-(v+edge);if(Math.abs(d)<=8&&(best===null||Math.abs(d)<Math.abs(best)))best=d;}
  return Math.round(best===null?Math.round(v/g.grid)*g.grid:v+best);
 };
 return {x:axis(x,l.w,s.width,'x','w'),y:axis(y,l.h,s.height,'y','h')};
}
