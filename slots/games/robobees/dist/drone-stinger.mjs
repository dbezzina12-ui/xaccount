// Like BIRDS' flock, the outgoing and incoming scenes share one uninterrupted
// flight. The stage changes on a covered frame; continue is enabled after clear.
// painter: the live 3D mascot draws the bees when it's running (mascot.swarm());
// otherwise they're the painted drone sprites.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function sprite(name){
 const img=new Image();img.src='assets/'+name+'.webp';
 return img.decode().then(()=>img);
}
const art=Promise.all([sprite('drone-body'),sprite('drone-wing')]).catch(()=>null);

function drawBee(ctx,[body,wing],x,y,size,bank,beat,yaw){
 ctx.save();ctx.translate(x,y);ctx.rotate(bank);
 ctx.scale(size*(1-.19*Math.abs(yaw)),size);
 for(const side of [-1,1]){
  ctx.save();ctx.scale(side,1);ctx.translate(.39,-.025);
  const flap=Math.sin(beat),fold=Math.cos(beat);
  ctx.save();ctx.rotate(.16+Math.sin(beat-.6)*.48);
  ctx.drawImage(wing,-.05,-.085,.63,.11+.13*Math.abs(fold));ctx.restore();
  ctx.rotate(-.34+flap*.64+yaw*side*.13);
  ctx.drawImage(wing,-.055,-.16,.94-.10*flap,.12+.23*Math.abs(fold));ctx.restore();
 }
 ctx.drawImage(body,-.5,-.53,1,1.08);ctx.restore();
}

function animate(duration,draw,skip=()=>false){
 return new Promise(resolve=>{
  const start=performance.now();let frame;
  function finish(){cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',hidden);draw(1);resolve()}
  function hidden(){if(document.hidden)finish()}
  function tick(now){const t=(now-start)/duration;if(t>=1||document.hidden||skip()){finish();return}draw(clamp(t));frame=requestAnimationFrame(tick)}
  document.addEventListener('visibilitychange',hidden);tick(start);
 });
}

export async function playStinger({canvas,scatterCells,reduced,cut,sound,release=false,painter=null}){
 let swapped=false;
 function swap(){if(!swapped){swapped=true;cut()}}
 if(reduced||document.hidden){swap();return}
 const sprites=painter?null:await art,ctx=canvas.getContext('2d');
 if(!(painter||sprites)||!ctx){swap();return}
 canvas.dataset.painter=painter?'mascot':'drone';
 const origins=scatterCells.map(cell=>{
  const r=cell.getBoundingClientRect();
  return {x:(r.x+r.width/2)/innerWidth,y:(r.y+r.height/2)/innerHeight,size:r.width/innerWidth};
 });
 if(!origins.length)origins.push({x:.5,y:.44,size:.11});
 const duration=release?1260:2280,hit=release?.46:.68;
 const count=release?6:12;
 canvas.hidden=false;
 sound?.();
 try{
  await animate(duration,p=>{
   const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.4);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const shadow=ease((p-hit+.075)/.075)*(1-ease((p-hit-.02)/.16));
   if(shadow){ctx.fillStyle='rgba(24,17,11,'+shadow+')';ctx.fillRect(0,0,w,h)}
   if(p>=hit)swap();
   const placed=[];
   for(let i=0;i<count;i++){
    const hero=i===count-1,side=i%2?1:-1,o=origins[i%origins.length];
    const launch=hero?.065:((i*7)%11)*.022;
    const t=clamp((p-launch)/(1-launch));if(!t||t>=1)continue;
    const peak=hero?(hit-launch)/(1-launch):.49+(i%4)*.046;
    const approach=clamp(t/peak),exit=clamp((t-peak)/(1-peak)),depth=approach**3;
    const escape=exit*exit*(2-exit),bend=Math.sin(approach*Math.PI);
    const ox=release?w*(.12+.75*((i*.618)%1)):o.x*w,oy=release?h*(.04+.23*((i*.382)%1)):o.y*h;
    const tx=w*(hero?.49:.04+.92*((i*.618+.16)%1)),ty=h*(hero?.50:.06+.86*((i*.382+.24)%1));
    const x=ox+(tx-ox)*depth+side*bend*w*.075+(hero?1:side)*escape*w*(hero?4.8:2.1);
    const y=oy+(ty-oy)*depth-bend*h*(.08+.022*(i%3))-escape*h*(hero?3.8:.6);
    const near=hero?Math.max(w,h)*2.15:Math.min(w,h)*(.23+.095*(i%4));
    const size=(o.size*w*.23+depth*near)*(1+exit*.13);
    const bank=side*bend*(.28+.08*(i%3))+side*exit*.53+Math.sin(t*8+i)*.06,beat=i*2.3+p*duration*.001*2*Math.PI*(8.4+i*.09),yaw=Math.sin(t*5+i);
    // the 3D bees grow in from nothing where the sprites fade in
    if(painter){placed.push({x,y,size:size*ease(t/.09),bank,beat,yaw,hero});continue}
    ctx.globalAlpha=ease(t/.09);
    drawBee(ctx,sprites,x,y,size,bank,beat,yaw);
   }
   if(painter)painter.draw(ctx,w,h,dpr,placed);
   // Let the passing swarm resolve into the same dark ink as the award art.
   // source-atop keeps the illustration visible wherever the swarm has cleared.
   const ink=release?1-ease((p-.12)/.29):ease((p-hit+.045)/.15);
   if(ink>0){ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=ink;ctx.fillStyle='#20231f';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over'}
   ctx.globalAlpha=1;
  });
 }finally{swap();canvas.hidden=true;canvas.width=1;canvas.height=1}
}

// One board-space flight per destination. Arrival updates are independent of
// frame rate; a skipped or backgrounded flight still delivers every bee.
export async function flyHiveBees({canvas,hive,targets,collect,fast,skip,onArrival}){
 if(!targets.length)return;
 const sprites=await art,ctx=canvas.getContext('2d');
 if(!sprites||!ctx||skip()||document.hidden){targets.forEach((_,i)=>onArrival(i));return}
 const spacing=fast?28:70,travel=fast?300:590,total=travel+spacing*(targets.length-1);
 const landed=new Set();
 canvas.hidden=false;
 try{
  await animate(total,progress=>{
   const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.4);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const port=hive.getBoundingClientRect(),hx=port.x+port.width/2,hy=port.y+port.height/2;
   targets.forEach((target,i)=>{
    if(landed.has(i))return;
    const t=clamp((progress*total-i*spacing)/travel);
    if(t===1||progress===1){landed.add(i);onArrival(i);return}
    if(t<=0)return;
    const r=target.getBoundingClientRect(),px=r.x+r.width/2,py=r.y+r.height/2;
    const u=collect?1-ease(t):ease(t),arc=Math.sin(u*Math.PI);
    const swing=(i%2?1:-1)*Math.min(32,r.width*.32)*arc;
    const x=hx+(px-hx)*u+swing,y=hy+(py-hy)*u-arc*Math.min(82,r.height*.9);
    const size=Math.max(15,Math.min(37,r.width*.36))*(.55+.45*arc);
    drawBee(ctx,sprites,x,y,size,(collect?-1:1)*(.16+.18*arc)*Math.sign(px-hx),progress*total*.052+i,arc*.6);
   });
  },skip);
 }finally{canvas.hidden=true;canvas.width=1;canvas.height=1}
}
