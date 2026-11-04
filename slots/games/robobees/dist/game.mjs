import {openFieldGuide} from './field-guide.mjs?v=2';
import {playStinger,flyHiveBees} from './drone-stinger.mjs?v=15';
import {spinIdle} from './mascot/spin-idle.mjs';
import {mountMascot} from './mascot/mascot.mjs?v=10';
import {mountController} from './controller/controller.js';
import {Autoplay,AUTOPLAY_AMOUNTS} from './autoplay.js';
import {mountWinShow,bonusSummary,tierFor,tiers} from './win-show.mjs?v=39';
import {rollReels,dropTumble,preloadSymbols,symbolClass,symbolUrl} from './reels.mjs?v=36';
import {addHoney,prepareHoney} from './honey.mjs';
import {MATH,buys,credit,features,modes,purchaseEntry,start,spin} from './rules.mjs?v=31';
const $=id=>document.getElementById(id);
const grid=$('board'),modal=$('menu'),intro=$('bonus-intro'),cabinet=grid.closest('.cab');
const playStage=$('play-stage');
const mascot=mountMascot($('mascot-stage'));
const desc={
 regular:'Wins tumble. Winning cells charge to 2×, then double on repeat hits. Charges stay for all 10 free spins.',
 super:'Bank every new Wild from spins and tumbles. On spin 10, each banked bee returns as a Wild.',
 hidden:'One Wild guaranteed per spin. Bees boost up to three cells before wins pay. New Wilds from tumbles also join the final-spin bank.'
};
const sample=['hive','K','nectar','stinger','Q','A','rotor','W','beacon','10','stinger','J','hive','K','nectar','10','beacon','Q','rotor','FS'];
const stakes=[10,20,40,60,80,100,150,200,300,400,500,750,1000,1500,2000,3000,4000,5000,7500,10000,15000,20000,25000,30000,40000,50000];
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const params=new URLSearchParams(location.search);
const palette=params.get('palette');
const scatterDemo=params.get('preview')==='scatter';
const tumbleDemo=params.get('preview')==='tumble';
const winDemo=params.get('preview')==='wins';
const hiveDemo=params.get('preview')==='hive';
const endDemo=params.get('preview')==='bonus-end';
const preview=endDemo||hiveDemo||winDemo||tumbleDemo||scatterDemo||params.get('preview')==='stinger';
document.body.classList.toggle('enamel-symbols',palette!=='original');
// Keep the old colour-study link attached to its separate saved game.
const key=palette==='enamel'?'robobees-enamel-preview-v1':'robobees-playtest-controller-v1';
let saved;
try{
 if(!preview)saved=JSON.parse(localStorage.getItem(key)||'null');
 else if(winDemo)saved={mute:JSON.parse(localStorage.getItem(key)||'null')?.mute??false};
}catch{}
let state=saved?.state??start(),face=saved?.face??sample,previous=saved?.previous??null,pending=saved?.pending??null;
// what a natural trigger spin paid: it counts toward the bonus round's cap
let carry=saved?.carry??0,bonusResult=saved?.bonusResult??null;
// Preserve earned multipliers in features saved under the previous rules.
if(state.mode==='super'||state.mode==='hidden')state.spots=state.spots.map(v=>Math.max(2,v));
const startingBalance=1000000;
let balance=saved?.balance??startingBalance,bet=saved?.bet??100,win=saved?.win??0,turbo=saved?.turbo??false,mute=saved?.mute??true;
let featureMode=Object.hasOwn(features,saved?.featureMode)?saved.featureMode:null;
const spinCost=()=>bet*(features[featureMode]?.price??1);
const shop=$('bonus-menu');
let ready=false,busy=false,stop=false,audio,bonusTimer,checkpoint=null,flightBank=null;
const winShow=mountWinShow($('win-show'),{money,audioContext:()=>audio,muted:()=>mute,swarm:()=>mascot.swarm?.()});
const autoplay=new Autoplay();
const controller=mountController($('controller'),{onAction:action});
const skin=document.createElement('link');skin.rel='stylesheet';skin.href='controller/robobees.css';$('controller').shadowRoot.append(skin);
function save(){
 if(preview)return;
 const settled=checkpoint??{state,face,previous,pending,carry,balance,win,bonusResult};
 try{localStorage.setItem(key,JSON.stringify({...settled,bet,turbo,mute,featureMode}))}catch{}
}
const cells=Array.from({length:20},(_,i)=>{
 const c=document.createElement('div');
 c.className='cell';c.style.setProperty('--reel',i%5);
 c.append(new Image(),document.createElement('span'));grid.append(c);return c;
});
function cell(i,id,spots,hit=false){
 const c=cells[i],m=spots[i];c.className='cell '+symbolClass(id)+(m?' charged':'')+(hit?' hit':'');
 c.dataset.multi=m;
 if(id==='FS')addHoney(c);else c.querySelector('.fs-rig')?.remove();
 const url=symbolUrl(id);
 if(c.firstChild.getAttribute('src')!==url)c.firstChild.src=url;
 c.firstChild.alt=id;c.lastChild.className='multi';if(c.lastChild.dataset.value!==String(m)){
  const label=c.lastChild;label.dataset.value=m;label.replaceChildren();
  if(m){const cross=document.createElement('small');cross.textContent='×';label.append(String(m),cross);}
 }c.lastChild.hidden=!m;c.lastChild.toggleAttribute('data-long',m>=100);
}
function draw(board,spots,hits=[]){cells.forEach((_,i)=>cell(i,board[i],spots,hits.includes(i)))}
function showFlightBank(n){
 flightBank=n;$('bank-count').textContent=String(n);
}
function labels(){
 const bonus=state.mode!=='base';
 mascot.setTurbo(turbo);
 $('mode').hidden=!bonus&&!featureMode;
 $('mode').textContent=bonus?modes[state.mode]:features[featureMode]?.label??'';
 $('bonus-hud').hidden=!bonus;$('hive-bank').hidden=state.mode!=='super'&&state.mode!=='hidden';
 $('spin-count').textContent=String(state.left);$('bank-count').textContent=String(flightBank??state.bank);
 controller.update({ready,busy,holding:bonus&&!busy,continuing:!!pending&&!busy,autoActive:autoplay.active,
  remaining:autoplay.remaining,muted:mute,turbo,balance:money(balance),bet:money(bonus?bet:spinCost()),win:money(win),buyActive:!!featureMode&&!bonus,
  canIncrease:ready&&bet<stakes.at(-1),canDecrease:ready&&bet>stakes[0],featureColor:bonus?'#ffa344':null});
 if(bonus||pending)for(const id of ['betPicker','betPlus','betMinus','buy','auto'])controller.element(id).disabled=true;
}
function tone(hz,len=.08,gain=.035){if(mute||!audio)return;const osc=audio.createOscillator(),v=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(hz,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(hz*.73,audio.currentTime+len);v.gain.setValueAtTime(gain,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+len);osc.connect(v).connect(audio.destination);osc.start();osc.stop(audio.currentTime+len)}
const cues=new Map();
function prepareFlightSound(){
 if(mute)return;
 audio??=new AudioContext();void audio.resume().catch(()=>{});
 for(const name of ['rush','release'])if(!cues.has(name)){
  cues.set(name,fetch('assets/swarm-'+name+'.mp3').then(r=>r.arrayBuffer()).then(b=>audio.decodeAudioData(b)).catch(()=>null));
 }
}
async function droneCue(name){
 if(mute||!audio||audio.state!=='running')return;
 const clip=await cues.get(name);if(!clip||mute)return;
 const source=audio.createBufferSource();source.buffer=clip;source.connect(audio.destination);
 source.onended=()=>source.disconnect();source.start();
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
async function wait(ms){for(let left=reduced?0:ms;left>0&&!stop;left-=25)await new Promise(r=>setTimeout(r,25))}
async function hiveFlight(indices,collect,arrive,depart){
 const dock=$('hive-bank');
 dock.classList.add('hive-active');
 try{
  await flyHiveBees({canvas:$('swarm-stinger'),hive:$('hive-port'),targets:indices.map(i=>cells[i]),
   collect,fast:turbo,skip:()=>stop||reduced,onDeparture:depart,onArrival:n=>{
    arrive(indices[n],n);tone((collect?360:510)+n*12,.08,.018);
   }});
 }finally{dock.classList.remove('hive-active')}
}
async function primeBoard(){
 if(state.mode==='regular'||!state.spots.some(Boolean))return;
 grid.classList.add('priming');
 $('notice').textContent='All 20 cells start at 2×';
 // Hold the values even with reduced motion; only the sweep is optional.
 for(let ms=0;ms<1400&&!stop&&!document.hidden;ms+=50)await new Promise(r=>setTimeout(r,50));
}
async function showCellValues(indices){
 if(!indices.length||stop)return;
 for(const i of indices)cells[i].classList.add('show-value');
 await wait(turbo?240:540);
 for(const i of indices)cells[i].classList.remove('show-value');
}
function lock(val){busy=val;spinIdle.setBusy(val,performance.now()/1000);labels()}
async function feature(mode){
 autoplay.stop();previous=state;state=start(mode,carry);pending=null;carry=0;win=0;stop=false;save();lock(true);
 intro.inert=true;
 await flyAcross(true,()=>{
  document.body.dataset.scene=mode;draw(face,state.spots);
  grid.classList.toggle('priming',mode!=='regular');
  cabinet.classList.remove('tease-zoom');document.body.classList.remove('present-award');
 });
 mascot.arrive();
 playStage.inert=false;
 await primeBoard();
 controller.element('play').focus({preventScroll:true});
 $('notice').textContent=mode==='regular'?'Worker Shift · Ten free spins.':modes[mode]+' · All 20 cells start at 2×.';
 lock(false);scheduleBonus();
}
async function showRoll(landing,spots,purchased=false){
 let count=0;
 grid.classList.remove('priming');
 grid.classList.toggle('fs-fast',turbo);
 for(const rig of grid.querySelectorAll('.fs-rig.latching'))rig.classList.remove('latching');
 await rollReels({cells,before:face,after:landing,spots,place:cell,turbo,reduced,purchased,skip:()=>stop,
  onTease:col=>{cabinet.classList.add('tease-zoom');grid.classList.add('anticipation');$('notice').textContent='Hive signal · Reel '+(col+1);tone(295+col*55,.30)},
  land:(col,scatters)=>{
   if(!scatters){tone(200+col*30,.06);return}
   count+=scatters;
   if(stop)grid.classList.add('fs-fast');
   if(!reduced)for(let i=col;i<20;i+=5){
    if(landing[i]==='FS')cells[i].querySelector('.fs-rig')?.classList.add('latching');
   }
   tone(410*1.16**count,.22);
   $('notice').textContent=count+' FS landed'+(count===2?' · One more for free spins':'');
  }});
 if(count<3)cabinet.classList.remove('tease-zoom');
 grid.classList.remove('anticipation');
 if(count>=3&&!stop&&!reduced){grid.classList.add('fs-awarded');await wait(turbo?280:700);grid.classList.remove('fs-awarded')}
}
function flyAcross(release,cut){
 return playStinger({canvas:$('swarm-stinger'),scatterCells:cells.filter(c=>c.classList.contains('scatter')),reduced,
  release,cut,sound:()=>droneCue(release?'release':'rush'),painter:mascot.swarm()});
}
async function showAward(){
 if(!pending||playStage.inert||modal.open)return;
 const mode=pending,tier={regular:'Free spins',super:'Free super spins',hidden:'Free hidden spins'}[mode];
 $('award-tier').textContent=tier;
 $('award-title').setAttribute('aria-label','10 '+tier.toLowerCase());
 $('award-name').textContent=modes[mode];
 $('award-rules').textContent=desc[mode];
 const initial=start(mode).spots;
 $('charge-map').replaceChildren(...initial.map((v,i)=>{
  const square=document.createElement('i');
  square.style.setProperty('--reel',i%5);
  square.textContent=v?v+'×':'';
  if(square.textContent){square.classList.add('lit');square.dataset.multi=2}return square;
 }));
 $('charge-caption').textContent=mode==='regular'?'Starts uncharged · Wins charge cells to 2×':'Fresh board · All 20 cells start at 2×';
 intro.dataset.tier=mode;
 playStage.inert=true;
 await mascot.depart();
 await flyAcross(false,()=>document.body.classList.add('present-award'));
 intro.inert=false;$('start-feature').focus({preventScroll:true});
}
$('start-feature').onclick=()=>{if(!busy&&pending){prepareFlightSound();feature(pending)}};
let feedbackTimer;
function cabinetMessage(message){
 const panel=$('cab-feedback');
 panel.textContent=message;panel.hidden=false;$('notice').textContent=message;
 clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{panel.hidden=true},3500);
}
async function showTumbles(result,oldBank){
 let bank=oldBank,runningWin=0,lineCount=0;
 for(const [index,step] of result.steps.entries()){
  if(index){
   $('notice').textContent='Tumble '+index;
   await dropTumble({cells,step,turbo,reduced,skip:()=>stop,place:cell});
  }
  if(step.collected.length){
   $('notice').textContent='Wilds returning to the hive';
   await hiveFlight(step.collected,true,()=>showFlightBank(++bank));
  }
  if(!index&&result.boosts.length){
   $('notice').textContent='Scout bees charging '+result.boosts.length+' cells';
   await hiveFlight(result.boosts,false,i=>cell(i,step.landed[i],step.active));
   await showCellValues(result.boosts);
  }
  if(step.drops.length){
   $('notice').textContent='Hive release · '+step.drops.length+' Wilds incoming';
   await hiveFlight(step.drops,false,i=>{
    cell(i,'W',step.active);cells[i].classList.add('wild-landing');
   },()=>showFlightBank(--bank));
   await wait(turbo?70:180);
  }
  face=step.board;draw(face,step.active,step.hit);
  if(!step.hit.length)break;
  lineCount+=step.wins.length;
  runningWin+=step.amount;win=Math.round(runningWin*bet);labels();tone(500+Math.min(index,6)*55,.16);
  await wait(turbo?100:300);
  // Stamp each unique cell once, even if two paylines used the same symbol.
  for(const i of step.hit){cell(i,face[i],step.after);cells[i].classList.add('tumble-clear')}
  await showCellValues(step.hit);
  for(const i of step.hit)cells[i].classList.remove('tumble-clear');
 }
 return lineCount;
}
async function presentBonusResult(){
 const {mode,cents,tier,spins}=bonusResult;
 await winShow.show(tier,cents,modes[mode],{bonus:{mode,spins},quick:turbo,reduced});
 bonusResult=null;
}
async function play(rng=Math.random){
 if(busy){stop=true;return}
 if(pending){showAward();return}
 const bonus=state.mode!=='base';
 if(!bonus&&balance<spinCost()){autoplay.stop();cabinetMessage('Insufficient demo balance. Open Menu to reset it.');labels();return}
 $('cab-feedback').hidden=true;
 stop=false;const result=spin(state,rng,bonus?null:featureMode),oldBank=state.bank;
 const award=credit(state,result.amount,bet),finished=bonus&&result.state.left===0;
 if(bonus)result.state.awardedCents=(state.awardedCents??credit({...state,total:0},state.total,bet))+award;
 if(finished)bonusResult=bonusSummary(state,result);
 if(!bonus)balance-=spinCost();
 win=0;checkpoint={state:finished?(previous??start()):result.state,face:result.board,previous:finished?null:previous,pending:result.trigger,carry:result.trigger?result.amount:0,balance:balance+award,win:finished?bonusResult.cents:award,bonusResult};save();lock(true);
 $('notice').textContent=result.finale?'Final spin · '+oldBank+' bees ready to deploy.':'Reels in motion…';tone(135,.14);
 if(result.seeded){
  draw(face,result.prior);grid.classList.add('priming','feature-seeding');
  $('notice').textContent=features[featureMode].label+' · Starting multipliers';
  // Reduced-motion players also need a readable still before the opening spin.
  for(let ms=0;ms<(turbo?300:770)&&!stop&&!document.hidden;ms+=50)await new Promise(r=>setTimeout(r,50));
  grid.classList.remove('feature-seeding');
 }
 await showRoll(result.landing,result.prior);

 const lineCount=await showTumbles(result,oldBank);
 flightBank=null;state=result.state;face=result.board;
 draw(face,result.seeded?result.steps.at(-1).after:state.spots);balance+=award;win=award;
 const tumbles=result.steps.length-1;
 $('notice').textContent=lineCount?lineCount+' winning lines · '+tumbles+' tumbles':'No connection this spin.';
 if(state.bank>oldBank)$('notice').textContent+=' +'+(state.bank-oldBank)+' Wild'+(state.bank-oldBank>1?'s':'')+' banked.';
 if(result.trigger){autoplay.stop();pending=result.trigger;carry=result.amount;$('notice').textContent=modes[pending]+' unlocked · Press play to enter.'}
 if(finished){
  win=bonusResult.cents;labels();await presentBonusResult();
  document.body.dataset.scene='base';state=previous??start();previous=null;draw(face,state.spots);
 }else{
  const tier=tierFor(result.amount,result.maxWin,result.seeded?features[featureMode].price:0);
  if(tier){
   labels();await winShow.show(tier,award,bonus?'Free spin win':'Spin win',{quick:turbo||stop,reduced});
  }
  if(result.maxWin&&!bonus)cabinetMessage('Max win · '+MATH.cap.toLocaleString('en-US')+'× reached');
 }
 checkpoint=null;save();
 if(!bonus&&autoplay.active)autoplay.finishRound(play,turbo?180:500);
 lock(false);if(pending)showAward();else scheduleBonus();
}
function scheduleBonus(){
 clearTimeout(bonusTimer);if(hiveDemo)return;
 if(!busy&&!modal.open&&!playStage.inert&&state.mode!=='base')bonusTimer=setTimeout(()=>{if(!modal.open&&!playStage.inert&&!busy)play()},turbo?300:740);
}
const shopCopy={
 regular:'10 free spins. Wins tumble and charge cells. Multipliers stay for all 10 spins.',
 super:'10 free spins on a 2× board. Wilds from spins and tumbles return on spin 10.',
 mystery:'10 free spins in a random bonus. Regular 50% · Super 40% · Hidden 10%.'
};
function showBonuses(section='buys'){
 const isBuy=section==='buys';
 shop.querySelector('h2').textContent=isBuy?'Bonus buys':'Feature spins';
 shop.querySelector('.shop-balance strong').textContent=money(balance);
 shop.querySelector('.shop-stake strong').textContent=money(bet);
 shop.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.tab===section));b.onclick=()=>showBonuses(b.dataset.tab)});
 shop.querySelectorAll('.shop-bet-steps button').forEach((b,i)=>{const v=stakes[stakes.indexOf(bet)+(i?1:-1)];b.disabled=v===undefined;b.onclick=()=>{setBet(v);showBonuses(section)}});
 const cards=shop.querySelector('.bonus-cards');cards.classList.toggle('feature-options',!isBuy);cards.replaceChildren();
 for(const [id,item] of Object.entries(isBuy?buys:features)){
  const card=document.createElement('article'),cost=bet*item.price,active=!isBuy&&featureMode===id;
  card.className='bonus-card';card.dataset.mode=id;
  const eyebrow=isBuy?({regular:'3 FS · REGULAR BONUS',super:'4 FS · SUPER BONUS',mystery:'MYSTERY BONUS'}[id]):item.type.toUpperCase();
  const caption=isBuy?'10 FREE SPINS':'PER PAID SPIN';
  const tag=id==='random'?'2–32×':id==='full32'?'32×':'';
  card.innerHTML='<div class="card-content"><span class="purchase-eyebrow">'+eyebrow+'</span><div class="card-emblem '+symbolClass(item.art)+'"><img alt="" src="'+symbolUrl(item.art)+'">'+(tag?'<b class="multi-stamp">'+tag+'</b>':'')+'</div><h3>'+item.label+'</h3><p>'+(isBuy?shopCopy[id]:item.copy)+'</p><small>'+caption+'</small><div class="card-price"><strong>'+money(cost)+'</strong><span>'+item.price+'× BASE BET</span></div></div><button class="card-action"></button>';
  const button=card.querySelector('button');button.disabled=!active&&balance<cost;
  button.textContent=button.disabled?'Not enough credits':isBuy?(id==='mystery'?'Buy mystery':'Buy free spins'):active?'Disable':'Enable';
  button.onclick=()=>{shop.close();if(isBuy){confirmBuy(id);return}
   featureMode=active?null:id;save();labels();$('notice').textContent=featureMode?item.label+' enabled · '+money(cost)+' per spin.':'Standard spins enabled.'};
  cards.append(card);
 }
 $('bonus-menu-note').textContent=isBuy?'One purchase starts one bonus. Hidden can also trigger naturally with 5 FS.':'Selected mode stays on until disabled. Wins use the base bet.';
 if(!shop.open)shop.showModal();
}
shop.querySelector('.close').onclick=()=>shop.close();
function confirmBuy(id){
 const item=buys[id],cost=bet*item.price,content=$('content');
 content.innerHTML='<h2>Buy '+item.label+'?</h2><p>'+shopCopy[id]+'</p><div class="buy-summary"><span>Base bet <b>'+money(bet)+'</b></span><span>Bonus cost · '+item.price+'× <b>'+money(cost)+'</b></span><span>Demo balance after purchase <b>'+money(balance-cost)+'</b></span></div><div class="buy-actions"><button>Back</button><button class="buy-primary">Buy for '+money(cost)+'</button></div>';
 const [back,confirm]=content.querySelectorAll('button');back.onclick=()=>{modal.close();showBonuses('buys')};confirm.onclick=()=>buy(id);modal.showModal();
}
async function buy(id){
 const cost=bet*buys[id].price;
 if(busy||pending||state.mode!=='base'||autoplay.active||balance<cost)return;
 const entry=purchaseEntry(id);
 $('cab-feedback').hidden=true;modal.close();balance-=cost;pending=entry.mode;carry=0;stop=false;win=0;
 checkpoint={state,face:entry.board,previous,pending,carry,balance,win};save();lock(true);
 $('notice').textContent='Bonus purchased · Landing FS';await showRoll(entry.board,state.spots,true);
 face=entry.board;draw(face,state.spots);checkpoint=null;save();lock(false);
 $('notice').textContent=modes[pending]+' unlocked · Press play to enter.';showAward();
}
const pct=x=>(Math.round(x*1000)/10)+'%';
function showRules(){
 const cap=MATH.cap.toLocaleString('en-US');
 $('content').innerHTML='<h2>Field manual</h2><p>Match three or more symbols from reel one on a fixed payline. Wilds substitute for paying symbols. Winning symbols clear together, the rest fall straight down, and new symbols fill from above. Each new board can pay again on the same spin.</p><p>Winning cells charge to 2×, then double on repeat hits up to 128×. Add the values on a winning line. A shared cell upgrades once per drop. Normal and Signal Boost wins carry their charges into the next paid spin. Free spins keep all charges throughout the bonus.</p><ul class="multi-key" aria-label="Cell multiplier colours">'+[2,4,8,16,32,64,128].map(n=>'<li data-multi="'+n+'">'+n+'×</li>').join('')+'</ul><p>Signal Boost costs '+features.enhanced.price+'× and raises the FS chance per reel from '+pct(MATH.scatter.base)+' to '+pct(MATH.scatter.enhanced)+'. Pollen Charge costs '+features.random.price+'× and seeds 6–12 cells at 2× to 32×. Hive Overdrive costs '+features.full32.price+'× and starts all 20 cells at 32×. Both seeded boards reset each paid spin. All wins use your base bet. On these two paid spins, Nice, Big, Epic and Mythic celebrate returns of 2×, 5×, 25× and 50× the spin price. A capped round plays Max.</p><p>FS survive tumbles. Finish with 3, 4 or 5 FS to trigger Regular, Super or Hidden. All give 10 free spins. Super and Hidden start at 2× and bank each newly landed Wild once on spins 1–9. On spin 10 the hive turns cells Wild. If the bank fills the board, remaining bees deploy on the next refill. Hidden also guarantees one opening Wild and upgrades up to three cells per spin.</p><p>Every mode returns 96% of what it costs over the long run. A round, its trigger spin and free spins included, pays at most '+cap+'× the base bet; reaching it ends the round.</p><small>PLAY MONEY · RTP 96% IN EVERY MODE · MAX WIN '+cap+'×</small>';
 modal.showModal();
}
modal.querySelector('.close').onclick=()=>modal.close();
function setBet(value){
 if(busy||pending||autoplay.active||state.mode!=='base'||!stakes.includes(value))return;
 if(value!==bet){bet=value;state=start();draw(face,state.spots);save();labels()}
}
function toggleSound(){
 mute=!mute;if(!mute){audio??=new AudioContext();prepareFlightSound();tone(440)}save();labels();
}
function canResetBalance(){
 return !preview&&ready&&!busy&&!checkpoint&&!pending&&!autoplay.active&&state.mode==='base';
}
function confirmBalanceReset(){
 if(!canResetBalance())return;
 choices('Reset demo balance?',[
  ['Cancel',()=>{}],
  ['Reset to '+money(startingBalance),()=>{
   if(!canResetBalance())return;
   balance=startingBalance;save();labels();
   cabinetMessage('Demo balance reset to '+money(balance));
  }]
 ]);
}
function choices(title,items){
 const content=$('content');content.replaceChildren();const heading=document.createElement('h2');heading.textContent=title;content.append(heading);
 const row=document.createElement('div');row.className='choice-row';content.append(row);
 for(const [label,fn,selected,disabled=false] of items){const b=document.createElement('button');b.textContent=label;if(selected!==undefined)b.setAttribute('aria-pressed',String(selected));b.disabled=disabled;b.onclick=()=>{modal.close();fn()};row.append(b)}
 modal.showModal();
}
function action(name){
 if(!ready||winDemo||$('win-show').open||$('field-guide').open)return;
 if(document.body.classList.contains('preview-ready')){if(name==='play')$('preview-stinger').click();return}
 if(!mute&&audio?.state!=='running')prepareFlightSound();
 if(name==='sound'){toggleSound();return}
 if(name==='turbo'){turbo=!turbo;save();labels();return}
 if(name==='settings'){
  autoplay.stop();labels();choices('Control room',[
   [mute?'Sound off':'Sound on',toggleSound,!mute],[turbo?'Turbo on':'Turbo off',()=>action('turbo'),turbo],['Flight manual',()=>openFieldGuide($('field-guide')),undefined,busy||!!pending||state.mode!=='base'],['Game rules',showRules],
   ['Reset demo balance',confirmBalanceReset,undefined,!canResetBalance()]]);
  return;
 }
 if(name==='play'){if(busy)stop=true;else if(!autoplay.active&&(pending||state.mode==='base'))play();return}
 if(name==='auto'&&autoplay.active){autoplay.stop();labels();return}
 if(busy||pending||autoplay.active||state.mode!=='base')return;
 if(name==='betPlus'||name==='betMinus')setBet(stakes[stakes.indexOf(bet)+(name==='betPlus'?1:-1)]);
 if(name==='bet')choices('Choose a bet',stakes.map(v=>[money(v),()=>setBet(v),v===bet]));
 if(name==='auto')choices('Autoplay',AUTOPLAY_AMOUNTS.map(n=>[n+' spins',()=>{autoplay.start(n);play()}]));
 if(name==='buy'){if(featureMode){featureMode=null;save();labels();$('notice').textContent='Standard spins enabled.'}else showBonuses()}
}
modal.addEventListener('close',()=>{if(!modal.open)modal.classList.remove('shop');scheduleBonus()});
document.addEventListener('keydown',e=>{
 if(e.code!=='Space'||e.repeat||$('field-guide').open||winDemo||$('win-show').open||modal.open||shop.open||playStage.inert||e.composedPath().some(el=>el.tagName==='BUTTON'))return;
 e.preventDefault();action('play');
});
document.body.dataset.scene=state.mode;
labels();
void prepareHoney();
const loading=$('symbol-loading'),loadingMessage=loading.querySelector('[role=status]'),retry=loading.querySelector('button');
const showOpening=!preview && !pending && !bonusResult && state.mode==='base';
const ident=$('bee-ident');
ident.hidden=!showOpening;
const identHold=showOpening ? new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,reduced?1800:3950))) : Promise.resolve();
for(;;){
 try{await preloadSymbols();break}
 catch{
  ident.hidden=true;
  loadingMessage.textContent='Couldn’t load all symbols.';
  retry.hidden=false;
  await new Promise(resolve=>retry.addEventListener('click',resolve,{once:true}));
  retry.hidden=true;loadingMessage.textContent='Loading symbols…';
 }
}
draw(face,state.spots);grid.setAttribute('aria-busy','false');
loading.hidden=true;await identHold;ident.hidden=true;
if(showOpening) await openFieldGuide($('field-guide'));
ready=true;labels();
if(bonusResult){lock(true);await presentBonusResult();save();lock(false)}
if(state.left===10&&(state.mode==='super'||state.mode==='hidden')){
 lock(true);primeBoard().finally(()=>{lock(false);scheduleBonus()});
}else scheduleBonus();
if(pending){$('notice').textContent=modes[pending]+' unlocked · Press play to enter.';showAward()}

