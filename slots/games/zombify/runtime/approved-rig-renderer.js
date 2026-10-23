// Small review renderer for this package's region, weighted-mesh and FK subset only.
// This is not the Spine runtime and is not a validator for arbitrary Spine data.
export function sample(frames,time,field,fallback=0){
 if(!frames?.length)return fallback;
 let a=frames[0],b=a;
 if(frames.sampleStep>0){const i=Math.max(0,Math.min(frames.length-1,Math.floor(time/frames.sampleStep)));a=frames[i];b=frames[Math.min(i+1,frames.length-1)];}
 else for(const f of frames){if(f.time<=time)a=f;else{b=f;break;}b=a;}
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
export function slotAttachment(data,clip,slot,time){let name=slot.attachment;for(const f of data.animations[clip]?.slots?.[slot.name]?.attachment||[])if(f.time<=time)name=f.name;return name;}
export function drawMesh(ctx,art,img,world,bones){
 const points=[];let offset=0;
 for(let i=0;i<art.uvs.length/2;i++){const count=art.vertices[offset++];let x=0,y=0;for(let j=0;j<count;j++){const bi=art.vertices[offset++],vx=art.vertices[offset++],vy=art.vertices[offset++],weight=art.vertices[offset++],m=world[bones[bi].name];x+=(m[0]*vx+m[2]*vy+m[4])*weight;y+=(m[1]*vx+m[3]*vy+m[5])*weight;}points.push([x,y]);}
 for(let i=0;i<art.triangles.length;i+=3){const ids=art.triangles.slice(i,i+3),p=ids.map(n=>points[n]),uv=ids.map(n=>[art.uvs[n*2]*img.width,art.uvs[n*2+1]*img.height]);
 const [u0,u1,u2]=uv,[p0,p1,p2]=p,ux=u1[0]-u0[0],uy=u1[1]-u0[1],vx=u2[0]-u0[0],vy=u2[1]-u0[1],det=ux*vy-uy*vx;if(Math.abs(det)<1e-8)continue;
 const dx=p1[0]-p0[0],dy=p1[1]-p0[1],ex=p2[0]-p0[0],ey=p2[1]-p0[1],a=(dx*vy-ex*uy)/det,b=(dy*vy-ey*uy)/det,c=(ex*ux-dx*vx)/det,d=(ey*ux-dy*vx)/det,e=p0[0]-a*u0[0]-c*u0[1],f=p0[1]-b*u0[0]-d*u0[1];
 ctx.save();ctx.beginPath();const sign=((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))>0?1:-1;const normals=p.map((v,j)=>{const q=p[(j+1)%3],dx=q[0]-v[0],dy=q[1]-v[1],l=Math.hypot(dx,dy)||1;return[sign*dy/l,-sign*dx/l];});for(let j=0;j<3;j++){const n=normals[(j+2)%3],m=normals[j],f=.55/Math.max(.01,1+n[0]*m[0]+n[1]*m[1]),xx=p[j][0]+(n[0]+m[0])*f,yy=p[j][1]+(n[1]+m[1])*f;j?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(img,0,0);ctx.restore();
 }
}
export function drawRig(ctx,data,images,clip,time,scale=1,offsetX=0,offsetY=0){
 const world=pose(data,clip,time),skin=data.skins[0].attachments;
 ctx.save();ctx.translate(offsetX,offsetY);ctx.scale(scale,-scale);
 for(const slot of data.slots){const attachment=slotAttachment(data,clip,slot,time);if(!attachment)continue;const art=skin[slot.name]?.[attachment];if(!art)continue;const img=images[art.path||attachment];if(!img)continue;ctx.save();ctx.globalAlpha=slotAlpha(data,clip,slot,time);ctx.globalCompositeOperation=slot.blend==='additive'?'lighter':'source-over';
 if(art.type==='mesh')drawMesh(ctx,art,img,world,data.bones);
 else{ctx.transform(...world[slot.bone]);ctx.translate(art.x||0,art.y||0);ctx.rotate((art.rotation||0)*Math.PI/180);ctx.scale(1,-1);ctx.drawImage(img,-art.width/2,-art.height/2,art.width,art.height);}ctx.restore();}ctx.restore();
}
