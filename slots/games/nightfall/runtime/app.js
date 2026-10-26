import {RULES,SYMBOLS,PAYTABLE,seedRng,createBoard,generateRound,multiplier} from './engine.js';
import {symbolArt,symbolNames,symbolAssets} from './symbols.js';
import {CourtKnight} from './nightfall-actors.js';
import {CourtArcher,CourtMage} from './nightfall-actors.js';
import {ArrowTrail} from './arrow-trail.js';
import {ReelMotion} from './reel-motion.js';
import {mountController} from './controller/controller.js';
import {GameAudio} from './audio.js';

const $=id=>document.getElementById(id),money=n=>'$'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),KEY='nightfall-session-v1';
const stakes=[20,40,60,80,100,200,400,500,1000,2000,5000,10000];
let stored;try{stored=JSON.parse(localStorage.getItem(KEY));}catch{}
const state={balance:Number.isSafeInteger(stored?.balance)&&stored.balance>=0?stored.balance:1000000,bet:stakes.includes(stored?.bet)?stored.bet:100,feature:!!stored?.feature,turbo:!!stored?.turbo,muted:!!stored?.muted,busy:false,ready:false,auto:0,win:0,visualBalance:null,bonus:false,skip:false,history:Array.isArray(stored?.history)?stored.history.slice(0,15):[]};
const audio=new GameAudio();audio.setMuted(state.muted);let knight=null,archer=null,reelMotion=null,menuPage='',splashResolve=null,celebrationResolve=null,toastTimer=null,board=[],marks=Array(49).fill(0),roundBase=state.bet,displayUnits=0;
const arrowTrail=new ArrowTrail($('arrow-effects'));
function persist(){try{localStorage.setItem(KEY,JSON.stringify({balance:state.balance,bet:state.bet,feature:state.feature,turbo:state.turbo,muted:state.muted,history:state.history}));}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
const controller=mountController($('controller'),{initial:{balance:money(state.balance),bet:money(state.bet),win:money(0)},onAction:handleAction});
function update(){if(!state.busy)$('mode-name').textContent=state.feature?'REAPER STRIKE ACTIVE':'THE GRAVEYARD';controller.update({ready:state.ready,busy:state.busy,autoActive:state.auto>0,remaining:state.auto,balance:money(state.visualBalance??state.balance),bet:money(state.bet*(state.feature?RULES.featureCost:1)),win:money(state.win),turbo:state.turbo,muted:state.muted,buyActive:state.feature,featureColor:state.feature?'#e9c56f':null,canDecrease:state.bet>stakes[0],canIncrease:state.bet<stakes.at(-1)});$('mode-detail').textContent=state.feature?`REAPER STRIKE ACTIVE · BASE BET ${money(state.bet)} · SPIN ${money(state.bet*RULES.featureCost)}`:'7 × 7 CLUSTERS · MULTIPLIER TILES';}
function makeCells(){const frag=document.createDocumentFragment();for(let i=0;i<49;i++){const cell=document.createElement('div');cell.className='cell';cell.dataset.index=i;cell.innerHTML='<span class="symbol"></span><span class="multi" hidden></span>';frag.appendChild(cell);}$('board').appendChild(frag);}
const cells=[];
function renderGrid(next,hits=marks){
 board=next.slice();marks=hits.slice();
 for(let i=0;i<49;i++){const cell=cells[i],multi=multiplier(marks[i]);cell.className=`cell ${marks[i]===1?'marked':''} ${multi?'multiplied':''} ${multi>=32?'hot':''} ${multi>=256?'superhot':''}`;cell.dataset.kind=board[i];cell.querySelector('.symbol').innerHTML=symbolArt(board[i]);const label=cell.querySelector('.multi');label.hidden=!multi;label.textContent=multi?multi+'×':'';}
 $('top-tile').textContent=Math.max(1,...marks.map(multiplier))+'×';
 $('board').setAttribute('aria-label',`7 by 7 grid. ${board.filter(x=>x==='fs').length} free-spin tombstones. Highest multiplier ${Math.max(1,...marks.map(multiplier))}.`);
}
function refreshMarks(next){marks=next.slice();for(let i=0;i<49;i++){const cell=cells[i],multi=multiplier(marks[i]);cell.classList.toggle('marked',marks[i]===1);cell.classList.toggle('multiplied',multi>0);cell.classList.toggle('hot',multi>=32);cell.classList.toggle('superhot',multi>=256);const label=cell.querySelector('.multi');label.hidden=!multi;label.textContent=multi+'×';}$('top-tile').textContent=Math.max(1,...marks.map(multiplier))+'×';}
async function delay(ms,{unskippable=false}={}){let elapsed=0,last=performance.now();while(elapsed<(state.skip&&!unskippable?20:state.turbo&&!unskippable?ms*.28:ms)){await new Promise(r=>setTimeout(r,25));const now=performance.now();if(!$('menu').open&&!document.hidden)elapsed+=now-last;last=now;}}
async function waitMenus(){while($('menu').open||document.hidden)await new Promise(r=>setTimeout(r,50));}
function status(text){$('status').textContent=text;}
function boardToast(text){const el=$('board-toast');el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function freshRng(){const seed=new Uint32Array(1);crypto.getRandomValues(seed);return seedRng(seed[0]);}
function setBet(value){if(state.busy||state.auto)return;state.bet=value;persist();update();audio.play('coin-up',.3);}
function closeMenu(){$('menu').close();menuPage='';}
function openMenu(page='features'){
 if(!state.ready)return;state.auto=0;update();menuPage=page;
 const titles={features:'Choose your adventure',bonuses:'Choose your adventure',settings:'Game settings',rules:'How to play',bet:'Choose your bet',auto:'Autoplay',history:'Recent rounds'};
 $('menu-title').textContent=titles[page];const content=$('menu-content');
 if(page==='features'||page==='bonuses'){
  const locked=state.busy?'disabled':'';
  content.innerHTML=`<div class="tabs"><button data-page="features" class="tab ${page==='features'?'active':''}">Feature spins</button><button data-page="bonuses" class="tab ${page==='bonuses'?'active':''}">Bonus buys</button></div>${state.busy?'<p class="menu-copy">This round is in progress. Purchases become available after it settles.</p>':''}`;
  if(page==='features')content.innerHTML+=`<div class="feature-card"><div class="feature-emblem"><img src="assets/symbols/wild.webp" alt=""></div><div><h3>Reaper Strike</h3><p>One guaranteed strike after the normal tumbles. Turns 3–5 cells wild.</p><span class="price">${RULES.featureCost}× base bet · ${money(state.bet*RULES.featureCost)} per spin</span></div><button class="primary" data-feature ${locked}>${state.feature?'DISABLE':'ACTIVATE'}</button></div><p class="menu-copy">Stays active until you disable it. Base bet ${money(state.bet)}; winnings use the base bet. Scatters can still trigger free spins.</p>`;
  else content.innerHTML+=`<div class="feature-card"><div class="feature-emblem">${symbolArt('fs')}</div><div><h3>Free Spins</h3><p>10 spins. Multiplier tiles stay in place. More frequent Reaper Strikes and Arrow Trails.</p><span class="price">${RULES.bonusCost}× base bet</span></div><button class="primary" data-buy="regular" ${locked}>${money(state.bet*RULES.bonusCost)}</button></div><div class="feature-card super"><div class="feature-emblem"><img src="assets/symbols/crown.webp" alt=""></div><div><h3>Super Free Spins</h3><p>10 spins. Every tile starts at 2×. Cross-cut attacks with a chance of a Soul Harvest.</p><span class="price">${RULES.superCost}× base bet</span></div><button class="primary" data-buy="super" ${locked}>${money(state.bet*RULES.superCost)}</button></div><p class="prototype-note">Playtest prices. Payouts are being tuned; no real money is used.</p>`;
 }else if(page==='settings')content.innerHTML=`<div class="setting-row"><div><strong>Sound effects</strong><small>GG win sounds and game effects</small></div><button data-sound>${state.muted?'OFF':'ON'}</button></div><div class="setting-row"><div><strong>Effects volume</strong></div><input aria-label="Effects volume" id="volume" type="range" min="0" max="1" step=".05" value="${audio.volume}"></div><div class="setting-row"><div><strong>Turbo</strong><small>Faster spins and tumbles</small></div><button data-turbo>${state.turbo?'ON':'OFF'}</button></div><div class="setting-row"><div><strong>Feature spins</strong><small>${state.feature?'Reaper Strike is active':'Standard spins'}</small></div><button data-page="features">MANAGE</button></div><div class="settings-actions"><button class="secondary" data-page="rules">GAME RULES</button><button class="secondary" data-page="history">HISTORY</button><button class="secondary" data-fullscreen>FULLSCREEN</button><button class="secondary" data-refill ${state.busy?'disabled':''}>REFILL CREDITS</button></div><p class="prototype-note">Night Fall v1.0 · Prototype math, not a certified RTP. Credits have no cash value.</p>`;
 else if(page==='bet')content.innerHTML=`<p class="menu-copy">${state.feature?`Reaper Strike costs ${RULES.featureCost}× the selected base bet.`:'Select a base bet.'}</p><div class="choice-grid">${stakes.map(n=>`<button data-stake="${n}" class="${n===state.bet?'selected':''}">${money(n)}</button>`).join('')}</div>`;
 else if(page==='auto')content.innerHTML=`<p class="menu-copy">Choose paid rounds. Free spins complete within their triggering round. Open the menu or press Auto again to stop after the current round.</p><div class="choice-grid">${[10,25,50,100,1000].map(n=>`<button data-auto="${n}">${n}</button>`).join('')}</div>`;
 else if(page==='history')content.innerHTML=state.history.length?`<div>${state.history.map(h=>`<div class="setting-row"><div><strong>${h.mode==='base'?'Standard spin':h.mode==='feature'?'Reaper Strike':h.mode==='super'?'Super Free Spins':'Free Spins'}</strong><small>${new Date(h.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · Cost ${money(h.cost)}</small></div><strong>${money(h.win)}</strong></div>`).join('')}</div>`:'<p class="menu-copy">Your completed rounds will appear here.</p>';
 else content.innerHTML=`<ul class="rule-list"><li><b>Connect 5 or more</b> matching symbols horizontally or vertically. Diagonals do not connect. Wins disappear and new symbols tumble in.</li><li><b>Forge multiplier tiles.</b> A first win marks the cell; a second activates 2×. Further wins double it up to 1,024×. The upgraded multipliers in a cluster add together and multiply its symbol payout. Cells upgrade once per tumble, even if a wild joins several clusters.</li><li><b>Reaper Strike.</b> After normal tumbles finish, the reaper can turn 3–5 cells into wilds. Wilds substitute for all paying symbols and may join different symbol clusters. At least one matching regular symbol is required. Scatters are never replaced. One strike opportunity per spin; unused wilds expire when the next spin starts.</li><li><b>Arrow Trail.</b> The skeleton archer can fire through 3–5 horizontal cells after tumbles in standard and regular free spins. Each tile becomes an arrow wild as the arrow passes. Arrow wilds substitute exactly like scythe wilds. FS tombstones stay untouched. The two characters share one attack opportunity per spin; guaranteed Reaper Strike spins and Super cross-cuts stay with the reaper.</li><li><b>Free Spins.</b> 3 / 4 / 5 / 6 / 7+ FS tombstones award 10 / 12 / 15 / 20 / 30 spins. The same counts retrigger in the bonus. Multiplier tiles stay for the entire bonus.</li><li><b>Super Free Spins.</b> All cells start at 2×. A cross-cut replaces the usual slash: center plus up to four adjoining cells. A gold Soul Harvest additionally upgrades affected cells by one multiplier level before wins are evaluated.</li><li><b>Maximum total round win:</b> 25,000× base bet, including all free spins. Reaching the limit ends the round. Base-game tiles reset on the next paid spin.</li></ul><p class="menu-copy">Sample paytable below, in multiples of base bet before tile multipliers. Full cluster sizes 5–15+ scale between these entries.</p><table class="paytable"><thead><tr><th>Symbol</th><th>5</th><th>8</th><th>10</th><th>15+</th></tr></thead><tbody>${SYMBOLS.map((s,i)=>`<tr><td><span class="symbol-mini">${symbolArt(s)}</span>${symbolNames[s]}</td>${[0,3,5,10].map(j=>`<td>${+(PAYTABLE[i][j]*RULES.payScale).toFixed(3)}×</td>`).join('')}</tr>`).join('')}</tbody></table><p class="prototype-note">This is a locally simulated playtest with development math. No certified return percentage or maximum-win probability is claimed.</p>`;
 if(!$('menu').open)$('menu').showModal();
}
function handleAction(action){
 void audio.unlock();
 if(action==='settings'){openMenu('settings');return;}
 if(action==='sound'){state.muted=!state.muted;audio.setMuted(state.muted);persist();update();return;}
 if(action==='turbo'){state.turbo=!state.turbo;persist();update();return;}
 if(action==='play'){if(state.busy){state.skip=true;state.auto=0;if(splashResolve)splashResolve();if(celebrationResolve)celebrationResolve();update();}else void startRound();return;}
 if(action==='auto'){if(state.auto){state.auto=0;update();}else if(!state.busy)openMenu('auto');return;}
 if(state.busy)return;
 if(action==='buy'){audio.play('buy-bonus-button',.7);if(state.feature){state.feature=false;persist();update();toast('Standard spins enabled');}else openMenu('features');}
 if(action==='bet')openMenu('bet');
 if(action==='betMinus')setBet(stakes[Math.max(0,stakes.indexOf(state.bet)-1)]);
 if(action==='betPlus')setBet(stakes[Math.min(stakes.length-1,stakes.indexOf(state.bet)+1)]);
}
$('menu-content').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.page){openMenu(b.dataset.page);return;}
 if(b.hasAttribute('data-feature')){if(state.busy)return;state.feature=!state.feature;persist();update();closeMenu();toast(state.feature?'Reaper Strike is active until disabled':'Standard spins enabled');}
 if(b.dataset.buy){if(state.busy)return;const mode=b.dataset.buy,cost=state.bet*(mode==='super'?RULES.superCost:RULES.bonusCost);if(state.balance<cost){toast('Not enough playtest credits. Refill from Settings.');return;}$('menu-title').textContent='Enter the bonus?';$('menu-content').innerHTML=`<div class="feature-card ${mode==='super'?'super':''}"><div class="feature-emblem"><img src="assets/symbols/wild.webp" alt=""></div><div><h3>${mode==='super'?'Super Free Spins':'Free Spins'}</h3><p>10 spins · Base bet ${money(state.bet)}</p><span class="price">Playtest balance after purchase: ${money(state.balance-cost)}</span></div></div><button class="primary" style="width:100%" data-confirm-buy="${mode}">BUY FOR ${money(cost)}</button><button class="secondary" style="width:100%;margin-top:10px" data-page="bonuses">BACK</button>`;}
 if(b.dataset.confirmBuy){const mode=b.dataset.confirmBuy;closeMenu();void startRound(mode);}
 if(b.dataset.stake){setBet(Number(b.dataset.stake));closeMenu();}
 if(b.dataset.auto){state.auto=Number(b.dataset.auto);closeMenu();update();void startRound();}
 if(b.hasAttribute('data-sound')){handleAction('sound');openMenu('settings');}
 if(b.hasAttribute('data-turbo')){handleAction('turbo');openMenu('settings');}
 if(b.hasAttribute('data-refill')&&!state.busy){state.balance=1000000;persist();update();toast('Playtest balance refilled to $10,000.00');}
 if(b.hasAttribute('data-fullscreen')){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable on this device.'));}
});
$('menu-content').addEventListener('input',e=>{if(e.target.id==='volume')audio.setVolume(Number(e.target.value));});
$('help').addEventListener('click',()=>openMenu('rules'));$('close-menu').addEventListener('click',closeMenu);
$('menu').addEventListener('click',e=>{if(e.target===$('menu')){const r=$('menu').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMenu();}});
document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||$('menu').open||$('intro').open||e.composedPath().some(x=>/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(x.tagName)))return;e.preventDefault();if(splashResolve)splashResolve();else if(celebrationResolve)celebrationResolve();else handleAction('play');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.auto=0;audio.stopAll();update();}});