if(endDemo){
 const button=$('preview-stinger'),mode=params.get('mode');
 const demoMode=['regular','super','hidden'].includes(mode)?mode:'super';
 async function replay(){
  if(busy)return;
  button.hidden=true;document.body.classList.remove('preview-ready');
  previous=start();state=start(demoMode);win=0;bet=100;balance=startingBalance;
  let seed=42;
  const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  // Settle the first nine spins with the shipped rules; play the tenth on screen.
  while(state.left>1){
   const result=spin(state,rng);
   balance+=credit(state,result.amount,bet);state=result.state;face=result.board;
  }
  document.body.dataset.scene=demoMode;draw(face,state.spots);labels();
  await play(rng);
  button.textContent='Replay bonus ending';button.hidden=false;document.body.classList.add('preview-ready');
 }
 button.onclick=replay;void replay();
}else if(hiveDemo){
 const button=$('preview-stinger');let seed;
 const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 button.hidden=false;button.textContent='▶ Collect Wilds';document.body.classList.add('preview-ready');
 button.onclick=async()=>{
  if(busy)return;
  button.hidden=true;document.body.classList.remove('preview-ready');
  if(state.mode==='base'){
   seed=509;previous=start();state={...start('super'),left:2};face=sample;win=0;
   document.body.dataset.scene='super';draw(face,state.spots);labels();
  }
  await play(rng);
  button.textContent=state.mode==='super'?'▶ Release '+state.bank+' Wilds':'↻ Replay hive flights';
  button.hidden=false;document.body.classList.add('preview-ready');
 };
}else if(winDemo){
 document.querySelector('.camera-window').inert=true;
 $('controller').hidden=true;
 const gallery=document.querySelector('.win-gallery');gallery.hidden=false;
 const samples={nice:12.5,big:48,epic:160,mythic:850,max:25000};
 for(const [id,config] of Object.entries(tiers)){
  const choice=document.createElement('button');choice.type='button';choice.textContent=config.label;
  choice.onclick=()=>{if(!mute)prepareFlightSound();void winShow.show(id,Math.round(samples[id]*100),'Animation preview',{reduced,holdForReview:true})};
  gallery.append(choice);
 }
}else if(tumbleDemo){
 const button=$('preview-stinger');
 button.hidden=false;button.textContent='▶ Play 32× tumble';
 document.body.classList.add('preview-ready');
 button.onclick=async()=>{
  if(busy)return;
  button.hidden=true;document.body.classList.remove('preview-ready');
  state=start();face=sample;featureMode='full32';balance=startingBalance;bet=100;draw(face,state.spots);
  // Fixed demo only. The three wins and their payouts use the live spin rules.
  let seed=924;
  await play(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  button.textContent='↻ Replay 32× tumble · '+money(win)+' won';button.hidden=false;document.body.classList.add('preview-ready');
 };
}else if(preview){
 const button=$('preview-stinger'),replay=$('replay-stinger'),entry=purchaseEntry('super');
 replay.href=location.search;
 if(scatterDemo){
  button.textContent='▶ Play FS landing';replay.textContent='↻ Replay FS landing';
 }else{
  face=entry.board;draw(face,state.spots);
 }
 document.body.classList.add('preview-ready');button.hidden=false;replay.hidden=false;
 $('notice').textContent=scatterDemo?'Preview the free spins scatter sequence':'Swarm Protocol · Four FS landed';
 button.onclick=async()=>{
  button.hidden=true;document.body.classList.remove('preview-ready');mute=false;prepareFlightSound();
  if(scatterDemo){
   stop=false;lock(true);await showRoll(entry.board,state.spots,true);
   face=entry.board;draw(face,state.spots);lock(false);
  }
  pending='super';labels();await showAward();
 };
}
