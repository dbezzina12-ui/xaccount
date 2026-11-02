import {playStinger,flyHiveBees} from './drone-stinger.mjs?v=13';
import {mountMascot} from './mascot/mascot.mjs?v=5';
import {mountController} from './controller/controller.js';
import {Autoplay,AUTOPLAY_AMOUNTS} from './autoplay.js';
import {rollReels,symbolClass,symbolUrl} from './reels.mjs?v=14';
import {buys,features,modes,purchaseEntry,start,spin} from './rules.mjs?v=7';
const $=id=>document.getElementById(id);
const grid=$('board'),modal=$('menu'),intro=$('bonus-intro'),cabinet=grid.closest('.cab');
const playStage=$('play-stage');
const mascot=mountMascot($('mascot-stage'));
const desc={
 regular:'Start with an uncharged board. Any reel can land a Wild. Charged cells stay lit and double on repeat wins.',
 super:'Bank Wilds on spins 1–9. On spin 10, one bee flies out of the hive for each banked Wild and turns a cell Wild.',
 hidden:'Land a Wild every spin. Scout bees double up to three cells before wins pay. On spin 10, the hive releases your banked Wilds.'
};
const sample=['hive','K','nectar','stinger','Q','A','rotor','W','beacon','10','stinger','J','hive','K','nectar','10','beacon','Q','rotor','FS'];
const stakes=[10,20,40,60,80,100,150,200,300,400,500,750,1000,1500,2000,3000,4000,5000,7500,10000,15000,20000,25000,30000,40000,50000];
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const key='robobees-playtest-controller-v1';
const preview=new URLSearchParams(location.search).get('preview')==='stinger';
let saved;
try{if(!preview)saved=JSON.parse(localStorage.getItem(key)||'null')}catch{}
let state=saved?.state??start(),face=saved?.face??sample,previous=saved?.previous??null,pending=saved?.pending??null;
// Preserve earned multipliers in features saved under the previous rules.
if(state.mode==='super'||state.mode==='hidden')state.spots=state.spots.map(v=>Math.max(2,v));
let balance=saved?.balance??1000000,bet=saved?.bet??100,win=saved?.win??0,turbo=saved?.turbo??false,mute=saved?.mute??true;
let featureMode=Object.hasOwn(features,saved?.featureMode)?saved.featureMode:null;
const spinCost=()=>bet*(features[featureMode]?.price??1);
const shop=$('bonus-menu');
let busy=false,stop=false,audio,bonusTimer,checkpoint=null,flightBank=null;
const autoplay=new Autoplay();
const controller=mountController($('controller'),{onAction:action});
const skin=document.createElement('link');skin.rel='stylesheet';skin.href='controller/robobees.css';$('controller').shadowRoot.append(skin);
function save(){
 if(preview)return;
 const settled=checkpoint??{state,face,previous,pending,balance,win};
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
 c.firstChild.src=symbolUrl(id);c.firstChild.alt=id;c.lastChild.className='multi';c.lastChild.textContent=m?m+'×':'';c.lastChild.hidden=!m;c.lastChild.toggleAttribute('data-long',m>=100);
}
function draw(board,spots,hits=[]){cells.forEach((_,i)=>cell(i,board[i],spots,hits.includes(i)))}
function showFlightBank(n){
 flightBank=n;$('bank-count').textContent=String(n);
 mascot.setBank(n);
}
function labels(){
 const bonus=state.mode!=='base';
 mascot.setTurbo(turbo);
 $('mode').textContent=(bonus?modes[state.mode]:features[featureMode]?.label??modes.base).toUpperCase();
 $('meter').textContent=bonus?'BONUS ACTIVE':'20 PAYLINES';
 $('bonus-hud').hidden=!bonus;$('wild-dock').hidden=state.mode==='regular';
 $('spin-count').textContent=String(state.left);$('bank-count').textContent=String(flightBank??state.bank);
 controller.update({ready:true,busy,holding:bonus&&!busy,continuing:!!pending&&!busy,autoActive:autoplay.active,
  remaining:autoplay.remaining,muted:mute,turbo,balance:money(balance),bet:money(bonus?bet:spinCost()),win:money(win),buyActive:!!featureMode&&!bonus,
  canIncrease:bet<stakes.at(-1),canDecrease:bet>stakes[0],featureColor:bonus?'#ffa344':null});
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
async function hiveFlight(indices,collect,arrive){
 const dock=$('wild-dock');
 dock.classList.add('hive-active');
 try{
  await flyHiveBees({canvas:$('swarm-stinger'),hive:$('hive-port'),targets:indices.map(i=>cells[i]),
   collect,fast:turbo,skip:()=>stop||reduced,onArrival:n=>{
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
function lock(val){busy=val;labels()}
async function feature(mode){
 autoplay.stop();previous=state;state=start(mode);pending=null;win=0;stop=false;save();lock(true);
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
 await rollReels({cells,before:face,after:landing,spots,place:cell,turbo,reduced,purchased,skip:()=>stop,
  onTease:col=>{cabinet.classList.add('tease-zoom');grid.classList.add('anticipation');$('notice').textContent='Hive signal · Reel '+(col+1);tone(295+col*55,.30)},
  land:(col,scatters)=>{
   if(!scatters){tone(200+col*30,.06);return}
   count+=scatters;
   for(let i=col;i<20;i+=5)if(landing[i]==='FS')cells[i].classList.add('fs-land');
   tone(410*1.16**count,.22);
   $('notice').textContent=count+' FS landed'+(count===2?' · One more for free spins':'');
  }});
 if(count<3)cabinet.classList.remove('tease-zoom');
 grid.classList.remove('anticipation');
 if(count>=3){grid.classList.add('fs-awarded');await wait(320);grid.classList.remove('fs-awarded')}
}
function flyAcross(release,cut){
 return playStinger({canvas:$('swarm-stinger'),scatterCells:cells.filter(c=>c.classList.contains('scatter')),reduced,
  release,cut,sound:()=>droneCue(release?'release':'rush')});
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
  square.textContent=v?'2×':i>=5&&i<=7?'2×':'';
  if(square.textContent){square.classList.add('lit');square.dataset.multi=2}return square;
 }));
 $('charge-caption').textContent=mode==='regular'?'First win on a cell charges it to 2×':'Starting board · 20 cells at 2×';
 intro.dataset.tier=mode;
 playStage.inert=true;
 await mascot.depart();
 await flyAcross(false,()=>document.body.classList.add('present-award'));
 intro.inert=false;$('start-feature').focus({preventScroll:true});
}
$('start-feature').onclick=()=>{if(!busy&&pending){prepareFlightSound();feature(pending)}};
async function play(){
 if(busy){stop=true;return}
 if(pending){showAward();return}
 const bonus=state.mode!=='base';
 if(!bonus&&balance<spinCost()){autoplay.stop();$('notice').textContent='Insufficient demo balance for this bet.';labels();return}
 stop=false;const result=spin(state,Math.random,bonus?null:featureMode),oldBank=state.bank;
 const award=Math.round(result.amount*bet),finished=bonus&&result.state.left===0;
 if(!bonus)balance-=spinCost();
 win=0;checkpoint={state:finished?previous:result.state,face:result.board,previous:finished?null:previous,pending:result.trigger,balance:balance+award,win:award};save();lock(true);
 $('notice').textContent=result.finale?'Final spin · '+oldBank+' bees ready to deploy.':'Reels in motion…';tone(135,.14);
 await showRoll(result.landing,result.prior);

 if(result.state.bank>oldBank){
  const collected=result.landing.flatMap((id,i)=>id==='W'?[i]:[]);
  $('notice').textContent='Wild collected · Returning to hive';
  await hiveFlight(collected,true,(_,n)=>showFlightBank(oldBank+n+1));
 }
 if(result.boosts.length){
  $('notice').textContent='Scout bees · Charging '+result.boosts.length+' multiplier '+(result.boosts.length===1?'cell':'cells');
  await hiveFlight(result.boosts,false,i=>cell(i,result.landing[i],result.active));
  await showCellValues(result.boosts);
 }
 if(result.drops.length){
  $('notice').textContent='Hive release · '+result.drops.length+' Wilds incoming';
  await hiveFlight(result.drops,false,(i,n)=>{
   cell(i,'W',result.active);cells[i].classList.add('wild-landing');
   showFlightBank(oldBank-n-1);
  });await wait(180);
 }
 face=result.board;draw(face,result.active,result.hit);if(result.amount){tone(660,.19);await wait(340)}
 flightBank=null;state=result.state;draw(face,state.spots,result.hit);balance+=award;win=award;
 if(result.hit.length){labels();await showCellValues(result.hit)}
 const charge=result.hit.length?' · '+result.hit.length+' cells charged':'';
 $('notice').textContent=result.amount?result.wins.length+' winning '+(result.wins.length===1?'line':'lines')+charge:'No connection this spin.';
 if(state.bank>oldBank)$('notice').textContent+=' +'+(state.bank-oldBank)+' Wild'+(state.bank-oldBank>1?'s':'')+' banked.';
 if(result.trigger){autoplay.stop();pending=result.trigger;$('notice').textContent=modes[pending]+' unlocked · Press play to enter.'}
 if(state.mode!=='base'&&state.left===0){$('notice').textContent=modes[state.mode]+' complete · '+state.total.toFixed(2)+'× total';await wait(500);document.body.dataset.scene='base';state=previous??start();previous=null;draw(face,state.spots)}
 checkpoint=null;save();
 if(!bonus&&autoplay.active)autoplay.finishRound(play,turbo?180:500);
 lock(false);if(pending)showAward();else scheduleBonus();
}
function scheduleBonus(){
 clearTimeout(bonusTimer);
 if(!busy&&!modal.open&&!playStage.inert&&state.mode!=='base')bonusTimer=setTimeout(()=>{if(!modal.open&&!playStage.inert&&!busy)play()},turbo?300:740);
}
const shopCopy={
 regular:'10 free spins. Winning cells build multipliers that stay for the bonus.',
 super:'10 free spins. All 20 cells start at 2×. Collected Wilds return on the final spin.',
 mystery:'10 free spins in a random bonus. Regular 50% · Super 40% · Hidden 10%.'
};
function showBonuses(section='buys'){
 const isBuy=section==='buys';
 shop.querySelector('h2').textContent=isBuy?'Bonus buys':'Feature spins';
 shop.querySelector('.shop-balance strong').textContent=money(balance);
 shop.querySelector('.shop-stake strong').textContent=money(bet);
 shop.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.tab===section));b.onclick=()=>showBonuses(b.dataset.tab)});
 shop.querySelectorAll('.shop-bet-steps button').forEach((b,i)=>{const v=stakes[stakes.indexOf(bet)+(i?1:-1)];b.disabled=v===undefined;b.onclick=()=>{setBet(v);showBonuses(section)}});
 const cards=shop.querySelector('.bonus-cards');cards.replaceChildren();
 for(const [id,item] of Object.entries(isBuy?buys:features)){
  const card=document.createElement('article'),cost=bet*item.price,active=!isBuy&&featureMode===id;
  card.className='bonus-card';card.dataset.mode=id;
  const eyebrow=isBuy?({regular:'3 FS · REGULAR BONUS',super:'4 FS · SUPER BONUS',mystery:'MYSTERY BONUS'}[id]):item.type.toUpperCase();
  const caption=isBuy?'10 FREE SPINS':'PER PAID SPIN';
  card.innerHTML='<div class="card-content"><span class="purchase-eyebrow">'+eyebrow+'</span><div class="card-emblem"><img alt="" src="'+symbolUrl(item.art)+'"></div><h3>'+item.label+'</h3><p>'+(isBuy?shopCopy[id]:item.copy)+'</p><small>'+caption+'</small><div class="card-price"><strong>'+money(cost)+'</strong><span>'+item.price+'× BASE BET</span></div></div><button class="card-action"></button>';
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
 modal.close();balance-=cost;pending=entry.mode;stop=false;win=0;
 checkpoint={state,face:entry.board,previous,pending,balance,win};save();lock(true);
 $('notice').textContent='Bonus purchased · Landing FS';await showRoll(entry.board,state.spots,true);
 face=entry.board;draw(face,state.spots);checkpoint=null;save();lock(false);
 $('notice').textContent=modes[pending]+' unlocked · Press play to enter.';showAward();
}
function showRules(){$('content').innerHTML='<h2>Field manual</h2><p>Land three or more matching symbols from reel one on any of 20 fixed paylines. W substitutes for paying symbols. FS scatters trigger Regular, Super or Hidden with 3, 4 or 5 respectively. Signal Boost costs 3× the base bet per spin and increases the scatter chance per reel from 7.5% to 11.5%. Scout Run costs 10× and guarantees at least one Wild per paid spin. Both modes pay wins on the base bet.</p><p>Winning cells become 2× on the next spin. Repeat hits double up to 128×. Add the active cell values along each winning line. Shared cells level up once per spin. Brighter cells hold higher multipliers.</p><ul class="multi-key" aria-label="Cell multiplier colours">'+[2,4,8,16,32,64,128].map(n=>'<li data-multi="'+n+'">'+n+'×</li>').join('')+'</ul><p>In base play a charge lasts through the next spin. During free spins it persists until the bonus ends. Super and Hidden start with 2× on every cell. Hidden guarantees a Wild every spin and sends bees to double up to three cells before scoring. Free spins advance automatically. Stop finishes only the spin in progress.</p><small>PLAY-MONEY MECHANICS BUILD · UNTUNED RETURNS</small>';modal.showModal()};
modal.querySelector('.close').onclick=()=>modal.close();
function setBet(value){
 if(busy||pending||autoplay.active||state.mode!=='base'||!stakes.includes(value))return;
 if(value!==bet){bet=value;state=start();draw(face,state.spots);save();labels()}
}
function toggleSound(){
 mute=!mute;if(!mute){audio??=new AudioContext();prepareFlightSound();tone(440)}save();labels();
}
function choices(title,items){
 const content=$('content');content.replaceChildren();const heading=document.createElement('h2');heading.textContent=title;content.append(heading);
 const row=document.createElement('div');row.className='choice-row';content.append(row);
 for(const [label,fn,selected] of items){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-pressed',String(!!selected));b.onclick=()=>{modal.close();fn()};row.append(b)}
 modal.showModal();
}
function action(name){
 if(!mute&&audio?.state!=='running')prepareFlightSound();
 if(name==='sound'){toggleSound();return}
 if(name==='turbo'){turbo=!turbo;save();labels();return}
 if(name==='settings'){
  autoplay.stop();labels();choices('Control room',[
   [mute?'Sound off':'Sound on',toggleSound,!mute],[turbo?'Turbo on':'Turbo off',()=>action('turbo'),turbo],['Game rules',showRules]]);
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
 if(e.code!=='Space'||e.repeat||modal.open||shop.open||playStage.inert||e.composedPath().some(el=>el.tagName==='BUTTON'))return;
 e.preventDefault();action('play');
});
document.body.dataset.scene=state.mode;
mascot.setBank(state.mode==='base'?0:state.bank,{animate:false});
draw(face,state.spots);labels();
if(state.left===10&&(state.mode==='super'||state.mode==='hidden')){
 lock(true);primeBoard().finally(()=>{lock(false);scheduleBonus()});
}else scheduleBonus();
if(pending){$('notice').textContent=modes[pending]+' unlocked · Press play to enter.';showAward()}

if(preview){
 // The replay uses the exact award path, separate from the saved playtest.
 const entry=purchaseEntry('super');
 face=entry.board;draw(face,state.spots);pending='super';labels();
 document.body.classList.add('preview-ready');$('preview-stinger').hidden=false;$('replay-stinger').hidden=false;
 $('notice').textContent='Swarm Protocol · Four FS landed';
 $('preview-stinger').onclick=()=>{
  mute=false;prepareFlightSound();
  $('preview-stinger').hidden=true;document.body.classList.remove('preview-ready');showAward();
 };
}
