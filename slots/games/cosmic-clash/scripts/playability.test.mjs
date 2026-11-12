import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {splitZeroGroups,splitCapGroups,mediumWeights} from './calibrate-medium.mjs';
import {distribution} from './distribution.mjs';

test('cap reservation preserves every original feature group and positive candidate',()=>{
 const entries=[0,50,100,25000,0,200,25000].map((payout,i)=>({i,payout}));
 const original=[{items:entries.slice(0,4),tickets:9000},{items:entries.slice(4),tickets:1000}];
 const groups=splitZeroGroups(splitCapGroups(original,300,25000),2000);
 assert.equal(groups.filter(g=>g.items[0].payout===25000).reduce((s,g)=>s+g.tickets,0),300);
 assert.equal(groups.filter(g=>g.items[0].payout===0).reduce((s,g)=>s+g.tickets,0),2000);
 for(const group of groups){assert(group.tickets>=group.items.length);assert(group.items.every(e=>entries[e.i]===e));}
 assert.equal(groups.filter(g=>g.items[0].i<4).reduce((s,g)=>s+g.tickets,0),9000);
 assert.throws(()=>splitCapGroups(original,10001,25000));
});

test('new complete-round cap frequencies preserve return, cost recovery and unchanged pools',async()=>{
 const current=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
 const baseline=JSON.parse(await readFile(new URL('../math/max-win-baseline.json',import.meta.url)));
 for(const [tier,oneIn] of Object.entries({duel:50000,regular:100000,super:25000})){
  const before=baseline.report.pools[tier],after=current.pools[tier];
  assert.equal(after.maxWinProbability,1/oneIn);
  assert(Math.abs(before.meanWinX-after.meanWinX)<.001);
  assert(Math.abs(before.distribution.coversCost-after.distribution.coversCost)<1e-6);
  assert.equal(before.hitRate,after.hitRate);
  assert(after.distribution.medianWinX>=before.distribution.medianWinX*.99);
 }
 const audit=JSON.parse(await readFile(new URL('../math/max-win-comparison.json',import.meta.url)));
 assert(Object.values(audit.preservedPools).every(Boolean));
 for(const mode of Object.values(audit.modes))assert(Object.values(mode.checks).every(Boolean));
});

test('offline calibration preserves feature groups while fixing zero returns and average payout',()=>{
 const entries=[0,0,50,80,100,130,180,250,500,1000].map((payout,i)=>({i,payout}));
 const original=[{items:entries.slice(0,6),tickets:700000},{items:entries.slice(6),tickets:300000}];
 const groups=splitZeroGroups(original,120000);
 assert.equal(groups.filter(g=>g.items[0].payout===0).reduce((sum,g)=>sum+g.tickets,0),120000);
 const w=mediumWeights(entries,groups,{target:130,sigma:.65,maximum:500000});
 assert(Math.abs(w.slice(0,6).reduce((a,b)=>a+b,0)-700000)<1e-6);
 assert(Math.abs(w.slice(6).reduce((a,b)=>a+b,0)-300000)<1e-6);
 assert(Math.abs(entries.reduce((sum,e)=>sum+e.payout*w[e.i],0)/1e6-130)<1e-7);
 assert(w.every(n=>n>=1&&n<=500000));
});

test('Duel Spin tickets meet playability targets without confusing partial returns with profit',async()=>{
 const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url))),report=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
 const d=distribution(data.pools.duel,50);
 assert.equal(d.anyPayout,.90);assert.equal(d.bands.zero,.10);
 assert(Math.abs(d.coversCost-.45)<.00001);assert(d.profit>.43&&d.profit<d.coversCost);
 assert(d.medianWinX>=42&&d.medianWinX<50);
 assert(d.mediumProbability>.65);assert(d.mediumShareOfReturn>.70);assert(d.largeShareOfReturn<.20);
 assert.deepEqual(d,report.pools.duel.distribution);
 assert(Math.abs(Object.values(d.bands).reduce((a,b)=>a+b,0)-1)<1e-12);
 for(const tier of ['regular','super']){const bonus=report.pools[tier].distribution;assert(bonus.mediumProbability>.65);assert(bonus.coversCost>.33);assert(bonus.largeShareOfReturn<.05);}
 assert.equal(report.pools.base.hitRate,.55);assert.equal(report.pools.enhanced.hitRate,.65);
 for(const mode of Object.values(report.modes))assert(Math.abs(mode.rtp-.96)<.00001);
});

