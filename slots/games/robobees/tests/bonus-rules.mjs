import assert from 'node:assert/strict';
import {start,spin,evaluate} from '../dist/rules.mjs';
let seed=982341;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const mode of ['super','hidden']){
 for(let run=0;run<2000;run++){
  let state=start(mode);assert(state.spots.every(n=>n===2));let bank=0;
  while(state.left){
   const r=spin(state,random),wilds=r.landing.filter(id=>id==='W').length;
   const available=state.spots.filter(n=>n<128).length;
   if(mode==='hidden'){
    assert(wilds>=1&&wilds<=2);
    assert(r.boosts.length>=Math.min(1,available)&&r.boosts.length<=Math.min(3,available));
   }else assert.equal(r.boosts.length,0);
   assert.equal(new Set(r.boosts).size,r.boosts.length);
   for(let i=0;i<20;i++){
    const active=r.boosts.includes(i)?Math.min(128,state.spots[i]*2):state.spots[i];
    assert.equal(r.active[i],active);
    assert.equal(r.state.spots[i],r.hit.includes(i)?Math.min(128,active*2):active);
   }
   assert.equal(r.amount,evaluate(r.board,r.active).amount);
   if(state.left===1){
    assert.equal(r.drops.length,bank);assert.equal(new Set(r.drops).size,bank);
    assert(r.drops.every(i=>r.landing[i]!=='W'&&r.board[i]==='W'));
   }else bank+=wilds;
   state=r.state;
  }
 }
}
const capped=start('hidden');capped.spots.fill(128);assert.equal(spin(capped,random).boosts.length,0);
console.log('40,000 bonus spins verified');
