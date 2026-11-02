// Like BIRDS' flock, the outgoing and incoming scenes share one uninterrupted
// flight. The stage changes on a covered frame; continue is enabled after clear.
// painter: the live 3D mascot draws the bees when it's running (mascot.swarm());
// otherwise they're the painted drone sprites.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function sprite(name){
 const img=new Image();img.src=name;
 return img.decode().then(()=>img);
}
const art=Promise.all([sprite('assets/drone-body.webp'),sprite('assets/drone-wing.webp')]).catch(()=>null);

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

// Each endpoint is measured in viewport coordinates every frame, including after a rotation.
let workers;
function workerArt(){
 workers??=Promise.all([
  sprite('mascot/bee-hover.webp'),
  fetch('mascot/mascot.json').then(r=>{if(!r.ok)throw Error();return r.json()})
 ]).then(([image,meta])=>({image,clip:meta.clips.hover})).catch(()=>null);
 return workers;
}

export async function flyHiveBees({canvas,hive,targets,collect,fast,skip,onDeparture=()=>{},onArrival}){
 if(!targets.length)return;
 const departed=new Set(),landed=new Set();
 function leave(i){if(!departed.has(i)){departed.add(i);onDeparture(i)}}
 function arrive(i){if(!landed.has(i)){leave(i);landed.add(i);onArrival(i)}}
 const finish=()=>targets.forEach((_,i)=>arrive(i));
 if(skip()||document.hidden){finish();return}
 const ctx=canvas.getContext('2d'),worker=await workerArt(),drones=worker?null:await art;
 if(!ctx||!(worker||drones)||skip()||document.hidden){finish();return}
 const spacing=fast?55:145,travel=fast?400:850,total=travel+spacing*(targets.length-1);
 canvas.hidden=false;
 try{
  await animate(total,progress=>{
   const bounds=canvas.getBoundingClientRect(),w=bounds.width,h=bounds.height;
   const dpr=Math.min(devicePixelRatio||1,1.4);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const port=hive.getBoundingClientRect(),hx=port.x+port.width/2-bounds.x,hy=port.y+port.height/2-bounds.y;
   targets.forEach((target,i)=>{
    if(landed.has(i))return;
    const elapsed=progress*total-i*spacing;
    if(elapsed<0)return;
    leave(i);
    if(elapsed>=travel||progress===1){arrive(i);return}
    const t=ease(clamp(elapsed/travel)),u=collect?1-t:t,v=1-u;
    const r=target.getBoundingClientRect(),dx=r.x+r.width/2-bounds.x-hx,dy=r.y+r.height/2-bounds.y-hy;
    // Both directions pass through the same tunnel. Nose out from its sill first,
    // then bank over the reels. The reverse path ducks behind the front lip.
    const side=Math.sign(dx)||1,reach=Math.min(95,Math.hypot(dx,dy)*.29);
    const ax=side*(port.width*.4+reach*.5),ay=port.height*.65;
    const bx=dx-side*reach,by=dy-Math.min(82,r.height*(.65+.13*(i%3)));
    const x=hx+3*v*v*u*ax+3*v*u*u*bx+u*u*u*dx;
    const y=hy+3*v*v*u*ay+3*v*u*u*by+u*u*u*dy;
    const entry=ease(u/.14),arc=Math.sin(Math.PI*u);
    const size=Math.min(45,Math.max(22,r.width*.46))*(.18+.82*entry)*(.78+.22*arc);
    const direction=collect?-side:side;
    ctx.save();ctx.globalAlpha=entry;
    if(worker){
     const frame=worker.clip.frames[(Math.floor(progress*total*worker.clip.fps/1000)+i*5)%worker.clip.frames.length];
     const height=size*frame[3]/frame[2];
     ctx.translate(x,y);ctx.rotate(direction*(collect?.12:-.12)*arc);ctx.scale(direction,1);
     ctx.drawImage(worker.image,frame[0],frame[1],frame[2],frame[3],-size/2,-height/2,size,height);
    }else drawBee(ctx,drones,x,y,size,direction*.18*arc,progress*total*.052+i,arc*.6);
    ctx.restore();
   });
  },skip);
 }finally{finish();canvas.hidden=true;canvas.width=1;canvas.height=1}
}