test('winner-keeps cost recovery and bonus quality survive the higher trigger frequency',async()=>{
 const before=JSON.parse(await readFile(new URL('../math/winner-keeps-baseline.json',import.meta.url)));
 const after=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
 for(const mode of ['base','enhanced','duel','regular','super']){
  const old=before.pools[mode].distribution,next=after.pools[mode].distribution;
  assert(next.coversCost>old.coversCost+.049);assert(next.profit>old.profit);
  // The new bonus allocation can lower plain-spin medians; paid Duel and
  // complete-bonus medians retain the winner-keeps improvement.
  if(!['base','enhanced'].includes(mode))assert(next.medianWinX>old.medianWinX);
 }
 const oldGod=before.pools.hidden.distribution,newGod=after.pools.hidden.distribution;
 assert(newGod.medianWinX>=oldGod.medianWinX*.95);
 assert(newGod.coversCost>oldGod.coversCost);
 assert(newGod.bands.belowHalfCost<oldGod.bands.belowHalfCost*.1);
 assert(newGod.largeShareOfReturn<oldGod.largeShareOfReturn);
 const budget=r=>Object.entries(r.natural).reduce((sum,[tier,p])=>sum+p*r.pools[tier].meanWinX,0);
 assert(budget(after)<.96*.5);
 for(const mode of Object.keys(before.modes))assert(Math.abs(after.modes[mode].rtp-before.modes[mode].rtp)<.00001);
 for(const tier of ['regular','super','hidden'])assert(Math.abs(after.pools[tier].meanWinX-before.pools[tier].meanWinX)<.005);
});
test('more bonuses preserve hit and cost-recovery rates while Duel wilds connect more often',async()=>{
 const before=JSON.parse(await readFile(new URL('../math/bonus-frequency-baseline.json',import.meta.url)));
 const after=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
 const chance=r=>Object.values(r.natural).reduce((sum,p)=>sum+p,0);
 assert(Math.abs(chance(after)-.004)<1e-12);assert(chance(after)>chance(before)*1.30);
 for(const tier of ['regular','super','hidden']){
  assert(Math.abs(after.natural[tier]/chance(after)-before.natural[tier]/chance(before))<1e-12);
  if(tier==='hidden'){
   assert(Math.abs(after.pools.hidden.meanWinX-before.pools.hidden.meanWinX)<.001);
   assert.equal(after.pools.hidden.bossRoundProbability,before.pools.hidden.bossRoundProbability);
   assert.deepEqual(after.pools.hidden.maxDuelReelProbabilities,before.pools.hidden.maxDuelReelProbabilities);
  }
  else {assert(Math.abs(after.pools[tier].meanWinX-before.pools[tier].meanWinX)<.001);assert(Math.abs(after.pools[tier].distribution.coversCost-before.pools[tier].distribution.coversCost)<1e-6);}
 }
 for(const mode of ['base','enhanced','duel']){
  assert.equal(after.pools[mode].hitRate,before.pools[mode].hitRate);
  assert(Math.abs(after.pools[mode].distribution.coversCost-before.pools[mode].distribution.coversCost)<.000001);
  assert(Math.abs(after.modes[mode].rtp-.96)<.000001);
 }
 for(const mode of ['base','enhanced'])assert(after.pools[mode].distribution.largeShareOfReturn<before.pools[mode].distribution.largeShareOfReturn);
 assert(after.pools.duel.openingConnections.bothWildsPayGivenTwo>before.pools.duel.openingConnections.bothWildsPayGivenTwo+.03);
 assert(after.pools.duel.openingConnections.allWildsPay>before.pools.duel.openingConnections.allWildsPay+.03);
 assert(after.pools.duel.distribution.medianWinX>=before.pools.duel.distribution.medianWinX*.99);
});
test('God Mode pacing changes preserve the other five complete outcome pools',async()=>{
 const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url)));
 const before=JSON.parse(await readFile(new URL('../math/god-pacing-baseline.json',import.meta.url)));
 const after=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url))).pools.hidden;
 for(const name of ['base','enhanced','duel','regular','super']){
  assert.equal(createHash('sha256').update(JSON.stringify(data.pools[name])).digest('hex'),before.poolHashes[name],name);
 }
 assert.equal(after.maxWinProbability,before.hidden.maxWinProbability);
 assert(Math.abs(after.meanWinX-before.hidden.meanWinX)<.001);
 assert(after.distribution.medianWinX>=before.hidden.distribution.medianWinX);
 assert(after.distribution.coversCost>=before.hidden.distribution.coversCost);
});
test('calibration remains finite after an extreme award reaches its weight ceiling',()=>{
 const entries=[0,50,70,100,120,150,1000000].map((payout,i)=>({i,payout}));
 const groups=splitZeroGroups([{items:entries,tickets:1000000}],200000);
 const weights=mediumWeights(entries,groups,{target:90,sigma:1,maximum:300000,cost:100,targetCover:.45});
 assert(weights.every(w=>Number.isFinite(w)&&w>=1&&w<=300000));
 assert(Math.abs(entries.reduce((sum,e,i)=>sum+e.payout*weights[i],0)/1e6-90)<1e-7);
 assert(Math.abs(entries.reduce((sum,e,i)=>sum+(e.payout>=100?weights[i]:0),0)/1e6-.45)<1e-7);
});
