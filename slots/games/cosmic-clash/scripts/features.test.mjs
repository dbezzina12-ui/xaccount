import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeRound,evaluate,winnerMultiplier,applyWildReels,duelCrossfireSources} from '../dist/math.js';
import {SUPER_ANTE_MIX,RULES,BETS,cashWin,quote} from '../dist/config.js';
import {chooseTier,createSession,randomTicket} from '../dist/session.js';
import {isDuelAtCap,isDuelRedundant} from '../dist/duel-presentation.js';
const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url)));
const report=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));

test('$500 base bets quote full feature prices and preserve exact maximum cash awards',()=>{
 assert.equal(BETS.at(-1),500);assert(BETS.every((n,i)=>i===0||n>BETS[i-1]));
 const stake=500e6;
 for(const [mode,cost] of Object.entries({base:500,enhanced:1500,superAnte:3000,duel:25000,bonus:50000,super:125000,mystery:125000}))assert.equal(quote(stake,mode).cost,cost*1e6);
 assert.equal(cashWin(stake,RULES.maxWin),12500000e6);
 assert.throws(()=>quote(stake+1,'base'));
});

test('ticket draws reject the uneven 32-bit tail rather than biasing rare outcomes',()=>{
 const draws=[4294967295,4000000000,3000000049];let calls=0;
 assert.equal(randomTicket(1e9,n=>{n[0]=draws[calls++];}),49);assert.equal(calls,3);
 assert.equal(randomTicket(1,n=>{n[0]=4294967295;}),0);
 assert.throws(()=>randomTicket(0));
});

test('already-maxed life-bearing Duel Spin fighters skip redundant combat',()=>{
 const d={from:256,to:256,regular:false,won:true,dead:false,lives:3,previousLives:3};
 assert(isDuelAtCap(d,null));assert(isDuelRedundant(d,null));
 assert(!isDuelRedundant({...d,won:false,lives:2},null));
 assert(!isDuelAtCap({...d,from:250},null));
});

test('Showdown cap is legal, reachable, and exactly one complete bonus in 100,000',()=>{
 let prev=0,capWeight=0,capBooks=0;
 for(const [seed,cumulative,payout] of data.pools.regular.entries){
  const weight=cumulative-prev;prev=cumulative;if(payout!==RULES.maxWin)continue;
  capWeight+=weight;capBooks++;
  const round=makeRound(seed,{tier:'regular',trigger:true});let total=0;
  for(const spin of round.events.filter(e=>e.type==='spin')){
   assert.equal(spin.before.length,0);
   for(const d of spin.duels)assert.equal(d.to,winnerMultiplier(d.from,d.rival,d.won));
   assert.equal(spin.win,Math.min(evaluate(spin.board).payout,RULES.maxWin-total));total+=spin.win;
  }
  assert.equal(total,RULES.maxWin);assert.equal(round.payoutMultiplier,total);
 }
 assert(capBooks>1);assert.equal(capWeight/data.pools.regular.total,1/100000);
});

test('Enhanced Spins triple each natural trigger probability at 3x cost',()=>{
 assert(Math.abs(Object.values(data.natural).reduce((sum,p)=>sum+p,0)-1/250)<1e-12);
 assert(Math.abs(Object.values(data.enhanced.natural).reduce((sum,p)=>sum+p,0)-3/250)<1e-12);
 assert.equal(quote(1e6,'enhanced').cost,3e6);assert.equal(quote(2e6,'enhanced').cost,6e6);
 let threshold=0;
 for(const [tier,p] of Object.entries(data.natural)){
  assert.equal(data.enhanced.natural[tier],p*3);
  assert.equal(chooseTier('enhanced',data,threshold+1e-10),tier);
  threshold+=p*3;assert.equal(chooseTier('enhanced',data,threshold-1e-10),tier);
 }
 assert.equal(chooseTier('enhanced',data,threshold),null);
 assert.equal(chooseTier('duel',data,0),null);
 assert(Math.abs(report.modes.enhanced.rtp-.96)<1e-6);
});

