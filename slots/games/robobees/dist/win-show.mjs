// All values entering the presenter are already settled. Nothing here can award a credit.
export const tiers={
 nice:{label:'Nice Win',min:10,seconds:2.15,hold:.78,bees:1,accent:'#efba72'},
 big:{label:'Big Win',min:25,seconds:2.85,hold:.90,bees:2,accent:'#ffae51'},
 epic:{label:'Epic Win',min:100,seconds:3.80,hold:1.05,bees:3,accent:'#81dedc'},
 mythic:{label:'Mythic Win',min:500,seconds:4.10,hold:1.20,bees:5,accent:'#eec978'},
 max:{label:'Max Win',seconds:4.75,hold:1.40,bees:7,accent:'#ffdc83'}
};

export function tierFor(multiple,maxWin=false){
 if(maxWin)return 'max';
 for(const id of ['mythic','epic','big','nice'])if(multiple>=tiers[id].min)return id;
 return null;
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

function paint(ctx,canvas,config,t,sprites,still){
 // Fixed design coordinates let the same choreography fit a phone or a landscape cabinet.
 const w=720,h=430,scale=Math.min(2,(canvas.clientWidth||w)/w*(devicePixelRatio||1));
 if(canvas.width!==Math.round(w*scale)||canvas.height!==Math.round(h*scale)){
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
 }
 ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,w,h);
 const level=config.bees,accent=config.accent,open=still?1:1-(1-clamp(t/.58))**3;
 ctx.save();ctx.translate(360,209);
 // Etched honeycomb rings and illuminated contact pads expand out from the count.
 for(let ring=0;ring<(level>=3?3:2);ring++){
  ctx.globalAlpha=.17-ring*.035;ctx.strokeStyle=accent;ctx.lineWidth=ring?1.2:2;
  const radius=(74+ring*34)*(.82+.18*open);
  polygon(ctx,0,0,radius);ctx.stroke();
 }
 ctx.globalAlpha=1;
 for(const side of [-1,1]){
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
 if(!sprites)return;
 const {clip,img}=sprites;
 for(let i=level-1;i>=0;i--){
  const hero=i===0,arrival=still?1:clamp((t-i*.055)/(.70+i*.025));
  if(!arrival)continue;
  const side=i%2?-1:1,endX=hero?365:360+side*(97+Math.floor((i-1)/2)*43);
  const endY=hero?66:89+Math.floor((i-1)/2)*19,bob=still?0:Math.sin(t*3+i)*3;
  const arc=Math.sin(arrival*Math.PI);
  let x=endX+(1-arrival)**2*(hero?-205:side*185);
  let y=endY+(1-arrival)**2*(hero?-62:70)+bob-14*Math.sin(arrival*Math.PI);
  if(level===2){x=endX+(1-arrival)*(hero?185:-190);y-=arc*21}
  if(level===3){x+=arc*Math.cos(arrival*Math.PI*2+i)*46;y+=arc*Math.sin(arrival*Math.PI*2+i)*32}
  if(level===5)y-=arc*(hero?27:9+i*5);
  if(level===7){x=360+(endX-360)*arrival+arc*side*65;y=145+(endY-145)*arrival-arc*36}
  const f=clip.frames[Math.floor((still?0:t*clip.fps+i*5))%clip.frames.length];
  const size=(hero?70+level*2:32+i*1.5)*(.63+.37*arrival);
  ctx.save();ctx.globalAlpha=arrival;ctx.translate(x,y);ctx.rotate((1-arrival)*side*.34);
  if(i%2)ctx.scale(-1,1);
  ctx.drawImage(img,f[0],f[1],f[2],f[3],-size/2,-size*f[3]/f[2]/2,size,size*f[3]/f[2]);ctx.restore();
 }
}

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

export function mountWinShow(dialog,{money,audioContext,muted,toggleMute}){
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),amount=dialog.querySelector('.win-cash');
 const title=dialog.querySelector('use'),skip=dialog.querySelector('.win-skip'),sound=dialog.querySelector('.win-sound');
 const reader=dialog.querySelector('.win-reader'),scope=dialog.querySelector('.win-scope');
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
  if(ctx)paint(ctx,canvas,tiers[s.id],s.still?1:(now-s.start)/1000,sprites,s.still);
  if(complete&&!s.announced){
   dialog.dataset.phase='total';skip.textContent='Continue';s.announced=true;
   reader.textContent=tiers[s.id].label+'. '+s.scope+'. '+formatted+'.';
  }
 }
 function advance(){
  if(!active)return;
  const s=active;s.counter.advance();stopCue(s);
  if(s.counter.closed)close();else update(s,performance.now());
 }
 function tick(s,now){
  if(s!==active)return;
  s.counter.tick((now-s.last)/1000);s.last=now;
  if(s.counter.closed||document.hidden){close();return}
  update(s,now);s.frame=requestAnimationFrame(time=>tick(s,time));
 }
 function soundLabel(){sound.textContent=muted()?'Sound off':'Sound on';sound.setAttribute('aria-pressed',String(!muted()))}
 dialog.addEventListener('click',e=>{
  if(e.target.closest('.win-sound')){toggleMute();soundLabel();if(active){if(muted())stopCue(active);else void cue(active)}return}
  advance();
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();advance()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close()});
 return {
  show(id,total,multiple,context,{quick=false,reduced=false,holdForReview=false}={}){
   if(!id||document.hidden)return Promise.resolve();
   close();
   const conf=tiers[id],now=performance.now(),counter=createWinCount(total,reduced?0:conf.seconds*(quick?.35:1),holdForReview?Infinity:reduced?1.05:conf.hold*(quick?.65:1));
   dialog.dataset.tier=id;dialog.dataset.phase='counting';dialog.style.setProperty('--signal',conf.accent);
   title.setAttribute('href','assets/wins/titles.svg#'+id);dialog.querySelector('.win-name').textContent=conf.label;
   scope.textContent=context;dialog.querySelector('.win-multiple').textContent=multiple.toLocaleString('en-US',{maximumFractionDigits:2})+'×';
   skip.textContent='Show total';reader.textContent='';soundLabel();dialog.showModal();skip.focus({preventScroll:true});
   return new Promise(resolve=>{
    const s={id,scope:context,start:now,last:now,counter,resolve,still:reduced,frame:0,cueVersion:0};active=s;
    void swarmArt().then(a=>{sprites=a});void cue(s);update(s,now);s.frame=requestAnimationFrame(time=>tick(s,time));
   });
  }
 };
}
