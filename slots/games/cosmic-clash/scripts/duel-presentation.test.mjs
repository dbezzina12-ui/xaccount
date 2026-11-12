import test from 'node:test';
import assert from 'node:assert/strict';
import {presentDuel as present,presentDuelsInOrder,isDuelRedundant} from '../dist/duel-presentation.js';
// The media controller is tested separately; keep these tests focused on
// game settlement, ordering and skipping around a complete take.
const presentDuel=options=>present({...options,createMotion:()=>({
 prepare:async()=>true,
 play:async({onShot})=>{onShot(1);await options.wait(1800*(options.pace||1));},
 stop(){}
})});

function overlay(){
 const fields=new Map();
 return {hidden:true,dataset:{},style:{setProperty(){}},querySelector(selector){if(!fields.has(selector))fields.set(selector,{textContent:''});return fields.get(selector);},text(name){return this.querySelector(`[data-fight="${name}"]`).textContent;}};
}
const normal={reel:3,regular:true,won:true,from:5,to:5,rival:20,lives:null,boss:false,winnerBoss:false,operation:'keep'};
test('winner keeps the displayed multiplier without a transfer or arithmetic animation',async()=>{
 for(const won of [true,false]){
  const node=overlay(),phases=[];let shot=0,resolved=0,duration=0;const award=won?'5×':'20×';
  await presentDuel({node,duel:{...normal,won,to:won?5:20},tier:'regular',wait:async ms=>{
   phases.push(node.dataset.phase);duration+=ms;
   if(node.dataset.phase==='duel'){assert.equal(node.text('hunter-value'),'5×');assert.equal(node.text('outlaw-value'),'20×');}
  },onShot:()=>shot++,onResolve:()=>resolved++});
  assert.deepEqual(phases,['duel','winner-hold','result']);assert.equal(shot,1);assert.equal(resolved,1);
  assert.equal(duration,2230);assert.equal(node.dataset.winner,won?'hunter':'outlaw');
  assert.equal(node.text(won?'hunter-value':'outlaw-value'),award);assert.equal(node.text('transfer'),'');
  assert.equal(node.text('formula'),'');assert.equal(node.text('award'),award);assert.equal(node.text('result'),'WINNER');assert.equal(node.hidden,true);
 }
});
test('a persistent challenger victory shows the new multiplier and remaining lives',async()=>{
 const node=overlay(),phases=[];
 await presentDuel({node,duel:{...normal,regular:false,won:false,from:25,to:5,rival:5,lives:2,previousLives:3,fighter:'outlaw'},tier:'super',wait:async()=>{phases.push(node.dataset.phase);}});
 assert.equal(node.dataset.incumbent,'outlaw');assert.equal(node.text('award'),'5×');assert.equal(node.text('formula'),'2 LIVES LEFT');assert.equal(node.text('transfer'),'');assert(!phases.includes('transfer'));
});
test('Boss presentation shows multiplication and clearly marks a capped award',async()=>{
 for(const capped of [false,true]){
  const node=overlay(),duel={...normal,rival:5,boss:true,winnerBoss:true,from:capped?320:5,to:capped?1024:25,operation:'multiply',multiplierCapped:capped};
  await presentDuel({node,duel,tier:'hidden',wait:async()=>{}});
  assert.equal(node.dataset.boss,'true');assert.equal(node.dataset.operation,'multiply');assert.equal(node.text('result'),'BOSS POWER');
  assert.equal(node.text('formula'),capped?'320 × 5':'5 × 5');assert.equal(node.text('award'),capped?'1024× CAP':'25×');
 }
});
test('God Mode shows doubling rather than falsely stealing a rival value',async()=>{
 for(const capped of [false,true]){
  const node=overlay(),duel={...normal,regular:false,from:capped?640:320,to:capped?1024:640,rival:15,operation:'double',multiplierCapped:capped};
  await presentDuel({node,duel,tier:'hidden',wait:async()=>{}});
  assert.equal(node.text('result'),'DOUBLED');assert.equal(node.text('transfer'),'2×');
  assert.equal(node.text('formula'),capped?'640 × 2':'320 × 2');assert.equal(node.text('award'),capped?'1024× CAP':'640×');
 }
});
test('a new Boss gets a readable reel entrance that can be skipped without changing its award',async()=>{
 for(const skipEntrance of [false,true]){
  const node=overlay(),phases=[];let skipped=false,resolved=0;
  await presentDuel({node,duel:{...normal,boss:true,bossEntrance:true,winnerBoss:true,to:25,operation:'multiply'},tier:'super',instant:()=>skipped,wait:async ms=>{
   phases.push(node.dataset.phase);
   if(node.dataset.phase==='boss-arrival'){assert.equal(ms,120);skipped=skipEntrance;}
  },onResolve:()=>resolved++});
  assert.equal(phases[0],'boss-arrival');assert.equal(resolved,1);assert.equal(node.text('award'),'25×');
  assert.equal(phases.length,skipEntrance?1:4);assert.equal(node.hidden,true);
 }
});
test('skipping at any phase resolves once and suppresses all remaining waits and gunshots',async()=>{
 for(const skipAfter of [0,1,2,3]){
  const node=overlay();let skipped=skipAfter===0,waits=0,shots=0,resolved=0;
  await presentDuel({node,duel:normal,tier:'regular',instant:()=>skipped,wait:async()=>{waits++;if(waits===skipAfter)skipped=true;},onShot:()=>{assert(!skipped);shots++;},onResolve:()=>resolved++});
  assert.equal(waits,skipAfter);assert.equal(resolved,1);assert.equal(shots,skipAfter===0?0:1);
  assert.equal(node.text('award'),'5×');assert.equal(node.hidden,true);
 }
});
test('a lost life or defeated reel shows no multiplier transfer or false award',async()=>{
 for(const lives of [2,0]){
  const node=overlay(),phases=[];
  await presentDuel({node,duel:{...normal,regular:false,won:false,from:8,to:8,rival:50,lives,previousLives:lives+1,dead:lives===0,operation:'hold'},tier:'super',wait:async()=>{phases.push(node.dataset.phase);}});
  assert.equal(node.text('result'),lives?'LIFE LOST':'K.O.');assert.equal(node.text('award'),lives?'2 LIVES':'REEL LOST');assert.equal(node.dataset.winner,'outlaw');
  assert.equal(node.text('hunter-value'),'8×');assert.equal(node.text('outlaw-value'),'50×');assert.equal(node.text('formula'),lives?'2 LIVES LEFT':'');assert(!phases.includes('transfer'));assert(phases.includes('life-loss'));
 }
});
test('VS reels open left to right, await each complete fight, and preserve the recorded book',async()=>{
 const order=[];let active=0,maximum=0;
 const duels=Object.freeze([{reel:1},{reel:4},{reel:2}].map(Object.freeze));
 await presentDuelsInOrder(duels,async duel=>{
  active++;maximum=Math.max(maximum,active);order.push(`start ${duel.reel}`);
  await presentDuel({node:overlay(),duel:{...normal,...duel},wait:async()=>{await Promise.resolve();},onResolve:async()=>{await Promise.resolve();order.push(`result ${duel.reel}`);}});
  order.push(`end ${duel.reel}`);active--;
 });
 assert.deepEqual(duels.map(d=>d.reel),[1,4,2]);
 assert.equal(maximum,1);assert.deepEqual(order,['start 1','result 1','end 1','start 2','result 2','end 2','start 4','result 4','end 4']);
});
test('already capped persistent winners resolve once without a fight, delay or gunshot',async()=>{
 for(const tier of ['hidden','super'])for(const boss of [false,true]){
  const cap=tier==='hidden'?1024:256,lives=tier==='hidden'?null:3;
  const duel={...normal,regular:false,from:cap,to:cap,lives,previousLives:lives,boss,winnerBoss:boss,operation:tier==='hidden'?(boss?'multiply':'double'):'keep'};
  const node=overlay();let resolutions=0,shows=0,hidden=true;
  Object.defineProperty(node,'hidden',{get:()=>hidden,set:value=>{hidden=value;if(!value)shows++;}});
  assert.equal(isDuelRedundant(duel,tier),true);
  await presentDuel({node,duel,tier,wait:()=>assert.fail('Capped win must not wait'),onShot:()=>assert.fail('Capped win must not fire'),onResolve:()=>resolutions++});
  assert.equal(resolutions,1);assert.equal(shows,0);assert.equal(node.hidden,true);
 }
});
test('first reaching the cap still plays the fight and awards the upgrade',async()=>{
 const node=overlay(),duel={...normal,regular:false,from:640,to:1024,lives:null,previousLives:null,operation:'double',multiplierCapped:true};
 const phases=[];assert.equal(isDuelRedundant(duel,'hidden'),false);
 await presentDuel({node,duel,tier:'hidden',wait:async()=>{phases.push(node.dataset.phase);}});
 assert(phases.includes('duel'));assert(phases.includes('transfer'));assert.equal(node.text('award'),'1024× CAP');
});
test('a capped Last Stand defeat applies its life loss without replaying combat',async()=>{
 for(const lives of [2,0]){
  const node=overlay(),duel={...normal,regular:false,from:256,to:256,won:false,lives,previousLives:lives+1,dead:lives===0,operation:'hold'};let resolved=0,appliedLives;
  assert.equal(isDuelRedundant(duel,'super'),false);
  await presentDuel({node,duel,tier:'super',wait:()=>assert.fail('No fight wait at cap'),onShot:()=>assert.fail('No shots at cap'),onResolve:()=>{resolved++;appliedLives=duel.lives;}});
  assert.equal(resolved,1);assert.equal(appliedLives,lives);assert.equal(node.hidden,true);
 }
});

