// Night Fall's reaper and skeleton archer: ChatGPT's approved cutouts on a
// jointed rig (Claude, animation). Presentation only: the engine settles every
// outcome before these play, and they only read the events they are given.
//
// Every part hangs from a bone that turns about its joint and carries its
// children, so a forearm stays on its elbow, the scythe in its fist, the bow
// in the bow hand and the fingers on the string through every pose. Joints are
// measured from the art by tools/nightfall-rig.py (assets/nightfall/rig.json).
// The body, with the legs and boots, never moves: the feet stay planted on the
// ground line place() measures, and breathing scales the upper body about the
// soles. Parts stay flat siblings in a fixed draw order; each gets the matrix
// of its bone, times its rest placement: the art's own turn or move inside the
// bone (rig.json `rest`), which seats each forearm's socket cap inside its
// sleeve and each shoulder ball on the body's socket. ChatGPT's boxes stacked
// the arm pieces end to end, so the caps showed and the archer's shoulders
// floated beside the body.
const ROOT='assets/nightfall/';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const SIZE=[320,430];

// Placement boxes [x, y, w, h] in rig space (from ChatGPT's atlas extraction)
// and draw order. `bone` is the bone the part hangs from; `rest` names the
// rest placement it shares (default: its own). The reaper's hems are the
// sleeves again, less what the body covers, drawn over the forearms so each
// comes out of its sleeve; the shaft runs over the sleeve and under the fist,
// as in the layout target.
export const RIGS={
 reaper:{size:SIZE,parts:{
  cape:{file:'cape',box:[36,151,205,245],bone:'cape',z:0},
  upperLeft:{file:'upper-left',box:[64,172,62,106],bone:'upperLeft',z:1},
  upperRight:{file:'upper-right',box:[225,170,60,100],bone:'upperRight',z:1},
  body:{file:'body',box:[66,149,212,267],bone:'chest',z:2},
  foreRight:{file:'fore-right',box:[244,246,58,98],bone:'foreRight',z:3},
  hemRight:{file:'upper-right-hem',box:[225,170,60,100],bone:'upperRight',rest:'upperRight',z:4},
  scythe:{file:'scythe',box:[103,5,185,390],bone:'scythe',z:5},
  head:{file:'head',box:[55,48,193,177],bone:'head',z:6},
  foreLeft:{file:'fore-left',box:[69,257,58,98],bone:'foreLeft',z:7},
  hemLeft:{file:'upper-left-hem',box:[64,172,62,106],bone:'upperLeft',rest:'upperLeft',z:8},
  fistRight:{file:'fore-right-fist',box:[244,246,58,98],bone:'foreRight',rest:'foreRight',z:9}
 }},
 archer:{size:SIZE,parts:{
  body:{file:'body',box:[87,147,174,264],bone:'chest',z:2},
  bow:{file:'bow-bare',box:[4,155,156,221],bone:'bow',z:3},
  bowArm:{file:'bow-arm',box:[41,183,90,137],bone:'bowArm',z:4},
  arrow:{file:'arrow',box:[4,155,156,221],bone:'arrow',z:5},
  head:{file:'head',box:[65,36,190,194],bone:'head',z:6},
  drawUpper:{file:'draw-upper',box:[146,210,128,99],bone:'drawUpper',z:7},
  drawFore:{file:'draw-fore',box:[146,210,128,99],bone:'drawFore',z:8}
 }}
};

// 2D affine [a,b,c,d,e,f]: x' = a x + c y + e, y' = b x + d y + f.
const I=[1,0,0,1,0,0];
const mul=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
const rotAbout=(deg,[x,y])=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y];};
const move=([x,y])=>[1,0,0,1,x,y];
const apply=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
// A part's rest placement (rig.json), identity if it has none.
export const restOf=(J,kind,name,spec=RIGS[kind])=>J.rest?.[spec.parts[name]?.rest||name]||I;

