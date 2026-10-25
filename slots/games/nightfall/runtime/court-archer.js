export class CourtArcher {
 constructor(stage) {
  this.stage=stage;this.canvas=stage.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.frames=[];this.meta=[];this.current=0;this.raf=0;this.run=0;this.lean=0;this.angle=0;this.eyeClose=0;this.blinkTimer=0;this.blinkRaf=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
  this.resize=new ResizeObserver(()=>{if(this.frames.length===12)this.draw(this.current);});this.resize.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stopBlink();else if(!stage.classList.contains('shooting'))this.scheduleBlink();});
 }
 async load() {
  this.meta=await (await fetch('assets/archer-frames/frames.json')).json();
  await Promise.all(this.meta.map(async(p,i)=>{const img=new Image();img.src='assets/archer-frames/'+p.file;await img.decode();this.frames[i]=img;}));this.idle();
 }
 idle(){this.run++;cancelAnimationFrame(this.raf);this.stopBlink();this.stage.classList.remove('shooting');this.lean=0;this.angle=0;this.draw(0);this.scheduleBlink();}
 stopBlink(){clearTimeout(this.blinkTimer);cancelAnimationFrame(this.blinkRaf);this.eyeClose=0;this.stage.dataset.eyes='open';if(this.frames.length===12)this.draw(this.current);}
 scheduleBlink(){
  clearTimeout(this.blinkTimer);if(this.reduced.matches||document.hidden)return;
  this.blinkTimer=setTimeout(()=>{
   if(this.stage.classList.contains('shooting')||document.getElementById('menu')?.open){this.scheduleBlink();return;}
   const start=performance.now();const tick=now=>{const p=Math.min(1,(now-start)/210);this.eyeClose=p<.35?p/.35:p<.52?1:(1-p)/.48;this.stage.dataset.eyes=this.eyeClose>.85?'closed':'open';this.draw(0);if(p<1)this.blinkRaf=requestAnimationFrame(tick);else{this.eyeClose=0;this.scheduleBlink();}};this.blinkRaf=requestAnimationFrame(tick);
  },2400+Math.random()*3700);
 }
 draw(index){
  this.current=index;const rect=this.stage.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio,2),p=this.meta[index],img=this.frames[index];if(!p||!img)return;
  const cw=Math.round(w*2.7*dpr),ch=Math.round(h*1.35*dpr);
  if(this.canvas.width!==cw||this.canvas.height!==ch){this.canvas.width=cw;this.canvas.height=ch;}
  this.ctx.setTransform(dpr,0,0,dpr,0,0);this.ctx.clearRect(0,0,cw/dpr,ch/dpr);this.ctx.imageSmoothingQuality='high';
  const scale=h*.98/353;this.ctx.translate(w*1.1+this.lean,h*1.35-h*.012);this.ctx.rotate(this.angle);this.ctx.drawImage(img,-p.anchor[0]*scale,-p.anchor[1]*scale,img.naturalWidth*scale,img.naturalHeight*scale);
  if(index===0&&this.eyeClose>0){this.ctx.save();this.ctx.translate(-p.anchor[0]*scale,-p.anchor[1]*scale);this.ctx.scale(scale,scale);for(const eye of [{x:89,y:110,w:14,h:11},{x:116,y:108,w:24,h:14}]){this.ctx.save();this.ctx.beginPath();this.ctx.ellipse(eye.x+eye.w/2,eye.y+eye.h/2,eye.w/2,eye.h/2,0,0,Math.PI*2);this.ctx.clip();this.ctx.fillStyle='#07090c';const lid=eye.h*.5*this.eyeClose;this.ctx.fillRect(eye.x,eye.y,eye.w,lid);this.ctx.fillRect(eye.x,eye.y+eye.h-lid,eye.w,lid);this.ctx.restore();}this.ctx.restore();}
  this.stage.querySelector('.knight-shadow').style.translate=`${this.lean}px 0`;
 }
 releasePoint(){
  const r=this.stage.getBoundingClientRect(),p=this.meta[8],scale=r.height*.98/353,mirror=matchMedia('(max-width:760px) and (orientation:portrait)').matches?-1:1;
  const x=(32-p.anchor[0])*scale,y=(151-p.anchor[1])*scale,c=Math.cos(this.angle),s=Math.sin(this.angle);
  return {x:r.left+r.width*.5+(this.lean+x*c-y*s)*mirror,y:r.bottom-r.height*.012+x*s+y*c};
 }
 shoot({target,turbo=false,paused=()=>document.hidden,skip=()=>false}={}) {
  this.idle();this.stopBlink();if(this.reduced.matches||skip()){this.scheduleBlink();return Promise.resolve(this.releasePoint());}
  const start=this.releasePoint(),height=this.stage.getBoundingClientRect().height;
  // Pivot into the actual shot direction; keep the foot anchor and pose scale fixed.
  const pitch=target?Math.atan2(target.y-start.y,Math.abs(target.x-start.x)):0,aimAngle=Math.max(-.16,Math.min(.16,-pitch*.32));
  const id=++this.run,durations=[70,70,70,60,65,70,100,90,80,110,120,140],speed=turbo?.5:1,total=durations.reduce((a,b)=>a+b,0)*speed;
  const stops=[];durations.reduce((sum,ms)=>{stops.push(sum+ms*speed);return sum+ms*speed;},0);this.stage.classList.add('shooting');
  const smooth=p=>{const t=Math.max(0,Math.min(1,p));return t*t*(3-2*t);},releaseAt=stops[7];
  return new Promise(resolve=>{let elapsed=0,last=performance.now(),released=false;
   const tick=now=>{
    if(id!==this.run){if(!released)resolve(this.releasePoint());return;}
    if(!paused())elapsed+=Math.min(60,now-last);last=now;if(skip())elapsed=total;
    const index=stops.findIndex(end=>elapsed<end);
    if(index<0){this.stage.classList.remove('shooting');this.lean=0;this.angle=0;this.draw(0);this.scheduleBlink();if(!released)resolve(this.releasePoint());return;}
    const prepare=smooth(elapsed/(releaseAt*.72)),recover=elapsed<releaseAt?1:1-smooth((elapsed-releaseAt)/(total-releaseAt));
    const kick=elapsed<releaseAt?0:Math.sin(Math.min(1,(elapsed-releaseAt)/(160*speed))*Math.PI)*recover;
    this.lean=height*(-.035*prepare*recover+.018*kick);this.angle=aimAngle*prepare*recover-.025*kick;this.draw(index);
    if(index>=8&&!released){released=true;resolve(this.releasePoint());}
    this.raf=requestAnimationFrame(tick);
   };this.raf=requestAnimationFrame(tick);
  });
 }
}
