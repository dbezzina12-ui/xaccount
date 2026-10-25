// Layered artwork only. The imported engine owns all outcomes.
const ROOT='assets/nightfall/';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export const RIGS={
 reaper:{size:[320,430],parts:{cape:[36,151,205,245],body:[66,149,212,267],head:[55,48,193,177],upperLeft:[64,172,62,106],foreLeft:[69,257,58,98],upperRight:[225,170,60,100],foreRight:[244,246,58,98],scythe:[103,5,185,390]}},
 archer:{size:[320,430],parts:{body:[87,147,174,264],head:[65,36,190,194],bowArm:[41,183,90,137],drawArm:[146,210,128,99],bow:[4,155,156,221]}}
};
const FILES={reaper:{cape:'cape',body:'body',head:'head',upperLeft:'upper-left',foreLeft:'fore-left',upperRight:'upper-right',foreRight:'fore-right',scythe:'scythe'},archer:{body:'body',head:'head',bowArm:'bow-arm',drawArm:'draw-arm',bow:'bow'}};
const markup=(kind)=>Object.entries(RIGS[kind].parts).map(([name,[x,y,w,h]])=>`<img class="rig-part part-${name}" data-part="${name}" src="${ROOT}${kind}/${FILES[kind][name]}.webp" style="left:${x/3.2}%;top:${y/4.3}%;width:${w/3.2}%;height:${h/4.3}%" alt="" draggable="false">`).join('');
class Actor {
 constructor(stage,kind){this.stage=stage;this.kind=kind;this.run=0;this.pending=null;this.raf=0;this.blinkTimer=0;this.animations=[];this.stage.querySelector('canvas')?.remove();this.rig=document.createElement('div');this.rig.className='character-rig '+kind;this.rig.innerHTML=markup(kind);this.stage.append(this.rig);this.parts=Object.fromEntries([...this.rig.querySelectorAll('[data-part]')].map(e=>[e.dataset.part,e]));this.onVisibility=()=>{if(document.hidden)this.stopBlink();else this.scheduleBlink();};document.addEventListener('visibilitychange',this.onVisibility);this.resize=new ResizeObserver(()=>this.place());this.resize.observe(document.getElementById('board-shell'));this.resize.observe(document.getElementById('controller'));window.addEventListener('resize',()=>this.place());}
 async load(){const blink=new Image();blink.src=ROOT+this.kind+'/blink.webp';this.blink=blink;await Promise.all([...this.rig.querySelectorAll('img'),blink].map(i=>i.decode()));this.place();this.idle();}
 place(){
  const b=document.getElementById('board-shell').getBoundingClientRect(),c=document.getElementById('controller').getBoundingClientRect();
  const mobile=innerWidth<=760&&innerHeight>innerWidth;
  const extra=Number(document.documentElement.style.getPropertyValue('--actor-scale'))||1;
  let h,w,x,y;
  if(mobile){
   // Match the approved foreground silhouettes, with feet behind the upper controls.
   // Arm animation remains a separate Claude task; scene fitting must not shrink the cast.
   const feet=c.top+Math.min(96,c.height*.64);
   h=Math.min(innerWidth*.74,innerHeight*.34)*extra;
   h=Math.min(h,Math.max(100,feet-b.bottom+24));
   w=h*320/430;y=feet-h;
   x=this.kind==='reaper'?-w*.14:innerWidth-w*.88;
  }else{
   h=Math.min(490,innerHeight*.64)*extra;w=h*320/430;
   x=this.kind==='reaper'?Math.max(-w*.08,b.left-w+18):Math.min(innerWidth-w*.92,b.right-18);
   y=c.top-h+12;
  }
  Object.assign(this.stage.style,{width:w+'px',height:h+'px',left:x+'px',right:'auto',top:y+'px',bottom:'auto',transform:'none'});
 }
 stopBlink(){clearTimeout(this.blinkTimer);this.parts.head.src=ROOT+this.kind+'/head.webp';}
 scheduleBlink(){clearTimeout(this.blinkTimer);if(document.hidden||reduced())return;this.blinkTimer=setTimeout(()=>{if(this.pending||document.getElementById('menu')?.open){this.scheduleBlink();return;}this.parts.head.src=this.blink.src;this.blinkTimer=setTimeout(()=>{this.parts.head.src=ROOT+this.kind+'/head.webp';this.scheduleBlink();},130);},3400+Math.random()*2200);}
 idle(){this.run++;cancelAnimationFrame(this.raf);this.pending?.();this.pending=null;for(const a of this.animations)a.cancel();this.animations=[];for(const el of Object.values(this.parts))el.style.transform='';this.stage.classList.remove('attacking','shooting');this.scheduleBlink();}
 salute(){if(!reduced())this.parts.head.animate([{transform:'rotate(0)'},{transform:'rotate(-7deg)'},{transform:'rotate(0)'}],{duration:620,easing:'ease-in-out'});}
 action({duration=900,paused=()=>document.hidden||document.getElementById('menu')?.open,skip=()=>false,paint,release=.55}){this.idle();this.stopBlink();if(reduced()||skip()){paint(0);this.scheduleBlink();return Promise.resolve(this.releasePoint?.());}const id=++this.run;let resolved=false;return new Promise(resolve=>{this.pending=()=>{if(!resolved){resolved=true;resolve(this.releasePoint?.());}};let elapsed=0,last=performance.now();const tick=now=>{if(id!==this.run)return;if(!paused())elapsed+=Math.min(50,now-last);last=now;if(skip())elapsed=duration;const p=Math.min(1,elapsed/duration);paint(p);if(p>=release&&!resolved){resolved=true;resolve(this.releasePoint?.());}if(p<1)this.raf=requestAnimationFrame(tick);else{this.pending=null;paint(0);this.stage.classList.remove('attacking','shooting');this.scheduleBlink();}};this.raf=requestAnimationFrame(tick);});}
}
export class CourtKnight extends Actor {
 constructor(stage){super(stage,'reaper');}
 strike({turbo=false}={}){this.stage.classList.add('attacking');return this.action({duration:turbo?520:1050,release:.48,skip:()=>globalThis.NightFall?.state.skip,paint:p=>{const wind=p<.38?Math.sin(p/.38*Math.PI/2):p<.58?1-(p-.38)/.2*1.9:-.9*(1-(p-.58)/.42);const a=wind*32;this.parts.scythe.style.transform=`rotate(${a}deg)`;this.parts.upperRight.style.transform=`rotate(${a*.5}deg)`;this.parts.foreRight.style.transform=`rotate(${a*.7}deg)`;this.parts.upperLeft.style.transform=`rotate(${-a*.18}deg)`;this.parts.head.style.transform=`rotate(${-a*.08}deg)`;this.parts.cape.style.transform=`rotate(${-a*.12}deg)`;}});}
}
export class CourtArcher extends Actor {
 constructor(stage){super(stage,'archer');}
 releasePoint(){const b=this.parts.bow.getBoundingClientRect();return{x:b.left+b.width*.54,y:b.top+b.height*.53};}
 shoot({target,turbo=false,paused,skip}={}){const b=this.releasePoint(),angle=target?Math.max(-20,Math.min(20,Math.atan2(b.y-target.y,b.x-target.x)*180/Math.PI)):0;return this.action({duration:turbo?480:960,paused,skip,release:.57,paint:p=>{const pull=p<.55?p/.55:Math.max(0,1-(p-.55)/.45);this.parts.drawArm.style.transform=`translateX(${pull*12}%) rotate(${-pull*12}deg)`;this.parts.bow.style.transform=`rotate(${angle*pull}deg) scaleX(${1-pull*.06})`;this.parts.bowArm.style.transform=`rotate(${angle*pull*.6}deg)`;this.parts.head.style.transform=`rotate(${angle*pull*.15}deg)`;}});}
}