test('all Duel Spin books guarantee 2–5 first-spin wilds and preserve rare life chains',()=>{
 let previous=0,livesWeight=0,capWeight=0,crossfireWeight=0,sawEarlyEnd=false,sawLimit=false,sawLostOuter=false,sawFullBoard=false;
 let connectedWeight=0,allConnectedWeight=0,bothConnectedWeight=0;
 const crossfireCounts=new Set();
 const counts={2:0,3:0,4:0,5:0};
 for(const [seed,cumulative,payout] of data.pools.duel.entries){
  const weight=cumulative-previous;previous=cumulative;
  const round=makeRound(seed,{feature:'duel'}),spins=round.events.filter(e=>e.type==='spin'),first=spins[0];
  assert(first.states.length>=2&&first.states.length<=5);
  assert.equal(first.states.length,first.landings.length);
  assert.equal(new Set(first.states.map(s=>s.reel)).size,first.states.length);
  counts[first.states.length]+=weight;if(first.hasLives)livesWeight+=weight;
  const paidReels=new Set(first.wins.filter(w=>!w.word).flatMap(w=>w.positions.map(p=>p.reel))),connected=first.states.filter(s=>paidReels.has(s.reel)).length;
  if(connected)connectedWeight+=weight;if(connected===first.states.length)allConnectedWeight+=weight;if(first.states.length===2&&connected===2)bothConnectedWeight+=weight;
  if(spins.some(s=>s.crossfire.length))crossfireWeight+=weight;
  if(payout===RULES.maxWin)capWeight+=weight;
  let total=0;
  for(let i=0;i<spins.length;i++){
   const spin=spins[i];
   const sources=duelCrossfireSources(spin.states),plain=applyWildReels(spin.underlying,spin.states);
   assert.deepEqual(spin.crossfireSources,sources.map(s=>s.id));
   assert(spin.underlying.flat().every(s=>!s.temporary));
   const available=plain.flat().filter(s=>s.name!=='WILD'&&s.name!=='SCATTER').length;
   if(sources.length&&available){
    assert(spin.crossfire.length>=2&&spin.crossfire.length<=Math.min(4,available));
    crossfireCounts.add(spin.states.length);
   }else assert.equal(spin.crossfire.length,0);
   assert.equal(new Set(spin.crossfire.map(p=>p.reel+':'+p.row)).size,spin.crossfire.length);
   for(const p of spin.crossfire){
    assert(p.reel>0&&p.reel<4);assert(!spin.states.some(s=>s.reel===p.reel));
    assert.notEqual(plain[p.reel][p.row].name,'WILD');
    plain[p.reel][p.row]={name:'WILD',temporary:true};
   }
   assert.deepEqual(spin.board,plain);
   if(spin.states.length===5)sawFullBoard=true;
   if(duelCrossfireSources(spin.before).length&&!sources.length)sawLostOuter=true;
   assert(!spin.raw.flat().some(s=>s.name==='SCATTER'));
   assert.equal(spin.win,Math.min(evaluate(spin.board).payout,RULES.maxWin-total));total+=spin.win;
   assert.equal(spin.totalWin,total);
   for(const s of spin.states){assert(s.multiplier<=256);assert(s.lives===null||s.lives>0);assert(spin.board[s.reel].every(x=>x.name==='WILD'&&x.multiplier===s.multiplier));}
   for(const d of spin.duels){
    assert.equal(d.to,winnerMultiplier(d.from,d.rival,d.won));
    if(!d.won&&!d.regular)assert.equal(d.lives,d.previousLives-1);
    if(d.dead)assert(!spin.states.some(s=>s.id===d.id));
   }
   if(i){assert.deepEqual(spin.before,spins[i-1].states);assert.equal(spin.landings.length,0);}
  }
  assert.equal(round.payoutMultiplier,payout);assert.equal(total,payout);
  if(first.hasLives){
   assert(spins.length>1||first.capped);assert(first.landings.every(s=>s.lives===3));assert(spins.length<=1+RULES.duelRespins);
   assert(round.events.some(e=>e.type==='featureEnd'));
   if(spins.at(-1).states.length===0)sawEarlyEnd=true;
   if(spins.length===1+RULES.duelRespins)sawLimit=true;
  }else assert.equal(spins.length,1);
 }
 assert(sawEarlyEnd&&sawLimit);assert(capWeight>0);assert.equal(capWeight/previous,report.pools.duel.maxWinProbability);
 assert.deepEqual([...crossfireCounts].sort(),[2,3,4]);assert(sawLostOuter&&sawFullBoard);
 assert.equal(crossfireWeight/previous,report.pools.duel.crossfireRoundProbability);
 assert.deepEqual(report.pools.duel.openingConnections,{anyWildPays:connectedWeight/previous,allWildsPay:allConnectedWeight/previous,bothWildsPayGivenTwo:bothConnectedWeight/counts[2]});
 assert.equal(livesWeight/previous,.01);
 assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([n,w])=>[n,w/previous])),{2:.82,3:.16,4:.019,5:.001});
 assert.equal(quote(1e6,'duel').cost,50e6);assert.equal(quote(2e6,'duel').cost,100e6);
 assert(Math.abs(report.modes.duel.rtp-.96)<1e-6);
});

test('life respins charge once and settle the entire round at the original base bet',async()=>{
 const entry=data.pools.duel.entries.find(([seed])=>makeRound(seed,{feature:'duel'}).events[0].hasLives);
 const fixed=structuredClone(data);fixed.pools.duel={total:1,entries:[[entry[0],1,entry[2]]]};
 const originalFetch=globalThis.fetch,originalLocation=globalThis.location;
 globalThis.location={search:''};globalThis.fetch=async()=>({ok:true,json:async()=>fixed});
 try{
  const session=await createSession(),start=session.balance,round=session.play(2e6,'duel');
  assert.equal(round.cost,100e6);assert.equal(session.balance,start-100e6);
  assert(round.events.filter(e=>e.type==='spin').length>1);
  assert.equal(round.win,cashWin(2e6,entry[2]));assert.throws(()=>session.play(2e6,'duel'));
  session.settle(round.id);assert.equal(session.balance,start-100e6+round.win);assert.throws(()=>session.settle(round.id));
 }finally{globalThis.fetch=originalFetch;globalThis.location=originalLocation;}
});

test('Super Ante routes exact paid-spin boundaries to Last Stand, God Mode or an ordinary Enhanced spin',()=>{
 const total=1e9;
 assert.equal(quote(2e6,'superAnte').cost,12e6);
 assert.equal(chooseTier('superAnte',data,0),'super');
 assert.equal(chooseTier('superAnte',data,(14669752-1)/total),'super');
 assert.equal(chooseTier('superAnte',data,14669752/total),'hidden');
 assert.equal(chooseTier('superAnte',data,(15625000-1)/total),'hidden');
 assert.equal(chooseTier('superAnte',data,1/64),null);
 assert.equal(chooseTier('superAnte',data,(total-1)/total),null);
 const mean=Object.entries(SUPER_ANTE_MIX).reduce((sum,[key,p])=>sum+p*report.pools[key].meanWinX,0);
 assert.equal(mean/6,report.modes.superAnte.rtp);
 assert.ok(Math.abs(mean/6-.96)<.000001);
});
