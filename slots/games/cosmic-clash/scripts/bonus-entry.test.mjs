import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRound} from '../dist/math.js';
import {bonusEntryEvent} from '../dist/bonus-entry.js';

function freeze(value){
 if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}
 return value;
}

test('God Mode starts empty and its selected 5x wild lands on the first actual bonus spin',()=>{
 const reels=new Set();let boss=false;
 for(let seed=1;seed<=100;seed++){
  const round=freeze(makeRound(seed,{tier:'hidden',trigger:true}));
  const original=structuredClone(round),shown=round.events.map(bonusEntryEvent);
  const start=shown.find(e=>e.type==='bonusStart'),first=shown.find(e=>e.type==='spin');
  const recorded=round.events.find(e=>e.type==='spin'),initial=recorded.before[0];
  reels.add(initial.reel);boss||=initial.boss;
  assert.equal(shown[0],round.events[0],'scatter reveal stays unchanged');
  assert.deepEqual(start.states,[]);assert.deepEqual(first.before,[]);
  assert.equal(first.turn,1);assert.equal(first.remaining,9);
  assert.deepEqual(first.landings,[{...initial,row:2}]);
  assert.equal(first.landings[0].multiplier,5);
  assert.equal(first.duels[0].id,initial.id);
  assert.equal(first.duels[0].from,5);
  for(let reel=0;reel<5;reel++)for(let row=0;row<5;row++){
   assert.deepEqual(first.raw[reel][row],reel===initial.reel&&row===2?{name:'VS'}:recorded.raw[reel][row]);
  }
  for(const key of ['board','underlying','duels','states','wins','win','totalWin','crossfire','capped'])assert.equal(first[key],recorded[key],key);
  assert.deepEqual(round,original,'presentation cannot mutate the selected round');
  assert.equal(bonusEntryEvent(first),first,'the landing cannot be added twice');
  for(const e of round.events.filter(e=>e.type==='spin'&&e.turn>1))assert.equal(bonusEntryEvent(e),e);
 }
 assert.equal(reels.size,5);assert(boss,'also covers the gold Boss opening');
});

test('other bonus types and Duel Spins retain their existing entrance and spin events',()=>{
 for(const options of [{},{tier:'regular',trigger:true},{tier:'super',trigger:true},{feature:'duel'}]){
  const round=makeRound(17,options);
  for(const event of round.events)assert.equal(bonusEntryEvent(event),event);
 }
});
