import {RULES} from './config.js?v=god-pacing-71';
// Presentation only: these values never change the settled outcome or wallet.
export const WIN_TIERS=Object.freeze([
 {id:'win',label:'WIN',minimum:0,duration:650,coins:0},
 {id:'nice',label:'NICE WIN',minimum:1000,duration:1800,coins:0},
 {id:'big',label:'BIG WIN',minimum:2500,duration:3000,coins:12},
 {id:'super',label:'EPIC WIN',minimum:10000,duration:4300,coins:24},
 {id:'relic',label:'EPIC WIN',minimum:50000,duration:6200,coins:36},
 {id:'max',label:'MAX WIN',minimum:RULES.maxWin,duration:11000,coins:48}
].map(Object.freeze));
export const WIN_ART=Object.freeze({nice:'./assets/wins/ink-nice.webp',big:'./assets/wins/ink-big.webp',super:'./assets/wins/ink-epic.webp',relic:'./assets/wins/ink-epic.webp',max:'./assets/wins/ink-max.webp'});
// Keep decoded image nodes alive and swap nodes, never reset an on-screen src.
const artCache=new Map();
export function preloadWinArt(){
 if(typeof Image==='undefined')return Promise.resolve();
 for(const src of new Set(Object.values(WIN_ART))){
  if(artCache.has(src))continue;
  const image=new Image();image.alt='';image.width=900;image.height=600;image.decoding='async';
  const entry={image,ready:false,promise:null};artCache.set(src,entry);
  entry.promise=new Promise(resolve=>{
   image.onload=async()=>{try{await image.decode?.();}catch{}entry.ready=true;resolve();};
   image.onerror=()=>resolve();image.src=src;
  });
 }
 return Promise.all([...artCache.values()].map(entry=>entry.promise));
}
void preloadWinArt();
export function winTier(payout,{capped=false}={}){
 if(capped)return WIN_TIERS.at(-1);
 return WIN_TIERS.slice(0,-1).findLast(t=>payout>=t.minimum);
}
export function startCountUp({from=0,to,duration=650,stops=[],onUpdate=()=>{},now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}){
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<from)throw Error('Invalid display count.');
 const path=[from,...[...new Set(stops)].filter(n=>n>from&&n<to).sort((a,b)=>a-b),to],started=now();
 let frame=null,done=false,resolve;const finished=new Promise(r=>{resolve=r;});
 function finish(){if(done)return;done=true;if(frame!==null)cancelFrame(frame);frame=null;onUpdate(to,1);resolve();}
 function tick(){if(done)return;const progress=Math.min(1,Math.max(0,(now()-started)/duration));if(progress>=1){finish();return;}
  const segment=progress*(path.length-1),index=Math.floor(segment),fraction=segment-index,eased=fraction*fraction*(3-2*fraction);
  onUpdate(Math.floor(path[index]+(path[index+1]-path[index])*eased),progress);frame=requestFrame(tick);
 }
 onUpdate(from,0);if(duration<=0||to===from)finish();else frame=requestFrame(tick);
 return {finished,skip:finish,cancel:finish};
}
function addCoins(node,count,{burst=false}={}){
 const doc=node.ownerDocument;
 for(let i=0;i<count;i++){
  const coin=doc.createElement('span');coin.className=burst?'win-coin win-coin-burst':'win-coin';coin.setAttribute('aria-hidden','true');
  coin.style.setProperty('--coin-size',`${4+Math.random()*6}cqw`);
  coin.style.setProperty('--coin-x',`${Math.random()*100}%`);
  coin.style.setProperty('--coin-drift',`${(Math.random()-.5)*70}cqw`);
  coin.style.setProperty('--coin-turn',`${(Math.random()-.5)*1440}deg`);
  coin.style.setProperty('--coin-delay',`${burst?Math.random()*.2:-Math.random()*3.5}s`);
  coin.style.setProperty('--coin-time',`${2.5+Math.random()*2}s`);node.append(coin);
 }
}
export async function presentWin({nodes,payout,units,format,capped=false,summary=false,reduced=false,turbo=false,onValue=()=>{},onTier=()=>{},onControl=()=>{},leadIn=200,wait=ms=>new Promise(r=>setTimeout(r,ms)),counterOptions={}}){
 const finalTier=winTier(payout,{capped}),show=summary||finalTier.id!=='win',manual=summary||capped;
 const {dialog,title,art,value,multiple,hint,proceed,coins,context,skipTargets=[]}=nodes;
 const cleanup=[];let count,phase='counting',shownTier=null,coinCount=0,release;
 const continued=new Promise(r=>{release=r;});
 const listen=(node,type,fn)=>{node.addEventListener(type,fn);cleanup.push(()=>node.removeEventListener(type,fn));};
 let artRequest=0,artSource=null;
 const showArt=tier=>{
  if(!art)return;
  const src=WIN_ART[tier.id];
  if(src===artSource)return;
  artSource=src;const request=++artRequest;
  const entry=artCache.get(src);
  const apply=()=>{
   if(request!==artRequest)return;
   if(entry?.ready){art.replaceChildren(entry.image);art.hidden=false;dialog.classList.add('has-win-art');}
   else{art.hidden=true;dialog.classList.remove('has-win-art');}
  };
  if(entry&&!entry.ready)entry.promise.then(apply);else apply();
 };
 const changeTier=(tier,final=false)=>{
  if(!show)return;
  if(shownTier!==tier.id){shownTier=tier.id;showArt(tier);title.textContent=tier.label;dialog.dataset.tier=tier.id;if(!reduced&&tier.coins>coinCount){addCoins(coins,tier.coins-coinCount);coinCount=tier.coins;}onTier(tier,false);}
  if(final){title.textContent=tier.label;onTier(tier,true);}
 };
 const skip=e=>{e.preventDefault();e.stopPropagation();if(phase==='counting')count?.skip();else if(phase==='ready')release();};
 const key=e=>{if(['Enter',' ','Escape'].includes(e.key))skip(e);};
 try{
  // Brief landing beat; artwork is decoded during startup, not during the win.
  if(show&&!summary&&leadIn>0)await wait(turbo?Math.min(80,leadIn):leadIn);
  if(show){
   coins.replaceChildren();dialog.dataset.phase='counting';dialog.dataset.tier=finalTier.id;proceed.hidden=true;value.textContent=format(0);multiple.textContent='0.00×';
   value.style.setProperty('--win-digits',String(Math.max(7,format(units).length)));
   context.textContent=capped?`${(RULES.maxWin/100).toLocaleString('en-US')}× MAXIMUM REACHED`:summary?'TOTAL BONUS WIN':'COSMIC CLASH';
   hint.textContent=reduced?'':'Tap to skip the count';title.textContent=finalTier.label;
   if(capped&&!reduced){addCoins(coins,finalTier.coins);coinCount=finalTier.coins;}
   // Non-modal, absolutely positioned inside the reel frame; never a top-layer screen.
   listen(dialog,'click',skip);listen(dialog,'keydown',key);listen(dialog,'cancel',skip);dialog.show();dialog.focus({preventScroll:true});
  }else{
   for(const target of skipTargets){
    const old={role:target.getAttribute('role'),tabindex:target.getAttribute('tabindex'),title:target.getAttribute('title')};
    target.setAttribute('role','button');target.setAttribute('tabindex','0');target.setAttribute('title','Skip payout count');target.classList.add('counting-payout');
    listen(target,'click',skip);listen(target,'keydown',key);
    cleanup.push(()=>{target.classList.remove('counting-payout');for(const [name,v] of Object.entries(old)){if(v===null)target.removeAttribute(name);else target.setAttribute(name,v);}});
   }
  }
  const duration=reduced?0:Math.max(350,(summary?Math.max(1800,finalTier.duration):finalTier.duration)*(turbo?.55:1));
  const stops=show?WIN_TIERS.slice(2,-1).filter(t=>t.minimum<payout).map(t=>Math.round(units*t.minimum/payout)):[];
  count=startCountUp({...counterOptions,to:units,duration,stops,onUpdate:(n,progress)=>{
   onValue(n,progress);
   if(!show)return;
   value.textContent=format(n);const current=units?Math.floor(payout*n/units):payout;multiple.textContent=`${(current/100).toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2})}×`;
   const tier=progress===1?finalTier:winTier(current);changeTier(tier.id==='win'&&finalTier.id!=='win'?WIN_TIERS[1]:tier);
  }});
  onControl(()=>count.skip(),'Skip win count');
  await count.finished;phase='finale';onControl(null);
  if(show){
   dialog.dataset.phase='finale';hint.textContent='';changeTier(finalTier,true);value.textContent=format(units);multiple.textContent=`${(payout/100).toLocaleString('en-US',{maximumFractionDigits:2})}×`;
   if(!reduced&&finalTier.coins)addCoins(coins,capped?36:16,{burst:true});
   await wait(reduced?80:turbo?500:capped?1500:950);
   if(manual){phase='ready';dialog.dataset.phase='ready';hint.textContent=summary?'Bonus complete':'';proceed.textContent='CONTINUE';proceed.hidden=false;proceed.focus();onControl(()=>release(),'Continue');await continued;}
  }else await wait(reduced?0:100);
 }finally{
  onControl(null);count?.cancel();cleanup.reverse().forEach(fn=>fn());if(show){dialog.close();coins.replaceChildren();proceed.hidden=true;artRequest++;}
 }
}