// Reaper v2 candidate (`?reaper=v2`): ChatGPT's registered bone arm under
// Dylan's shoulder mantle, made by tools/nightfall-reaper-v2.py into
// assets/nightfall/reaper-v2/ (boxes and joints in its rig.json; rig space
// 400 x 430). Back to front: the robe body; the upper arm, forearm and hand
// with the scythe, under the mantle; the mantle, pinned at the chest clasp,
// over the shoulder and elbow; the fist and scythe again without the wrist
// stub, in front of the mantle, robe and boots; and the hood again, faded in
// while the blade swings behind the head. `fade` names the pose key that
// sets a part's opacity.
export const REAPER_V2={size:[400,430],dir:'reaper-v2',blink:false,parts:{
 body:{file:'body',bone:'chest',z:0},
 armUpper:{file:'arm-upper',bone:'upper',z:1},
 armFore:{file:'arm-fore',bone:'fore',z:2},
 hand:{file:'hand',bone:'hand',z:3},
 mantle:{file:'mantle',bone:'chest',z:4},
 handFront:{file:'hand-front',bone:'hand',z:5},
 head:{file:'head',bone:'chest',z:6,fade:'headOver'}
}};
const ang=([x,y])=>Math.atan2(y,x)*180/Math.PI;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],len=v=>Math.hypot(v[0],v[1]),scale=(v,k)=>[v[0]*k,v[1]*k];
const ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const span=(p,a,b)=>clamp((p-a)/(b-a));
// Breathing: the upper body rises about the soles; the boots stay put.
const breathe=(sole,amount)=>[1,0,0,1+amount,0,-sole*amount];

// Two-bone IK: the angles that put the end of shoulder->elbow->end on
// `target`, as rotations from the rest pose, keeping the rest pose's bend.
export function solveArm(shoulder,elbow,end,target){
 const l1=len(sub(elbow,shoulder)),l2=len(sub(end,elbow)),to=sub(target,shoulder);
 const d=clamp(len(to),Math.abs(l1-l2)+.01,l1+l2-.01);
 const bend=Math.sign((elbow[0]-shoulder[0])*(end[1]-shoulder[1])-(elbow[1]-shoulder[1])*(end[0]-shoulder[0]))||1;
 const a=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1))*180/Math.PI;
 const upperAbs=ang(to)-bend*a;
 const e2=add(shoulder,scale([Math.cos(upperAbs*Math.PI/180),Math.sin(upperAbs*Math.PI/180)],l1));
 const upper=upperAbs-ang(sub(elbow,shoulder));
 const fore=ang(sub(add(shoulder,scale(to,d/len(to)||1)),e2))-ang(sub(end,elbow))-upper;
 return {upper,fore,elbow:e2};
}

