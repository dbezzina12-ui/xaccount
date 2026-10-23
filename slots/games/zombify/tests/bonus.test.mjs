import test from 'node:test';
import assert from 'node:assert/strict';
import {walkZombies,walkSuper,placeSuperZombies,makeRound,seeded,freshInfection,HUMAN_MULTIS,PEOPLE,CAP,expandedZombies,humanBiteValue,step} from '../runtime/math.js';
import {lineWins,PAYTABLE} from '../runtime/paylines.js';
import {createPlayback} from '../runtime/playback.js';
const filled=()=>Array.from({length:30},(_,i)=>({id:`c${i}`,kind:'j'}));
const head=(id='z')=>({id,kind:'zombie',multi:0,direction:'up'});

test('the third bite unlocks a type; remaining same-spin humans immediately carry its rank value',()=>{
 const progress=freshInfection(),first=filled();first[25]=head();first[19].kind='skater';
 const one=walkZombies(first,seeded(1),{infection:progress});
 assert.equal(progress.skater,1);assert.equal(one.bites,1);assert.equal(one.board[19].multi,1);
 const next=filled();next[25]=head('next');next[19].kind=next[13].kind=next[7].kind='skater';
 const two=walkZombies(next,seeded(1),{infection:progress}),walks=two.events.filter(e=>e.type==='walk');
 assert.deepEqual(walks.map(e=>e.gain),[1,1,2]);assert.equal(walks[0].unlocked,null);assert.equal(walks[1].unlocked,'skater');
 assert.equal(walks[1].board[7].biteValue,2);assert.equal(walks[1].board[7].infected,true);
 assert.equal(progress.skater,3);assert.equal(two.board[7].multi,4);
 assert.equal(one.events[0].infection.skater,1,'event progress must not change when future bites happen');
 assert.deepEqual(first[25],head(),'input board stays unchanged');
 assert.ok(PEOPLE.filter(k=>k!=='skater').every(k=>progress[k]===0));
});

test('infected values follow the human paytable ranking without changing normal line wins',()=>{
 assert.deepEqual(PEOPLE.map(k=>HUMAN_MULTIS[k]),[2,3,4,5,10]);
 assert.deepEqual([...PEOPLE].sort((a,b)=>PAYTABLE[a][0]-PAYTABLE[b][0]),PEOPLE);
 for(const kind of PEOPLE){
  const board=filled();[0,1,2].forEach(i=>board[i].kind=kind);const plain=lineWins(board);
  [0,1,2].forEach(i=>Object.assign(board[i],{infected:true,biteValue:HUMAN_MULTIS[kind]}));
  assert.deepEqual(lineWins(board),plain);assert.equal(humanBiteValue(board[0]),HUMAN_MULTIS[kind]);
 }
});

test('Super passes cards to the top, includes its origin and collects only human values',()=>{
 const board=filled();board[24]=head();board[18].kind='builder';board[6].kind='scientist';
 const result=walkSuper(board),movement=result.events.filter(e=>['walk','pass'].includes(e.type));
 assert.deepEqual(movement.map(e=>e.target),[18,12,6,0]);
 assert.deepEqual(movement.map(e=>e.gain),[4,0,10,0]);
 assert.deepEqual(movement.map(e=>e.eaten),[1,1,2,2]);
 assert.equal(result.bites,2);assert.equal(result.board[0].multi,14);assert.equal(result.reels,1);
 const [stack]=expandedZombies(result.board);assert.deepEqual(stack.cells,[0,6,12,18,24]);
 assert.ok(stack.super&&stack.fullReel);assert.ok(stack.cells.every(i=>result.board[i].stackMulti===14));
 assert.equal(new Set(result.board.map(c=>c.id)).size,30);assert.deepEqual(board[24],head());
});

test('top-row and card-only Super landings remain paying wilds with no invented multiplier',()=>{
 for(const landing of [0,24]){
  const board=filled();board[landing]=head();const result=walkSuper(board);
  assert.equal(result.bites,0);assert.equal(result.board[0].multi,0);assert.equal(result.board[0].eaten,0);
  assert.equal(expandedZombies(result.board)[0].cells.length,landing/6+1);
  assert.ok(result.events.filter(e=>e.type==='pass').every(e=>e.gain===0));
  const win=lineWins(result.board).find(w=>w.line===1);assert.equal(win.multi,1);assert.equal(win.amount,win.base);
 }
});

