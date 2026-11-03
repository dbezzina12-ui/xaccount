// Lens-space compositing: the nozzle stays small in world space, but the end of
// the stream expands towards the viewer. No particles use the game's RNG.
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const p = clamp(n); return p*p*(3-2*p); };
let splash, crests;
function waterArt() {
  if (splash) return;
  // Asymmetrical lobes and folded crests, drawn once in impact-centred coordinates.
  splash = new Path2D('M-.82-.14C-.90-.28-1.20-.27-1.09-.44C-1.00-.58-.77-.36-.65-.46C-.55-.59-.81-.90-.64-.99C-.45-1.10-.49-.65-.31-.68C-.08-.71-.23-1.22-.02-1.19C.17-1.17.05-.72.25-.68C.43-.64.55-1.00.67-.89C.81-.77.52-.54.65-.44C.81-.32 1.07-.59 1.14-.42C1.22-.22.79-.20.82-.04C.85.14 1.19.18 1.04.34C.94.44.72.26.64.41C.56.57.84.73.71.87C.55 1.02.39.66.27.69C.12.73.30 1.23.10 1.23C-.13 1.22.04.73-.17.68C-.38.62-.41 1.03-.57.94C-.75.84-.45.57-.59.46C-.75.34-.99.57-1.06.41C-1.16.20-.75.21-.82-.14Z');
  crests = new Path2D('M-1.02-.43Q-.87-.46-.73-.37Q-.61-.33-.56-.43Q-.64-.25-.79-.31Z M-.58-.91Q-.52-.86-.47-.70Q-.40-.56-.33-.60Q-.46-.50-.53-.67Z M.01-1.12Q.07-1.01.01-.86Q-.03-.74.06-.68Q-.10-.72-.06-.90Z M.99-.40Q.86-.35.76-.23Q.68-.13.59-.17Q.71-.14.79-.20Z M.56.71Q.63.86.69.82Q.67.70.58.63Z');
}

function drop(ctx, x, y, r, stretch = 1, tilt = 0) {
  if (r < .4) return;
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(1,stretch);
  ctx.beginPath();ctx.ellipse(0,0,r*.78,r,0,0,Math.PI*2);
  ctx.fillStyle='#159deb';ctx.fill();ctx.strokeStyle='#075cb0';ctx.lineWidth=Math.max(.9,r*.10);ctx.stroke();
  ctx.beginPath();ctx.ellipse(-r*.22,-r*.39,r*.15,r*.34,.45,0,Math.PI*2);
  ctx.fillStyle='#c8f8ff';ctx.fill();ctx.restore();
}

function drawJet(ctx, barrel, target, progress, size, pilot) {
  if (!barrel || progress<=0 || progress>=1) return;
  const {x:sx,y:sy,dx,dy}=barrel, distance=Math.hypot(target.x-sx,target.y-sy);
  const lead=Math.min(110,distance*.34), lift=pilot?size*.07:size*.14;
  const path=k=>{
    const v=1-k;
    return {x:v*v*v*sx+3*v*v*k*(sx+dx*lead)+3*v*k*k*(target.x+(sx-target.x)*.16)+k*k*k*target.x,
            y:v*v*v*sy+3*v*v*k*(sy+dy*lead)+3*v*k*k*(target.y-lift)+k*k*k*target.y};
  };
  const head=clamp(progress/(pilot?.84:.65)), tail=clamp((progress-(pilot?.20:.59))/(pilot?.80:.41));
  const upper=[],lower=[],shine=[];
  for(let j=0;j<=18;j++){
    const k=tail+(head-tail)*j/18,p=path(k),a=path(k-.001),b=path(k+.001);
    const len=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
    const breadth=(pilot?1.1:2.6)+(pilot?.012:.11)*size*k**2.7;
    const wave=1+.13*Math.sin(15*k-progress*19);
    upper.push([p.x+nx*breadth*wave,p.y+ny*breadth*wave]);
    lower.push([p.x-nx*breadth,p.y-ny*breadth]);
    shine.push([p.x+nx*breadth*.45,p.y+ny*breadth*.45]);
  }
  ctx.beginPath();for(const [x,y] of [...upper,...lower.reverse()])ctx.lineTo(x,y);ctx.closePath();
  ctx.fillStyle='#168fe5';ctx.strokeStyle='#075eb4';ctx.lineWidth=pilot?1:2.5;ctx.fill();ctx.stroke();
  ctx.beginPath();for(const [x,y] of shine)ctx.lineTo(x,y);
  ctx.strokeStyle='#96edff';ctx.lineWidth=pilot?1.3:Math.max(2,size*.008);ctx.stroke();
  const tip=path(head);drop(ctx,tip.x,tip.y,(pilot?.014:.069)*size*(.18+head*head),.88);
}

