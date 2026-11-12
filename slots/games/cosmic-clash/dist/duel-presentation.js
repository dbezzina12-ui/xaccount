import {multiplierCap} from './config.js?v=god-pacing-71';
import {createDuelMotion,duelCast} from './duel-motion.js?v=96';
// Each reveal lives inside its own expanded reel. The round book already
// contains the winner; presentation and skipping never select an outcome.
export const DUEL_FIGHT_HTML=`<div class="reel-fight" aria-hidden="true" hidden>
 <span class="vs-fight-border"></span>
 <div class="fight-cube"><div class="arena-face">
 <video class="duel-motion" data-motion="scene" muted playsinline preload="auto" disablepictureinpicture></video>
 <span class="fight-boss-label">BOSS</span>
 <div class="reel-opponent opponent-top"><b class="fight-value" data-fight="hunter-value"></b></div>
 <div class="reel-opponent opponent-bottom"><b class="fight-value" data-fight="outlaw-value"></b></div>
 <span class="stolen-multiplier" data-fight="transfer"></span>
 </div><div class="winner-face"><div class="winner-face-portrait"></div><div class="reel-result"><strong data-fight="result"></strong><small data-fight="formula"></small><b data-fight="award"></b></div></div></div>
</div>`;

// The recorded book may list established fighters before newly landed ones.
// Sort only this presentation copy; preserve the book and each recorded result.
export async function presentDuelsInOrder(duels,present){for(const duel of [...duels].sort((a,b)=>a.reel-b.reel))await present(duel);}

export const isDuelAtCap=(duel,tier)=>(tier==='hidden'||tier==='super'||(!duel.regular&&Number.isInteger(duel.previousLives)))&&duel.from===multiplierCap(tier)&&duel.to===duel.from;
export const isDuelRedundant=(duel,tier)=>isDuelAtCap(duel,tier)&&duel.won&&!duel.dead&&duel.lives===duel.previousLives;

export async function presentDuel({node,duel,tier,wait,instant=()=>false,pace=1,onShot=()=>{},onOpen=()=>{},onReveal,onResolve=()=>{},createMotion=createDuelMotion}){
 // Already-capped reels never shoot again. Resolution still applies life
 // losses and removals; the caller presents those as a brief status cue.
 if(isDuelAtCap(duel,tier)){node.hidden=true;delete node.dataset.phase;await onResolve();return;}
 const find=name=>node.querySelector(`[data-fight="${name}"]`);
 const setValue=(name,value)=>{const el=find(name);el.textContent=`${value}×`;if(el.dataset)el.dataset.digits=String(String(value).length);};
 const grows=duel.operation==='double'||duel.operation==='multiply',doubles=duel.operation==='double',keeps=duel.operation==='keep';
 const lostLife=!duel.regular&&!duel.won;
 setValue('hunter-value',duel.from);
 setValue('outlaw-value',duel.rival);
 find('transfer').textContent=grows?`${doubles?2:duel.rival}×`:'';
 find('result').textContent=duel.dead?'K.O.':grows?(duel.winnerBoss?'BOSS POWER':'DOUBLED'):keeps?'WINNER':'LIFE LOST';
 find('formula').textContent=grows?`${duel.from} × ${doubles?2:duel.rival}`:lostLife&&!duel.dead?`${duel.lives} ${duel.lives===1?'LIFE':'LIVES'} LEFT`:'';
 find('award').textContent=duel.dead?'REEL LOST':!grows&&!keeps?`${duel.lives} ${duel.lives===1?'LIFE':'LIVES'}`:`${duel.to}×${duel.multiplierCapped?' CAP':''}`;
 node.dataset.winner=duel.won?'hunter':'outlaw';node.dataset.tier=tier||'base';
 const cast=duelCast(duel);
 node.dataset.winnerBoss=String(!!duel.winnerBoss);node.dataset.boss=String(!!duel.boss);node.dataset.incumbent=cast.top;node.dataset.operation=duel.operation;
 node.dataset.loser=cast.loser;node.dataset.defeated=cast[cast.loser];node.dataset.victor=cast[cast.winner];
 node.style.setProperty('--fight-pace',String(pace));
 const motion=createMotion(node,{duel,instant});
 const phase=async(name,duration)=>{node.dataset.phase=name;if(!instant())await wait(duration*pace);};
 try{
  if(instant()){await onResolve();return;}
  node.hidden=false;onOpen();
  // Mount visibly before preparation. Cold clips are started by play(),
  // which owns the startup deadline and keeps the duel photo on screen.
  const preparation=motion.prepare();
  let ready=await preparation;
  if(onReveal&&!instant()){
   if(motion.prepareFrame)ready=await motion.prepareFrame();
   if(ready){node.dataset.phase='reveal';await onReveal();}
  }
  if(duel.bossEntrance)await phase('boss-arrival',120);
  if(ready&&!instant()){
   node.dataset.phase='duel';
   // A stalled take falls through to its recorded winner; it cannot hold a spin.
   await motion.play({pace,onShot});
  }
  await phase(grows?'transfer':keeps?'winner-hold':'life-loss',130);
  node.dataset.phase='result';
  if(grows||keeps)setValue(duel.won?'hunter-value':'outlaw-value',duel.to);
  await Promise.all([onResolve(),instant()?Promise.resolve():wait(300*pace)]);
 }finally{motion.stop();node.hidden=true;delete node.dataset.phase;}
}
