// RoboBees' mascot, sprite fallback: the hive and the robo-bee in #mascot-stage, drawn from sprites pre-rendered from
// their 3D models (mascot.json places every frame). mascot.mjs uses it where the live 3D mascot can't run. Presentation only: it follows the game's state and never decides an outcome.
// Each animation runs on its own clock and gives way to the newest state, so turbo, Stop and skips never wait on it.
// Reduced motion holds still poses and swaps states without flying. It never draws on Math.random, the game's
// outcome stream, so a seeded session lands the same spins with or without it.
const base=new URL('./',import.meta.url);
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function sprite(name){
 const img=new Image();img.src=new URL(name+'.webp',base).href;
 return img.decode().then(()=>img);
}
const art=Promise.all([fetch(new URL('mascot.json',base)).then(r=>r.json()),
 ...['hive','hive-front','bee-hover','bee-dive','bee-burst','bee-worker'].map(sprite)]).catch(()=>null);
// The composition in sprite pixels: the hive, the perched workers and the hovering bee.
const FRAME=[50,22,512,356];
// A perched worker's size against the bee's, how long the bees take (seconds, before turbo), and how much faster
// than their rendered clips the dive and the burst play.
const WORKER=.55,ARRIVE=.7,LAND=.5,LEAVE=.55,DIVE=1.6,BURST=1.4;