// Bone world matrices (rig space) for a pose. Each bone: [parent, local matrix].
function reaperBones(J,pose){
 const b={};
 b.chest=breathe(J.sole,pose.breath||0);
 b.cape=mul(b.chest,rotAbout(pose.cape||0,J.shoulders));
 b.head=mul(b.chest,rotAbout(pose.head||0,J.neck));
 b.upperLeft=mul(b.chest,rotAbout(pose.upperLeft||0,J.shoulderLeft));
 b.foreLeft=mul(b.upperLeft,rotAbout(pose.foreLeft||0,J.elbowLeft));
 b.upperRight=mul(b.chest,rotAbout(pose.upperRight||0,J.shoulderRight));
 b.foreRight=mul(b.upperRight,rotAbout(pose.foreRight||0,J.elbowRight));
 b.scythe=mul(b.foreRight,rotAbout(pose.scythe||0,J.grip));
 return b;
}
function reaperV2Bones(J,pose){
 const b={};
 b.chest=breathe(J.sole,pose.breath||0);
 b.upper=mul(b.chest,rotAbout(pose.shoulder||0,J.shoulder));
 b.fore=mul(b.upper,rotAbout(pose.elbow||0,J.elbow));
 b.hand=mul(b.fore,rotAbout(pose.wrist||0,J.wrist));
 return b;
}
function archerBones(J,pose){
 const b={};
 b.chest=breathe(J.sole,pose.breath||0);
 b.head=mul(b.chest,rotAbout(pose.head||0,J.neck));
 const aim=mul(b.chest,rotAbout(pose.aim||0,J.bowShoulder));
 // The bow hand's rest grip: the arm rises about its shoulder and the bow sits
 // in the hand, the arrow's rest on the grip in the palm.
 b.bowArm=mul(aim,rotAbout(J.armLift+(pose.bowArm||0),J.bowShoulder));
 b.bow=mul(aim,move(J.bowShift));
 // Where the nock rests on the string, in the bow's frame, drawn back along the arrow.
 const nock=apply(b.bow,J.nock),grip=apply(b.bow,J.grip),back=scale(sub(nock,grip),1/len(sub(nock,grip)));
 const target=add(nock,scale(back,pose.pull||0));
 // The fingers hold the nock: solve the draw arm for it (in the chest's frame).
 const inv=invert(b.chest),local=apply(inv,pose.hand||target);
 const ik=solveArm(J.drawShoulder,J.drawElbow,J.fingers,local);
 b.drawUpper=mul(b.chest,rotAbout(ik.upper,J.drawShoulder));
 b.drawFore=mul(b.drawUpper,rotAbout(ik.fore,J.drawElbow));
 const pinch=apply(b.drawFore,J.fingers);
 // The arrow: nock in the fingers, shaft resting on the grip.
 const turn=ang(sub(grip,pinch))-ang(sub(J.grip,J.nock));
 b.arrow=mul(move(sub(pinch,J.nock)),rotAbout(turn,J.nock));
 return {bones:b,pinch,target,grip,tips:[apply(b.bow,J.tipTop),apply(b.bow,J.tipBottom)],tip:apply(b.arrow,J.arrowTip)};
}
function invert(m){const det=m[0]*m[3]-m[1]*m[2];return [m[3]/det,-m[1]/det,-m[2]/det,m[0]/det,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det];}

// Keyframes: [time 0..1, values], eased between.
function sample(track,p){
 let i=0;while(i<track.length-1&&p>track[i+1][0])i++;
 const [t0,a]=track[i],[t1,b]=track[Math.min(i+1,track.length-1)];
 const k=t1>t0?ease(clamp((p-t0)/(t1-t0))):1,out={};
 for(const key of new Set([...Object.keys(a),...Object.keys(b)]))out[key]=(a[key]||0)+((b[key]||0)-(a[key]||0))*k;
 return out;
}
// The scythe slash, toward the board on the reaper's right (screen right).
// Bone angles add down the arm, so each key is set by where the blade points
// (shoulder + elbow + wrist, clockwise from upright): wind up to -45 (blade
// back over the head, hand out at chest height), slash through to +60 by the
// release (.48), follow through to +84, then settle back into the rest grip.
export const STRIKE=[
 [0,{}],
 [.2,{upperRight:-14,foreRight:-26,scythe:10,upperLeft:4,foreLeft:3,head:-3,cape:-1.5}],
 [.38,{upperRight:-24,foreRight:-46,scythe:25,upperLeft:7,foreLeft:5,head:-5,cape:-2.5}],
 [.48,{upperRight:6,foreRight:8,scythe:46,upperLeft:-3,foreLeft:-5,head:4,cape:2.5}],
 [.58,{upperRight:12,foreRight:16,scythe:56,upperLeft:-5,foreLeft:-7,head:6,cape:3}],
 [.74,{upperRight:6,foreRight:8,scythe:26,upperLeft:-2,foreLeft:-3,head:2,cape:1}],
 [1,{}]
];

