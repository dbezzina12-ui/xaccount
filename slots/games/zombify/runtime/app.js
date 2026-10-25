import {stackPresentationMask,visibleStackCells,stackPortraitRegion} from './zombie-layout.js';
import {playZombieLanding} from './zombie-landing-cue.js';
import {createTeasePresentation,teaseStage} from './tease-presentation.js';
import {createTeaseAudio} from './tease-audio.js';
import {createBonusScreen} from './bonus-screen.js';
import {createInfectionTubes} from './infection-tubes.js';
import {reelTeasePlan,reelFrames,mysteryScatterBoard} from './reel-tease.js';
import {gameReady} from './game-ready.js?v=125';
import {createInfectionField} from './infection-field.js';
import {createRecliningArt,recliningArtReady} from './reclining-art.js';
import {mountApprovedRig,stopApprovedRigs,preloadApprovedRigs,createApprovedAnimator,playFullReelExit} from './approved-rig.js';
import {zombieAnchor} from './zombie-layout.js';
import {LABELS, SYMBOLS, PEOPLE, HUMAN_MULTIS, freshInfection, humanBiteValue, expandedZombies, seeded, makeRound} from './math.js';
import {createSession, BETS} from './session.js?v=bet500';
import {createPlayback} from './playback.js';
import {BONUS_BUYS,BONUS_FEATURES,FEATURE_SPIN,PREVIEW_MODES,roundCostMultiplier} from './config.js';
import {createAutoSpins,AUTO_COUNTS} from './auto-spins.js';
import {playFS,registerFSAnimator} from './fs-presentation.js';
import {playSwatStep} from './zombie-swat.js';
import {playZombieJump,registerZombieAnimator} from './zombie-jump.js';
import {createFreeSpinCounter} from './free-spin-counter.js';
import {mountController} from './controller/controller.js?v=mobile-scene-123';
import {FEATURE_PRESENTATION,mobileControllerState} from './feature-presentation.js';
import {createZombieEffects} from './zombie-fx.js';
import {createGameAudio} from './game-audio.js?v=116';
import {createWinCelebration} from './win-celebration.js';
import {WIN_TIERS,celebrationFor} from './win-tiers.js';