test('row 3 returns every spin, rejects higher landings and only upgrades lower',()=>{
 const first=placeSuperZombies(filled(),undefined,seeded(1),{landings:[12]});
 assert.equal(first.starts[0],2);assert.equal(first.board[12].kind,'zombie');
 const repeat=placeSuperZombies(filled(),first.starts,()=>.99);
 assert.equal(repeat.board[12].kind,'zombie');assert.equal(repeat.board[12].multi,0);assert.equal(repeat.upgrades.length,0);
 const higher=placeSuperZombies(filled(),repeat.starts,seeded(1),{landings:[0,6]});
 assert.equal(higher.starts[0],2);assert.equal(higher.board[12].kind,'zombie');assert.equal(higher.upgrades.length,0);
 const lower=placeSuperZombies(filled(),higher.starts,seeded(1),{landings:[24]});
 assert.equal(lower.starts[0],4);assert.deepEqual(lower.upgrades,[{reel:0,from:2,to:4}]);
 assert.equal(first.starts[0],2,'later upgrades must not mutate earlier snapshots');
 for(let spin=0;spin<4;spin++){
  const bottom=placeSuperZombies(filled(),lower.starts,seeded(spin),{landings:[12,18]});
  assert.equal(bottom.board[24].kind,'zombie');assert.equal(bottom.starts[0],4);
  assert.equal(walkSuper(bottom.board).events.filter(e=>e.type==='pass').length,4);
 }
});

test('a held bottom start climbs fresh humans every spin with independent multipliers and bite counts',()=>{
 const starts=[4,null,null,null,null,null];
 for(const [people,expectedMulti,expectedBites] of [[['scientist','cop'],15,2],[['skater'],2,1],[[],0,0]]){
  const board=filled();people.forEach((kind,n)=>board[18-n*6].kind=kind);
  const placed=placeSuperZombies(board,starts,seeded(1),{landings:[]});
  assert.equal(placed.board[24].multi,0);assert.equal(placed.board[24].eaten,0);
  const result=walkSuper(placed.board),stack=expandedZombies(result.board)[0];
  assert.equal(stack.cells.length,5);assert.equal(stack.multi,expectedMulti);assert.equal(result.bites,expectedBites);
  assert.equal(result.board[0].eaten,expectedBites);assert.equal(stack.startRow,4);
  assert.equal(result.events.filter(e=>['walk','pass'].includes(e.type)).length,4);
 }
});

test('same-spin Super heads consolidate without consuming one another',()=>{
 const board=filled();board[6]=head('upper');board[24]=head('lower');board[0].kind='skater';board[18].kind='cop';
 const result=walkSuper(board);assert.equal(result.board[0].id,'upper');assert.equal(result.board[0].multi,7);
 assert.equal(result.bites,2);assert.equal(result.board.filter(c=>c.kind==='zombie').length,1);assert.equal(result.reels,1);
});

test('both bonus previews demonstrate the new rules and a new bonus starts with no prior state',()=>{
 const regular=makeRound({kind:'outbreak',rng:seeded(3)}),ends=regular.events.filter(e=>e.type==='spinEnd'&&e.bonus);
 assert.equal(ends.length,8);assert.ok(PEOPLE.every(k=>ends[4].infection[k]===3));
 assert.ok(ends.every(e=>e.board.every(c=>!c.superZombie)));
 const superRound=makeRound({kind:'preview_super',rng:seeded(2)}),superEnds=superRound.events.filter(e=>e.type==='spinEnd');
 assert.equal(superEnds.length,10);
 assert.deepEqual(superEnds.slice(0,4).map(e=>e.superStarts[0]),[2,2,4,4]);
 assert.deepEqual(superEnds.slice(0,4).map(e=>expandedZombies(e.board)[0].cells.length),[3,3,5,5]);
 for(const end of superEnds){
  const freshGains=superRound.events.filter(e=>e.type==='walk'&&e.turn===end.turn&&e.target%6===0).reduce((sum,e)=>sum+e.gain,0);
  assert.equal(expandedZombies(end.board)[0].multi,freshGains,'Super preview collects all fresh human values on that reel');
 }
 for(const kind of ['buy_outbreak','buy_super']){
  const fresh=makeRound({kind,rng:seeded(3)}),reveal=fresh.events.find(e=>e.type==='reveal');
  assert.deepEqual(reveal.infection,freshInfection());assert.ok(reveal.board.every(c=>!c.stackId&&!c.spanCells));
 }
});

