import {shopGroups} from './feature-menu.js?v=ante124';
import {mountController} from './controller/controller.js?v=deck117';
import {mountCabinetFit} from './cabinet-fit.js?v=layout119';
import {bonusEntryEvent} from './bonus-entry.js?v=72';
import {createSpinResultGate} from './spin-result.js?v=71';
import {isGodUpgrade,presentGodUpgrade} from './god-upgrade.js?v=102';
import {mountSceneCharacters} from './scene-characters.js?v=107';
import {preloadDuelClips} from './duel-motion.js?v=96';
import {mountDuelIdleLights} from './duel-idle.js?v=100';
import {createSpinCounter} from './spin-counter.js?v=50';
import {mountIntroGuide} from './intro-guide.js?v=foundry';
import {mountGameAnimation} from './animation/game-animation.mjs?v=orbit122';
let gameAnimation;
let closeIntroGuide=()=>{};
import {FEATURE_SPINS,RULES,BETS,PAYTABLE,WORD_RULES,LINES,LABELS,TIERS,MODES,cashWin,quote} from './config.js?v=ante124';
import {createSession} from './session.js?v=ante124';
import {reelPlan,settleReel,createScatterAnticipation} from './reel-motion.js?v=soft-impact-65';
import {featureArt} from './feature-symbols.js?v=signal';
import {revealDuel} from './duel-reveal.js?v=foundry';
import {rollWildMultiplier} from './wild-upgrade.js';
import {presentWin,preloadWinArt} from './win-presentation.js?v=frontier-ink';
import {AUTO_COUNTS,createAutoSpins} from './auto-spins.js';
import {BountyAudio} from './audio.js?v=106';
import {presentDuel,presentDuelsInOrder,isDuelAtCap,isDuelRedundant,DUEL_FIGHT_HTML} from './duel-presentation.js?v=98';
import {lineMap,linePoints,lineWinDetails,createWinTraceCycle} from './payline-view.js?v=god-pacing-71';
const controller=mountController(document.getElementById('controller'),{onAction:controllerAction,layoutTargets:{desktop:document.querySelector('.machine'),mobile:document.getElementById('game')}});
mountCabinetFit(document.getElementById('game'));
const controllerIds={'spin-button':'play','buy-button':'buy','buy-label':'buyLabel','menu-button':'settings','bet-minus':'betMinus','bet-plus':'betPlus','auto-button':'auto','auto-remaining':'remaining','balance':'balance','bet':'bet','hud-win':'win','feature-banner':'banner'};
const $=id=>controllerIds[id]?controller.element(controllerIds[id]):document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const symbols=Object.keys(PAYTABLE);
const atlases=[{file:'frontier-ink/mounted-premiums.webp',columns:2,rows:2,symbols:['HELMET','GUN','BLADE','CHIP']},{file:'frontier-ink/claim-tags.webp',columns:2,rows:2,symbols:['D','U','E','L']}];
let activeMode='base',roundMode='base';
let session,betIndex=4,busy=false,turbo=false,fast=false,skipAction=null,tier=null,selected=null,turn=0,currentWin=0,roundStake=1e6,started=false;
const motions=new Set(),timers=new Set(),history=[];
const resultGate=createSpinResultGate();let inSpin=false;
const revealedBosses=new Set();
const spinCounter=createSpinCounter({game:$('game'),element:$('spin-counter'),value:$('spin-counter-value'),label:$('spin-counter-label'),status:$('spin-counter-status'),lift:$('spin-counter-lift'),animate:(element,frames,duration)=>{if(reduced||fast)return;const animation=element.animate(frames,{duration:turbo?duration*.5:duration,easing:'cubic-bezier(.2,.75,.25,1)'});motions.add(animation);animation.finished.catch(()=>{}).finally(()=>motions.delete(animation));}});
let shownBoard=Array.from({length:5},(_,reel)=>Array.from({length:5},(_,row)=>({name:symbols[(reel*3+row*2)%8]})));
const stake=()=>Math.round(BETS[betIndex]*1e6);
const money=units=>new Intl.NumberFormat('en-US',{style:'currency',currency:session?.currency||'USD',maximumFractionDigits:2}).format(units/1e6);
let lineWinCapped=false;
const traceCycle=createWinTraceCycle({instant:()=>reduced||turbo||fast,draw:drawWinTrace});
function drawWinTrace(trace,win){
 $('payline-overlay').innerHTML=trace?`<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${trace.points}" class="win-path-shadow"/><polyline points="${trace.points}" class="win-path"/></svg>`:'';
 for(const el of $('reels').querySelectorAll('.line-active'))el.classList.remove('line-active');
 for(const el of $('duel-overlays').children)el.classList.remove('line-active');
 $('line-explanation').hidden=!trace;$('status').hidden=!!trace;
 if(!trace)return;
 const details=lineWinDetails(win,shownBoard),formatBase=units=>new Intl.NumberFormat('en-US',{style:'currency',currency:session?.currency||'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(units/1e6);
 $('line-symbol').innerHTML=art(details.symbol);
 $('line-win-title').textContent=details.title+(details.wordCapped?' · 5× CAP':'');
 $('line-win-formula').textContent=`${formatBase(cashWin(roundStake,details.basePayout))}${details.multiplier>1?` × ${details.factor}`:''} = ${money(cashWin(roundStake,details.payout))}${lineWinCapped?' BEFORE CAP':''}`;
 $('line-explanation').title=details.multipliers.length>1?`Wild multipliers on this line: ${details.multipliers.map(n=>`${n}×`).join(' + ')} = ${details.multiplier}×`:details.title;
 for(const p of win.positions){$('reels').children[p.reel]?.querySelector('.reel-panel')?.children[p.row]?.classList.add('line-active');$('duel-overlays').querySelector(`[data-reel="${p.reel}"]`)?.classList.add('line-active');}
}
function art(name){const feature=featureArt(name);if(feature)return feature;const atlas=atlases.find(a=>a.symbols.includes(name));if(!atlas)throw Error(`Unknown symbol: ${name}`);const index=atlas.symbols.indexOf(name);return `<span class="symbol-art atlas-art" aria-hidden="true"><img src="./assets/${atlas.file}" alt="" draggable="false" style="width:${atlas.columns*100}%;height:${atlas.rows*100}%;left:${-(index%atlas.columns)*100}%;top:${-Math.floor(index/atlas.columns)*100}%"></span>`;}
function cell(s){return `<div class="symbol-cell${s.temporary?' temporary':''}" data-name="${s.name}" aria-label="${LABELS[s.name]||s.name}${s.multiplier?' '+s.multiplier+' times':''}">${art(s.name)}</div>`;}
function panel(column){const el=document.createElement('div');el.className='reel-panel';el.innerHTML=column.map(cell).join('');return el;}
function drawBoard(board){traceCycle.clear();gameAnimation?.clearScatters();$('reels').replaceChildren(...board.map((column,i)=>{const el=document.createElement('div');el.className='reel';el.dataset.reel=i;el.append(panel(column));return el;}));shownBoard=structuredClone(board);void gameAnimation?.syncScatters();}
function setStatus(text){$('status').textContent=text;}
function showRoundError(text){setStatus(text);$('round-error-copy').textContent=text;$('round-error').showModal();}
function refresh(){
 const featureMode=busy?(Object.hasOwn(FEATURE_SPINS,roundMode)?roundMode:'base'):activeMode;
 $('game').dataset.feature=featureMode;
 controller.update({ready:started,busy,holding:resultGate.holding,continuing:!!skipAction,autoActive:auto.active,remaining:auto.remaining,
  canDecrease:betIndex>0,canIncrease:betIndex<BETS.length-1,turbo,
  buyActive:activeMode!=='base',featureColor:FEATURE_SPINS[featureMode]?.color??null,banner:'',
  balance:money(session?.balance??10000e6),bet:money(quote(stake(),featureMode).cost),win:money(currentWin)});
 $('reset-button').disabled=busy;
 $('line-guide-button').disabled=busy||!started;
}
function pause(ms){if(fast||reduced||ms<=0)return Promise.resolve();return new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);timers.delete(done);resolve();};timer=setTimeout(done,ms);timers.add(done);});}
function skip(){if(resultGate.holding)return;if(inSpin)resultGate.markSkipped();if(skipAction){skipAction();return;}if(!busy)return;fast=true;for(const m of motions)try{m.finish();}catch{}for(const el of document.querySelectorAll('.duel-card'))for(const a of el.getAnimations({subtree:true}))try{a.finish();}catch{}for(const done of [...timers])done();}
function lives(state){return state.lives===null?(tier==='hidden'?'<span class="infinity">∞</span>':''):Array.from({length:3},(_,i)=>`<i${i>=state.lives?' class="empty"':''}></i>`).join('');}
function updateFighter(el,state){el.classList.toggle('boss',!!state.boss);el.classList.toggle('winner-outlaw',state.fighter==='outlaw');}
function card(state){const el=document.createElement('div');el.className=`duel-card${tier==='hidden'?' immortal':''}`;el.dataset.id=state.id;el.dataset.reel=state.reel;el.style.gridColumn=state.reel+1;el.setAttribute('aria-label',`${tier==='hidden'?'Immortal ':''}Duel wild on reel ${state.reel+1}, ${state.multiplier} times${state.lives!==null?', '+state.lives+' lives':''}`);el.innerHTML=`<div class="duel-portrait"></div><span class="wild-emblem"><img src="./assets/frontier-ink/features/wild.svg" alt="Wild" width="1254" height="1254"></span><span class="boss-tag">BOSS</span>${DUEL_FIGHT_HTML}<b class="wild-multiplier">${state.multiplier}×</b><div class="duel-lives">${lives(state)}</div>`;updateFighter(el,state);return el;}
function syncCards(states){const holder=$('duel-overlays'),ids=new Set(states.map(s=>String(s.id)));for(const el of [...holder.children])if(!ids.has(el.dataset.id))el.remove();for(const state of states){let el=holder.querySelector(`[data-id="${state.id}"]`);if(!el){el=card(state);holder.append(el);}el.classList.remove('dueling','lost','pending-duel');el.querySelector('.vs-doors')?.remove();updateFighter(el,state);el.querySelector('.wild-multiplier').textContent=`${state.multiplier}×`;el.querySelector('.duel-lives').innerHTML=lives(state);}}
async function spinReels(board,before=[]){
 fast=false;turn++;drawBoard(shownBoard);syncCards(before);gameAnimation?.clearScatters();
 let scatterTotal=0;audio.spinStart();
 const previous=shownBoard,columns=[...$('reels').children],running=new Map();
 const anticipation=createScatterAnticipation({turbo,instant:()=>fast||reduced,
  slow:(index,rate)=>{const motion=running.get(index);if(motion)motion.updatePlaybackRate(rate);},
  change:({active,pending,next,scatters})=>{
   $('reel-stage').classList.toggle('bonus-tease',active);audio.anticipation(active,next??0);gameAnimation?.tease(active);
   columns.forEach(el=>el.querySelectorAll('.symbol-cell[data-name=SCATTER]').forEach(cell=>cell.classList.toggle('scatter-locked',active&&!el.querySelector('.reel-track'))));
   columns.forEach((el,index)=>{el.classList.toggle('teasing',pending.includes(index));el.classList.toggle('tease-next',index===next);});
   if(active)setStatus(`BONUS TEASE · ${scatters} SCATTERS`);
  }
 });
 try{await Promise.all(columns.map(async(el,index)=>{
  const plan=reelPlan(previous[index],board[index],index,{turbo:turbo||reduced,turn}),track=document.createElement('div');track.className='reel-track';track.style.height=`${plan.panels.length*100}%`;
  for(const column of plan.panels){const p=panel(column);p.style.height=`${100/plan.panels.length}%`;track.append(p);}el.replaceChildren(track);
  if(!reduced){const motion=track.animate(plan.frames,{duration:fast?1:plan.duration,easing:'linear',fill:'forwards'});motions.add(motion);running.set(index,motion);try{await motion.finished;}catch{}finally{motions.delete(motion);running.delete(index);motion.cancel();}}
  el.replaceChildren(panel(board[index]));
  const landedScatters=board[index].filter(s=>s.name==='SCATTER').length;
  if(landedScatters&&!fast&&!reduced)for(const fs of el.querySelectorAll('.fs-vault-art'))fs.classList.add('fs-touchdown');
  anticipation.landed(index,landedScatters);
  scatterTotal+=landedScatters;
  audio.reelStop({index,scatters:landedScatters,landedScatters:scatterTotal,newWilds:board[index].filter(s=>s.name==='VS').length});
  if(index<4&&!fast&&!reduced&&board[index].some(s=>s.name==='VS'))audio.duelTease();
  await settleReel(el,{turbo,instant:()=>fast||reduced,motions});
  if(landedScatters)await gameAnimation?.syncScatters({land:!fast&&!reduced});
 }));shownBoard=structuredClone(board);}finally{anticipation.finish();audio.endReels();}
}
async function duel(event){
 const activeIds=new Set(event.duels.map(d=>d.id));
 for(const landing of event.landings)if(activeIds.has(landing.id)&&!$('duel-overlays').querySelector(`[data-id="${landing.id}"]`)){const el=card(landing);el.classList.add('pending-duel');$('duel-overlays').append(el);}
 if(!event.duels.length){drawBoard(event.underlying);return;}
 await presentDuelsInOrder(event.duels,async d=>{
  const pace=turbo?.3:1;
  // Final state and payout still come from the complete round. Skip all
  // spectacle, upgrade sounds and between-fight delays for unchanged caps.
  if(isDuelRedundant(d,event.tier))return;
  const el=$('duel-overlays').querySelector(`[data-id="${d.id}"]`);if(!el)return;
  const fresh=el.classList.contains('pending-duel'),landing=event.landings.find(landing=>landing.id===d.id);
  const symbol=fresh&&landing?$('reels').children[d.reel]?.querySelector('.reel-panel')?.children[landing.row]?.querySelector('.vs-symbol-art'):null;
  const capped=isDuelAtCap(d,event.tier),bossEntrance=d.boss&&!revealedBosses.has(d.id);if(bossEntrance)revealedBosses.add(d.id);
  const godUpgrade=!fresh&&isGodUpgrade(d,event.tier);
  if(!capped)setStatus(godUpgrade?`GOD MODE · REEL ${d.reel+1} · 2× BOOST`:`${bossEntrance?'GOLD BOSS':d.boss?'BOSS DUEL':'DUEL'} · REEL ${d.reel+1} · ${d.from}× VS ${d.rival}×`);
  if(!godUpgrade){el.classList.add('focused');if(!capped)el.classList.add('dueling');}
  const resolve=async()=>{
   updateFighter(el,event.states.find(s=>s.id===d.id)||{boss:d.stateBoss,fighter:'hunter'});el.querySelector('.duel-lives').innerHTML=lives({lives:d.lives});
   if(!d.won&&!d.regular)el.classList.add('lost');
   if(!fast&&!capped)audio.duelResult(d,{god:godUpgrade});
   setStatus(d.dead?'REEL LOST':d.operation==='hold'?`${d.lives} ${d.lives===1?'LIFE':'LIVES'} LEFT`:d.operation==='keep'?`WINNER · ${d.to}×${!d.regular&&!d.won?` · ${d.lives} ${d.lives===1?'LIFE':'LIVES'} LEFT`:''}`:`${d.from} ${d.operation==='multiply'||d.operation==='double'?'×':'+'} ${d.operation==='double'?2:d.rival} ${d.multiplierCapped?'→':'='} ${d.to}×${d.multiplierCapped?' CAP':''}`);
   await rollWildMultiplier(el,d.from,d.to,{reduced:reduced||fast||d.operation==='keep',duration:(godUpgrade?220:320)*pace});
   if(d.dead){el.classList.add('defeated');await pause(160*pace);el.remove();}
  };
  try{
   if(godUpgrade){
    await presentGodUpgrade({card:el,duel:d,pace,instant:()=>fast||reduced,motions,onResolve:resolve,onReveal:fresh?async()=>{
     const face=document.createElement('div');face.className='god-reveal-face';face.append(el.querySelector('.duel-portrait').cloneNode(true));el.append(face);
     try{if(!fast&&!reduced)audio.duelOpen();await revealDuel({card:el,symbol,pace:pace*.7,instant:()=>fast||reduced,motions});}finally{face.remove();}
    }:undefined});
   }else{
    await presentDuel({node:el.querySelector('.reel-fight'),duel:{...d,bossEntrance},tier:event.tier,wait:pause,instant:()=>fast||reduced,pace,onOpen:()=>audio.duelOpen(),onReveal:fresh?()=>revealDuel({card:el,symbol,pace,instant:()=>fast||reduced,motions}):undefined,onShot:()=>audio.duelShot(),onResolve:resolve});
   }
  }finally{audio.endDuel();el.classList.remove('dueling','focused','pending-duel');}
  await pause(godUpgrade?(turbo?20:60):capped?(turbo?120:500):(turbo?30:90));
 });
 drawBoard(event.underlying);syncCards(event.states);await pause(turbo?60:140);
}
async function crossfire(event){
 if(!event.crossfire.length){drawBoard(event.board);return;}
 const sources=(event.crossfireSources?.length?event.crossfireSources.map(id=>event.states.find(s=>s.id===id)):event.states).filter(Boolean);
 const announcement=$('duel-announcement');
 $('crossfire-count').textContent=`${event.crossfire.length} EXTRA WILDS`;
 announcement.dataset.phase='intro';announcement.hidden=fast||reduced;
 setStatus(`CROSSFIRE · ${event.crossfire.length} EXTRA WILDS`);
 try{
  if(!fast&&!reduced)audio.ritualIgnite();
  await pause(turbo?700:1100);
  announcement.dataset.phase='firing';
  if(fast||reduced)announcement.hidden=true;
  await gameAnimation.crossfire({placements:event.crossfire,sources,mobile:controller.element('play').getRootNode().host.dataset.layout==='mobile',
   instant:()=>fast||reduced,speed:turbo?2.2:1,
   getTarget:p=>$('reels').children[p.reel]?.querySelector('.reel-panel')?.children[p.row],
   onPlacement:p=>{const el=$('reels').children[p.reel]?.querySelector('.reel-panel')?.children[p.row];if(el)el.outerHTML=cell(event.board[p.reel][p.row]);}
  });
  await pause(turbo?350:600);
  announcement.dataset.phase='out';await pause(180);
 }finally{announcement.hidden=true;delete announcement.dataset.phase;$('crossfire').replaceChildren();drawBoard(event.board);}
}
function highlight(event){lineWinCapped=event.capped;for(const win of event.wins)for(const p of win.positions){const el=$('reels').children[p.reel]?.querySelector('.reel-panel')?.children[p.row];if(win.word)el?.classList.add(p.reel<4?'word-winning':'word-booster');}traceCycle.start(event.wins);}
const winNodes={dialog:$('win-dialog'),title:$('win-title'),art:$('win-art'),value:$('win-value'),multiple:$('win-multiple'),hint:$('win-hint'),proceed:$('win-proceed'),coins:$('win-coins'),context:$('win-context'),skipTargets:[$('hud-win')]};
async function showWin(event,{summary=false}={}){
 const payout=summary?event.totalWin:event.win,amount=cashWin(roundStake,payout),settled=cashWin(roundStake,event.totalWin),before=summary?0:cashWin(roundStake,event.totalWin-event.win);
 if(summary){currentWin=settled;controller.update({win:money(currentWin)});}
 await presentWin({nodes:winNodes,payout,units:amount,format:money,capped:event.capped,summary,reduced,turbo,wait:pause,onValue:n=>{if(!summary){currentWin=Math.min(settled,before+n);controller.update({win:money(currentWin)});}},onTier:(t,final)=>{if(!final)audio.winTier(t.id);},onControl:fn=>{skipAction=fn;if(fast&&fn&&!summary&&$('win-dialog').dataset.phase!=='ready')fn();refresh();}});
 audio.endWin();currentWin=settled;refresh();
}
async function startBonus(event){
 auto.stop('bonus');tier=event.tier;$('game').dataset.tier=tier;audio.bonusStart(tier==='super',tier==='hidden');$('mode-label').textContent=TIERS[tier].name;$('bonus-remaining').textContent=`${event.spins} FREE SPINS`;$('round-badge').hidden=false;
 spinCounter.begin(event.spins,tier);
 syncCards(event.states);$('splash-art').src=`./assets/frontier-ink/shop/${{regular:'showdown',super:'last-stand',hidden:'mystery'}[tier]}.svg`;$('splash-art').alt=TIERS[tier].name;$('splash-kicker').textContent='10 FREE SPINS AWARDED';$('splash-title').textContent=TIERS[tier].name;
 $('splash-detail').textContent={regular:'The winning fighter keeps its own multiplier. Gold Bosses reveal higher values.',super:'Reels stay with three lives. The winner keeps its multiplier; a challenger victory costs one life.',hidden:'An immortal 5× fighter lands on spin one. Double every spin, up to 1,024×. Gold Bosses multiply by their rival; two or more reels unleash Crossfire.'}[tier];
 $('bonus-splash').hidden=false;fast=false;
 await new Promise(resolve=>{const proceed=()=>{$('splash-start').removeEventListener('click',proceed);skipAction=null;$('bonus-splash').hidden=true;audio.freeSpinStart();resolve();};skipAction=proceed;$('splash-start').addEventListener('click',proceed);$('splash-start').focus();refresh();});
}
async function play(mode=activeMode,preview=null){
 if(busy||!session||!started)return false;revealedBosses.clear();busy=true;skipAction=null;fast=false;roundStake=stake();roundMode=preview?'base':mode;currentWin=0;tier=null;$('game').dataset.tier='base';closeAll();refresh();void audio.unlock();
 let round,settled=false;
 try{
  round=session.play(roundStake,mode,{preview});refresh();if(preview){$('demo-label').textContent='FREE BONUS PREVIEW';}
  setStatus(mode==='duel'?'DUEL SPIN · GUARANTEED WILD REELS':['base','enhanced','superAnte'].includes(mode)?'GOOD LUCK':'REVEALING YOUR BONUS');
  for(const recorded of round.events){
   const event=bonusEntryEvent(recorded);
   if(event.type==='trigger'){await spinReels(event.board);setStatus(`${event.scatters} BOUNTY VAULTS · ${TIERS[event.tier].name}`);audio.bonusHit();$('reel-stage').classList.add('bonus-triggering');try{await gameAnimation.trigger({instant:()=>fast||reduced,speed:turbo?2:1});}finally{$('reel-stage').classList.remove('bonus-triggering');}}
   else if(event.type==='bonusStart')await startBonus(event);
   else if(event.type==='spin'){
    inSpin=true;resultGate.begin({reduced});
    if(event.feature==='duel'){
     $('mode-label').textContent=event.hasLives?'DUEL SPINS · 3 LIVES':'DUEL SPINS';
     if(event.hasLives){if(event.turn===1)spinCounter.begin(event.remaining,'super','RESPINS');else spinCounter.reveal(event.remaining);auto.stop('lives');audio.setScene('super');$('round-badge').hidden=false;$('round-badge').textContent=event.turn===1?'LIVES AWARDED':`FREE RESPIN ${event.turn-1} / ${RULES.duelRespins}`;}
     $('bonus-remaining').textContent=event.hasLives?`${event.remaining} RESPINS LEFT`:`${event.initialReels} WILD REELS`;
    }
    if(event.tier){spinCounter.reveal(event.remaining);$('bonus-remaining').textContent=`${event.remaining} SPINS LEFT`;$('round-badge').textContent=`SPIN ${event.turn} / ${event.totalSpins}`;}
    await spinReels(event.raw,event.before);await duel(event);await crossfire(event);highlight(event);
    if(event.win){const word=event.wins.find(w=>w.word);setStatus(word?`DUEL WORD · 100×${word.multiplier>1?` × ${word.multiplier}`:''} = ${word.amount/100}×`:`${event.wins.length} WINNING ${event.wins.length===1?'LINE':'LINES'}`);if(event.win<1000)audio.win({amount:event.win,capped:event.capped,turbo});if(event.capped&&(event.tier||event.hasLives)){await pause(1000);}else await showWin(event);}else{setStatus(event.tier?'NO PAYING LINE · THE SHOWDOWN CONTINUES':`NO PAYING LINE · TAP ${LINES.length} PAYLINES TO VIEW`);await pause(turbo?160:600);}
    if(event.tier||event.hasLives)spinCounter.settle(event.remaining);
    await resultGate.show(()=>{drawBoard(event.board);syncCards(event.states);highlight(event);currentWin=cashWin(roundStake,event.totalWin);setStatus(event.win?`SPIN WIN · ${money(cashWin(roundStake,event.win))}`:'NO PAYING LINE');refresh();});
    inSpin=false;refresh();
   }else if(event.type==='bonusEnd'||event.type==='featureEnd'){spinCounter.complete();fast=false;await showWin(event,{summary:true});}
  }
  session.settle(round.id);settled=true;
  history.unshift({mode:preview?'Preview':round.tier?TIERS[round.tier].name:FEATURE_SPINS[mode]?.name??'Base game',cost:round.cost,win:round.win,preview:!!preview});history.splice(40);
  setStatus(preview?'BONUS PREVIEW COMPLETE':round.win?'BOUNTY COLLECTED':`NO PAYING LINE · TAP ${LINES.length} PAYLINES TO VIEW`);return true;
 }catch(error){
  traceCycle.clear();
  if(round&&!settled){try{session.settle(round.id);settled=true;currentWin=round.win;}catch{}}
  showRoundError(error.message||'The round could not start.');auto.stop('error');return false;
 }finally{
  spinCounter.hide();inSpin=false;busy=false;tier=null;skipAction=null;fast=false;audio.setScene('base');$('game').dataset.tier='base';$('mode-label').textContent=`${LINES.length} PAYLINES`;$('bonus-remaining').textContent='25,000× MAX WIN';$('round-badge').hidden=true;$('demo-label').textContent='FREE PLAY';$('bonus-splash').hidden=true;$('duel-announcement').hidden=true;$('crossfire').replaceChildren();refresh();
 }
}
const auto=createAutoSpins({play:()=>play(),canPlay:()=>!busy&&started&&!!session&&session.balance>=quote(stake(),activeMode).cost&&!document.hidden,onChange:()=>{refresh();},onError:error=>showRoundError(error.message)});
const audio=new BountyAudio({onChange:settings=>{for(const [id,channel] of [['effects-button','effects'],['music-button','music']])$(id).setAttribute('aria-pressed',String(settings.enabled&&settings[channel]>0));for(const channel of ['music','effects']){$(`${channel}-volume`).value=Math.round(settings[channel]*100);$(`${channel}-level`).textContent=`${Math.round(settings[channel]*100)}%`;}controller.update({muted:!settings.enabled});$('audio-note').textContent=audio?.unavailable?'Audio could not start. Tap Sound to retry.':'';}});
controller.update({muted:!audio.settings.enabled});
// Only actual Crossfire placements emit shots; idle rig events stay silent.
$('game').addEventListener('cosmic:animation-cue',({detail})=>{if(busy&&!fast&&!reduced&&detail?.name==='shot'&&detail.placement)audio.duelShot();});
function closeAll(){for(const d of document.querySelectorAll('dialog[open].overlay, #shop[open]'))d.close();}
function open(id){if(!started||(busy&&!['settings','info','history','payline-dialog'].includes(id)))return;auto.stop('menu');closeAll();$(id).showModal();}
function betStep(direction){if(busy||auto.active)return;const before=betIndex;betIndex=Math.max(0,Math.min(BETS.length-1,betIndex+direction));if(betIndex!==before)audio.uiClick();currentWin=0;refresh();if($('shop').open)renderShop();if($('info').open)renderPaytable();}
function activateFeature(mode){
 if(busy||auto.active||(mode!=='base'&&!Object.hasOwn(FEATURE_SPINS,mode)))return;
 activeMode=mode;currentWin=0;closeAll();refresh();
 setStatus(mode==='base'?'FEATURE SPINS DISABLED':`${FEATURE_SPINS[mode].name.toUpperCase()} ACTIVE · ${money(quote(stake(),mode).cost)} PER SPIN`);
}
function renderShop(){
 const groups=$('bonus-cards');
 $('shop-stake').textContent=money(stake());
 $('shop').classList.toggle('confirming',Boolean(selected));
 $('cancel-selection').hidden=!selected;
 groups.innerHTML=shopGroups({selected,activeMode,balance:session.balance,formatMoney:money,price:mode=>quote(stake(),mode).cost});
 document.querySelector('.preview-options').hidden=Boolean(selected);
 document.querySelectorAll('[data-shop-step]').forEach(button=>{button.disabled=Number(button.dataset.shopStep)<0?betIndex===0:betIndex===BETS.length-1;});
}
document.querySelector('.shop-switch').addEventListener('click',event=>{
 const button=event.target.closest('[data-group]');
 if(!button)return;
 $('bonus-cards').dataset.group=button.dataset.group;
 for(const tab of button.parentElement.children)tab.setAttribute('aria-pressed',String(tab===button));
});
function renderPaytable(){
 $('paytable-bet').textContent=`Payout per winning line at ${money(stake())} base bet, before Duel wild multipliers.`;
 $('paytable').innerHTML=Object.entries(PAYTABLE).map(([name,pays])=>`<article class="pay-symbol">${art(name)}<h4>${LABELS[name]}</h4><table aria-label="${LABELS[name]} payouts"><tbody>${[5,4,3].map(n=>`<tr><th scope="row">${n}</th><td>${money(cashWin(stake(),pays[n-3]))}</td></tr>`).join('')}</tbody></table></article>`).join('');
 $('word-paytable').innerHTML=`<div class="word-symbols" aria-label="D U E L">${WORD_RULES.letters.map(art).join('')}</div><div><h3>SPELL DUEL</h3><strong>${money(cashWin(stake(),WORD_RULES.award))}<span>UP TO ${money(cashWin(stake(),WORD_RULES.award*WORD_RULES.maxMultiplier))}</span></strong><p>100× base bet. A Duel wild on reel 5 boosts this award by up to 5×.</p></div>`;
}
function selectPayline(index){
 const rows=LINES[index];if(!rows)return;
 $('guide-board').innerHTML=shownBoard.flatMap((column,reel)=>column.map((s,row)=>`<div class="guide-cell${row===rows[reel]?' selected':''}" style="grid-column:${reel+1};grid-row:${row+1}" aria-label="Reel ${reel+1}, row ${row+1}: ${LABELS[s.name]||s.name}">${art(s.name)}${s.multiplier?`<small>${s.multiplier}×</small>`:''}</div>`)).join('');
 $('guide-line-overlay').innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${linePoints(rows)}" class="win-path-shadow"/><polyline points="${linePoints(rows)}" class="win-path"/></svg>`;
 $('line-selection').innerHTML=`LINE ${index+1}<span>Rows ${rows.map(n=>n+1).join(' → ')} · top row is 1</span>`;
 $('line-cards').querySelectorAll('[data-line]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.line)===index)));
}
function renderLinePage(page){
 const first=page*10,last=Math.min(LINES.length,first+10);
 $('line-cards').innerHTML=LINES.slice(first,last).map((rows,offset)=>{const index=first+offset;return `<button class="line-card" data-line="${index}" aria-pressed="false" aria-label="Line ${index+1}, rows ${rows.map(n=>n+1).join(', ')}">${lineMap(index)}<span>${index+1}</span></button>`;}).join('');
 $('line-pages').querySelectorAll('[data-line-page]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.linePage)===page)));
 selectPayline(first);
}
function showPaylines(){
 if(!started)return;
 $('payline-title').textContent=`${LINES.length} FIXED PAYLINES`;
 $('line-pages').innerHTML=Array.from({length:Math.ceil(LINES.length/10)},(_,page)=>`<button data-line-page="${page}" aria-pressed="false">${page*10+1}–${Math.min(LINES.length,page*10+10)}</button>`).join('');
 renderLinePage(0);open('payline-dialog');
}
function renderHistory(){if(!history.length)return;$('history-list').innerHTML=`<table><thead><tr><th>ROUND</th><th>COST</th><th>WIN</th></tr></thead><tbody>${history.map(r=>`<tr><td>${r.mode}</td><td>${r.preview?'Free':money(r.cost)}</td><td>${money(r.win)}</td></tr>`).join('')}</tbody></table>`;}
function toggleTurbo(){audio.uiClick();turbo=!turbo;$('turbo-button').setAttribute('aria-pressed',String(turbo));controller.update({turbo});}
function positionMenu(menu,anchor){
 const button=anchor.getBoundingClientRect();
 menu.style.setProperty('--menu-left',`${Math.max(10,Math.min(innerWidth-280,button.left))}px`);
 menu.style.setProperty('--menu-bottom',`${Math.max(10,innerHeight-button.top+8)}px`);
}
function showBetPicker(){
 if(!started||busy||auto.active)return;
 const menu=$('bet-dialog'),list=$('bet-options'),feature=activeMode!=='base';
 menu.style.setProperty('--picker-accent',FEATURE_SPINS[activeMode]?.color??'#f5bc51');
 $('bet-picker-note').textContent=feature?'Choose a base bet. The feature spin cost is shown below each amount.':'Choose your bet per spin.';
 list.innerHTML=BETS.map((amount,index)=>{const base=Math.round(amount*1e6);return `<button class="bet-option" type="button" data-bet-index="${index}" aria-pressed="${index===betIndex}"><span>${money(base)}${feature?`<small>${money(quote(base,activeMode).cost)} per spin</small>`:''}</span><span class="bet-check" aria-hidden="true">✓</span></button>`;}).join('');
 positionMenu(menu,controller.element('betPicker'));open('bet-dialog');
 requestAnimationFrame(()=>{if(!menu.open)return;const choice=list.querySelector('[aria-pressed="true"]');choice?.focus({preventScroll:true});if(choice)list.scrollTop=choice.offsetTop-(list.clientHeight-choice.offsetHeight)/2;});
}
$('bet-options').addEventListener('click',event=>{
 const button=event.target.closest('[data-bet-index]');if(!button||busy||auto.active)return;
 const index=Number(button.dataset.betIndex);if(!Number.isInteger(index)||index<0||index>=BETS.length)return;
 betStep(index-betIndex);$('bet-dialog').close();controller.element('betPicker').focus({preventScroll:true});
});
function controllerAction(action){
 if(action==='play'){if(busy)skip();else void play();}
 else if(action==='betMinus'||action==='betPlus')betStep(action==='betMinus'?-1:1);
 else if(action==='buy'){audio.buyClick();if(activeMode!=='base'){activateFeature('base');return;}selected=null;renderShop();open('shop');}
 else if(action==='settings'){audio.uiClick();positionMenu($('settings'),controller.element('settings'));open('settings');}
 else if(action==='bet'){if(started&&!busy&&!auto.active)audio.uiClick();showBetPicker();}
 else if(action==='turbo'){if(started)toggleTurbo();}
 else if(action==='sound')void audio.setEnabled(!audio.settings.enabled);
 else if(action==='auto'){if(auto.active||!busy)audio.uiClick();if(auto.active)auto.stop();else if(!busy)open('auto-dialog');}
}
$('auto-options').innerHTML=AUTO_COUNTS.map(n=>`<button data-auto="${n}">${n.toLocaleString()}</button>`).join('');
$('auto-options').addEventListener('click',e=>{const b=e.target.closest('[data-auto]');if(b){closeAll();void auto.start(Number(b.dataset.auto));}});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
document.querySelectorAll('dialog.overlay, #shop').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('bonus-cards').addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(!b||b.disabled)return;audio.buyClick();const mode=b.dataset.buy;if(Object.hasOwn(FEATURE_SPINS,mode)){activateFeature(activeMode===mode?'base':mode);return;}if(selected===mode){activeMode='base';void play(mode);}else{selected=mode;renderShop();$('bonus-cards').querySelector('button').focus();}});
$('cancel-selection').addEventListener('click',()=>{const previous=selected;selected=null;renderShop();$('bonus-cards').querySelector(`[data-buy="${previous}"]`)?.focus();});
document.querySelectorAll('[data-shop-step]').forEach(b=>b.addEventListener('click',()=>betStep(Number(b.dataset.shopStep))));
document.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',()=>void play('base',b.dataset.preview)));
$('info-button').addEventListener('click',()=>{renderPaytable();open('info');});
$('line-guide-button').addEventListener('click',showPaylines);$('info-lines-button').addEventListener('click',showPaylines);
$('line-pages').addEventListener('click',event=>{const button=event.target.closest('[data-line-page]');if(button)renderLinePage(Number(button.dataset.linePage));});
$('line-cards').addEventListener('click',event=>{const button=event.target.closest('[data-line]');if(button)selectPayline(Number(button.dataset.line));});
$('history-button').addEventListener('click',()=>{renderHistory();open('history');});
$('reset-button').addEventListener('click',()=>{if(busy)return;session.reset();currentWin=0;refresh();closeAll();setStatus('DEMO CREDITS RESET');});
$('turbo-button').addEventListener('click',toggleTurbo);
$('effects-button').addEventListener('click',()=>void audio.toggleChannel('effects'));$('music-button').addEventListener('click',()=>void audio.toggleChannel('music'));
for(const channel of ['music','effects']){
 const slider=$(`${channel}-volume`);slider.value=Math.round(audio.settings[channel]*100);$(`${channel}-level`).textContent=`${slider.value}%`;
 slider.addEventListener('input',()=>{const level=Number(slider.value)/100;audio.setVolume(channel,level);if(level>0)void audio.setEnabled(true);});
}
$('test-sfx').addEventListener('click',async()=>{if(await audio.unlock())audio.duelLand();});
document.addEventListener('visibilitychange',()=>{audio.setHidden(document.hidden);if(document.hidden)auto.stop('hidden');});
document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.composedPath()[0]?.tagName))return;if(document.querySelector('dialog[open].overlay, #shop[open]')||!started)return;e.preventDefault();if(busy)skip();else if(!auto.active)void play();});
$('enter-game').addEventListener('click',()=>{closeIntroGuide();$('boot').hidden=true;started=true;void audio.unlock();refresh();$('spin-button').focus({preventScroll:true});});
async function init(){
 void mountDuelIdleLights($('game'));
 const identLogo=document.querySelector('.studio-monogram img');
 const identReady=Promise.all([document.fonts.ready,identLogo.decode().catch(()=>{})]).then(()=>{
  const mark=document.querySelector('.studio-wordmark'),source=mark.querySelector('.studio-main b'),target=mark.querySelector('.studio-gam');
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
  mark.style.setProperty('--gam-x',`${a.left+a.width/2-b.left-b.width/2}px`);
  mark.style.setProperty('--gam-y',`${a.top+a.height/2-b.top-b.height/2}px`);
  mark.style.setProperty('--gam-scale',String(a.width/b.width));mark.classList.add('wordmark-ready');$('studio-loading').classList.add('ident-ready');return performance.now();
 });
 document.querySelectorAll('[data-symbol-art]').forEach(el=>{el.innerHTML=art(el.dataset.symbolArt);});
 drawBoard(shownBoard);mountSceneCharacters($('game'));gameAnimation=mountGameAnimation({game:$('game'),reels:$('reel-stage'),motions,reduced});void gameAnimation.syncScatters();let loaded=0;const startedAt=performance.now();
 const tasks=['frontier-ink/signal-title.webp','frontier-ink/signal-rails.webp','frontier-ink/mounted-premiums.webp','frontier-ink/claim-tags.webp',(matchMedia('(max-aspect-ratio:1/1)').matches?'frontier-ink/dusk-portrait.webp':'frontier-ink/dusk-wide.webp'),'comic-v64/portraits.webp','studio-gg-diagonal.png','frontier-ink/features/vs.svg?v=2','frontier-ink/features/signal-fs.webp','frontier-ink/features/wild.svg','duel-fighters.png','overhead-fighters.webp','duel-ground.webp','boss-fighter.png','frontier-ink/shop/showdown.svg','frontier-ink/shop/last-stand.svg','frontier-ink/shop/mystery.svg'].map(name=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('Game artwork could not load. Please reload.'));img.src=`./assets/${name}`;}));
 // Warm the optional mobile effect without letting it block game startup.
 const pistol=new Image();pistol.src='./assets/spine-v96/mobile-crossfire/images/parts.png';
 // Combat posters are loaded by the media players; a missing poster must not block startup.
 if(!reduced)tasks.push(preloadDuelClips());
 tasks.push(preloadWinArt());
 tasks.push(audio.preloadSfx());
 tasks.push(createSession().then(s=>{session=s;}));
 try{await Promise.all(tasks.map(p=>p.then(()=>{$('loading-fill').style.width=`${++loaded/tasks.length*100}%`;})));const identStarted=await identReady;await new Promise(r=>setTimeout(r,reduced?0:Math.max(0,4900-(performance.now()-identStarted))));$('studio-loading').classList.add('studio-exit');if(!reduced)await new Promise(r=>setTimeout(r,380));$('studio-loading').hidden=true;$('intro').hidden=false;closeIntroGuide=mountIntroGuide($('intro'),cell);refresh();
  fetch('./math-report.json?v=ante124').then(r=>r.json()).then(report=>{const duel=report.pools.duel.distribution;const chance=Object.values(report.natural).reduce((sum,p)=>sum+p,0);$('bonus-frequency-note').textContent=`A bonus triggers about once per ${(1/chance).toFixed(0)} normal spins or ${(1/(chance*3)).toFixed(0)} Enhanced Spins on average. Each spin is independent. Bonus payouts use the same bonus pools whether triggered or purchased.`;$('duel-return-note').textContent=`Duel Spins cost 50× the base bet. Across the complete outcome pool, ${(duel.anyPayout*100).toFixed(0)}% return something and ${(duel.coversCost*100).toFixed(0)}% return the full spin price or more. A return below the spin price is a net loss. These are long-run probabilities, not a promise for any session.`;$('rtp-note').textContent=`This fixed prototype model returns approximately ${(report.modes.base.rtp*100).toFixed(2)}% in base play, ${(report.modes.enhanced.rtp*100).toFixed(2)}% for Enhanced Spins, ${(report.modes.superAnte.rtp*100).toFixed(2)}% for Super Ante, ${(report.modes.duel.rtp*100).toFixed(2)}% for Duel Spins, ${(report.modes.bonus.rtp*100).toFixed(2)}% for Showdown Buy, ${(report.modes.super.rtp*100).toFixed(2)}% for Last Stand Buy, and ${(report.modes.mystery.rtp*100).toFixed(2)}% for Mystery Buy over its full weighted outcomes. Individual sessions vary.`;}).catch(()=>{});
 }catch(error){$('loading-status').textContent=error.message;$('loading-fill').style.background='#ff6565';}
}
void init();