export function mountMascot(stage){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const canvas=document.createElement('canvas');
 // The canvas reaches past the stage, so the bee can leave over its edges.
 canvas.style.cssText='position:absolute;left:-50%;top:-70%;width:200%;height:240%;pointer-events:none';
 stage.style.overflow='visible';stage.append(canvas);
 const ctx=canvas.getContext('2d');
 let s=null,speed=1,bee={mode:'hover',at:0},back=false,extra=0,frame=0,inView=true,dived=null,disposed=false;
 const workers=[];
 const now=()=>performance.now()/1000;
 art.then(a=>{if(a&&!disposed){s={meta:a[0],hive:a[1],front:a[2],hover:a[3],dive:a[4],burst:a[5],worker:a[6]};wake()}});

 function put(img,f,x=f[4],y=f[5],k=1){ctx.drawImage(img,f[0],f[1],f[2],f[3],x,y,f[2]*k,f[3]*k)}
 function hoverFrame(t){const fr=s.meta.clips.hover.frames;return fr[Math.floor((reduced?0:t)*s.meta.clips.hover.fps)%fr.length]}
 // The bee: which sprite frame, where, and whether it is still in the tunnel behind the hive's face.
 function beeAt(t){
  if(bee.mode==='hover')return {img:s.hover,f:hoverFrame(t)};
  if(bee.mode==='away')return null;
  const p=(t-bee.at)/bee.dur;
  if(bee.mode==='arrive'){
   if(p>=1){bee={mode:'hover',at:t};return beeAt(t)}
   // in from above and to the right, settling into the hover
   const q=ease(p),f=hoverFrame(t),k=1+(1-q)*.6,[hx,hy]=s.meta.anchors.hover;
   return {img:s.hover,f,x:hx+(f[4]-hx)*k+(1-q)*170,y:hy+(f[5]-hy)*k-(1-q)*300,k};
  }
  const clip=s.meta.clips[bee.mode],img=bee.mode==='dive'?s.dive:s.burst;
  if(p>=1){
   if(bee.mode==='dive'){const c=s.meta.clips.burst;bee={mode:'burst',at:t,dur:c.frames.length/c.fps/speed/BURST};dived?.()}
   else{bee=back?{mode:'arrive',at:t,dur:ARRIVE/speed}:{mode:'away',at:t};back=false}
   return beeAt(t);
  }
  const f=clip.frames[Math.min(clip.frames.length-1,Math.floor(p*clip.frames.length))];
  return {img,f,inside:f[6]};
 }
 function workerAt(w,t){
  const fr=s.meta.clips.worker.frames,f=fr[Math.floor(t*s.meta.clips.worker.fps+w.phase)%fr.length];
  const perch=s.meta.anchors.perches[w.slot],[px,py]=perch.at,[wx,wy]=s.meta.anchors.worker,k=perch.scale*WORKER;
  let x=px,y=py,alpha=1;
  const land=ease((t-w.at)/(LAND/speed));
  if(land<1){x+=(1-land)*260;y-=(1-land)*120+Math.sin(land*Math.PI)*40}
  if(w.gone!=null){
   const off=ease((t-w.gone)/(LEAVE/speed));
   if(off>=1)return null;
   x-=off*220;y+=off*300;alpha=1-off;
  }
  return {f,x:x+(f[4]-wx)*k,y:y+(f[5]-wy)*k,k,alpha};
 }

 function draw(){
  frame=0;
  if(!s)return;
  const t=now(),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  // Fit the composition into the stage, standing on its floor. A tall stage (beside the cabinet on desktop) lets it
  // grow a quarter wider than the stage, spilling right, away from the cabinet; otherwise it is centred.
  const sw=stage.clientWidth,sh=stage.clientHeight,k=Math.min(sw*1.25/FRAME[2],sh/FRAME[3]),cw=FRAME[2]*k;
  ctx.translate(sw*.5+Math.max(0,(sw-cw)/2)-FRAME[0]*k,sh*1.7-(FRAME[1]+FRAME[3])*k);ctx.scale(k,k);
  const b=beeAt(t);
  put(s.hive,s.meta.hive);
  if(b?.inside){put(b.img,b.f);put(s.front,s.meta['hive-front'])}
  for(let i=workers.length-1;i>=0;i--){
   const at=workerAt(workers[i],t);
   if(!at){workers.splice(i,1);continue}
   ctx.globalAlpha=at.alpha;put(s.worker,at.f,at.x,at.y,at.k);ctx.globalAlpha=1;
  }
  if(extra){
   const [x,y]=s.meta.anchors.perches[0].at;
   ctx.font='800 26px system-ui,sans-serif';ctx.textAlign='left';ctx.lineWidth=6;ctx.strokeStyle='#1b1712';ctx.fillStyle='#ffd27a';
   ctx.strokeText('+'+extra,x+30,y-6);ctx.fillText('+'+extra,x+30,y-6);
  }
  if(b&&!b.inside)put(b.img,b.f,b.x,b.y,b.k);
  if(!reduced||busy())wake();
 }
 const busy=()=>bee.mode!=='hover'&&bee.mode!=='away'||workers.some(w=>w.gone!=null||now()-w.at<LAND);
 function wake(){if(!frame&&!disposed&&inView&&!document.hidden)frame=requestAnimationFrame(draw)}
 document.addEventListener('visibilitychange',wake);
 const seen=new IntersectionObserver(([e])=>{inView=e.isIntersecting;wake()});seen.observe(stage);

 return {
  // Into a bonus: the bee dives into the hive and bursts out. Resolves as it bursts, so the swarm can follow it out;
  // at once when there is nothing to show, and never later than the dive's length, even in a hidden tab.
  depart(){
   if(reduced||!s||bee.mode!=='hover'&&bee.mode!=='arrive')return Promise.resolve();
   const c=s.meta.clips.dive,dur=c.frames.length/c.fps/speed/DIVE;
   bee={mode:'dive',at:now(),dur};back=false;wake();
   return new Promise(resolve=>{dived=()=>{dived=null;resolve()};setTimeout(()=>dived?.(),dur*1000+60)});
  },
  // The bonus has begun: the bee flies back to its hover.
  arrive(){
   if(bee.mode==='dive'||bee.mode==='burst'){back=true;return}
   if(bee.mode==='away')bee=reduced?{mode:'hover',at:now()}:{mode:'arrive',at:now(),dur:ARRIVE/speed};
   wake();
  },
  // Banked Wilds: one worker perches on the hive for each; 0 sends them all off, as the banked Wilds deploy.
  setBank(n,{animate=true}={}){
   const slots=s?s.meta.anchors.perches.length:10,want=Math.min(n,slots),t=now(),here=workers.filter(w=>w.gone==null);
   extra=Math.max(0,n-slots);
   if(want<here.length)for(const w of here.slice(want))w.gone=animate&&!reduced?t:t-LEAVE*2;
   for(let i=here.length;i<want;i++){
    const taken=new Set(workers.filter(w=>w.gone==null).map(w=>w.slot));
    let slot=0;while(taken.has(slot))slot++;
    workers.push({slot,at:animate&&!reduced?t+(i-here.length)*.12/speed:t-LAND*2,gone:null,phase:slot%4});
   }
   wake();
  },
  setTurbo(on){speed=on?1.8:1},
  dispose(){disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',wake);seen.disconnect();dived?.();canvas.remove()},
 };
}