export function paintLensWater(ctx,w,h,t,barrel,wind) {
  if(t<=0 || t>=1 || w<=0 || h<=0)return;
  const size=Math.min(w,h), hit={x:w*.48,y:h*.46}, test={x:w*.455,y:h*.415};
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  drawJet(ctx,barrel,test,clamp(t/.135),size,true);
  if(t>.114 && t<.55){
    const age=clamp((t-.114)/.27), r=size*.023*(.84+.16*Math.sin(Math.min(age*9,Math.PI)));
    drop(ctx,test.x,test.y+age*age*size*.018,r,1+age*.56,.11);
    for(let i=0;i<3;i++)drop(ctx,test.x+(i-1.1)*r*2.2,test.y-r*(1.2+i%2)+age*r*.6,r*(.19+i*.06));
  }
  drawJet(ctx,barrel,hit,clamp((t-.31)/.255),size,false);
  if(t<.469){ctx.restore();return;}
  waterArt();
  const spread=smooth((t-.469)/.145);
  const far=Math.hypot(Math.max(hit.x,w-hit.x),Math.max(hit.y,h-hit.y));
  const radius=Math.max(.01,far*.92*spread);
  const {cx,cy,front}=wind;
  // The dry patch expands from the fan itself. The spray is pushed out to
  // the sides of the lens, in the same direction as the loose reel faces.
  ctx.save();
  ctx.globalAlpha=1-.67*smooth((t-.59)/.19);
  if(front>0){
    ctx.beginPath();ctx.rect(-2,-2,w+4,h+4);ctx.moveTo(cx+front,cy);
    ctx.arc(cx,cy,front,0,Math.PI*2);ctx.clip('evenodd');
  }
  ctx.save();ctx.translate(hit.x,hit.y);ctx.rotate(-.11);ctx.scale(radius,radius*.93);
  const water=ctx.createLinearGradient(-.55,-.76,.33,.80);
  water.addColorStop(0,'#70e6ff');water.addColorStop(.27,'#19b8f6');water.addColorStop(.64,'#087ed8');water.addColorStop(1,'#0a51ac');
  ctx.fillStyle=water;ctx.fill(splash);ctx.lineWidth=.018;ctx.strokeStyle='#075cb0';ctx.stroke(splash);
  ctx.fillStyle='#bcf6ff';ctx.fill(crests);ctx.restore();
  // Reflections stay anchored to the wet glass until the blast reaches them.
  if(spread>.14){
    ctx.save();ctx.globalAlpha=smooth((spread-.14)/.8)*.68;
    for(let j=0;j<13;j++){
      const x=w*((j*.618+.11)%1), y=h*((j*.383+.12)%1)+h*(-.08*(1-spread));
      if(Math.hypot(x-hit.x,y-hit.y)>radius*.63)continue;
      const r=size*(.009+.007*(j%4));
      ctx.beginPath();ctx.ellipse(x,y,r*.64,r*1.38,-.23,0,Math.PI*2);ctx.strokeStyle='#54d5fe';ctx.lineWidth=1.5;ctx.stroke();
      ctx.beginPath();ctx.ellipse(x-r*.18,y-r*.62,r*.16,r*.38,.24,0,Math.PI*2);ctx.fillStyle='#e2fcff';ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  if(front>0){
    ctx.globalAlpha=1-smooth((t-.83)/.14);
    for(let j=0;j<20;j++){
      const a=j*2.4,r=front*(.93+.16*((j*.61)%1));
      const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      if(Math.hypot(x-hit.x,y-hit.y)>radius*1.02)continue;
      drop(ctx,x,y,size*(.006+.003*(j%5)),1.6+(j%3)*.35,a-Math.PI/2);
    }
  }else{
    for(let j=0;j<14;j++){
      const angle=j*2.4, reach=radius*(1.0+.32*(j%4)/3);
      drop(ctx,hit.x+Math.cos(angle)*reach,hit.y+Math.sin(angle)*reach*.91,
        (2+size*.023*spread)*(1+j%3*.32),1.28,angle-Math.PI/2);
    }
  }
  ctx.restore();
}