const $=id=>document.getElementById(id);
const infectionTubes=createInfectionTubes({container:$('infection-people'),people:PEOPLE,labels:LABELS,multipliers:HUMAN_MULTIS});
const session=createSession();
const playback=createPlayback();
registerZombieAnimator(createApprovedAnimator());
void gameReady.ensure().catch(()=>{});
const money=n=>(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const effects=createZombieEffects({host:document.querySelector('.board-wrap'),board:$('board'),shouldSkip:()=>playback.read().skipping||!!document.querySelector('dialog[open]')});
// Prepare while the studio/guide is visible; optional effects never delay a spin.
void effects.warm();
let busy=false, sound=false;
const roundHistory=[];
const lastChannelLevels={music:.38,effects:.75};
const audioDirector=createGameAudio({onError:()=>toast('Some audio could not load. The game will continue normally.')});
let currentBoard=[], currentMulti=0, currentBites=0, currentEaten=0, currentMode='base';
let currentInfection=freshInfection(),bonusTier=null,currentSuperStarts=Array(6).fill(null),currentCarriedMultis=Array(6).fill(0);
const runningAnimations=new Set();
const freeSpins=createFreeSpinCounter({game:$('game'),element:$('free-spins-counter'),value:$('free-spins-value'),label:$('free-spins-label'),status:$('free-spins-status'),lift:$('free-spins-lift'),animate,onHide:leaveFeature});
let completeFeature=null, toastTimer, pending=null;
const auto=createAutoSpins({play:()=>play(),canPlay:()=>!busy&&!pending&&session.read().credits>=session.read().spinCost,onChange:()=>syncControls(),onError:()=>toast('Autoplay stopped. Your current round has finished.')});
const mobileController=mountController($('mobile-controller'),{onAction:controllerAction});
const winCelebration=createWinCelebration({dialog:$('win-celebration'),format:money,playSound:soundEffect,stopSound:()=>audioDirector.stopEffects(.12),reduced,onChange:syncControls});
const bonusScreen=createBonusScreen({dialog:$('feature'),content:$('feature-content'),doors:[...$('feature').querySelectorAll('.feature-door')],button:$('feature-continue'),reduced,onWaiting:ready=>{completeFeature=ready?()=>bonusScreen.continue():null;syncControls();}});
function syncMobileController(){
  const view=mobileControllerState({state:session.read(),maxBetIndex:BETS.length-1,busy,pending,auto,playback:playback.read(),awaitingFeature:!!completeFeature,tier:bonusTier,sound,win:$('last-win').textContent});
  mobileController.update({...view,balance:money(view.balance),bet:money(view.bet)});
  const betButton=mobileController.element('betPicker'),state=session.read(),enhanced=state.spinMode==='enhanced',life=state.spinMode===FEATURE_SPIN.kind;
  betButton.querySelector('span').textContent='BET';
  betButton.setAttribute('aria-label',`Change base bet. ${life?'Second Life spin cost':enhanced?'Enhanced spin cost':'Bet'} ${money(state.spinCost)}. Base bet ${money(state.bet)}.`);
}
function displayWin(value){$('last-win').textContent=value;mobileController.update({win:value});}

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,4000);
}
function duration(ms) { return playback.duration(ms,reduced); }
async function pause(ms) {
  const until=performance.now()+duration(ms);
  while(performance.now()<until) {
    await new Promise(resolve=>setTimeout(resolve,Math.min(50,Math.max(0,until-performance.now()))));
    if(playback.read().skipping) break;
  }
}
async function animate(node, frames, ms=300, extra={}) {
  if(!node?.animate || reduced || playback.read().skipping) return;
  let animation;
  try {
    animation=node.animate(frames,{duration:duration(ms),easing:'cubic-bezier(.2,.7,.3,1)',...extra});
    runningAnimations.add(animation);await animation.finished;
  } catch { /* Animation cancellation cannot alter the round payout. */ }
  finally {if(animation)runningAnimations.delete(animation);}
}
function soundEffect(type,options={}) {
  if(!sound || playback.read().skipping) return;
  audioDirector.play(type,options);
}
function syncControls() {
  syncSettingsMenu();
  $('menu-quick-spin').checked=playback.read().speed!=='normal';
  const state=session.read(),locked=busy||auto.active||!!pending;
  $('balance').textContent=money(state.credits);$('bet').textContent=money(state.spinCost);
  const enhanced=state.spinMode==='enhanced',life=state.spinMode===FEATURE_SPIN.kind;
  $('bet-label').textContent='BET';
  $('bet').title=enhanced||life?`Total spin cost. Base bet ${money(state.bet)}.`:'Base bet';
  $('game').classList.toggle('enhanced-spins',enhanced);
  $('game').classList.toggle('second-life-spins',life);
  $('enhanced-setting').checked=enhanced;$('enhanced-setting').disabled=locked;
  $('activate-enhanced').disabled=locked||(!enhanced&&state.credits<state.bet*3);
  $('activate-enhanced').textContent=enhanced?'DISABLE':'ACTIVATE';$('activate-enhanced').setAttribute('aria-pressed',String(enhanced));
  $('second-life-setting').checked=life;$('second-life-setting').disabled=locked;
  for(const button of document.querySelectorAll('[data-shop-preview]'))button.disabled=locked;
  for(const button of document.querySelectorAll('[data-win-preview]'))button.disabled=locked;
  $('enhanced-price').textContent=money(state.bet*3);
  $('enhanced-setting-price').textContent=`3× · ${money(state.bet*3)} / SPIN`;
  $('shop-bet').textContent=money(state.bet);
  for(const id of ['minus','shop-minus'])$(id).disabled=locked||state.betIndex===0;
  for(const id of ['plus','shop-plus'])$(id).disabled=locked||state.betIndex===BETS.length-1;
  for(const id of ['showcase','demo-mode','reel-demo','outbreak','super-preview','hidden-preview','quick-guide','reset','menu-reset','buy'])$(id).disabled=locked;
  $('menu').disabled=false;$('rules-open').disabled=busy;$('show-rules').disabled=busy;
  $('spin').dataset.stop=String(busy||auto.active);
  $('spin').disabled=busy&&playback.read().spin===null&&!winCelebration.read().active;
  $('spin-label').textContent=busy?'SKIP':auto.active?'STOP':'SPIN';
  $('spin').setAttribute('aria-label',busy?'Skip this spin':auto.active?'Stop auto spins':'Spin');
  $('auto').disabled=!auto.active&&(busy||!!pending);
  $('auto').setAttribute('aria-pressed',String(auto.active));
  $('auto').setAttribute('aria-label',auto.active?'Stop auto spins':'Auto spins');
  $('auto-count').textContent=auto.active?auto.remaining:'';
  for(const [kind,stem] of [['buy_outbreak','bonus'],['buy_super','super'],['buy_mystery','mystery']]){
    const cost=state.bet*BONUS_BUYS[kind].cost;
    $(`${stem}-price`).textContent=money(cost);
    $(kind.replace('_','-')).disabled=locked||state.credits<cost;
  }
  $('feature-spin-price').textContent=money(state.bet*FEATURE_SPIN.cost);
  $('second-life-setting-price').textContent=`10× · ${money(state.bet*FEATURE_SPIN.cost)} / SPIN`;
  $('activate-feature').disabled=locked||(!life&&state.credits<state.bet*FEATURE_SPIN.cost);
  $('activate-feature').textContent=life?'DISABLE':'ACTIVATE';$('activate-feature').setAttribute('aria-pressed',String(life));
  $('purchase').disabled=!pending||busy||pending.bet!==state.bet||state.credits<pending.cost;
  syncMobileController();
}
function makeTile(cell,index=0) {
  const tile=document.createElement('div');
  tile.className='tile';tile.dataset.kind=cell.kind;tile.dataset.id=cell.id;tile.dataset.index=index;
  tile.title=LABELS[cell.kind]+(cell.kind==='zombie'&&cell.multi?` · ${cell.multi}×`:'');tile.setAttribute('aria-hidden','true');
  const art=document.createElement('span');art.className=`symbol art-${cell.kind}`;
  if(PEOPLE.includes(cell.kind)){
    // The round marks a type infected only after its third eat.
    // Both base-game carrier values share the fully zombified artwork.
    tile.dataset.infection=cell.infected||humanBiteValue(cell)>1?'2':'0';
  }
  if(cell.kind==='zombie'&&cell.fullReel)tile.classList.add('claimed');
  tile.append(art);
  if(cell.kind==='zombie'&&cell.id.startsWith('second-life:')&&cell.multi>0){
    const held=document.createElement('strong');held.className='life-held-multi';held.textContent=`${cell.multi}×`;tile.append(held);
  }
  const gain=humanBiteValue(cell);
  if(gain>0){
    const stage=cell.infected?3:gain===5?5:3;
    if(gain>1)tile.classList.add('carrier',`carrier-${stage}`);
    const value=document.createElement('span');value.className='carrier-value';const digits=document.createElement('strong');digits.className='multiplier-digits';digits.textContent=`+${gain}×`;value.append(digits);tile.append(value);
    if(gain>1)tile.title=`Zombified ${LABELS[cell.kind]} · adds ${gain}× when eaten`;
  }
  return tile;
}
function stackArt(multi,span=5,horizontal=false,direction='right',headless=false,singleSymbol=false) {
  const art=document.createElement('div');art.className='stack-art';
  art.classList.add('approved-stack-art');
  if(horizontal)art.classList.add('horizontal-stack-art');
  if(span===1)art.classList.add('single-stack-art');
  const image=singleSymbol?document.createElement('span'):horizontal?createRecliningArt(direction,span):document.createElement('img');
  if(singleSymbol){image.className='symbol art-zombie';image.setAttribute('aria-hidden','true');}
  else if(!horizontal){image.className='approved-rig-fallback';image.src='assets/approved-rig/front/idle.png';image.alt='';if(headless)image.hidden=true;}
  const badge=document.createElement('strong');badge.className='stack-multi';badge.textContent=multi?`${multi}×`:'';
  if(singleSymbol)Object.assign(badge.style,{left:'0',right:'0',top:'auto',bottom:'2px',fontSize:'clamp(14px,2vw,24px)',textAlign:'center',transform:'none'});
  art.append(image,badge);art.rigReady=singleSymbol?Promise.resolve():horizontal?recliningArtReady(image):mountApprovedRig(art,{span,direction,...(headless?{clip:'headless',staticPose:true}:{})});return art;
}
function stackFrame(stack) {
  const frame=document.createElement('div');frame.className=`expanded-zombie${stack.fullReel?' full-reel':''}${stack.super?' super-zombie':''}${stack.hidden?' hidden-zombie':''}`;
  frame.dataset.headId=stack.id;frame.dataset.span=String(stack.cells.length);frame.dataset.direction=stack.direction||'up';
  if(stack.horizontal){frame.classList.add('horizontal-zombie');frame.style.gridColumn=`${stack.cells[0]%6+1} / span ${stack.cells.length}`;frame.style.gridRow=String(Math.floor(stack.cells[0]/6)+1);frame.style.setProperty('--span',stack.cells.length);return frame;}
  frame.style.gridColumn=String(stack.cells[0]%6+1);
  frame.style.gridRow=`${Math.floor(stack.cells[0]/6)+1} / span ${stack.cells.length}`;
  frame.style.setProperty('--span',stack.cells.length);frame.style.setProperty('--zombie-offset',`${-100*zombieAnchor(stack.cells.length)}%`);return frame;
}
function renderStacks(board) {
  const previous=new Map([...$('stack-layer').children].map(frame=>[frame.dataset.headId,frame])),ready=[];
  for(const stack of expandedZombies(board)){
    const visible=visibleStackCells(stack,board),mask=stackPresentationMask(stack,board),portrait=stackPortraitRegion(stack,board);
    if(!visible.length||!portrait)continue;
    const signature=JSON.stringify([stack.cells,stack.multi,stack.direction,stack.fullReel,stack.super,stack.hidden,visible,portrait.cells]),existing=previous.get(stack.id);
    if(existing?.dataset.stackSignature===signature){
      previous.delete(stack.id);ready.push(existing.querySelector('.stack-art').rigReady);
      for(const index of visible)$('board').children[index].classList.add('stack-covered');
      continue;
    }
    const frame=stackFrame(stack),backdrop=document.createElement('span');
    frame.dataset.stackSignature=signature;frame.style.maskImage=mask;frame.style.webkitMaskImage=mask;frame.style.maskSize='100% 100%';frame.style.maskRepeat='no-repeat';
    frame.classList.add('settled-zombie');backdrop.className='zombie-backdrop';backdrop.setAttribute('aria-hidden','true');
    backdrop.style.setProperty('--haze-delay',`${-(stack.cells[0]%6)*.7}s`);
    const energy=document.createElement('span');energy.className='resolved-energy';backdrop.append(energy,createInfectionField(stack.horizontal));
    for(let n=0;n<7;n++){
      const mote=document.createElement('i');mote.className='resolved-mote';
      mote.style.setProperty('--mote-x',`${8+(n*29+stack.cells[0]*13)%84}%`);
      mote.style.setProperty('--mote-drift',`${(n%3-1)*18}px`);
      mote.style.setProperty('--mote-speed',`${3.1+n*.43}s`);
      mote.style.setProperty('--mote-delay',`${-n*.69-stack.cells[0]*.13}s`);
      backdrop.append(mote);
    }
    const reframed=portrait.cells.length!==stack.cells.length;
    const art=stackArt(stack.multi,portrait.cells.length,stack.horizontal,stack.direction,false,reframed&&portrait.cells.length===1);
    if(reframed){
      frame.dataset.portraitCells=portrait.cells.join(',');
      Object.assign(art.style,{position:'absolute',left:`${portrait.left*100}%`,top:`${portrait.top*100}%`,width:`${portrait.width*100}%`,height:`${portrait.height*100}%`});
    }
    ready.push(art.rigReady);
    frame.append(backdrop,art);$('stack-layer').append(frame);
    for(const index of visible)$('board').children[index].classList.add('stack-covered');
  }
  for(const frame of previous.values()){stopApprovedRigs(frame);frame.remove();}
  return Promise.all(ready);
}
function render(board) {
  currentBoard=board;
  const fragment=document.createDocumentFragment();board.forEach((cell,index)=>fragment.append(makeTile(cell,index)));
  $('board').replaceChildren(fragment);const ready=renderStacks(board);
  const counts=Object.entries(board.reduce((result,cell)=>{result[cell.kind]=(result[cell.kind]||0)+1;return result;},{}));
  const stacks=expandedZombies(board).map(stack=>`${stack.cells.length}-position ${stack.multi} times zombie on reel ${stack.cells[0]%6+1}`);
  const carriers=board.flatMap((cell,index)=>humanBiteValue(cell)>1?[`Zombified ${LABELS[cell.kind]} adds ${humanBiteValue(cell)} times on reel ${index%6+1}, row ${Math.floor(index/6)+1}`]:[]);
  $('board').setAttribute('aria-label',`Six reels with five positions each. ${counts.map(([kind,count])=>`${count} ${LABELS[kind]}`).join(', ')}. ${[...stacks,...carriers].join('. ')}`);
  return ready;
}
async function spinReels(board,bonus=false) {
  audioDirector.stopEffects();
  effects.clear();void effects.warm();
  const previous=currentBoard.length===30?currentBoard:board;clearLines();
  const headless=await playFullReelExit($('stack-layer'),{board:previous,rate:1000/Math.max(1,duration(1000)),shouldSkip:()=>reduced||playback.read().skipping,onEvent:name=>{if(name==='head_release')soundEffect('bite');}});
  soundEffect('spin');stopApprovedRigs($('stack-layer'));$('stack-layer').replaceChildren();
  render(board);if(reduced){soundEffect('stop');await pause(100);return;}
  const surface=$('reel-effects'),bounds=surface.getBoundingClientRect();surface.replaceChildren();
  // Measure in the reel surface's local coordinates. A tease camera may still
  // be easing out when autoplay starts the next spin.
  const scaleX=bounds.width/surface.clientWidth||1,scaleY=bounds.height/surface.clientHeight||1;
  const reels=[],stripRigs=[];
  for(let reel=0;reel<6;reel++){
    const startRow=0;
    const first=$('board').children[startRow*6+reel].getBoundingClientRect(),last=$('board').children[24+reel].getBoundingClientRect();
    const top=$('board').children[reel].getBoundingClientRect();
    const gap=(($('board').children[6+reel].getBoundingClientRect().top-top.top)-top.height)/scaleY;
    const cellHeight=first.height/scaleY,unit=cellHeight+gap;
    const window=document.createElement('div');window.className='spinning-reel';
    window.style.cssText=`left:${(first.left-bounds.left)/scaleX}px;top:${(first.top-bounds.top)/scaleY}px;width:${first.width/scaleX}px;height:${(last.bottom-first.top)/scaleY}px`;
    // Keep the fixed reel texture aligned behind moving symbols. Its opaque
    // background also hides the already-resolved board beneath each strip.
    window.style.setProperty('--reel-texture-width',`${surface.clientWidth}px`);
    window.style.setProperty('--reel-texture-height',`${surface.clientHeight}px`);
    window.style.setProperty('--reel-texture-x',`${(bounds.left-first.left)/scaleX}px`);
    window.style.setProperty('--reel-texture-y',`${(bounds.top-first.top)/scaleY}px`);
    const strip=document.createElement('div');strip.className='reel-strip';strip.style.gap=`${gap}px`;
    const final=Array.from({length:5-startRow},(_,row)=>board[(row+startRow)*6+reel]);
    const filler=Array.from({length:24},(_,row)=>({id:`blur${reel}-${row}`,kind:SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]}));
    const old=Array.from({length:5-startRow},(_,row)=>previous[(row+startRow)*6+reel]);
    for(const cell of [...final,...filler,...old]){const tile=makeTile(cell);tile.style.height=`${cellHeight}px`;strip.append(tile);}
    for(const stack of expandedZombies(previous).filter(stack=>!stack.horizontal&&stack.cells[0]%6===reel&&Math.floor(stack.cells[0]/6)>=startRow)){
      const art=stackFrame(stack);art.style.cssText=`position:absolute;left:0;top:${(final.length+filler.length+Math.floor(stack.cells[0]/6)-startRow)*unit}px;width:100%;height:${stack.cells.length*unit-gap}px;--span:${stack.cells.length};--zombie-offset:${-100*zombieAnchor(stack.cells.length)}%`;const character=stackArt(stack.multi,stack.cells.length,false,stack.direction,headless.has(stack.id));art.append(character);stripRigs.push(character.rigReady);strip.append(art);
    }
    const distance=(final.length+filler.length)*unit;strip.style.transform=`translateY(${-distance}px)`;
    window.append(strip);surface.append(window);reels.push({window,strip,distance,unit});
  }
  await Promise.all(stripRigs);
  const stops=reelTeasePlan(board,bonus,playback.read().speed);let settledFS=0;
  const tease=createTeasePresentation({host:document.querySelector('.board-wrap'),board:$('board'),shouldSkip:()=>reduced||playback.read().skipping});
  const teaseAudio=bonus?null:createTeaseAudio({play:soundEffect,stopCue:name=>audioDirector.stopCue(name),focus:on=>audioDirector.focus(on),shouldSkip:()=>reduced||playback.read().skipping});
  try{await Promise.all(reels.map(async(reelView,reel)=>{
    const {window,strip}=reelView;
    const plan=stops[reel];
    // Keep a readable final approach at each speed; Skip still finishes immediately.
    const timing=plan.tease?{...plan,start:duration(plan.start),ms:duration(plan.start)+plan.ms-plan.start}:plan;
    await animate(strip,reelFrames(reelView,timing),timing.ms,{easing:'linear',fill:'forwards',...(plan.tease?{duration:timing.ms}:{})});
    window.remove();soundEffect('stop',{pan:(reel-2.5)*.19});
    const hasVial=Array.from({length:5},(_,row)=>board[row*6+reel]).some(cell=>cell.kind==='vial');
    if(hasVial){
      settledFS+=board.filter((cell,i)=>i%6===reel&&cell.kind==='vial').length;
      soundEffect('vial',{pan:(reel-2.5)*.19});
      if(!bonus){
        $('phase').textContent=`${settledFS} FS${settledFS===2?' · ONE MORE…':settledFS===3?' · OUTBREAK':settledFS===4?' · SUPER OUTBREAK':settledFS>=5?' · HIDDEN OUTBREAK':''}`;

      }
    }
    if(!bonus){tease.settle({reel,count:settledFS,board,reels});teaseAudio.settle({count:settledFS,waiting:stops.some((p,i)=>i>reel&&p.tease)});}
    if(hasVial&&!bonus)for(let i=reel;i<30;i+=6)if(board[i].kind==='vial')effects.scatter(i,teaseStage(settledFS).particle,settledFS);
    // Landing is conveyed by the symbol motion and sound, without floor particles.
    const landed=Array.from({length:5},(_,row)=>row*6+reel);
    await Promise.all([
      ...landed.filter(i=>board[i].kind==='vial').map(i=>playFS($('board').children[i].firstElementChild,'land',{animate,shouldSkip:()=>reduced||playback.read().skipping})),
      ...landed.filter(i=>board[i].kind==='zombie').map(i=>playZombieLanding($('board').children[i],{animate,shouldSkip:()=>reduced||playback.read().skipping}))
    ]);
  }));}finally{
    tease.clear();teaseAudio?.clear();surface.replaceChildren();
    for(const tile of $('board').children)tile.classList.remove('fs-locked');
  }
}
async function expandZombie(event) {
  render(event.before);
  $('phase').textContent=event.fullReel?'FULL REEL ZOMBIE':`${event.cells.length}-POSITION ZOMBIE`;
  $('message').textContent=`${event.cells.length} ${event.cells.length===1?'POSITION':'POSITIONS'} · ${event.multi?`${event.multi}× WILD`:'WILD'}${event.hidden?' · CARRIES TO NEXT SPIN':event.super?' · THIS SPIN':''}`;
  if(reduced||playback.read().skipping){
    soundEffect('land',{pan:(event.cells[0]%6-2.5)*.19});
    await render(event.board);horde(event.multi,event.biteCount,event.eaten);await pause(180);return;
  }
  try {
    soundEffect('grow',{pan:(event.cells[0]%6-2.5)*.19});
    await playZombieJump({event,board:$('board'),layer:$('bite-effects'),animate,pause,rate:1000/Math.max(1,duration(1000)),
      shouldSkip:()=>reduced||playback.read().skipping,onImpact:()=>{soundEffect('land',{pan:(event.cells[0]%6-2.5)*.19});}});
  } finally {
    await render(event.board);horde(event.multi,event.biteCount,event.eaten);
  }
  await pause(180);
}
function clearLines() {
  effects.clear('line');
  $('payline-effects').replaceChildren();
  for(const tile of $('board').children)tile.classList.remove('hit');
  for(const stack of $('stack-layer').children)stack.classList.remove('stack-hit');
}
function showLine(win) {
  clearLines();const svg=$('payline-effects'),bounds=svg.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
  const positions=win.cells.map(index=>point(index));
  const polyline=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  polyline.setAttribute('points',positions.map(at=>`${at.x},${at.y}`).join(' '));polyline.setAttribute('class','winning-line');svg.append(polyline);
  const length=positions.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-positions[i].x,p.y-positions[i].y),0);
  polyline.style.strokeDasharray=String(length);
  void animate(polyline,[{strokeDashoffset:length},{strokeDashoffset:0}],480,{easing:'ease-out'});
  effects.line(win.cells);
  for(const index of win.cells){
    $('board').children[index].classList.add('hit');
    const owner=currentBoard[index].stackId||currentBoard[index].owner||currentBoard[index].id;
    if(owner)for(const frame of $('stack-layer').children)if(frame.dataset.headId===owner)frame.classList.add('stack-hit');
  }
}
function horde(multi,bites,eaten=0) {
  currentMulti=multi; currentBites=bites; currentEaten=eaten;
  $('multiplier').innerHTML=multi?`${multi}<span>×</span>`:'—';
  $('infection-fill').style.width=`${Math.min(100,eaten/5*100)}%`;
  $('bite-count').textContent=`${eaten} EATEN`;
  $('round-bites').textContent=bites;
}
function banner(caption,amount,equation='') {
  $('win-caption').textContent=caption;$('win-amount').textContent=amount;
  $('win-equation').textContent=equation;$('win-banner').hidden=false;
  effects.win();
  void animate($('win-amount'),[{opacity:.4,transform:'translateY(7px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)'}],240);
}
function point(index) {
  const outer=$('bite-effects').getBoundingClientRect();
  const rect=$('board').children[index].getBoundingClientRect();
  return {x:rect.left-outer.left+rect.width/2,y:rect.top-outer.top+rect.height/2};
}
function renderInfection(progress=freshInfection()) {
  currentInfection={...progress};$('infection-tracker').hidden=bonusTier!=='regular';
  $('carrier-note').textContent=bonusTier?'Zombified bites: Skater +2×, Medic +3×, Builder +4×, Officer +5×, Scientist +10×.':'In base play, zombified characters add +3× or +5× when eaten. Bonuses have their own infection rules.';
  $('infection-summary').textContent=`${infectionTubes.update(progress)} / 5 INFECTED`;
}
async function walking(event) {
  const isHeart=event.type==='heart';
  const tiles=[...$('board').children],from=point(event.source),to=point(event.target);
  const rect=tiles[event.source].getBoundingClientRect(),dx=to.x-from.x,dy=to.y-from.y;
  const victim=event.human?`${event.gain>1?'INFECTED ':''}${LABELS[event.human].toUpperCase()}`:LABELS[event.targetKind].toUpperCase();
  $('message').textContent=event.human?`${victim} ${event.direction==='down'?'KNOCKED OFF':'SWATTED'} · +${event.gain}× · ZOMBIE NOW ${event.multi}×`:`PASSED ${victim} · NO MULTIPLIER COLLECTED`;
  if(isHeart)$('message').textContent='HEART COLLECTED · +1 RESPIN · MULTIPLIERS CARRY OVER';
  $('phase').textContent=`${event.direction==='up'?'CLIMB & SWAT':event.direction==='down'?'JUMP & KNOCK':'CRAWL & SWAT'} · ${event.direction.toUpperCase()}`;
  $('horde-note').textContent=event.hidden?'This reel keeps its multiplier. New bites add to it next spin.':event.super?`Starts on row ${event.startRow+1} or lower next spin. Collects a fresh multiplier each climb.`:'This zombie’s multiplier. Its trail stays ordinary wild.';
  soundEffect('step',{pan:(event.source%6-2.5)*.19});
  if(reduced&&(event.human||isHeart))soundEffect(isHeart?'heart':'bite',{pan:(event.target%6-2.5)*.19});
  await playSwatStep({event,board:$('board'),layer:$('bite-effects'),animate,pause,rate:1000/Math.max(1,duration(1000)),shouldSkip:()=>reduced||playback.read().skipping,onContact:()=>{soundEffect(isHeart?'heart':event.human?'bite':'step',{pan:(event.target%6-2.5)*.19,intensity:event.gain>1?1.1:1});effects.bite(event.target,event.direction,event.gain);}});
  render(event.board);$('bite-effects').replaceChildren();
  if(event.infection){renderInfection(event.infection);render(event.board);}
  void animate($('board').children[event.source],[{filter:'brightness(2)'},{filter:'brightness(1)'}],260);
  horde(event.multi,event.biteCount,event.eaten);
  if(isHeart&&!playback.read().skipping){
    const award=document.createElement('strong');award.className='heart-award';award.textContent='+1 RESPIN';$('bite-effects').append(award);
    try{
      await animate(award,[{opacity:0,transform:'translate(-50%,-25%) scale(.65)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.06)',offset:.25},{opacity:1,transform:'translate(-50%,-55%) scale(1)',offset:.8},{opacity:0,transform:'translate(-50%,-85%) scale(.96)'}],1000);
      if(reduced)await pause(700);
    }finally{award.remove();}
  }
  if(event.unlocked){
    $('message').textContent=`${LABELS[event.unlocked].toUpperCase()} INFECTED · FUTURE BITES ADD ${HUMAN_MULTIS[event.unlocked]}×`;
    const portrait=$('infection-people').children[PEOPLE.indexOf(event.unlocked)];
    await animate(portrait,[{filter:'brightness(2)'},{filter:'brightness(1)'}],340);soundEffect('infect');
  }
  void animate($('multiplier'),[{transform:'translateY(5px) scale(1.12)'},{transform:'translateY(0) scale(1)'}],180);
  await pause(event.gain>1?90:event.gain>0?0:160);
}
async function claimReel(event) {
  render(event.board);event.cells.forEach(index=>$('board').children[index].classList.add('reel-filled'));
  horde(event.multi,event.biteCount,event.eaten);$('round-waves').textContent=event.reelCount;
  $('phase').textContent='FULL REEL';$('message').textContent=`REEL ${event.reel+1} · ${event.multi?`${event.multi}×`:'WILD'}${event.hidden?' · MULTIPLIER CARRIES OVER':event.super?' THIS SPIN · BOTTOM START HELD':' COMBINED ON ONE ZOMBIE'}`;
  soundEffect('full',{pan:(event.reel-2.5)*.19});await pause(200);
}
function scatterArt(node,count){
  node.replaceChildren();
  for(let i=0;i<Math.min(5,count);i++){const symbol=document.createElement('span');symbol.className='symbol art-vial';node.append(symbol);}
}
function leaveFeature(){
  audioDirector.setScene('base');
  bonusTier=null;delete $('game').dataset.bonusTier;
  $('game').classList.remove('outbreak-active');
  renderInfection();currentSuperStarts=Array(6).fill(null);currentCarriedMultis=Array(6).fill(0);
  $('horde-note').textContent='Eat humans. Leave wilds. Cards stop the walk.';
}
async function teaseMystery(tier){
  $('phase').textContent='MYSTERY OUTBREAK';
  $('message').textContent='3 FS · OUTBREAK / 4 FS · SUPER / 5 FS · HIDDEN';
  await spinReels(mysteryScatterBoard(tier));
  await pause(650);
}
function enterFeature(event) {
  return bonusScreen.show({onCovered:()=>{
    audioDirector.stopEffects();audioDirector.setScene('bonus');
    $('game').classList.add('outbreak-active');soundEffect('bonus');
    // Make all bonus layout changes while the opaque doors cover the scene.
    $('game').dataset.freeSpins='pending';
    bonusTier=event.tier;$('game').dataset.bonusTier=event.tier;renderInfection(event.infection);
    const bonus=BONUS_FEATURES[event.tier],presentation=FEATURE_PRESENTATION[event.tier];
    $('feature').dataset.tier=event.tier;
    $('feature').dataset.view='intro';
    $('feature').setAttribute('aria-describedby','feature-award feature-description');
    $('feature-award').hidden=false;$('feature-result').hidden=true;
    $('feature-kicker').textContent=event.mystery?'MYSTERY REVEALED':event.bought?'BONUS BOUGHT':`${bonus.scatters} SCATTERS · QUARANTINE BREACHED`;
    $('feature-heading').textContent=bonus.title;$('feature-amount').textContent=event.spins;
    $('feature-description').textContent=presentation.description;
    $('horde-note').textContent=event.tier==='hidden'?'Starting rows and each reel’s multiplier carry over. Every fresh bite adds to its total.':event.tier==='super'?'Starting rows stay or upgrade lower. Every spin collects new multipliers.':'Three eats unlock a human type. Infection lasts for this bonus.';
  },onContinue:()=>{freeSpins.begin(event.spins,event.tier);}});
}
function finishFeature(event,round,celebration,winAmount){
  return bonusScreen.show({onCovered:async()=>{
    // The doors are fully shut before any total or celebration is revealed.
    $('feature').dataset.view='result';$('feature').dataset.tier=event.tier;
    $('feature').setAttribute('aria-describedby','feature-result feature-description');
    $('feature-heading').textContent=BONUS_FEATURES[event.tier].title;
    $('feature-award').hidden=true;$('feature-result').hidden=false;
    const total=winAmount(event.total);
    $('feature-result-value').textContent=total;
    $('feature-result-value').style.setProperty('--result-scale',Math.min(1,9/total.length));
    $('feature-description').textContent=event.total>=WIN_TIERS.max.threshold?'25,000× ROUND LIMIT REACHED':'FREE SPINS COMPLETE';
    if(celebration){
      $('win-celebration').dataset.doorBacked='true';
      try{
        await winCelebration.show({...celebration,amount:Math.round(celebration.units*round.bet/100),preview:round.preview,speed:playback.read().speed});
      }finally{delete $('win-celebration').dataset.doorBacked;}
    }else if(event.total){soundEffect('finish');}
  },onContinue:()=>freeSpins.hide()});
}
async function play(kind=session.read().spinMode) {
  if(busy) {
    if(winCelebration.skip())return;
    if(playback.skipSpin())for(const animation of runningAnimations){try{animation.finish();}catch{}}
    effects.clear();audioDirector.stopEffects();
    return;
  }
  if(gameReady.read().status!=='ready'){toast('Artwork is still loading. Finish loading before playing.');return false;}
  await Promise.all([audioDirector.prepare(),effects.warm()]);
  // Another input may have started a round during audio decoding.
  if(busy)return false;
  let round;
  try { round=session.begin(kind,PREVIEW_MODES.includes(kind)?seeded(kind==='preview_feature'?24:kind==='outbreak'?3:2):undefined); }
  catch(error) {toast(error.message);return false;}
  busy=true;playback.endSpin();currentMode=kind;syncControls();
  if(round.result.featureSpin)$('game').dataset.featureSpin='true';else delete $('game').dataset.featureSpin;
  $('preview-notice').hidden=!round.preview;displayWin('0.00');
  $('round-waves').textContent='0';$('round-lines').textContent='0';
  $('game').classList.remove('outbreak-active');$('win-banner').hidden=true;
  void freeSpins.hide();
  horde(0,0);
  let lineCount=0;
  const winAmount=units=>money(Math.round(units*round.bet/100));
  try {
    for(const event of round.result.events) {
      if(event.type==='featureSpinStart'){
        $('message').textContent='SECOND LIFE · TWO GUARANTEED ZOMBIES · COLLECT HEARTS FOR RESPINS';
      }else if(event.type==='heartRespin'){
        soundEffect('respin');
        banner('SECOND LIFE','RESPIN','ZOMBIES RETURN · MULTIPLIERS CARRY OVER');
        await pause(1150);$('win-banner').hidden=true;
      }else if(event.type==='reveal') {
        playback.beginSpin(event.turn);syncControls();
        $('win-banner').hidden=true;$('phase').textContent=event.bonus?BONUS_FEATURES[event.tier].title:'INFECTION ZONE';
        if(event.bonus)freeSpins.reveal(event.left);
        horde(event.multi,currentBites,event.eaten);
        if(event.infection)renderInfection(event.infection);
        if(event.superStarts)currentSuperStarts=[...event.superStarts];
        if(event.carriedMultipliers)currentCarriedMultis=[...event.carriedMultipliers];
        const upgrade=event.upgrades?.find(change=>change.from!==null);
        $('message').textContent=event.bonus?(event.tier!=='regular'?`${upgrade?`REEL ${upgrade.reel+1} UPGRADED TO ROW ${upgrade.to+1}`:'ZOMBIES RETURN · UPWARD ONLY'} · ${event.tier==='hidden'?'MULTIPLIERS CARRY OVER':'FRESH MULTIPLIERS'}`:'INFECTION CARRIES OVER · BUILD STRONGER BITES'):'HUMANS ARE FOOD · CARDS STOP THE WALK';
        if(event.featureSpin){$('phase').textContent=`SECOND LIFE · SPIN ${event.turn}`;$('message').textContent=event.turn>1?'ZOMBIES RETURN · MULTIPLIERS CARRY OVER · NEW DIRECTIONS':'TWO GUARANTEED ZOMBIES · COLLECT HEARTS FOR RESPINS';}
        await spinReels(event.board,event.bonus);
        await pause(440);
      } else if(event.type==='walk'||event.type==='pass'||event.type==='heart') await walking(event);
      else if(event.type==='reelComplete') await claimReel(event);
      else if(event.type==='expand') await expandZombie(event);
      else if(event.type==='lineWin') {
        lineCount+=event.wins.length;$('round-lines').textContent=lineCount;
        const celebration=celebrationFor(event);
        $('phase').textContent='LEFT-TO-RIGHT WIN';if(!celebration)soundEffect('win');
        const featured=[...event.wins].sort((a,b)=>b.amount-a.amount).slice(0,4);
        for(const win of featured){
          showLine(win);$('message').textContent=`LINE ${win.line} · ${win.count} ${LABELS[win.kind].toUpperCase()} · ${winAmount(win.base)} × ${win.multi} = ${winAmount(win.amount)}`;
          await pause(650);
        }
        clearLines();displayWin(winAmount(event.total));
        if(celebration&&!playback.read().skipping){
          await winCelebration.show({...celebration,amount:Math.round(celebration.units*round.bet/100),preview:round.preview,speed:playback.read().speed,shouldSkip:()=>playback.read().skipping});
        }else{
          banner('SPIN WIN',winAmount(event.win),event.win<event.uncapped?'25,000× ROUND LIMIT REACHED':`${event.wins.length} WINNING ${event.wins.length===1?'LINE':'LINES'}`);
          await pause(950);$('win-banner').hidden=true;
        }
      }
      else if(event.type==='spinEnd') {
        const skipped=playback.read().skipping;
        clearLines();render(event.board);horde(event.multi,event.biteCount,event.eaten);
        if(event.infection)renderInfection(event.infection);
        if(event.carriedMultipliers)currentCarriedMultis=[...event.carriedMultipliers];
        if(event.bonus)freeSpins.settle(event.left);
        playback.endSpin();syncControls();
        if(skipped&&(event.bonus||event.featureSpin))await pause(450);
      }
      else if(event.type==='bonusStart') {
        auto.stop('bonus');
        $('win-banner').hidden=true;$('message').textContent=event.bought?'BONUS BOUGHT · QUARANTINE BREACHED':'QUARANTINE BREACHED';
        if(event.mystery)await teaseMystery(event.tier);
        await enterFeature(event);await pause(250);
      } else if(event.type==='bonusEnd') {
        $('message').textContent=`${BONUS_FEATURES[event.tier].title} COMPLETE`;
        freeSpins.complete();
        currentCarriedMultis=Array(6).fill(0);
      } else if(event.type==='roundEnd') {
        clearLines();render(currentBoard);horde(event.multi,event.biteCount,event.eaten);
        $('phase').textContent=event.bonus?`${BONUS_FEATURES[event.tier].title} COMPLETE`:'INFECTION ZONE';
        $('spin-state').textContent='25 LINES · LEFT TO RIGHT';
        $('win-banner').hidden=true;
        const celebration=celebrationFor(event);
        if(event.bonus){
          await finishFeature(event,round,celebration,winAmount);
        }else if(celebration){
          await winCelebration.show({...celebration,amount:Math.round(celebration.units*round.bet/100),preview:round.preview,speed:playback.read().speed});
        }
        $('message').textContent=round.preview?'PREVIEW COMPLETE · SPIN TO PLAY':event.total?`TOTAL WIN ${winAmount(event.total)} · MULTIPLIERS RESET NEXT SPIN`:'NO WINNING LINE · SPIN AGAIN';
      }
    }
    session.finish(round);displayWin(money(session.read().lastWin));
    if(!round.preview){roundHistory.unshift({time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),kind:round.kind,cost:round.cost,win:session.read().lastWin});roundHistory.length=Math.min(50,roundHistory.length);}
    return true;
  } catch(error) {
    console.error('Round display failed',error);session.cancel(round);
    $('win-banner').hidden=true;displayWin('0.00');
    toast('The round could not finish. Your free-play credits were restored.');
    auto.stop('error');return false;
  } finally {
    winCelebration.cancel();bonusScreen.cancel();
    void freeSpins.hide();
    effects.clear();
    busy=false;playback.endSpin();$('bite-effects').replaceChildren();$('reel-effects').replaceChildren();clearLines();syncControls();
    delete $('game').dataset.featureSpin;
  }
}