test('300 Super rounds preserve or improve starting rows while rebuilding every spin and conserving payouts',()=>{
 let caps=0,returns=0,upgrades=0,lowerMultis=0;
 for(let seed=0;seed<300;seed++){
  const round=makeRound({kind:'buy_super',rng:seeded(seed)});let previous=null,sum=0,bites=0,steps=0,collected=0;
  caps+=round.total===CAP;
  for(const event of round.events){
   if(event.board){assert.equal(event.board.length,30);assert.equal(new Set(event.board.map(c=>c.id)).size,30);}
   if(event.type==='reveal'){
    collected=0;assert.equal(event.multi,0);assert.equal(event.eaten,0);
    assert.ok(event.board.every(c=>!c.stackId&&!c.spanCells&&c.kind!=='wild'));
    const heads=event.board.filter(c=>c.kind==='zombie');
    assert.ok(heads.every(c=>c.multi===0&&c.eaten===0&&c.direction==='up'));
    for(let reel=0;reel<6;reel++){
     const row=event.superStarts[reel];
     if(row!==null){assert.equal(event.board[row*6+reel].kind,'zombie');assert.equal(heads.filter(c=>c.id===`super:${reel}`).length,1);}
     if(previous?.superStarts[reel]!=null){
      returns++;assert.ok(row>=previous.superStarts[reel],'held row cannot move higher or disappear');
      upgrades+=row>previous.superStarts[reel];
     }
    }
   }
   if(['walk','pass'].includes(event.type)){
    steps++;assert.equal(event.target,step(event.source,'up'));assert.equal(event.direction,'up');
    const human=PEOPLE.includes(event.before[event.target].kind);assert.equal(event.gain,human?HUMAN_MULTIS[event.before[event.target].kind]:0);
    bites+=human;collected+=event.gain;
   }
   if(event.type==='lineWin'){
    const expected=lineWins(event.board);assert.deepEqual(event.wins,expected);
    sum+=Math.min(CAP-sum,expected.reduce((n,w)=>n+w.base*w.multi,0));assert.equal(sum,event.total);
   }
   if(event.type==='spinEnd'){
    assert.equal(event.board.filter(c=>c.kind==='zombie').reduce((n,c)=>n+c.multi,0),collected,'only this spin’s bites can contribute');
    for(const stack of expandedZombies(event.board)){
     const reel=stack.cells[0]%6;
     assert.ok(stack.super);assert.equal(stack.cells.length,event.superStarts[reel]+1);
     assert.deepEqual(stack.cells,Array.from({length:stack.cells.length},(_,r)=>r*6+reel));
     assert.ok(stack.cells.every(i=>event.board[i].stackMulti===stack.multi));
     const old=previous?.board.find(c=>c.id===stack.id);lowerMultis+=!!old&&stack.multi<old.multi;
    }
    previous=event;
   }
  }
  assert.equal(sum,round.total);assert.equal(bites,round.biteCount);assert.ok(steps>=bites);
 }
 assert.ok(returns>1000);assert.ok(upgrades>100);assert.ok(lowerMultis>100,'fresh collection can roll a lower multiplier');
 assert.ok(caps<150,'prototype must not produce near-automatic maximum wins');
});

test('Skip across either bonus clears at the current spin boundary without losing infection or returning zombie events',()=>{
 for(const kind of ['outbreak','preview_super']){
  const round=makeRound({kind,rng:seeded(2)}),playback=createPlayback();let ends=0;
  for(const event of round.events){
   if(event.type==='reveal'){playback.beginSpin(event.turn);assert.equal(playback.duration(1000),1000);if(event.left===6)playback.skipSpin();}
   if(event.type==='spinEnd'){ends++;playback.endSpin();assert.equal(playback.read().skipping,false);}
  }
  assert.equal(ends,round.events.filter(e=>e.type==='reveal').length);assert.equal(playback.read().speed,'normal');
 }
});