class Actor {
 constructor(stage,kind,spec=RIGS[kind]){
  this.stage=stage;this.kind=kind;this.run=0;this.pending=null;this.raf=0;this.idleRaf=0;this.blinkTimer=0;this.joints=null;this.pose={};this.nod=null;
  this.spec=spec;this.size=spec.size||SIZE;this.dir=spec.dir||kind;this.blinks=spec.blink!==false;this.parts={};
  this.stage.querySelector('canvas')?.remove();
  this.rig=document.createElement('div');this.rig.className='character-rig '+kind;
  this.stage.append(this.rig);
  if(Object.values(spec.parts).every(p=>p.box))this.build();
  this.onVisibility=()=>{if(document.hidden){this.stopBlink();this.stopIdle();}else{this.scheduleBlink();this.startIdle();}};
  document.addEventListener('visibilitychange',this.onVisibility);
  this.resize=new ResizeObserver(()=>this.place());
  for(const id of ['board-shell','controller'])if(document.getElementById(id))this.resize.observe(document.getElementById(id));
  window.addEventListener('resize',()=>this.place());
 }
 // The part images, placed by their boxes (rig units) as % of the rig.
 build(){
  const [W,H]=this.size;
  this.rig.innerHTML=`<span class="rig-shadow"></span>`+Object.entries(this.spec.parts).map(([name,{file,box:[x,y,w,h],z}])=>`<img class="rig-part part-${name}" data-part="${name}" src="${ROOT}${this.dir}/${file}.webp" style="left:${x/W*100}%;top:${y/H*100}%;width:${w/W*100}%;height:${h/H*100}%;z-index:${z}" alt="" draggable="false">`).join('');
  this.parts=Object.fromEntries([...this.rig.querySelectorAll('[data-part]')].map(e=>[e.dataset.part,e]));
 }
 async loadJoints(){return (await fetch(ROOT+'rig.json').then(r=>r.json()))[this.kind];}
 async load(){
  const joints=await this.loadJoints();
  let blink=null;if(this.blinks){blink=new Image();blink.src=ROOT+this.dir+'/blink.webp';this.blink=blink;}
  await Promise.all([...this.rig.querySelectorAll('img'),...(blink?[blink]:[])].map(i=>i.decode()));
  this.joints=joints;
  this.shadow();this.place();this.idle();
 }
 // The contact shadow under the boots, on the sole line (rig space).
 shadow(){const J=this.joints,[W,H]=this.size,[cx,w]=J.feet||(this.kind==='reaper'?[180,196]:[176,168]);Object.assign(this.rig.querySelector('.rig-shadow').style,{left:(cx-w/2)/W*100+'%',width:w/W*100+'%',top:(J.sole-8)/H*100+'%',height:16/H*100+'%'});}
 // Stand both characters on one ground line. Phones: the soles sit on the
 // bottom of the controller's first row (Buy Bonus, - and +), on the stone path
 // and clear of the icon row under it, as in the layout target. Desktop: on the
 // floor just above the controller bar.
 place(){
  if(!this.joints)return;
  const board=document.getElementById('board-shell').getBoundingClientRect(),c=document.getElementById('controller').getBoundingClientRect();
  const mobile=innerWidth<=760&&innerHeight>innerWidth,extra=Number(document.documentElement.style.getPropertyValue('--actor-scale'))||1;
  const [W,H]=this.size,soleFrac=this.joints.sole/H,centre=this.joints.centre??(this.kind==='reaper'?.5375:.544);
  // How far right the art reaches (desktop: the reaper's reach ends 18 px into the board).
  const reach=this.joints.right?this.joints.right/W+.06:1;
  let h,ground,x;
  if(mobile){
   // The shared controller lives in an open shadow root.
   const ctl=document.getElementById('controller'),buy=(ctl.shadowRoot||ctl).querySelector('[aria-label="Buy bonus"]')?.getBoundingClientRect();
   ground=buy?.height?buy.bottom:c.top+Math.min(64,c.height*.45);
   // Both share the reaper's scale (the taller, with the scythe), sized to the
   // room between the board and the ground; the blade may cross the frame a little.
   const room=ground-(board.bottom-14);
   h=clamp(room/((414-5)/SIZE[1]),120,Math.min(innerWidth*.74,330))*extra;
   const w=h*W/H;
   x=(this.kind==='reaper'?.175:.83)*innerWidth-w*centre;
  }else{
   ground=c.top-6;
   h=Math.min(490,innerHeight*.64)*extra;const w=h*W/H;
   x=this.kind==='reaper'?Math.max(-w*.08,board.left-w*reach+18):Math.min(innerWidth-w*.92,board.right-18);
  }
  const w=h*W/H,y=ground-h*soleFrac;
  this.ground=ground;
  Object.assign(this.stage.style,{width:w+'px',height:h+'px',left:x+'px',right:'auto',top:y+'px',bottom:'auto',transform:'none'});
 }
 // Draws a pose: every part gets its bone's matrix, converted from rig units to
 // the part's own pixels (transform-origin 0 0).
 draw(pose=this.pose){
  if(!this.joints)return;
  const s=this.rig.clientWidth/this.size[0]||1,frame=this.bones(pose);
  for(const [name,el] of Object.entries(this.parts)){
   const spec=this.spec.parts[name],m=mul(frame.bones[spec.bone]||I,restOf(this.joints,this.kind,name,this.spec)),[bx,by]=spec.box;
   if(spec.fade)el.style.opacity=clamp(pose[spec.fade]||0).toFixed(3);
   // Element px: p_css = s*B + L*q + t, with t = s*((L - I) B + T).
   const e=s*((m[0]-1)*bx+m[2]*by+m[4]),f=s*(m[1]*bx+(m[3]-1)*by+m[5]);
   el.style.transform=`matrix(${m[0].toFixed(5)},${m[1].toFixed(5)},${m[2].toFixed(5)},${m[3].toFixed(5)},${e.toFixed(2)},${f.toFixed(2)})`;
  }
  this.paintExtras?.(frame,pose);
  this.frame=frame;
 }
 stopBlink(){clearTimeout(this.blinkTimer);if(this.blinks&&this.parts.head)this.parts.head.src=ROOT+this.dir+'/head.webp';}
 scheduleBlink(){clearTimeout(this.blinkTimer);if(!this.blinks||document.hidden||reduced())return;this.blinkTimer=setTimeout(()=>{if(this.pending||document.getElementById('menu')?.open){this.scheduleBlink();return;}this.parts.head.src=this.blink.src;this.blinkTimer=setTimeout(()=>{this.parts.head.src=ROOT+this.dir+'/head.webp';this.scheduleBlink();},130);},3400+Math.random()*2200);}
 // A slow idle cycle: breathing, and a little sway carried down each arm.
 // At most 30 paints a second; none while hidden, under reduced motion, during
 // an action, or with the menu open.
 idlePose(t){return {breath:.0065*Math.sin(t*Math.PI*2/4.2)};}
 startIdle(){
  if(this.idleRaf||document.hidden||reduced()||!this.joints)return;
  let last=0;const start=performance.now();
  const tick=now=>{this.idleRaf=requestAnimationFrame(tick);if(this.pending||document.getElementById('menu')?.open||now-last<33)return;last=now;
   const t=(now-start)/1000,pose=this.idlePose(t);
   if(this.nod){const k=clamp((now-this.nod)/620);pose.head=(pose.head||0)-7*Math.sin(Math.PI*k);if(k>=1)this.nod=null;}
   this.pose=pose;this.draw(pose);};
  this.idleRaf=requestAnimationFrame(tick);
 }
 stopIdle(){cancelAnimationFrame(this.idleRaf);this.idleRaf=0;}
 idle(){this.run++;cancelAnimationFrame(this.raf);this.pending?.();this.pending=null;this.pose={};this.draw({});this.stage.classList.remove('attacking','shooting');this.scheduleBlink();this.startIdle();}
 salute(){if(!reduced())this.nod=performance.now();}
 // Runs `pose(p)` over `duration` ms; resolves at `release` (or on Skip,
 // reduced motion, or a new idle()), and ends in the rest pose.
 action({duration=900,paused=()=>document.hidden||document.getElementById('menu')?.open,skip=()=>false,pose,release=.55,onRelease}){
  this.idle();this.stopBlink();
  if(reduced()||skip()){this.draw({});this.scheduleBlink();return Promise.resolve(this.releasePoint?.());}
  const id=++this.run;let resolved=false;
  return new Promise(resolve=>{
   const done=()=>{if(!resolved){resolved=true;const at=this.releasePoint?.();onRelease?.();resolve(at);}};
   this.pending=done;
   let elapsed=0,last=performance.now();
   const tick=now=>{if(id!==this.run)return;if(!paused())elapsed+=Math.min(50,now-last);last=now;
    if(skip())elapsed=duration;const p=Math.min(1,elapsed/duration);
    // The release frame: the last pose before it, so the release point (the
    // arrow's head) and anything held at release are read at full draw.
    if(p>=release&&!resolved){this.pose=pose(release-1e-4);this.draw(this.pose);done();}
    this.pose=pose(p);this.draw(this.pose);
    if(p<1)this.raf=requestAnimationFrame(tick);else{this.pending=null;this.pose={};this.draw({});this.stage.classList.remove('attacking','shooting');this.scheduleBlink();}};
   this.raf=requestAnimationFrame(tick);
  });
 }
}

