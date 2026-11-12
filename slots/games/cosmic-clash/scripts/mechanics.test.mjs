import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluate,combineMultipliers,winnerMultiplier,resolveDuel,addCrossfire,applyWildReels,makeRound,rng} from '../dist/math.js';
import {RULES,multiplierCap,cashWin,quote,poolOptions} from '../dist/config.js';
import {pickEntry,chooseTier,createSession} from '../dist/session.js';
import {WIN_TIERS,winTier} from '../dist/win-presentation.js';
import {createAutoSpins} from '../dist/auto-spins.js';
const board=(name='HELMET')=>Array.from({length:5},()=>Array.from({length:5},()=>({name})));
test('50 lines pay longest matches, with additive VS multipliers',()=>{
 assert.equal(evaluate(board()).payout,50*125);
 const wilds=applyWildReels(board(),[{id:1,reel:1,multiplier:4},{id:2,reel:3,multiplier:8}]);
 assert.equal(evaluate(wilds).payout,50*125*12);
 const blocked=board();blocked[0]=blocked[0].map(()=>({name:'SCATTER'}));assert.equal(evaluate(blocked).payout,0);
 const interrupted=board();interrupted[2]=interrupted[2].map(()=>({name:'E'}));assert.equal(evaluate(interrupted).payout,0);
 const ordinary=applyWildReels(board(),[{id:1,reel:1,multiplier:0}]);assert.equal(evaluate(ordinary).payout,50*125);
});
test('ordinary fights keep exactly the winning value, including gold Bosses',()=>{
 assert.equal(winnerMultiplier(5,20,true),5);assert.equal(winnerMultiplier(5,20,false),20);
 assert.equal(winnerMultiplier(250,5,true),250);assert.equal(winnerMultiplier(250,5,false),5);
 for(const pair of [[0,5],[5,-1],[5,NaN],[257,5],[5,1.5]])assert.throws(()=>winnerMultiplier(...pair,true),/Invalid/);
 assert.throws(()=>combineMultipliers(5,5),/exclusive to God Mode/);
});
test('Last Stand changes owners and keeps the winner value while consuming lives',()=>{
 const initial={id:1,reel:1,lives:3,multiplier:25,boss:true,fighter:'boss'};
 let s=resolveDuel(initial,true,'super',5);assert.deepEqual(s,initial);
 s=resolveDuel(s,false,'super',5);assert.equal(s.multiplier,5);assert.equal(s.lives,2);assert.equal(s.boss,false);assert.equal(s.fighter,'outlaw');
 s=resolveDuel(s,true,'super',50);assert.equal(s.multiplier,5);assert.equal(s.lives,2);assert.equal(s.fighter,'outlaw');
 s=resolveDuel(s,false,'super',50);assert.equal(s.multiplier,50);assert.equal(s.lives,1);assert.equal(s.fighter,'hunter');
 s=resolveDuel(s,false,'super',2);assert.equal(s.multiplier,2);assert.equal(s.lives,0);
});
test('God Mode alone grows multipliers and permits 1024x, while Bosses multiply the rival',()=>{
 let state={id:1,reel:0,multiplier:5,lives:null,boss:false};
 for(const expected of [10,20,40,80,160,320,640,1024,1024,1024]){
  state=resolveDuel(state,false,'hidden',15);assert.equal(state.multiplier,expected);assert.equal(state.lives,null);
 }
 assert.equal(combineMultipliers(320,3,false,'hidden'),640);
 assert.equal(combineMultipliers(320,3,true,'hidden'),960);
 assert.equal(combineMultipliers(640,3,true,'hidden'),1024);
 for(const tier of [null,'regular','super']){
  assert.equal(multiplierCap(tier),256);assert.equal(winnerMultiplier(250,20,false,tier),20);
  assert.throws(()=>winnerMultiplier(320,3,true,tier),/Invalid/);
 }
});
test('the 25000x maximum uses the real cap and preserves lower win celebrations',()=>{
 assert.equal(RULES.maxWin,2500000);assert.equal(WIN_TIERS.at(-1).minimum,RULES.maxWin);
 assert.equal(winTier(1000000).id,'relic');assert.equal(winTier(RULES.maxWin,{capped:true}).id,'max');
});
test('Crossfire needs two VS reels, adds temporary wilds only to eligible spots',()=>{
 const states=[{id:1,reel:1,multiplier:8},{id:2,reel:3,multiplier:4}];
 assert.deepEqual(addCrossfire(board(),states.slice(0,1),rng(1)),[]);
 for(let seed=1;seed<=30;seed++){
  const b=applyWildReels(board(),states);b[0][0]={name:'SCATTER'};const shots=addCrossfire(b,states,rng(seed));
  assert(shots.length>=2&&shots.length<=4);assert.equal(new Set(shots.map(p=>`${p.reel},${p.row}`)).size,shots.length);
  for(const p of shots){assert(![1,3].includes(p.reel));assert.deepEqual(b[p.reel][p.row],{name:'WILD',temporary:true});}
  assert.equal(b[0][0].name,'SCATTER');assert.equal(b[1][0].multiplier,8);
 }
});
test('bonus reveal counts and decorative trigger do not change the round award',()=>{
 for(const [tier,count] of Object.entries({regular:3,super:4,hidden:5}))for(const seed of [1,17,73,256]){
  const plain=makeRound(seed,{tier}),reveal=makeRound(seed,{tier,trigger:true});
  assert.equal(reveal.events[0].board.flat().filter(s=>s.name==='SCATTER').length,count);
  assert.deepEqual(reveal.events.slice(1),plain.events);assert.equal(reveal.payoutMultiplier,plain.payoutMultiplier);
 }
});
test('complete bonus state chains: lives, persistence, zero spins, cap, and guaranteed hidden VS',()=>{
 let sawDead=false,sawCap=false,sawAdditional=false,sawBossWin=false,sawBossDefeat=false;
 for(const tier of ['regular','super','hidden'])for(let seed=1;seed<=180;seed++){
  const round=makeRound(seed,{tier}),start=round.events[0],spins=round.events.filter(e=>e.type==='spin');
  assert.equal(start.type,'bonusStart');if(tier==='hidden'){assert.equal(start.states.length,1);assert.equal(start.states[0].multiplier,RULES.startMultiplier);}
  let total=0;
  for(let i=0;i<spins.length;i++){
   const e=spins[i];assert.equal(e.remaining,10-e.turn);assert.equal(e.win,Math.min(evaluate(e.board).payout,RULES.maxWin-total));total+=e.win;assert.equal(e.totalWin,total);
   if(tier==='regular')assert.equal(e.before.length,0);
   if(i&&tier!=='regular')assert.deepEqual(e.before,spins[i-1].states);
   for(const s of e.states){assert(s.multiplier<=multiplierCap(tier));assert(s.lives===null||s.lives>0);}
   for(const d of e.duels){
    const god=tier==='hidden',expected=god?Math.min(1024,d.boss?d.from*d.rival:d.from*2):(d.won?d.from:d.rival);
    assert.equal(d.operation,god?(d.boss?'multiply':'double'):d.dead?'hold':'keep');assert.equal(d.winnerBoss,d.boss&&d.won);
    assert.equal(d.to,expected);
    assert.equal(d.uncappedTo,god?(d.boss?d.from*d.rival:d.from*2):expected);
    assert.equal(d.multiplierCapped,d.uncappedTo>multiplierCap(tier));
    if(d.winnerBoss)sawBossWin=true;
    if(d.boss&&!d.won&&d.regular){sawBossDefeat=true;assert.equal(d.stateBoss,false);assert.equal(e.states.find(s=>s.id===d.id).fighter,'outlaw');}
    if(d.dead){sawDead=true;assert(!e.states.some(s=>s.id===d.id));assert(!e.board.flat().some(s=>s.duelId===d.id));}
    if(tier==='hidden'){assert(d.won);assert.equal(d.to,combineMultipliers(d.from,d.rival,d.boss,tier));}
   }
   if(tier==='hidden'&&e.states.length>1)sawAdditional=true;
  }
  assert.equal(total,round.payoutMultiplier);assert(total<=RULES.maxWin);if(total===RULES.maxWin)sawCap=true;else assert.equal(spins.at(-1).remaining,0);
 }
 assert(sawDead&&sawCap&&sawAdditional&&sawBossWin&&sawBossDefeat);
});
test('currency uses integer base bet units and correct buy costs',()=>{
 assert.equal(quote(1e6,'bonus').cost,100e6);assert.equal(quote(2e6,'super').cost,500e6);assert.equal(quote(1e6,'mystery').cost,250e6);
 assert.equal(cashWin(2e6,250),5e6);assert.equal(cashWin(1e6,2500000),25000e6);assert.equal(cashWin(2e6,2500000),50000e6);assert.throws(()=>quote(-1,'base'));assert.throws(()=>cashWin(1e6,2500001));
});
test('missed Duel Badges remain unchanged and never substitute or trigger a fight',()=>{
 let misses=0,mixed=false;
 for(const tier of [null,'regular'])for(let seed=1;seed<=500;seed++){
  const spins=makeRound(seed,{tier}).events.filter(e=>e.type==='spin');
  for(const spin of spins)for(const landing of spin.landings){
   if(spin.duels.some(d=>d.id===landing.id))continue;
   misses++;if(spin.duels.length)mixed=true;
   const {reel,row}=landing;assert.deepEqual(spin.underlying[reel][row],spin.raw[reel][row]);assert.deepEqual(spin.board[reel][row],{name:'VS'});
   assert(!spin.states.some(s=>s.reel===reel));
   assert(!spin.wins.some(w=>w.positions.some(p=>p.reel===reel&&p.row===row)));
  }
 }
 assert(misses>0);assert(mixed,'also covers a missed badge alongside a connected reel');
});
test('fixed pool boundaries and exact mystery tier thresholds',()=>{
 const p={total:10,entries:[[1,3,0],[2,8,10],[3,10,20]]};assert.equal(pickEntry(p,0)[0],1);assert.equal(pickEntry(p,.3)[0],2);assert.equal(pickEntry(p,.8)[0],3);assert.equal(pickEntry(p,.99999)[0],3);
 assert.equal(chooseTier('mystery',{},.3999),'regular');assert.equal(chooseTier('mystery',{},.4),'super');assert.equal(chooseTier('mystery',{},.89999),'super');assert.equal(chooseTier('mystery',{},.9),'hidden');
});
test('published weighted pools match mode RTP and selected seeds',async()=>{
 const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url))),report=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
 for(const [tier,pool] of Object.entries(data.pools)){
  let prev=0,total=0,bossWeight=0;
  for(const [seed,cumulative,payout] of pool.entries){
   assert(cumulative>prev);assert(Number.isSafeInteger(cumulative));const weight=cumulative-prev;total+=weight*payout;
   if(tier!=='hidden'){
    const round=makeRound(seed,poolOptions(tier));assert.equal(round.payoutMultiplier,payout);
    if(round.events.some(e=>e.duels?.some(d=>d.boss)))bossWeight+=weight;
   }
   prev=cumulative;
  }
  if(!['hidden','duel'].includes(tier)){assert.equal(bossWeight/pool.total,{base:.008,enhanced:.008,regular:.25,super:.20}[tier]);assert.equal(bossWeight/pool.total,report.pools[tier].bossRoundProbability);}
  assert.equal(prev,pool.total);assert(Math.abs(total/pool.total/100-report.pools[tier].meanWinX)<1e-8);
  for(const i of [0,1,100,pool.entries.length-1]){const [seed,,payout]=pool.entries[i];assert.equal(makeRound(seed,{...poolOptions(tier),trigger:true}).payoutMultiplier,payout);}
 }
 for(const mode of Object.values(report.modes))assert(Math.abs(mode.rtp-.96)<.00001);
});
test('actual God Mode books give extra reels in 70% of rounds, with all five reachable',async()=>{
 const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url))),report=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
 const pool=data.pools.hidden,counts={1:0,2:0,3:0,4:0,5:0},starts=[0,0,0,0,0],arrivals={};let prev=0,bossWeight=0;
 for(const [seed,cumulative,payout] of pool.entries){
  const round=makeRound(seed,{tier:'hidden'}),spins=round.events.filter(e=>e.type==='spin'),max=Math.max(...spins.map(e=>e.states.length));
  assert.equal(round.payoutMultiplier,payout);assert(payout<=RULES.maxWin);
  const opening=round.events[0].states[0],firstExtra=spins.find(e=>e.landings.length);
  assert.equal(opening.multiplier,5);starts[opening.reel]+=cumulative-prev;
  if(firstExtra){assert(firstExtra.turn>=2&&firstExtra.turn<=6);arrivals[firstExtra.turn]=(arrivals[firstExtra.turn]||0)+cumulative-prev;}
  for(const spin of spins){
   assert.equal(new Set(spin.states.map(s=>s.reel)).size,spin.states.length);assert(spin.duels.every(d=>d.won));
   if(spin.states.length>=2&&spin.states.length<5)assert(spin.crossfire.length>=2&&spin.crossfire.length<=4);
   for(const shot of spin.crossfire){
    assert(!spin.states.some(s=>s.reel===shot.reel));
    assert.deepEqual(spin.board[shot.reel][shot.row],{name:'WILD',temporary:true});
   }
  }
  if(spins.some(e=>e.duels.some(d=>d.boss)))bossWeight+=cumulative-prev;
  counts[max]+=cumulative-prev;prev=cumulative;
 }
 for(const [count,probability] of Object.entries({1:.30,2:.65,3:.045,4:.0045,5:.0005})){
  assert.equal(counts[count]/pool.total,probability);assert.equal(report.pools.hidden.maxDuelReelProbabilities[count],probability);
 }
 assert.equal(report.pools.hidden.additionalDuelProbability,.70);
 assert.deepEqual(starts.map(w=>w/pool.total),[.1,.15,.15,.3,.3]);
 assert.deepEqual(report.pools.hidden.startingReelProbabilities,starts.map(w=>w/pool.total));
 for(let turn=1;turn<=10;turn++)assert.equal(report.pools.hidden.firstAdditionalBySpin[turn],(arrivals[turn]||0)/pool.total);
 assert.equal(bossWeight/pool.total,.20);assert.equal(bossWeight/pool.total,report.pools.hidden.bossRoundProbability);
 assert(report.pools.hidden.effectiveOutcomeCount>400);assert(report.pools.hidden.mostLikelyOutcomeProbability<.01);
});
test('demo wallet charges once, settles once, and preview never alters balance',async()=>{
 const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url))),oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 globalThis.location={search:''};globalThis.fetch=async()=>({ok:true,json:async()=>data});
 try{
  const s=await createSession(),initial=s.balance,round=s.play(1e6,'super');assert.equal(s.balance,initial-250e6);assert.throws(()=>s.play(1e6));s.settle(round.id);assert.equal(s.balance,initial-250e6+round.win);assert.throws(()=>s.settle(round.id));
  const before=s.balance,preview=s.play(1e6,'base',{preview:'hidden'});assert.equal(s.balance,before);s.settle(preview.id);assert.equal(s.balance,before);
  globalThis.location.search='?sessionID=x';await assert.rejects(createSession(),/Engine release/);
 }finally{globalThis.fetch=oldFetch;globalThis.location=oldLocation;}
});
test('auto spins never overlap paid rounds and stop after a bonus begins',async()=>{
 let inFlight=0,maximum=0,count=0;const auto=createAutoSpins({play:async()=>{inFlight++;maximum=Math.max(maximum,inFlight);await Promise.resolve();count++;inFlight--;if(count===3)auto.stop('bonus');return true;},wait:async()=>{}});
 await auto.start(10);assert.equal(count,3);assert.equal(maximum,1);assert.equal(auto.active,false);assert.equal(auto.remaining,0);
});
