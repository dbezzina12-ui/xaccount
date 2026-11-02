// All values entering the presenter are already settled. Nothing here can award a credit.
export const tiers={
 nice:{label:'Nice Win',min:10,perCost:2,seconds:2.15,hold:.78,bees:1,accent:'#efba72'},
 big:{label:'Big Win',min:25,perCost:5,seconds:2.85,hold:.90,bees:2,accent:'#ffae51'},
 epic:{label:'Epic Win',min:100,perCost:25,seconds:3.80,hold:1.05,bees:3,accent:'#81dedc'},
 mythic:{label:'Mythic Win',min:500,perCost:50,seconds:4.10,hold:1.20,bees:5,accent:'#eec978'},
 max:{label:'Max Win',seconds:4.75,hold:1.40,bees:7,accent:'#ffdc83'}
};

export function tierFor(multiple,maxWin=false,seededPrice=0){
 if(maxWin)return 'max';
 for(const id of ['mythic','epic','big','nice']){
  const threshold=seededPrice>0?tiers[id].perCost*seededPrice:tiers[id].min;
  if(multiple>=threshold)return id;
 }
 return null;
}

// A cap can end the ten-spin award early. Preserve the sum of credited cents.
export function bonusSummary(before,result){
 return {mode:before.mode,spins:10-before.left+1,cents:result.state.awardedCents,tier:tierFor(result.state.total,result.maxWin)};
}

// Integer-cent count and two-stage skip follow the studio celebration model.
export function createWinCount(total,seconds,hold){
 let elapsed=0,held=0,complete=seconds===0,closed=false;
 return {
  tick(delta){
   if(complete){held+=delta;if(held>=hold)closed=true}
   else{elapsed+=delta;if(elapsed>=seconds)complete=true}
  },
  advance(){if(complete)closed=true;else complete=true},
  get complete(){return complete},get closed(){return closed},
  get value(){return complete?total:Math.floor(total*(1-(1-elapsed/seconds)**2))}
 };
}

let art;
function swarmArt(){
 if(!art)art=Promise.all([
  fetch('mascot/mascot.json').then(r=>{if(!r.ok)throw Error();return r.json()}),
  (async()=>{const img=new Image();img.src='mascot/bee-hover.webp';await img.decode();return img})()
 ]).then(([meta,img])=>({clip:meta.clips.hover,img})).catch(()=>null);
 return art;
}
const clamp=n=>Math.max(0,Math.min(1,n));
function polygon(ctx,x,y,r){
 ctx.beginPath();
 for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/3;ctx.lineTo(x+r*Math.cos(a),y+r*Math.sin(a))}
 ctx.closePath();
}

// Flight positions are optical centres in viewport pixels. Only the etched artwork
// and lettering use the cabinet's original design coordinates.
export function swarmFlight(view,level,t,still=false){
 const {w,h,insets,stage}=view;
 const pad=Math.max(8,Math.min(w,h)*.025);
 const left=insets.left+pad,right=w-insets.right-pad,top=insets.top+pad;
 const bottom=Math.min(h-insets.bottom-pad,stage.y+stage.h*.47);
 const width=right-left,height=bottom-top;
 if(width<=0||height<=0)return [];
 const wide=clamp((w/h-.7)/1.1);
 const heroSpan=Math.min(stage.w*(.42+.008*level),width*.72,height*.93);
 const placed=[];
 for(let i=level-1;i>=0;i--){
  const hero=i===0,side=i%2?-1:1,rank=Math.floor((i-1)/2);
  const arrival=still?1:clamp((t-i*.055)/(.74+i*.03));
  if(!arrival)continue;
  const glide=1-(1-arrival)**2,arc=Math.sin(arrival*Math.PI);
  const emerge=clamp(arrival/.24);
  const span=hero?heroSpan:heroSpan*(.55-rank*.062);
  const size=span*(.67+.33*glide)*emerge*(2-emerge);
  const bank=still?0:side*(.30*(1-glide)+.085*arc);
  // A square around the widest wingbeat also encloses the sprite's antennae and
  // the live rig's feet. Rotate that envelope before choosing the flight path.
  const reach=size*(Math.abs(Math.cos(bank))+Math.abs(Math.sin(bank)))/2;
  const endX=hero?.5:.5+side*[.265,.402,.475][rank];
  const endY=hero?.66:[.32+.21*wide,.81-.03*wide,.12+.13*wide][rank];
  const fromX=hero?(level===2?.82:.17):side<0?.015:.985;
  const fromY=hero?(level===7?.91:.13):rank%2?.90:.15;
  const bob=still?0:Math.sin(t*2.7+i)*.013;
  const x=clamp(fromX+(endX-fromX)*glide+arc*side*(level===3?.09:.045));
  const y=clamp(fromY+(endY-fromY)*glide-arc*(level>=5?.14:.08)+bob);
  placed.push({x:left+reach+x*(width-2*reach),y:top+reach+y*(height-2*reach),
   size,hero,side,arrival,bank,beat:still?i:t*42+i*1.2,yaw:side*.75});
 }
 return placed;
}