// The v2 strike, toward the board on the reaper's right. Keys are the
// shoulder, elbow and wrist turns (degrees, clockwise); the scythe turns by
// their sum. Wind up with the blade back behind the hood (-56 at .38, the
// fist raised beside the hood, the hood drawn over the blade), bring it over
// the top, then chop down toward the board: +66 at the release (.48), +94 in
// the follow-through, and settle back. The hood layer fades out (.43 to .45)
// while the blade is above the head, clear of it. The elbow and shoulder
// stay under the mantle throughout (tests/browser/nightfall-reaper-v2.e2e.mjs).
export const STRIKE_V2=[
 [0,{}],
 [.08,{shoulder:-2,elbow:3,wrist:-6,headOver:1}],
 [.2,{shoulder:-8,elbow:10,wrist:-24,headOver:1}],
 [.38,{shoulder:-20,elbow:24,wrist:-60,headOver:1}],
 [.43,{shoulder:-4,elbow:8,wrist:-4,headOver:1}],
 [.45,{shoulder:0,elbow:14,wrist:12}],
 [.48,{shoulder:6,elbow:25,wrist:35}],
 [.58,{shoulder:10,elbow:38,wrist:46}],
 [.74,{shoulder:4,elbow:14,wrist:16}],
 [1,{}]
];

