import assert from 'node:assert/strict';
import {MATH,start,spin,evaluate,refill,features,credit} from '../dist/rules.mjs';

let seed=982341;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const indices=Array.from({length:20},(_,i)=>i);
const blank=()=>Array(20).fill(0);
const charge=n=>Math.min(128,Math.max(2,n*2));
let tumbles=0,freshWilds=0,carriedWilds=0,lateFS=0,maxWins=0;
function verify(state,r,mode){
 const bonus=state.mode!=='base',swarm=['super','hidden'].includes(state.mode);
 const touched=new Set();let active=[...r.prior],bank=state.bank,amount=0;
 for(const i of r.boosts)active[i]=charge(active[i]);
 assert.equal(new Set(r.boosts).size,r.boosts.length);
 if(state.mode==='hidden'){
  assert.ok(r.landing.includes('W'));
  const available=state.spots.filter(n=>n<128).length;
  assert.ok(r.boosts.length>=Math.min(1,available)&&r.boosts.length<=Math.min(3,available));
 }else assert.equal(r.boosts.length,0);
 if(mode==='random'){
  assert.equal(r.seeded,true);const n=r.prior.filter(Boolean).length;
  assert.ok(n>=6&&n<=12);assert.ok(r.prior.every(v=>[0,2,4,8,16,32].includes(v)));
 }else if(mode==='full32'){assert.ok(r.prior.every(v=>v===32));assert.ok(r.seeded)}
 else assert.deepEqual(r.prior,state.spots);
 for(const [n,w] of r.steps.entries()){
  const prev=r.steps[n-1];
  assert.deepEqual(w.active,active);
  if(n){
   tumbles++;
   for(let col=0;col<5;col++){
    const rows=[col,col+5,col+10,col+15],kept=rows.filter(i=>!prev.hit.includes(i));
    const vacancies=4-kept.length;
    for(let row=0;row<4;row++){
     const i=rows[row];
     if(row<vacancies){assert.equal(w.from[i],row-vacancies);if(w.landed[i]==='FS')lateFS++}
     else{
      const j=kept[row-vacancies];assert.equal(w.from[i],Math.floor(j/5));assert.equal(w.landed[i],prev.board[j]);
      if(w.landed[i]==='W'&&swarm&&!r.finale)carriedWilds++;
     }
    }
   }
  }else{assert.equal(w.from,null);assert.deepEqual(w.landed,r.landing)}
  const arrived=swarm&&!r.finale?indices.filter(i=>w.landed[i]==='W'&&(!n||w.from[i]<0)):[];
  assert.deepEqual(w.collected,arrived);
  if(n)freshWilds+=arrived.length;
  bank+=arrived.length;
  assert.equal(new Set(w.drops).size,w.drops.length);
  if(!r.finale)assert.equal(w.drops.length,0);
  for(const i of w.drops)assert.notEqual(w.landed[i],'W');
  assert.deepEqual(w.board,w.landed.map((id,i)=>w.drops.includes(i)?'W':id));
  bank-=w.drops.length;
  const score=evaluate(w.board,w.active),last=n===r.steps.length-1;
  // the cap: the step that reaches it pays only what is left, and ends the chain
  if(r.maxWin&&last){assert.ok(w.amount<=score.amount);score.amount=w.amount}
  assert.deepEqual(w.hit,score.hit);assert.equal(w.amount,score.amount);
  active=active.map((v,i)=>score.hit.includes(i)?charge(v):v);
  assert.deepEqual(w.after,active);score.hit.forEach(i=>touched.add(i));
  amount+=score.amount;
 }
 assert.equal(r.limited,false);
 assert.equal(r.amount,Math.round(amount*100)/100);
 const room=Math.round((MATH.cap-(bonus?state.total+(state.carry||0):0))*100)/100;
 if(r.maxWin){maxWins++;assert.equal(r.amount,room);assert.equal(r.trigger,null);assert.equal(r.state.left,0)}
 else{assert.ok(r.amount<room);assert.equal(r.steps.at(-1).hit.length,0);assert.equal(r.state.left,Math.max(0,state.left-1))}
 assert.equal(r.state.bank,bank);
 if(r.finale&&!r.maxWin)assert.equal(bank,0);
 assert.deepEqual(r.state.spots,bonus?active:active.map((v,i)=>r.seeded||!touched.has(i)?0:v));
 const fs=r.board.filter(x=>x==='FS').length;
 if(!r.maxWin)assert.equal(r.trigger,bonus?null:({3:'regular',4:'super',5:'hidden'}[fs]??null));
}
for(const mode of ['regular','super','hidden']){
 for(let run=0;run<1500;run++){
  let state=start(mode);assert.ok(state.spots.every(v=>v===(mode==='regular'?0:2)));
  while(state.left){
   const r=spin(state,random);verify(state,r,null);state=r.state;
  }
 }
}
// 45,000 free spins above, and 1,250 paid spins in each of the 4 paid modes
for(const mode of [null,...Object.keys(features)]){
 let state=start();
 for(let run=0;run<1250;run++){const r=spin(state,random,mode);verify(state,r,mode);state=r.state}
}
const overflow={...start('super'),left:1,bank:36};
const finale=spin(overflow,random);verify(overflow,finale,null);
assert.equal(finale.steps.reduce((n,s)=>n+s.drops.length,0),36);
assert.ok(finale.steps.filter(s=>s.drops.length).length>=2);
const capped=start('hidden');capped.spots.fill(128);assert.equal(spin(capped,random).boosts.length,0);
const sample=Array.from({length:20},(_,i)=>String(i));
const gravity=refill(sample,[5,15],0,()=>.3);
assert.deepEqual([0,5,10,15].map(i=>gravity.from[i]),[-2,-1,0,2]);
assert.equal(gravity.landed[10],'0');assert.equal(gravity.landed[15],'10');
assert.ok(freshWilds>0&&carriedWilds>0&&lateFS>0);
assert.equal(features.random.price,20);assert.equal(features.full32.price,250);
// The cap counts a natural trigger spin's win (carry): a round near it pays only the rest, then ends.
for(let run=0;run<300;run++){
 const near={...start('hidden',run%2?400:0),left:5};near.spots.fill(128);near.total=MATH.cap-near.carry-150;
 const r=spin(near,random);verify(near,r,null);
 assert.ok(r.amount<=150);if(r.maxWin)assert.equal(r.state.total+near.carry,MATH.cap);
}
// Credits in cents: a round's spins add up to its rounded total, and a capped round to exactly the cap, at the
// smallest and largest stakes ($0.10 and $500).
let cappedCredits=0;
for(const bet of [10,50000]){
 for(let run=0;run<200;run++){
  const carry=[0,0.35,1.07,412.49][run%4];
  let s={...start(run%3?'hidden':'super',carry),left:3+run%4};s.spots.fill(128);s.total=Math.round((MATH.cap-carry-[60.13,333.37,1250.01][run%3])*100)/100;
  let cents=credit(start(),carry,bet),inBonus=0; // the trigger spin
  const first=credit({...s,total:0},s.total,bet);cents+=first;inBonus+=first; // already credited
  s={...s,awardedCents:first};
  while(s.left){
   const r=spin(s,random),c=credit(s,r.amount,bet);cents+=c;inBonus+=c;s=r.state;
   if(r.maxWin){assert.equal(cents,MATH.cap*bet);cappedCredits++}
  }
  assert.equal(cents,Math.round(Math.round((carry+s.total)*100)*bet/100));
  assert.equal(inBonus,cents-credit(start(),carry,bet));
 }
}
assert.ok(cappedCredits>0);
assert.equal(credit(start(),12.34,10),123);assert.equal(credit(start(),0.35,10),4);assert.equal(credit(start(),0.05,10),1);
assert.equal(Object.keys(features).length,3);
console.log('50,000 spins verified;',tumbles,'tumbles;',freshWilds,'new banked refill Wilds;',carriedWilds,'surviving Wild observations;',lateFS,'refill scatters;',maxWins,'rounds reached the cap;',cappedCredits,'capped rounds credited exactly the cap in cents at $0.10 and $500.');