function rigPlacement(bee){
 // The 3D rig's wing envelope is 2.26 authored units wide and its optical
 // centre is .175 units above its origin. The sprite is already centred.
 const size=bee.size/2.26;
 return {...bee,size,x:bee.x-Math.sin(bee.bank)*.175*size,y:bee.y+Math.cos(bee.bank)*.175*size};
}

function paint(ctx,canvas,config,t,sprites,still,scene){
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 if(!scene.view||scene.view.w!==w||scene.view.h!==h){
  const rect=scene.stage.getBoundingClientRect(),origin=canvas.getBoundingClientRect();
  const safe=getComputedStyle(scene.dismiss);
  scene.view={w,h,stage:{x:rect.left-origin.left,y:rect.top-origin.top,w:rect.width,h:rect.height},
   insets:{left:parseFloat(safe.paddingLeft),right:parseFloat(safe.paddingRight),top:parseFloat(safe.paddingTop),bottom:parseFloat(safe.paddingBottom)}};
 }
 const scale=Math.min(2,devicePixelRatio||1,Math.sqrt(2400000/(w*h)));
 if(canvas.width!==Math.round(w*scale)||canvas.height!==Math.round(h*scale)){
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
 }
 ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.clearRect(0,0,w,h);
 const level=config.bees,accent=config.accent,open=still?1:1-(1-clamp(t/.58))**3;
 const stage=scene.view.stage;
 ctx.save();ctx.translate(stage.x,stage.y);ctx.scale(stage.w/720,stage.h/500);ctx.translate(360,291);
 // Etched honeycomb rings and illuminated contact pads expand out from the count.
 for(let ring=0;ring<(level>=3?3:2);ring++){
  ctx.globalAlpha=.17-ring*.035;ctx.strokeStyle=accent;ctx.lineWidth=ring?1.2:2;
  const radius=(74+ring*34)*(.82+.18*open);
  polygon(ctx,0,0,radius);ctx.stroke();
 }
 ctx.globalAlpha=1;
 if(!scene.bonus)for(const side of [-1,1]){
  ctx.save();ctx.scale(side,1);
  for(let k=0;k<Math.min(4,level+1);k++){
   const y=-29+k*13,x=111+k*8,reach=(56+level*9-k*10)*open;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+reach,y-14);ctx.lineTo(x+reach+12,y-25);ctx.lineTo(x+11,y-8);ctx.closePath();
   ctx.fillStyle=k===0?accent:k%2?'#a67c48':'#ffe4ad';ctx.globalAlpha=k===0?.95:.58;ctx.fill();
  }
  ctx.restore();
 }
 // The Epic ring chases around its six contacts. Mythic adds a queen crest;
 // Max releases a second wave of honeycomb cells out past the typography.
 if(level===3){
  for(let i=0;i<6;i++){
   const angle=i*Math.PI/3-Math.PI/2,lit=still?i%2===0:(Math.floor(t*7)+i)%6<2;
   polygon(ctx,Math.cos(angle)*103,Math.sin(angle)*103,lit?5:3);
   ctx.fillStyle=lit?'#d6ffef':'#316560';ctx.fill();
  }
 }else if(level>=5){
  const surge=still?.60:clamp((t-.26)/.85);
  for(let i=0;i<(level===7?12:5);i++){
   const angle=level===7?i*Math.PI/6:Math.PI+(i+1)*Math.PI/6;
   const radius=(level===7?146:127)*surge;
   const x=radius*Math.cos(angle)*1.22,y=radius*Math.sin(angle);
   const pulse=still?.7:.64+.2*Math.sin(t*2.8+i*.72);
   ctx.globalAlpha=pulse*surge;polygon(ctx,x,y,level===7?6:4.5);
   ctx.fillStyle=i%3?'#e19535':'#fff0bf';ctx.fill();
  }
  ctx.globalAlpha=1;
 }
 // Pollen gathers into a fast halo for higher tiers. Fixed phases leave game RNG untouched.
 ctx.fillStyle=accent;
 for(let i=0;i<6+level*4;i++){
  const angle=i*2.39996,phase=still?.52:(t*.46+i*.271)%1;
  const radius=93+phase*96,px=Math.cos(angle)*radius*1.55,py=Math.sin(angle)*radius*.89;
  ctx.globalAlpha=(1-phase)*.83*open;ctx.save();ctx.translate(px,py);ctx.rotate(angle+.55);
  ctx.fillRect(-3,-1,2+phase*7,2.4);ctx.restore();
 }
 ctx.restore();
 const placed=swarmFlight(scene.view,level,t,still);
 if(scene.painter){
  try{scene.painter.draw(ctx,w,h,scale,placed.map(rigPlacement));return}catch{scene.painter=null}
 }
 if(!sprites)return;
 const {clip,img}=sprites;
 for(const [index,bee] of placed.entries()){
  const f=clip.frames[Math.floor(still?0:t*clip.fps+index*5)%clip.frames.length];
  const height=bee.size*f[3]/f[2];
  ctx.save();ctx.globalAlpha=bee.arrival;ctx.translate(bee.x,bee.y);ctx.rotate(bee.bank);
  if(!bee.hero&&bee.side>0)ctx.scale(-1,1);
  ctx.drawImage(img,f[0],f[1],f[2],f[3],-bee.size/2,-height/2,bee.size,height);ctx.restore();
 }

}