test('result waits for the whole generated take before revealing or applying the award',async()=>{
 const node=overlay();let finishVideo,resolved=false;
 const pending=present({node,duel:normal,wait:async()=>{},createMotion:()=>({
  prepare:async()=>true,play:()=>new Promise(done=>{finishVideo=done;}),stop(){}
 }),onResolve:()=>{resolved=true;}});
 await Promise.resolve();await Promise.resolve();
 assert.equal(node.dataset.phase,'duel');assert.equal(resolved,false);
 finishVideo(true);await pending;assert.equal(resolved,true);assert.equal(node.hidden,true);
});
test('unavailable video still settles the exact recorded outcome once',async()=>{
 const node=overlay();let resolved=0;
 await present({node,duel:normal,wait:async()=>{},createMotion:()=>({prepare:async()=>false,play:()=>assert.fail('Cannot play unavailable media'),stop(){}}),onResolve:()=>resolved++});
 assert.equal(resolved,1);assert.equal(node.text('award'),'5×');assert.equal(node.hidden,true);
});

test('a fresh VS finishes opening before combat starts, and skipping it still settles once',async()=>{
 for(const skipOpening of [false,true]){
  const node=overlay();let finishOpening,skipped=false,plays=0,resolutions=0;
  const job=present({node,duel:normal,instant:()=>skipped,wait:async()=>{},
   createMotion:()=>({prepare:async()=>true,play:async()=>{plays++;},stop(){}}),
   onReveal:()=>new Promise(resolve=>{finishOpening=resolve;}),onResolve:()=>resolutions++});
  await Promise.resolve();await Promise.resolve();
  assert.equal(node.dataset.phase,'reveal');assert.equal(node.hidden,false);
  assert.equal(plays,0);assert.equal(resolutions,0);
  skipped=skipOpening;finishOpening();await job;
  assert.equal(plays,skipOpening?0:1);assert.equal(resolutions,1);
  assert.equal(node.text('award'),'5×');assert.equal(node.hidden,true);
 }
});

test('media preparation completes before the VS reveals the first video frame',async()=>{
 const node=overlay();let ready,opened=false,resolved=0;
 const pending=present({node,duel:normal,wait:async()=>{},createMotion:()=>({
  prepare:()=>new Promise(resolve=>ready=resolve),play:async()=>true,stop(){}
 }),onReveal:async()=>{opened=true;},onResolve:()=>resolved++});
 assert.equal(opened,false);assert.equal(node.hidden,false);assert.equal(resolved,0);
 ready(true);await pending;assert.equal(opened,true);assert.equal(resolved,1);assert.equal(node.hidden,true);
});
