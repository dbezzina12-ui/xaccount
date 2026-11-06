import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shownTotal, paidOf, credits} from '../presentation/win-ledger.mjs';
import {playSixRound as sixView} from '../engine/six.js';
import {playRound,seeded} from '../engine/engine.js';
import {winOf} from '../engine/settle.js';
import {BETS} from '../engine/rules.js';

for(const variant of ['collections','flat','ladder'])test(variant+' totals survive every bonus cursor and dead spin',()=>{
 let deadAfterWin=0;
 for(const mode of ['base','nightshift','doublepost','mystery'])for(const seed of [1,2,20,52,432,2443]){
  const round=variant==='collections'?playRound({mode,rng:seeded(seed)}):sixView({mode,rng:seeded(seed),variant});
  assert.equal(shownTotal(round,{stage:'base',next:0}),0);
  let expected=paidOf(round.spin);
  for(const [next,spin] of (round.bonus?.spins||[]).entries()){
   const restored=JSON.parse(JSON.stringify({stage:'bonus',next}));
   assert.equal(shownTotal(round,restored),expected);
   if(expected && !paidOf(spin))deadAfterWin++;
   expected+=paidOf(spin);
   assert.equal(shownTotal(round,{stage:'bonus',next:next+1}),expected);
   for(const bet of BETS)assert.equal(winOf(expected,bet),expected*bet/100);
  }
  assert.equal(expected,round.total);
  assert.equal(shownTotal(round,{stage:'end',next:round.bonus?.spins.length||0}),round.total);
 }
 assert.ok(deadAfterWin>0);
});
test('credits always retain decimal cents',()=>{
 assert.equal(credits(0),'0.00');assert.equal(credits(1000000),'10,000.00');assert.equal(credits(109),'1.09');
});
test('display uses capped paid awards, not raw multiplied wins',()=>{
 const round={total:2500000,spin:{win:100},bonus:{spins:[{win:3000000,paid:2499900}]}};
 assert.equal(shownTotal(round,{stage:'bonus',next:1}),2500000);
});