const bonusScenery={regular:'woodland-clearing',super:'foundry',hidden:'queen-vault'};
const ordinaryTotal={seconds:1.15,bees:1,accent:'#ffaa51'};

const recordings=new Map();
function recording(id,context){
 if(!recordings.has(id)){
  recordings.set(id,fetch('assets/wins/'+id+'.mp3').then(async r=>{
   if(!r.ok)throw Error();
   return context.decodeAudioData(await r.arrayBuffer());
  }).catch(()=>{recordings.delete(id);return null}));
 }
 return recordings.get(id);
}

export function mountWinShow(dialog,{money,audioContext,muted,swarm}){
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),amount=dialog.querySelector('.win-cash');
 const title=dialog.querySelector('use'),dismiss=dialog.querySelector('.win-dismiss');
 const reader=dialog.querySelector('.win-reader'),stage=dialog.querySelector('.win-stage');
 const scenery=dialog.querySelector('.bonus-landscape img');
 function prepareBonus(mode){
  const url='assets/'+bonusScenery[mode]+'.webp';
  if(scenery.getAttribute('src')!==url)scenery.src=url;
 }
 let active=null,sprites=null;

 function stopCue(s){
  s.cueVersion++;
  if(!s.voice)return;
  const {node,gain,context}=s.voice;s.voice=null;
  const now=context.currentTime;gain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(0,now,.012);try{node.stop(now+.055)}catch{}
 }
 async function cue(s){
  const context=audioContext();if(!context||muted())return;
  const version=++s.cueVersion;
  if(context.state!=='running')try{await context.resume()}catch{return}
  if(s!==active||s.cueVersion!==version||muted())return;
  const buf=await recording(s.id,context);
  if(!buf||s!==active||s.cueVersion!==version||muted())return;
  const offset=(performance.now()-s.start)/1000;if(offset>=buf.duration)return;
  const node=context.createBufferSource(),gain=context.createGain();node.buffer=buf;gain.gain.value=.55;
  node.connect(gain).connect(context.destination);node.onended=()=>{node.disconnect();gain.disconnect()};
  s.voice={node,gain,context};node.start(0,offset);
 }
 function close(){
  const s=active;if(!s)return;
  active=null;cancelAnimationFrame(s.frame);stopCue(s);dialog.close();s.resolve();
 }
 function update(s,now){
  const counter=s.counter,complete=counter.complete;
  const formatted=money(counter.value);if(amount.textContent!==formatted)amount.textContent=formatted;
  if(ctx)paint(ctx,canvas,s.config,s.still?1:(now-s.start)/1000,sprites,s.still,s);
  if(complete&&!s.announced){
   dialog.dataset.phase='total';dismiss.setAttribute('aria-label',s.bonus?'Return to reels':'Continue');s.announced=true;
   reader.textContent=s.scope+'. '+formatted+'.';
  }
 }
 function advance(){
  const s=active;if(!s||s.leaving)return;
  s.counter.advance();stopCue(s);
  if(!s.counter.closed){update(s,performance.now());return}
  if(!s.bonus||s.still){close();return}
  s.leaving=true;cancelAnimationFrame(s.frame);
  dialog.animate([{opacity:1},{opacity:0}],{duration:260,easing:'ease-in',fill:'forwards'}).finished
   .then(animation=>{animation.cancel();if(active===s)close()});
 }
 function tick(s,now){
  if(s!==active)return;
  s.counter.tick((now-s.last)/1000);s.last=now;
  if(s.counter.closed||(!s.bonus&&document.hidden)){close();return}
  update(s,now);s.frame=requestAnimationFrame(time=>tick(s,time));
 }
 dismiss.addEventListener('click',advance);
 dialog.addEventListener('cancel',e=>{e.preventDefault();advance()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!active?.bonus)close()});
 return {
  prepareBonus,
  show(id,total,context,{quick=false,reduced=false,holdForReview=false,bonus=null}={}){
   if(!bonus&&(!id||document.hidden))return Promise.resolve();
   close();
   const conf=tiers[id]??ordinaryTotal,now=performance.now();
   const seconds=reduced||total===0?0:conf.seconds*(quick?.35:1);
   const counter=createWinCount(total,seconds,bonus||holdForReview?Infinity:reduced?1.05:conf.hold*(quick?.65:1));
   let heading=conf.label,scope=context;
   if(bonus){
    prepareBonus(bonus.mode);dialog.dataset.bonus=bonus.mode;
    const played=bonus.spins+' free spin'+(bonus.spins===1?'':'s');
    dialog.querySelector('.bonus-signature').textContent=context+' complete';
    dialog.querySelector('.bonus-detail').textContent=played+(id?' · '+conf.label:'');
    heading=context+' total win';scope=heading+'. '+played+(id?'. '+conf.label:'');
   }else{delete dialog.dataset.bonus;scope=heading+'. '+context}
   dialog.dataset.tier=id??'total';dialog.dataset.phase='counting';dialog.style.setProperty('--signal',conf.accent);
   title.setAttribute('href','assets/wins/titles.svg?v=37#'+(bonus?'total':id));dialog.querySelector('.win-name').textContent=heading;
   amount.style.setProperty('--cash-size',Math.min(bonus?17:13,156/money(total).length)+'cqw');
   reader.textContent='';dismiss.setAttribute('aria-label','Show total');dialog.showModal();dismiss.focus({preventScroll:true});
   return new Promise(resolve=>{
    const config=bonus&&conf.bees===2?{...conf,bees:3}:conf;
    const s={id,config,bonus,scope,start:now,last:now,counter,resolve,still:reduced,frame:0,cueVersion:0,painter:null,stage,dismiss};active=s;
    try{s.painter=swarm?.()??null}catch{/* Use the pre-rendered mascot frames when 3D is unavailable. */}
    void swarmArt().then(a=>{sprites=a});if(id)void cue(s);update(s,now);s.frame=requestAnimationFrame(time=>tick(s,time));
   });
  }
 };
}
