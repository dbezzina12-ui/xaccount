import { paintLensWater } from './lens-water.js?v=2';
import { carryReelFaces, paintGust, windFront, shaftAngle } from './fan-gust.js?v=1';
// The nozzle supplies the water and the extractor supplies the gust.
// With `carry` (stage-fan.js), the extractor starts as the wall fan behind the
// operator, keeps its angle and speed, and lifts into the gust position.
// It lifts as the main jet starts and grows at once (ease-out) toward the camera.
const LIFT = .33, ARRIVE = .51, easeOut = n => 1-Math.pow(1-clamp(n),3);
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const x=clamp(n); return x*x*(3-2*x); };

export function drawPressureTransfer(dialog, { duration, skip, mist, faces=[], getBarrel, onPilot, onHose, onImpact, carry=null }) {
  const canvas = dialog.querySelector('.pressure-transfer');
  const ctx = canvas.getContext('2d');
  const hub = dialog.querySelector('.extractor-anchor');
  const ink = getComputedStyle(dialog).getPropertyValue('--surge').trim();
  const tier=dialog.dataset.tier;
  let moving, fanRadius=0, width=0, height=0, cx=0, cy=0, far=0, elapsed=0, last=null, struck=false, pilot=false, hose=false;
  let lifted=false, liftAt=0, liftAngle=0, spin=0;
  if (carry) {
    const origin=dialog.getBoundingClientRect(), from=carry.from;
    dialog.style.setProperty('--from-x',(from.x-origin.left).toFixed(1)+'px');
    dialog.style.setProperty('--from-y',(from.y-origin.top).toFixed(1)+'px');
    dialog.style.setProperty('--from-size',from.size.toFixed(1)+'px');
    dialog.style.setProperty('--carry','0'); dialog.style.setProperty('--lifted','0');
    dialog.dataset.carry='';
  }
  function lift(seconds) {
    if (!carry || lifted) return;
    lifted=true; liftAt=seconds; liftAngle=carry.angle(); spin=carry.speed();
    dialog.style.setProperty('--lifted','1'); carry.onLift?.();
  }
  function fit() {
    width=canvas.clientWidth; height=canvas.clientHeight;
    const resolution=Math.min(devicePixelRatio||1,1.6,Math.sqrt(1400000/(width*height)));
    canvas.width=Math.max(1,Math.round(width*resolution)); canvas.height=Math.max(1,Math.round(height*resolution));
    if (ctx) ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    const b=hub.getBoundingClientRect(), origin=canvas.getBoundingClientRect();
    cx=b.left-origin.left+b.width/2; cy=b.top-origin.top+b.height/2;
    far=Math.hypot(Math.max(cx,width-cx),Math.max(cy,height-cy))+48;
    fanRadius=(dialog.querySelector('.extractor-engine')?.getBoundingClientRect().width || Math.min(width,height)*.4)*.53;
    moving?.fit(origin.left,origin.top,cx,cy,width,height);
  }
  function frame(t) {
    if (width!==canvas.clientWidth || height!==canvas.clientHeight) fit();
    const blast=smooth((t-.685)/.295), radius=far*blast;
    const front=windFront(t,far,fanRadius);
    const seconds=t*duration/1000;
    if (carry) {
      if (t>=LIFT) lift(seconds);
      dialog.style.setProperty('--carry',easeOut((t-LIFT)/(ARRIVE-LIFT)).toFixed(4));
    }
    // A carried fan keeps the wall fan's angle and speed under the surge.
    const carried=lifted ? liftAngle+spin*(seconds-liftAt) : 0;
    dialog.style.setProperty('--shaft-angle',(carried+shaftAngle(t,duration/1000,tier)).toFixed(2)+'deg');
    moving?.update(t>.56?front:0,far);
    dialog.style.setProperty('--radius',radius.toFixed(1)+'px');
    dialog.style.setProperty('--ignition',smooth((t-.39)/.15).toFixed(3));
    if (!skip() && t<1) {
      if (!pilot && t>=.114) { pilot=true;onPilot?.(); }
      if (!hose && t>=.31) { hose=true;onHose?.(); }
    }
    if (!struck && t>=.61) { struck=true;onImpact(); }
    if (!ctx) return;
    ctx.clearRect(0,0,width,height);
    ctx.lineCap='round';
    if (blast>0 && blast<1) {
      // Layer the hall reveal under a textured, expanding pressure front.
      const size=Math.max(48,Math.min(width,height)*.20);
      const fog=mist?.complete&&mist.naturalWidth>0;
      // The Super pressure front has a second compression ring; Blackout
      // leaves a slower violet afterglow as the emergency lights take over.
      const echoes=tier==='regular'?[0]:tier==='super'?[0,.14]:[.10,.28];
      for(const lag of echoes){
        const front=Math.max(0,blast-lag);
        if(!front)continue;
        ctx.globalAlpha=(1-blast)*.38;ctx.strokeStyle=ink;ctx.lineWidth=1+7*(1-blast);
        ctx.beginPath();ctx.arc(cx,cy,front*far,0,Math.PI*2);ctx.stroke();
      }
      for(let j=0;j<50;j++){
        const a=j*2.39996, wobble=Math.sin(j*8.31), r=radius+(wobble*.4-.12)*size*blast;
        const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
        const sz=size*(.72+(j%7)*.1+blast*.3);
        if(x < -sz || y < -sz || x > width+sz || y > height+sz)continue;
        ctx.globalAlpha=Math.sin(Math.PI*blast)*(.36+(j%3)*.09);
        if(fog){ctx.save();ctx.translate(x,y);ctx.rotate(a+wobble*blast);ctx.drawImage(mist,-sz/2,-sz/2,sz,sz);ctx.restore();}
        else{ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,Math.max(1,r),a,a+.045);ctx.stroke();}
      }
    }
    ctx.globalAlpha=1;
    paintLensWater(ctx,width,height,t,t<.565 ? getBarrel?.() : null,{cx,cy,front});
    paintGust(ctx,cx,cy,front,Math.min(width,height),t);
  }
  if(!duration||skip()){
    if(carry){lift(0);dialog.style.setProperty('--carry','1');}
    dialog.style.setProperty('--radius','160vmax');dialog.style.setProperty('--ignition','1');dialog.style.setProperty('--shaft-angle','0deg');onImpact();return Promise.resolve();
  }
  if(faces.length) moving=carryReelFaces(dialog.querySelector('.gust-faces'),faces);
  return new Promise(resolve=>{
    const pause=()=>{last=null;};
    document.addEventListener('visibilitychange',pause);
    function tick(now){
      if(last!==null&&!document.hidden)elapsed+=now-last;
      last=now;
      const t=skip()?1:clamp(elapsed/duration);
      frame(t);
      if(t<1)requestAnimationFrame(tick);
      else{moving?.clear();document.removeEventListener('visibilitychange',pause);dialog.style.setProperty('--radius','160vmax');resolve();}
    }
    requestAnimationFrame(tick);
  });
}