export class CourtKnight extends Actor {
 constructor(stage){
  const v2=new URLSearchParams(location.search).get('reaper')==='v2';
  super(stage,'reaper',v2?REAPER_V2:RIGS.reaper);this.v2=v2;
 }
 // v2: the boxes and joints come from its own rig.json.
 async loadJoints(){
  if(!this.v2)return super.loadJoints();
  const rig=await fetch(ROOT+'reaper-v2/rig.json').then(r=>r.json());
  this.spec={...REAPER_V2,size:rig.size,parts:Object.fromEntries(Object.entries(REAPER_V2.parts).map(([n,p])=>[n,{...p,box:rig.parts[p.file].box}]))};
  this.size=rig.size;this.build();
  // `&reaperDebug=joints`: the mantle and robe see-through, to inspect the joints.
  if(new URLSearchParams(location.search).get('reaperDebug')==='joints')this.rig.classList.add('debug-joints');
  return {...rig.joints,checks:rig.checks};
 }
 bones(pose){return {bones:this.v2?reaperV2Bones(this.joints,pose):reaperBones(this.joints,pose)};}
 idlePose(t){const w=Math.sin(t*Math.PI*2/4.2),v=Math.sin(t*Math.PI*2/5.6+1);
  if(this.v2)return {breath:.0065*w,shoulder:.8*v,elbow:.6*Math.sin(t*Math.PI*2/5.6+.4),wrist:-.5*v};
  return {breath:.0065*w,cape:.7*v,head:.8*Math.sin(t*Math.PI*2/6.3),upperRight:.8*v,foreRight:.6*Math.sin(t*Math.PI*2/5.6+.4),scythe:-.5*v,upperLeft:-.7*v,foreLeft:-.8*Math.sin(t*Math.PI*2/5.6+.5)};}
 // The blade's position on screen (its curve's midpoint), for tests and effects.
 bladePoint(){const J=this.joints,b=(this.frame||this.bones({})).bones,[x,y]=this.v2?apply(b.hand,J.blade):apply(b.scythe,[160,40]),r=this.rig.getBoundingClientRect();return {x:r.left+x*r.width/this.size[0],y:r.top+y*r.height/this.size[1]};}
 strike({turbo=false}={}){this.stage.classList.add('attacking');const keys=this.v2?STRIKE_V2:STRIKE;return this.action({duration:turbo?520:1050,release:.48,skip:()=>globalThis.NightFall?.state.skip,pose:p=>sample(keys,p)});}
}

