import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,seedRng,mysteryBonus,generateRound,bonusFor} from '../runtime/engine.js';

test('Mystery uses the advertised 40/50/10 boundaries and fixed price',()=>{
 assert.equal(RULES.mysteryCost,370);
 assert.deepEqual(RULES.mystery,{regular:.4,super:.5,hidden:.1});
 for(const [draw,tier] of [[0,'regular'],[.399999,'regular'],[.4,'super'],[.899999,'super'],[.9,'hidden'],[.999999,'hidden']])assert.equal(mysteryBonus(()=>draw),tier);
});

test('Mystery selects once then plays the existing selected bonus, with correct scatter art',()=>{
 const seen=new Set();
 for(let seed=1;seed<=200;seed++){
  const rng=seedRng(seed),tier=mysteryBonus(rng),expected=generateRound({rng,mode:tier});
  const actual=generateRound({rng:seedRng(seed),mode:'mystery'});seen.add(tier);
  assert.equal(actual.purchaseMode,'mystery');assert.equal(actual.bonusMode,tier);
  assert.equal(actual.total,expected.total);assert.deepEqual(actual.events,expected.events);
  assert.ok(actual.events[0].board.filter(k=>k===({regular:'fs',super:'sfs',hidden:'hfs'})[tier]).length>=3);
  const b=actual.events[0].board,award=bonusFor(b.filter(k=>k==='fs').length,b.filter(k=>k==='sfs').length,b.filter(k=>k==='hfs').length);
  assert.equal(actual.events.find(e=>e.type==='bonusStart').count,award.count);
  assert.equal(actual.events.find(e=>e.type==='prize')?.amount||0,award.prize);
  assert.equal(actual.events.some(e=>e.type==='hiddenStrikes'),tier==='hidden');
  const unrecorded=generateRound({rng:seedRng(seed),mode:'mystery',record:false});
  assert.equal(unrecorded.total,actual.total);assert.equal(unrecorded.bonusMode,tier);assert.deepEqual(unrecorded.events,[]);
 }
 assert.equal(seen.size,3);
});

test('seeded Mystery distribution includes Hidden at the published share',()=>{
 const count={regular:0,super:0,hidden:0},rng=seedRng(20261026),n=100000;
 for(let i=0;i<n;i++)count[mysteryBonus(rng)]++;
 for(const tier of Object.keys(count))assert.ok(Math.abs(count[tier]/n-RULES.mystery[tier])<.005,`${tier}: ${count[tier]}`);
});