function openDialog(id){if(busy&&id!=='settings')return;auto.stop();if(id==='settings')positionSettingsMenu();$(id).showModal();syncControls();}
function spinAction(){if(completeFeature){completeFeature();return;}const wasAuto=auto.active;auto.stop();if(busy||!wasAuto)void play();}
function preview(kind){if(busy||auto.active)return;$('settings').close();void play(kind);}
async function previewWin(tier){
  if(busy||auto.active||pending||!WIN_TIERS[tier])return;
  $('settings').close();busy=true;syncControls();
  try{await audioDirector.prepare();const units=WIN_TIERS[tier].threshold;await winCelebration.show({tier,units,amount:Math.round(units*session.read().bet/100),preview:true,speed:'normal'});}
  finally{busy=false;syncControls();}
}
function changeBet(direction){if(busy||auto.active||pending)return;session.changeBet(direction);syncControls();}
function resetCredits(){if(busy||auto.active)return;session.reset();syncControls();displayWin('0.00');toast('Free-play credits reset to 10,000.00.');}
function setSpinMode(mode){
  if(busy||auto.active||pending)return false;
  const state=session.read();
  if(mode!=='base'&&state.credits<state.bet*roundCostMultiplier(mode)){
    toast('Not enough free-play credits for this spin mode. Lower your bet or reset credits in the menu.');
    syncControls();return false;
  }
  session.setSpinMode(mode);syncControls();return true;
}
function toggleSpinMode(mode){
  if(setSpinMode(session.read().spinMode===mode?'base':mode))$('shop').close();
}
function bonusBuyAction(){
  if(busy||auto.active||pending)return;
  if(session.read().spinMode!=='base')setSpinMode('base');
  else {openDialog('shop');soundEffect('buy');}
}
function selectBuy(kind){
  if(busy||auto.active||pending||!Object.hasOwn(BONUS_BUYS,kind))return;
  const state=session.read(),offer=BONUS_BUYS[kind],cost=state.bet*offer.cost;
  if(state.credits<cost){toast('Not enough free-play credits for this bonus.');return;}
  soundEffect('buy');pending={kind,bet:state.bet,cost};
  const mystery=kind==='buy_mystery';
  $('confirm').dataset.mode=mystery?'mystery':offer.tier;
  $('confirm-eyebrow').textContent=mystery?'40% OUTBREAK · 50% SUPER · 10% HIDDEN':`${offer.scatters} SCATTERS · ${offer.spins} FREE SPINS`;
  scatterArt($('confirm-scatters'),mystery?1:offer.scatters);
  $('confirm-scatters').classList.toggle('mystery-symbols',mystery);
  $('confirm-title').textContent=offer.title;$('confirm-description').textContent=offer.description;
  $('confirm-price').textContent=money(cost);$('confirm-balance').textContent=`Balance after purchase: ${money(state.credits-cost)}`;
  $('shop').close();$('confirm').showModal();syncControls();
}
function showBetPicker(){
  if(busy||auto.active||pending)return;
  const state=session.read(),costMultiplier=roundCostMultiplier(state.spinMode),modeName=state.spinMode===FEATURE_SPIN.kind?'Second Life':'Enhanced Spins';
  $('bet-picker-note').textContent=costMultiplier>1?`Choose your base bet. ${modeName} charge ${costMultiplier}× this amount per paid spin; wins use the base bet.`:'Choose your base bet for each spin.';
  $('bet-options').replaceChildren(...BETS.map((bet,index)=>{
    const button=document.createElement('button');button.className='stake-option';button.dataset.betIndex=String(index);button.setAttribute('aria-pressed',String(index===state.betIndex));
    const value=document.createElement('strong');value.textContent=money(bet);button.append(value);
    if(costMultiplier>1){const cost=document.createElement('small');cost.textContent=`${money(bet*costMultiplier)} / SPIN`;button.append(cost);}
    return button;
  }));
  openDialog('bet-picker');
  const current=$('bet-options').querySelector('[aria-pressed=true]');current.focus({preventScroll:true});current.scrollIntoView({block:'nearest'});
}
function controllerAction(action){
  if(action==='play')spinAction();
  else if(action==='betMinus'||action==='betPlus')changeBet(action==='betMinus'?-1:1);
  else if(action==='buy')bonusBuyAction();
  else if(action==='settings')openDialog('settings');
  else if(action==='bet')showBetPicker();
  else if(action==='sound')void toggleSound();
  else if(action==='turbo'){
    const next=playback.read().speed==='normal'?'turbo':'normal';playback.setSpeed(next);$('speed').value=next;syncControls();
  }else if(action==='auto'){
    if(auto.active)auto.stop();else openDialog('autoplay');
  }
}
async function toggleSound(){
  const pending=audioDirector.setEnabled(!audioDirector.read().enabled);
  await pending;sound=audioDirector.read().enabled;$('sound').classList.toggle('on',sound);
  $('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('sound').setAttribute('aria-pressed',String(sound));
  $('sound-setting').checked=sound;syncSettingsMenu();syncMobileController();
}
for(const channel of ['music','effects']){
  const input=$(channel+'-volume'),output=$(channel+'-level');
  input.value=Math.round(audioDirector.read().levels[channel]*100);output.textContent=input.value+'%';
  input.addEventListener('input',()=>{audioDirector.setLevel(channel,Number(input.value)/100);output.textContent=input.value+'%';if(Number(input.value)>0){lastChannelLevels[channel]=Number(input.value)/100;if(!audioDirector.read().enabled)void toggleSound();}syncSettingsMenu();});
}
document.addEventListener('click',event=>{
  const button=event.composedPath().find(node=>node.matches?.('button'));
  if(button&&!button.disabled&&!button.closest('#win-celebration')&&!button.hasAttribute('data-win-preview')&&!['sound','spin','feature-continue','buy','buy-outbreak','buy-super','buy-mystery'].includes(button.id)&&!['play','sound','buy'].includes(button.dataset.action))soundEffect('ui');
});
for(const button of document.querySelectorAll('[data-win-preview]'))button.addEventListener('click',()=>void previewWin(button.dataset.winPreview));
$('spin').addEventListener('click',spinAction);
$('showcase').addEventListener('click',()=>preview($('demo-mode').value));
$('demo-mode').addEventListener('change',()=>{
  const mode=$('demo-mode').value;
  const captions={single:'1 step · 2 tall',showcase:'2 steps · 3 tall',triple:'3 steps · 4 tall',down:'3 steps down · 4 tall',carriers:'2 steps · 3 tall · 8×',horizontal:'Left to right · wild trail',horizontal_left:'Right to left · wild trail'};
  $('showcase').querySelector('strong').textContent=mode.startsWith('horizontal')?'ZOMBIE WALK':mode==='carriers'?'CARRIER BITES':'ZOMBIE GROWTH';
  $('showcase').querySelector('small').textContent=captions[mode];
});
$('reel-demo').addEventListener('click',()=>preview('reel'));
$('outbreak').addEventListener('click',()=>preview('outbreak'));
$('super-preview').addEventListener('click',()=>preview('preview_super'));
$('hidden-preview').addEventListener('click',()=>preview('preview_hidden'));
$('feature').addEventListener('click',()=>completeFeature?.());
$('feature').addEventListener('cancel',event=>{event.preventDefault();completeFeature?.();});
$('feature').addEventListener('close',()=>completeFeature?.());
for(const [id,direction] of [['minus',-1],['plus',1],['shop-minus',-1],['shop-plus',1]])$(id).addEventListener('click',()=>changeBet(direction));
$('speed').addEventListener('change',()=>{playback.setSpeed($('speed').value);$('menu-quick-spin').checked=$('speed').value!=='normal';syncSettingsMenu();syncMobileController();});
$('menu-quick-spin').addEventListener('change',()=>{const value=$('menu-quick-spin').checked?'quick':'normal';playback.setSpeed(value);$('speed').value=value;syncSettingsMenu();syncMobileController();});
$('sound').addEventListener('click',()=>void toggleSound());
$('sound-setting').addEventListener('change',()=>void toggleSound());
$('rules-open').addEventListener('click',()=>openDialog('rules'));
$('menu').addEventListener('click',()=>openDialog('settings'));
$('show-rules').addEventListener('click',()=>{$('settings').close();openDialog('rules');});

function syncSettingsMenu(){
 const audio=audioDirector.read();
 for(const channel of ['music','effects'])$('menu-'+channel).setAttribute('aria-pressed',String(audio.enabled&&audio.levels[channel]>0));
 $('menu-turbo').setAttribute('aria-pressed',String(playback.read().speed==='turbo'));
 $('menu-history').disabled=busy;
}
function positionSettingsMenu(){
 const mobile=mobileController.element('settings'),anchor=mobile.getBoundingClientRect().width?mobile:$('menu');
 const rect=anchor.getBoundingClientRect(),height=window.innerHeight;
 $('settings').style.setProperty('--menu-left',Math.max(10,Math.min(window.innerWidth-260,rect.left))+'px');
 $('settings').style.setProperty('--menu-bottom',Math.max(10,Math.min(height-180,height-rect.top+8))+'px');
}
async function toggleMenuChannel(channel){
 const state=audioDirector.read(),isOn=state.enabled&&state.levels[channel]>0;
 if(isOn){lastChannelLevels[channel]=state.levels[channel];audioDirector.setLevel(channel,0);}
 else {
  if(!state.enabled){const other=channel==='music'?'effects':'music';if(state.levels[other]>0)lastChannelLevels[other]=state.levels[other];audioDirector.setLevel(other,0);}
  audioDirector.setLevel(channel,state.levels[channel]||lastChannelLevels[channel]);
  if(!state.enabled)await toggleSound();
 }
 for(const key of ['music','effects']){const level=Math.round(audioDirector.read().levels[key]*100);$(key+'-volume').value=level;$(key+'-level').textContent=level+'%';}
 syncSettingsMenu();
}
for(const channel of ['music','effects'])$('menu-'+channel).addEventListener('click',()=>void toggleMenuChannel(channel));
$('menu-turbo').addEventListener('click',()=>controllerAction('turbo'));
$('extra-rules').addEventListener('click',()=>{$('settings').close();openDialog('rules');});
$('menu-history').addEventListener('click',()=>{
 if(busy)return;
 const rows=$('history-rows');rows.replaceChildren();
 if(!roundHistory.length)rows.textContent='No completed rounds yet.';
 for(const round of roundHistory){
  const row=document.createElement('div');row.className='history-row';
  for(const text of [round.time+' · '+round.kind.replaceAll('_',' '),'BET '+money(round.cost),'WIN '+money(round.win)]){const cell=document.createElement('span');cell.textContent=text;row.append(cell);}
  rows.append(row);
 }
 $('settings').close();openDialog('history');
});
window.addEventListener('resize',()=>{if($('settings').open)positionSettingsMenu();});
$('settings').addEventListener('click',event=>{if(event.target!==$('settings'))return;const r=$('settings').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('settings').close();});

for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
$('bet-options').addEventListener('click',event=>{
  const button=event.target.closest('[data-bet-index]');if(!button||busy||auto.active||pending)return;
  const index=Number(button.dataset.betIndex);if(!Number.isInteger(index)||index<0||index>=BETS.length)return;
  changeBet(index-session.read().betIndex);$('bet-picker').close();
});
$('bet-picker').addEventListener('close',()=>{
  const target=getComputedStyle($('mobile-controller')).display!=='none'?mobileController.element('betPicker'):$('plus');target.focus({preventScroll:true});
});
for(const id of ['reset','menu-reset'])$(id).addEventListener('click',resetCredits);
$('buy').addEventListener('click',bonusBuyAction);
$('buy-outbreak').addEventListener('click',()=>selectBuy('buy_outbreak'));
$('buy-super').addEventListener('click',()=>selectBuy('buy_super'));
$('buy-mystery').addEventListener('click',()=>selectBuy('buy_mystery'));
$('activate-feature').addEventListener('click',()=>toggleSpinMode(FEATURE_SPIN.kind));
$('enhanced-setting').addEventListener('change',()=>{
  setSpinMode($('enhanced-setting').checked?'enhanced':'base');
  syncControls();
});
$('second-life-setting').addEventListener('change',()=>{
  setSpinMode($('second-life-setting').checked?FEATURE_SPIN.kind:'base');
  syncControls();
});
$('activate-enhanced').addEventListener('click',()=>toggleSpinMode('enhanced'));
for(const button of document.querySelectorAll('[data-shop-preview]'))button.addEventListener('click',()=>{$('shop').close();preview(button.dataset.shopPreview);});
$('confirm').addEventListener('close',()=>{pending=null;syncControls();});
$('confirm-back').addEventListener('click',()=>{pending=null;$('confirm').close();openDialog('shop');});
$('purchase').addEventListener('click',()=>{
  if(!pending||busy)return;const chosen=pending,state=session.read();
  if(chosen.bet!==state.bet||state.credits<chosen.cost)return;
  pending=null;$('confirm').close();void play(chosen.kind);
});
$('auto').addEventListener('click',()=>{if(auto.active){auto.stop();return;}openDialog('autoplay');});
for(const count of AUTO_COUNTS){
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Start ${count} auto spins`);
  const value=document.createElement('strong');value.textContent=String(count);
  const label=document.createElement('span');label.textContent='SPINS';button.append(value,label);
  button.addEventListener('click',()=>{$('autoplay').close();void auto.start(count);});$('auto-options').append(button);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)auto.stop('hidden');});
document.addEventListener('keydown',event=>{
  if(event.code!=='Space'||event.repeat||event.composedPath().some(node=>node.matches?.('button,input,textarea,select,summary'))||document.querySelector('dialog[open]'))return;
  event.preventDefault();spinAction();
});
render(makeRound({kind:'carriers',rng:seeded(2)}).events[0].board);
for(const [id,value] of [['guide-normal',1],['guide-infected',3]]){
  $(id).append(makeTile({id,kind:'scientist',biteValue:value}));
}
syncControls();

function readState() {
  return {...session.read(),playback:playback.read(),autoplay:{active:auto.active,remaining:auto.remaining},mode:currentMode,currentZombieMultiplier:currentMulti,currentZombieEaten:currentEaten,bites:currentBites,
    awaitingOutbreak:!!completeFeature,phase:$('phase').textContent,freeSpins:freeSpins.read(),audio:audioDirector.read(),
    entryPage:document.documentElement.dataset.entry||null,infection:{...currentInfection},bonusTier,carriedReelMultipliers:[...currentCarriedMultis],superStartingRows:currentSuperStarts.map(row=>row===null?null:row+1),board:currentBoard.map(cell=>cell.kind),expanded:expandedZombies(currentBoard),zombies:currentBoard.flatMap((cell,position)=>cell.kind==='zombie'?[{position,multi:cell.multi||0,eaten:cell.eaten||0,startRow:cell.startRow===undefined?null:cell.startRow+1}]:[]),
    carriers:currentBoard.flatMap((cell,position)=>humanBiteValue(cell)>1?[{position,kind:cell.kind,gain:humanBiteValue(cell)}]:[])};
}
function validInput(input, allowed=[]) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw Error('Invalid tool input.');
}
if(document.modelContext?.registerTool) {
  const lifecycle=new AbortController();
  const specs=[
    {name:'read_zombify_state',title:'Read Zombify state',description:'Read the current board, free-play credits and round status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){validInput(input);return readState();}},
    {name:'start_zombify_round',title:'Start a Zombify round',description:'Start a free-play spin or feature preview. Returns after the round begins animating. Base spins cost 1× base bet, Enhanced spins cost 3×; previews leave credits unchanged. Read state for progress and continue Outbreak when it is offered.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['base','enhanced','single','showcase','triple','down','carriers','horizontal','horizontal_left','reel','outbreak','preview_super','preview_hidden','preview_feature']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){validInput(input,['mode']);if(!['base','enhanced','single','showcase','triple','down','carriers','horizontal','horizontal_left','reel','outbreak','preview_super','preview_hidden','preview_feature'].includes(input.mode))throw Error('Unknown mode.');if(busy||auto.active||document.querySelector('dialog[open]'))throw Error('Finish the current round or close the dialog first.');if(session.read().credits<session.read().bet*roundCostMultiplier(input.mode))throw Error('Insufficient free-play credits.');void play(input.mode);return readState();}},
    {name:'continue_zombify_outbreak',title:'Continue Outbreak',description:'Accept the displayed Outbreak and start its awarded free spins, as with Tap to continue.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){validInput(input);if(!completeFeature)throw Error('No Outbreak is awaiting continuation.');completeFeature();return readState();}}
  ];
  for(const spec of specs) {
    try{Promise.resolve(document.modelContext.registerTool(spec,{signal:lifecycle.signal})).catch(error=>console.warn('Optional tool registration unavailable',error));}
    catch(error){console.warn('Optional tool registration unavailable',error);}
  }
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}

// A Spine renderer can be registered without touching game outcomes.
window.ZombifyAnimation={register:registerZombieAnimator,registerFS:registerFSAnimator};

// Studio adapter: presentation edits never modify math or the settled round.
window.ZombifyStudioRuntime = {
 configureAudio: (settings,assets) => {if(busy||auto.active)throw Error('Finish the round before changing audio.');audioDirector.configure(settings,assets);},
 read: () => ({...readState(), busy}),
 async start(mode='base') { if(busy || auto.active) throw Error('Finish the current round first.'); if(!['base','single','showcase','triple','reel','outbreak','preview_super','preview_hidden','preview_feature'].includes(mode))throw Error('Unknown preview.'); return play(mode); },
 continue: () => { if(completeFeature)completeFeature(); },
 resetBoard: () => { if(!busy)render(makeRound({kind:'carriers',rng:seeded(2)}).events[0].board); },
 speed: value => {if(!['normal','quick','turbo'].includes(value))throw Error('Unknown speed');playback.setSpeed(value);syncControls();},
 // Cheap round status for the studio bridge, polled every 100 ms.
 status: () => ({busy, awaitingOutbreak:!!completeFeature, autoplay:auto.active, dialog:!!document.querySelector('dialog[open]:not(#welcome)')}),
 loading: () => gameReady.read(),
 retryLoading: () => gameReady.ensure(),
 // Same as pressing SKIP during a round; an Outbreak waiting for Continue is left alone.
 skip: () => { if(busy&&!completeFeature)void play(); }
};