export class CourtArcher extends Actor {
 constructor(stage){super(stage,'archer');}
 load(){
  // The live bowstring, between the bow and the drawing hand.
  const ns='http://www.w3.org/2000/svg';
  this.string=document.createElementNS(ns,'svg');this.string.setAttribute('class','rig-string');this.string.setAttribute('viewBox',`0 0 ${SIZE[0]} ${SIZE[1]}`);this.string.setAttribute('preserveAspectRatio','none');
  // Drawn like the art's string: a dark outline with a tan core.
  this.stringLines=['outline','core'].map(c=>{const l=document.createElementNS(ns,'polyline');l.setAttribute('class',c);this.string.append(l);return l;});this.stringLine=this.stringLines[1];this.rig.append(this.string);
  return super.load();
 }
 bones(pose){return archerBones(this.joints,pose);}
 idlePose(t){const w=Math.sin(t*Math.PI*2/4.2);return {breath:.0065*w,head:.9*Math.sin(t*Math.PI*2/6.1),aim:.6*Math.sin(t*Math.PI*2/5.2)};}
 // The string runs tip, fingers (or the braced line once loosed, vibrating), tip.
 paintExtras(frame,pose){
  const [a,b]=frame.tips;let mid=frame.pinch;
  // Loosed: the braced line, ringing; as the next arrow is nocked the string
  // goes back to the fingers with it.
  if(pose.loosed){const brace=add(scale(add(a,b),.5),scale(sub(frame.grip,frame.pinch),-.05)),axis=scale(sub(frame.pinch,frame.grip),1/len(sub(frame.pinch,frame.grip))),k=pose.renock||0;mid=add(scale(add(brace,scale(axis,(pose.twang||0))),1-k),scale(frame.pinch,k));}
  const points=`${a[0].toFixed(2)},${a[1].toFixed(2)} ${mid[0].toFixed(2)},${mid[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`;
  for(const line of this.stringLines)line.setAttribute('points',points);
  this.parts.arrow.style.opacity=pose.loosed?String(pose.renock||0):'1';
 }
 // Where the loosed arrow starts: the nocked arrow's head, on screen.
 releasePoint(){
  const r=this.rig.getBoundingClientRect(),f=this.frame||(this.joints?this.bones({}):null);
  if(!f){const b=this.parts.bow.getBoundingClientRect();return {x:b.left,y:b.top+b.height*.53};}
  return {x:r.left+f.tip[0]*r.width/SIZE[0],y:r.top+f.tip[1]*r.height/SIZE[1]};
 }
 // Aim at the target, draw, loose at .57, follow through, then nock again.
 shoot({target,turbo=false,paused,skip}={}){
  this.stage.classList.add('shooting');
  // The bow arm turns about its shoulder so the arrow (pointing left at rest)
  // points at the target, up to 20 degrees either way.
  const from=this.releasePoint(),wrap=a=>a>180?a-360:a<-180?a+360:a;
  const want=target?clamp(wrap(ang(sub([target.x,target.y],[from.x,from.y]))-180),-20,20):0;
  let held=null;
  return this.action({duration:turbo?480:960,paused,skip,release:.57,
   onRelease:()=>{held=this.frame?.pinch;},
   pose:p=>{
    const raise=ease(span(p,0,.3))*(1-ease(span(p,.72,1))),draw=ease(span(p,.12,.55));
    const pose={aim:want*raise,head:want*raise*.15,pull:16*draw*(p<.57?1:0)};
    if(p>=.57){
     // Loosed: the hand stays back a beat, recoils a touch, then returns to the
     // string; the string snaps straight and rings out; a new arrow is nocked.
     const after=span(p,.57,1),settle=ease(span(p,.68,.95));
     const f=this.bones({aim:pose.aim});
     const back=held?held:f.pinch,rest=f.target;
     pose.hand=add(scale(back,1-settle),scale(rest,settle));
     pose.loosed=true;pose.twang=6*Math.exp(-after*9)*Math.cos(after*55);
     pose.renock=ease(span(p,.82,.98));
    }
    return pose;
   }});
 }
}
