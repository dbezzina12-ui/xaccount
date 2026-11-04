// Optical effects reuse the presenter clock and the actual flight coordinates.
const limit=x=>Math.max(0,Math.min(1,x));
function circuit(ctx,from,to,t,index,color){
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
 const flash=.5+.5*Math.cos(t*5-index*1.7);
 ctx.beginPath();ctx.moveTo(from.x,from.y);
 for(let j=1;j<8;j++){
  const u=j/8,offset=Math.sin(j*2.4+t*6+index)*Math.sin(Math.PI*u)*Math.min(8,length*.06);
  ctx.lineTo(from.x+dx*u-dy/length*offset,from.y+dy*u+dx/length*offset);
 }
 ctx.lineTo(to.x,to.y);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.globalAlpha=.12+.32*flash;ctx.stroke();
 ctx.lineWidth=1;ctx.strokeStyle='#e3fff5';ctx.stroke();
}
function crest(ctx,x,y,r,t,still){
 ctx.save();ctx.translate(x,y);ctx.scale(r,r);
 const edges=[[-1,-.23],[-.58,-.04],[-.46,-.62],[0,-.2],[.46,-.62],[.58,-.04],[1,-.23],[.72,.24],[-.72,.24],[-1,-.23]];
 const progress=still?1:limit((t-.18)/1.25),end=(edges.length-1)*progress;
 ctx.beginPath();ctx.moveTo(...edges[0]);
 for(let j=1;j<edges.length;j++){
  const f=limit(end-j+1);if(!f)break;
  const [a,b]=edges[j-1],[c,d]=edges[j];ctx.lineTo(a+(c-a)*f,b+(d-b)*f);
 }
 ctx.lineJoin='round';ctx.lineWidth=.025;ctx.strokeStyle='#ffe2a2';ctx.globalAlpha=.76;ctx.stroke();
 if(progress===1){ctx.fillStyle='#f59a4820';ctx.fill();ctx.fillStyle='#ffe09c';for(const [a,b] of [edges[2],edges[4]]){ctx.beginPath();ctx.arc(a,b,.045,0,Math.PI*2);ctx.fill()}}
 ctx.restore();
}
export function paintFlightEffects(ctx,scene,bees,t,still){
 if(!scene.id||!bees.length)return;
 const {w,h,stage}=scene.view,hero=bees.find(b=>b.hero);if(!hero)return;
 ctx.save();ctx.lineCap='round';
 // The wake follows the drones during their first pass. Each trail tapers to pollen.
 for(const bee of bees){
  const f=still?0:Math.sin(Math.PI*bee.arrival);
  if(f<=.01)continue;
  const side=bee.x<w/2?-1:1,span=bee.size*.95*f;
  for(let k=-1;k<=1;k++){
   const y=bee.y+k*bee.size*.09;
   ctx.beginPath();ctx.moveTo(bee.x,y);ctx.quadraticCurveTo(bee.x+side*span*.6,y+span*.18,bee.x+side*span,y-span*.1);
   ctx.strokeStyle=scene.config.accent;ctx.globalAlpha=.34*f;ctx.lineWidth=(k===0?3:1)*f;ctx.stroke();
  }
 }
 if(scene.id==='epic'){
  bees.filter(b=>!b.hero).forEach((bee,i)=>circuit(ctx,bee,hero,still?0:t,i,'#60e8e0'));
 }
 if(scene.id==='mythic'){
  const r=Math.min(w*.20,h*.13);
  crest(ctx,w*.5,Math.max(scene.view.insets.top+r*.8,hero.y-hero.size*.54),r,t,still);
 }
 if(scene.id==='max'){
  // Two shock fronts travel outward from the vault seam as it opens.
  for(const delay of [.25,.67]){
   const p=still?1:limit((t-delay)/1.4);if(p<=0||p>=1)continue;
   ctx.globalAlpha=.65*(1-p);ctx.strokeStyle='#ffeab6';ctx.lineWidth=2+4*(1-p);
   ctx.beginPath();ctx.ellipse(w*.5,stage.y+stage.h*.44,Math.max(1,p*w*.8),Math.max(1,p*h*.72),0,0,2*Math.PI);ctx.stroke();
  }
 }
 ctx.restore();
}