async function splash({title,value,copy,eyebrow='THE GRAVEYARD AWAITS',button='CONTINUE →'}){
 await waitMenus();$('splash-title').textContent=title;$('splash-value').textContent=value;$('splash-copy').textContent=copy;$('splash-eyebrow').textContent=eyebrow;$('splash-continue').textContent=button;
 if(state.skip)return;
 $('splash').showModal();await new Promise(resolve=>{splashResolve=()=>{$('splash').close();splashResolve=null;resolve();};});
}
$('splash-continue').addEventListener('click',()=>splashResolve?.());$('splash').addEventListener('cancel',e=>{e.preventDefault();splashResolve?.();});
function restoreKnight(){knight?.idle();archer?.idle();arrowTrail.clear();}
async function arrowPresentation(e){
 status('');
 const fromLeft=archer.releasePoint().x<innerWidth/2,farIndex=fromLeft?Math.max(...e.cells):Math.min(...e.cells),farCell=cells[farIndex]?.getBoundingClientRect();
 const target=farCell?{x:farCell.left+farCell.width/2,y:farCell.top+farCell.height/2}:null;
 const origin=await archer.shoot({target,turbo:state.turbo,paused:()=>$('menu').open||document.hidden,skip:()=>state.skip});
 await waitMenus();audio.bow();
 await arrowTrail.play({origin,cells:e.cells.map(index=>({index,element:cells[index]})),turbo:state.turbo,skip:()=>state.skip,paused:()=>$('menu').open||document.hidden,onHit:index=>{
  board[index]=e.board[index];const cell=cells[index];cell.dataset.kind=board[index];cell.querySelector('.symbol').innerHTML=symbolArt(board[index]);cell.classList.add('arrow-forged');audio.play('multi-appears',.14);
 }});
 renderGrid(e.board,e.hits);for(const i of e.cells)cells[i].classList.add('arrow-forged');await delay(350);
}
async function strikePresentation(e){
 status('');
 document.body.classList.add('striking');
 if(knight&&!state.skip)await knight.strike({turbo:state.turbo,cross:e.cross,gold:e.gold});
 else await delay(200);
 await waitMenus();audio.slash();
 const rows=new Map(),cols=new Map();for(const i of e.cells){const r=Math.floor(i/7),c=i%7;if(!rows.has(r))rows.set(r,[]);rows.get(r).push(c);if(!cols.has(c))cols.set(c,[]);cols.get(c).push(r);}
 let paths='';const draw=(x1,y1,x2,y2)=>{const d=`M${x1} ${y1}L${x2} ${y2}`;return `<path class="strike-line glow" d="${d}"/><path class="strike-line" d="${d}"/>`;};
 for(const[r,cs]of rows)if(cs.length>1)paths+=draw(Math.min(...cs)*100+15,r*100+50,Math.max(...cs)*100+85,r*100+50);
 for(const[c,rs]of cols)if(rs.length>1)paths+=draw(c*100+50,Math.min(...rs)*100+15,c*100+50,Math.max(...rs)*100+85);
 $('strike-fx').innerHTML=paths;$('board-shell').classList.remove('impact');void $('board-shell').offsetWidth;$('board-shell').classList.add('impact');
 renderGrid(e.board,e.hits);for(const i of e.cells)cells[i].classList.add('forged');audio.play('multi-appears',.35);await delay(650);$('strike-fx').replaceChildren();document.body.classList.remove('striking');
}
async function celebrate(units){
 if(units<10||state.skip)return;
 const tier=units>=RULES.maxWin?'max':units>=100?'epic':units>=40?'big':'nice';
 $('win-title').textContent=tier.toUpperCase()+' WIN';$('win-value').textContent=money(0);$('win-overlay').hidden=false;const source=audio.play(tier+'-win',.8);const final=Math.round(units*roundBase),duration=state.turbo?1800:tier==='max'?6500:tier==='epic'?5200:3800;
 let finished=false;await new Promise(resolve=>{
  let elapsed=0,last=performance.now(),frame;
  celebrationResolve=()=>{if(!finished){finished=true;$('win-value').textContent=money(final);return;}cancelAnimationFrame(frame);celebrationResolve=null;$('win-overlay').hidden=true;try{source?.stop();}catch{}resolve();};
  const tick=now=>{if(!$('menu').open&&!document.hidden)elapsed+=now-last;last=now;const progress=elapsed/duration,p=Math.min(1,progress);if(!finished)$('win-value').textContent=money(Math.round(final*(1-(1-p)**2)));if(p>=1&&!finished){finished=true;$('win-value').textContent=money(final);}if(progress>=1.35){celebrationResolve?.();return;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 });
}
$('win-overlay').addEventListener('click',()=>celebrationResolve?.());
$('splash-settings').addEventListener('click',()=>openMenu('settings'));
$('win-settings').addEventListener('click',e=>{e.stopPropagation();openMenu('settings');});
async function present(events){
 for(const e of events){
  await waitMenus();
  if(e.type==='drop'){
   await reelMotion.leave(board);renderGrid(e.board,e.hits);await reelMotion.fall(e.board,null,{initial:true});const scatterCells=e.board.flatMap((kind,i)=>kind==='fs'?[i]:[]),scatters=scatterCells.length;
   if(scatters){audio.play('fs-landing',.5);for(const i of scatterCells)cells[i].classList.add('winning');if(scatters>=2)status(scatters>=3?'THE GRAVES OPEN':'ONE MORE FS…');await Promise.all([reelMotion.scatters(scatterCells,{trigger:scatters>=3}),delay(scatters>=3?600:scatters>=2?450:140)]);for(const i of scatterCells)cells[i].classList.remove('winning');}else await delay(140);
  }else if(e.type==='win'){
   refreshMarks(e.hits);for(const i of e.positions)cells[i].classList.add('winning');displayUnits+=e.total;state.win=Math.round(displayUnits*roundBase);update();$('bonus-total').textContent=money(state.win);
   const biggest=[...e.wins].sort((a,b)=>b.pay-a.pay)[0];status(`${biggest.cells.length} ${symbolNames[biggest.symbol].toUpperCase()}${biggest.multiplier>1?' · '+biggest.multiplier+'×':''}  +${money(Math.round(e.total*roundBase))}`);
   audio.play(e.wins.some(w=>w.multiplier>1)?'multi-increase':'regular-win',.32);await delay(500);for(const i of e.positions)cells[i].classList.add('clearing');await delay(180);
  }else if(e.type==='tumble'){renderGrid(e.board,e.hits);await reelMotion.fall(e.board,e.falls);await reelMotion.scatters(e.board.flatMap((kind,i)=>kind==='fs'&&e.falls[i]>0?[i]:[]));await delay(120);}
  else if(e.type==='strike')await strikePresentation(e);
  else if(e.type==='arrow')await arrowPresentation(e);
  else if(e.type==='bonusStart'){
   state.bonus=true;$('bonus-total').textContent=money(state.win);document.body.classList.add('bonus');document.body.classList.toggle('super-bonus',e.mode==='super');$('mode-name').textContent=e.mode==='super'?'SOUL HARVEST':'FREE SPINS';$('bonus-rail').hidden=false;$('fs-left').textContent=e.count;audio.play('bonus-trigger',.6);
   await splash({title:e.mode==='super'?'SUPER FREE SPINS':'FREE SPINS',value:String(e.count),copy:e.mode==='super'?'Every tile starts at 2×. Cross-cut strikes are unlocked.':'Your multiplier tiles stay for the whole bonus.',button:'WAKE THE DEAD →'});
  }else if(e.type==='freeSpin'){$('fs-left').textContent=e.remaining+1;status(`FREE SPIN ${e.number}`);audio.play('free-spin-start',.2);await delay(230);}
  else if(e.type==='retrigger'){audio.play('bonus-trigger',.4);boardToast(`+${e.count} FREE SPINS`);$('fs-left').textContent=e.remaining;await delay(950);}
  else if(e.type==='bonusEnd'){
   $('fs-left').textContent='0';await celebrate(e.total);knight?.salute();
   await splash({title:e.capped?'MAXIMUM WIN':'THE DEAD REST AGAIN',value:money(Math.round(e.total*roundBase)),copy:`${e.played} free spins completed`,eyebrow:'TOTAL ROUND WIN',button:'RETURN TO THE GRAVEYARD →'});
  }
 }
}
async function startRound(requested){
 if(!state.ready||state.busy||$('intro').open||$('menu').open)return;
 const mode=requested|| (state.feature?'feature':'base'),factor={base:1,feature:RULES.featureCost,regular:RULES.bonusCost,super:RULES.superCost}[mode],cost=state.bet*factor;
 if(state.balance<cost){state.auto=0;update();toast('Not enough credits. Refill from Settings.');return;}
 let round;try{round=generateRound({rng:freshRng(),mode});}catch(e){console.error(e);state.auto=0;update();toast('The round could not start. No credits were spent.');return;}
 state.busy=true;state.skip=false;roundBase=state.bet;displayUnits=0;state.win=0;state.bonus=false;state.visualBalance=state.balance-cost;
 // Commit the entire result once before animation. Reload never loses an already generated reward.
 const award=Math.round(round.total*roundBase);state.balance=state.balance-cost+award;state.history.unshift({at:Date.now(),mode,cost,win:award});state.history=state.history.slice(0,15);persist();update();
 document.body.classList.remove('bonus','super-bonus');$('bonus-rail').hidden=true;$('mode-name').textContent=state.feature&&!requested?'REAPER STRIKE ACTIVE':'THE GRAVEYARD';status('THE REELS ARE IN MOTION');await audio.unlock();
 try{await present(round.events);if(!round.bonusMode)await celebrate(round.total);}catch(e){console.error(e);toast('Presentation interrupted. Your result has been credited.');}
 finally{state.win=award;state.visualBalance=null;state.busy=false;state.bonus=false;state.skip=false;document.body.classList.remove('striking','bonus','super-bonus');$('bonus-rail').hidden=true;$('mode-name').textContent=state.feature?'REAPER STRIKE ACTIVE':'THE GRAVEYARD';$('strike-fx').replaceChildren();restoreKnight();update();status(round.total>0?`ROUND WIN ${money(award)}`:'The graveyard is waiting');if(state.auto>0){state.auto--;update();if(state.auto>0){await delay(750,{unskippable:true});if(state.auto>0&&!$('menu').open&&!document.hidden)void startRound();}}}
}
async function boot(){
 $('intro-fs-art').innerHTML=symbolArt('fs');makeCells();cells.push(...$('board').children);reelMotion=new ReelMotion($('board'),cells,{paused:()=>document.hidden||$('menu').open,skip:()=>state.skip,turbo:()=>state.turbo,onLand:()=>audio.play('reel-landing-1',.3)});renderGrid(createBoard(seedRng(413021),false),marks);update();$('load-progress').style.width='28%';
 const assetPaths=['assets/nightfall/background.webp','assets/nightfall/background.webp','assets/nightfall/title.webp',...symbolAssets];
 const assets=assetPaths.map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.decode().then(resolve).catch(resolve);img.onerror=()=>reject(new Error('Could not load '+src));img.src=src;}));
 knight=new CourtKnight($('knight-stage'));
 // `?archer=mage`: the skeleton mage in the archer's place (candidate).
 archer=new (new URLSearchParams(location.search).get('archer')==='mage'?CourtMage:CourtArcher)($('archer-stage'));
 $('load-progress').style.width='55%';
 try{await Promise.all([...assets,knight.load(),archer.load(),audio.preload(),document.fonts.ready]);}catch(e){console.error(e);$('load-message').textContent='An artwork file could not load. Refresh to retry.';return;}
 $('load-progress').style.width='100%';state.ready=true;update();
 await new Promise(r=>setTimeout(r,250));$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),500);
 let skip=false;try{skip=localStorage.getItem('nightfall-skip-intro')==='yes';}catch{}if(!skip)$('intro').showModal();
}
$('enter').addEventListener('click',()=>{void audio.unlock();try{localStorage.setItem('nightfall-skip-intro',$('skip-intro').checked?'yes':'no');}catch{}$('intro').close();});
$('intro').addEventListener('cancel',()=>void audio.unlock());
globalThis.NightFall={state,controller,get board(){return board.slice();},get actors(){return {reaper:knight,archer};},spin:startRound,action:handleAction};
void boot();
