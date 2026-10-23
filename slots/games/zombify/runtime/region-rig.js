// Small review renderer for this package's region/linear-FK subset only.
// This is not the Spine runtime and is not a validator for arbitrary Spine data.
export function sample(frames,time,field,fallback=0){
 if(!frames?.length)return fallback;
 let a=frames[0],b=a;for(const f of frames){if(f.time<=time)a=f;else{b=f;break;}b=a;}
 const x=a[field]??fallback,y=b[field]??fallback;
 if(a===b||a.curve==='stepped')return x;
 const p=Math.max(0,Math.min(1,(time-(a.time||0))/((b.time||0)-(a.time||0))));return x+(y-x)*p;
}
export function multiply(p,q){return [p[0]*q[0]+p[2]*q[1],p[1]*q[0]+p[3]*q[1],p[0]*q[2]+p[2]*q[3],p[1]*q[2]+p[3]*q[3],p[0]*q[4]+p[2]*q[5]+p[4],p[1]*q[4]+p[3]*q[5]+p[5]];}
export function pose(data,clip,time){
 const animation=data.animations[clip]||{},world={};
 for(const b of data.bones){const t=animation.bones?.[b.name]||{};
 const angle=((b.rotation||0)+sample(t.rotate,time,'angle'))*Math.PI/180,sx=(b.scaleX??1)*sample(t.scale,time,'x',1),sy=(b.scaleY??1)*sample(t.scale,time,'y',1);
 const local=[Math.cos(angle)*sx,Math.sin(angle)*sx,-Math.sin(angle)*sy,Math.cos(angle)*sy,(b.x||0)+sample(t.translate,time,'x'),(b.y||0)+sample(t.translate,time,'y')];
 world[b.name]=b.parent?multiply(world[b.parent],local):local;}
 return world;
}
export function clipDuration(data,clip){let end=0;const walk=value=>{if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object'){if(typeof value.time==='number')end=Math.max(end,value.time);Object.values(value).forEach(walk);}};walk(data.animations[clip]);return end||1;}
export function slotAlpha(data,clip,slot,time){const timeline=data.animations[clip]?.slots?.[slot.name]?.color;if(!timeline)return parseInt((slot.color||'ffffffff').slice(6,8),16)/255;return sample(timeline.map(f=>({time:f.time,alpha:parseInt(f.color.slice(6,8),16)/255})),time,'alpha',1);}
export function drawRig(ctx,data,images,clip,time,scale=1,offsetX=0,offsetY=0){
 const world=pose(data,clip,time),skin=data.skins[0].attachments;
 ctx.save();ctx.translate(offsetX,offsetY);ctx.scale(scale,-scale);
 for(const slot of data.slots){if(!slot.attachment)continue;const art=skin[slot.name]?.[slot.attachment];if(!art)continue;const img=images[art.path||slot.attachment];if(!img)continue;ctx.save();ctx.transform(...world[slot.bone]);ctx.translate(art.x||0,art.y||0);ctx.rotate((art.rotation||0)*Math.PI/180);ctx.scale(1,-1);ctx.globalAlpha=slotAlpha(data,clip,slot,time);ctx.globalCompositeOperation=slot.blend==='additive'?'lighter':'source-over';ctx.drawImage(img,-art.width/2,-art.height/2,art.width,art.height);ctx.restore();}ctx.restore();
}
