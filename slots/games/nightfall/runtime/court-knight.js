// Every pose, including idle, uses one scale and one foot anchor.
const poses=[
 {name:'windup',anchor:[208,518]}, {name:'lift',anchor:[199,542]},
 {name:'cut',anchor:[200,426]}, {name:'impact',anchor:[219,427]},
 {name:'followthrough',anchor:[208,408]}, {name:'recover',anchor:[171,443]}
];
export class CourtKnight{
 constructor(stage){this.stage=stage;this.canvas=stage.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.frames=[];this.raf=0;this.run=0;this.current=5;this.blinkTimer=0;this.blinkRaf=0;this.eyeClose=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.resize=new ResizeObserver(()=>{if(this.frames.length===6)this.draw(this.current);});this.resize.observe(stage);document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stopBlink();else if(!stage.classList.contains('attacking'))this.scheduleBlink();});}
 async load(){await Promise.all(poses.map(async(p,i)=>{const img=new Image();img.src=`assets/knight-frames/${p.name}.webp`;await img.decode();this.frames[i]=img;}));this.placement=new ResizeObserver(()=>this.placeOnPaving());this.placement.observe(document.getElementById('controller'));this.placement.observe(document.getElementById('board-shell'));window.addEventListener('resize',()=>this.placeOnPaving());this.placeOnPaving();this.idle();}
 placeOnPaving(){
  const phone=matchMedia('(max-width:760px) and (orientation:portrait)').matches;
  const actors=[this.stage,document.getElementById('archer-stage')].filter(Boolean);
  if(!phone){for(const actor of actors)for(const key of ['width','height','top','bottom'])actor.style.removeProperty(key);document.body.classList.remove('knight-behind-stone');return;}
  const board=document.getElementById('board-shell').getBoundingClientRect(),controls=document.getElementById('controller').getBoundingClientRect();
  const room=controls.top-board.bottom-28,cropped=room<150,height=cropped?185:Math.min(225,room/1.18);
  for(const actor of actors)Object.assign(actor.style,{height:height+'px',width:height*2/3+'px',top:(cropped?board.bottom+10:controls.top-18-height*1.18)+'px',bottom:'auto'});
  document.body.classList.toggle('knight-behind-stone',cropped);document.documentElement.style.setProperty('--stone-top',controls.top+66+'px');
 }
 idle(){this.run++;cancelAnimationFrame(this.raf);this.stopBlink();this.stage.classList.remove('attacking','saluting');this.draw(5);this.scheduleBlink();}
 stopBlink(){clearTimeout(this.blinkTimer);cancelAnimationFrame(this.blinkRaf);this.eyeClose=0;this.stage.dataset.eyes='open';if(this.frames.length===6)this.draw(this.current);}
 scheduleBlink(delay=2800+Math.random()*3200){clearTimeout(this.blinkTimer);if(this.reduced.matches||document.hidden)return;this.blinkTimer=setTimeout(()=>{if(this.stage.classList.contains('attacking')||document.getElementById('menu')?.open){this.scheduleBlink();return;}const start=performance.now();const tick=now=>{const p=Math.min(1,(now-start)/220);this.eyeClose=p<.32?p/.32:p<.5?1:(1-p)/.5;this.stage.dataset.eyes=this.eyeClose>.85?'closed':'open';this.draw(5);if(p<1)this.blinkRaf=requestAnimationFrame(tick);else{this.eyeClose=0;this.scheduleBlink(Math.random()<.16?220:2800+Math.random()*3200);}};this.blinkRaf=requestAnimationFrame(tick);},delay);}
 salute(){this.stage.classList.add('saluting');setTimeout(()=>this.stage.classList.remove('saluting'),720);}
 draw(index){this.current=index;const rect=this.stage.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio,2);this.canvas.width=Math.round(w*2.7*dpr);this.canvas.height=Math.round(h*1.35*dpr);const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingQuality='high';const p=poses[index],img=this.frames[index],scale=h*.98/448,x=w*1.1-p.anchor[0]*scale,y=h*1.35-h*.012-p.anchor[1]*scale;if(img)ctx.drawImage(img,x,y,img.naturalWidth*scale,img.naturalHeight*scale);if(index===5&&this.eyeClose>0){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);this.drawEyelids(ctx,this.eyeClose);ctx.restore();}}
 drawEyelids(ctx,amount){
  // Close just the two eyes inside the existing visor; helmet and body stay still.
  for(const eye of [{x:146,y:111,w:29,h:17},{x:187,y:111,w:23,h:17}]){
   ctx.save();ctx.beginPath();ctx.ellipse(eye.x+eye.w/2,eye.y+eye.h/2,eye.w/2,eye.h/2,0,0,Math.PI*2);ctx.clip();ctx.fillStyle='#080a0b';const lid=eye.h*.5*amount;ctx.fillRect(eye.x,eye.y,eye.w,lid);ctx.fillRect(eye.x,eye.y+eye.h-lid,eye.w,lid);
   if(amount>.8){ctx.globalAlpha=(amount-.8)*5;ctx.strokeStyle='#76818b';ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(eye.x+3,eye.y+eye.h/2);ctx.quadraticCurveTo(eye.x+eye.w/2,eye.y+eye.h/2+2,eye.x+eye.w-3,eye.y+eye.h/2);ctx.stroke();}ctx.restore();
  }
 }
 strike({turbo=false}={}){
  this.idle();this.stopBlink();if(this.reduced.matches)return Promise.resolve();
  const id=++this.run,duration=turbo?500:1000,stops=[.14,.32,.46,.6,.79,1];this.stage.classList.add('attacking');
  return new Promise(resolve=>{let elapsed=0,last=performance.now(),impact=false,prev=-1;
   const tick=now=>{if(id!==this.run){if(!impact)resolve();return;}const paused=document.hidden||document.getElementById('menu').open;if(!paused)elapsed+=now-last;last=now;const p=elapsed/duration,index=stops.findIndex(end=>p<end);if(index<0){this.stage.classList.remove('attacking');this.draw(5);this.scheduleBlink();if(!impact)resolve();return;}if(index!==prev){this.draw(index);prev=index;}if(p>=.32&&!impact){impact=true;resolve();}this.raf=requestAnimationFrame(tick);};this.draw(0);this.raf=requestAnimationFrame(tick);
  });
 }
}
