import test from 'node:test';
import assert from 'node:assert/strict';
import {SYMBOLS,RULES,seedRng,clusters,evaluate,collapse,strike,resolveSpin,generateRound,multiplier,fsCount} from '../runtime/engine.js';
const empty=()=>Array(49).fill('fs');
test('clusters connect orthogonally, not diagonally; five required',()=>{const b=empty();[0,8,16,24,32].forEach(i=>b[i]='ruby');assert.equal(clusters(b).length,0);[0,1,2,9,16].forEach(i=>b[i]='ruby');assert.equal(clusters(b)[0].cells.length,6);});
test('first hit marks; second activates 2x; shared cells advance only once',()=>{const b=empty();[0,1,2,3,4].forEach(i=>b[i]='ruby');let e=evaluate(b,Array(49).fill(0));assert.equal(e.wins[0].multiplier,1);assert.equal(e.hits[0],1);e=evaluate(b,e.hits);assert.equal(e.wins[0].multiplier,10);assert.equal(e.hits[0],2);assert.equal(multiplier(99),1024);});
test('wilds connect different symbols, without paying all-wild combinations',()=>{const b=empty();[0,1,2,3,4].forEach(i=>b[i]='wild');assert.equal(clusters(b).length,0);b[0]='ruby';b[11]='sapphire';const e=evaluate(b,Array(49).fill(0));assert.equal(e.wins.length,2);assert.equal(e.hits[4],1);assert.equal(e.positions.length,6);});
test('gravity preserves surviving symbols and scatter order',()=>{const b=Array.from({length:49},(_,i)=>SYMBOLS[i%7]);b[0]='fs';b[7]='crown';const next=collapse(b,[42],seedRng(1));assert.equal(next.board[7],'fs');assert.equal(next.board[14],'crown');assert.equal(next.falls[7],1);assert.equal(next.board.length,49);});
test('strikes never overwrite scatters; regular strike at most five cells',()=>{for(const mode of ['base','feature','super']){for(let i=0;i<100;i++){const b=empty(),r=strike(b,Array(49).fill(0),mode,seedRng(i));assert.deepEqual(r.board,b);assert.equal(r.cells.length,0);const ordinary=Array(49).fill('ruby'),s=strike(ordinary,Array(49).fill(0),mode,seedRng(i));assert.ok(s.cells.length<=5);assert.ok(s.cells.length>=3);}}});
test('seeded rounds reproduce independently of recording events',()=>{for(const mode of ['base','feature','regular','super']){const a=generateRound({rng:seedRng(123),mode}),b=generateRound({rng:seedRng(123),mode,record:false});assert.equal(a.total,b.total);assert.equal(a.played,b.played);}});
test('guaranteed feature has exactly one strike unless cap reached first',()=>{for(let seed=1;seed<80;seed++){const r=resolveSpin({rng:seedRng(seed),mode:'feature'});assert.equal(r.events.filter(x=>x.type==='strike').length,r.capped?0:1);}});
test('super starts with every multiplier at 2x, and bonus history retains cells',()=>{const r=generateRound({rng:seedRng(42),mode:'super'});const start=r.events.findIndex(e=>e.type==='bonusStart');const drop=r.events.slice(start).find(e=>e.type==='drop');assert.ok(drop.hits.every(x=>x===2));let previous=Array(49).fill(2);for(const e of r.events.slice(start)){if(e.hits){for(let i=0;i<49;i++)assert.ok(e.hits[i]>=previous[i]);previous=e.hits;}}});
test('bonus buys visibly start with three scatter symbols',()=>{for(const mode of ['regular','super']){const r=generateRound({rng:seedRng(5),mode});assert.equal(r.events[0].type,'drop');assert.equal(r.events[0].board.filter(s=>s==='fs').length,3);assert.equal(r.events[1].count,10);}});
test('cap limits total award and ends the spin',()=>{const r=resolveSpin({rng:seedRng(1),board:Array(49).fill('crown'),hits:Array(49).fill(11),cap:100});assert.equal(r.total,100);assert.equal(r.capped,true);assert.equal(r.events.at(-1).type,'win');});
test('recorded awards sum to round payout without missing bonus awards',()=>{for(const mode of ['base','feature','regular','super'])for(let seed=1;seed<=60;seed++){const r=generateRound({rng:seedRng(seed),mode});const sum=r.events.filter(e=>e.type==='win').reduce((s,e)=>s+e.total,0);assert.ok(Math.abs(sum-r.total)<.0001);assert.ok(r.total<=RULES.maxWin);assert.ok(Number.isFinite(r.total));}});
test('scatter counts and extra scatter overflow are well-defined',()=>{assert.deepEqual([3,4,5,6,7,8].map(fsCount),[10,12,15,20,30,30]);});

test('arrow wilds join mixed wild clusters and never pay on their own',()=>{
 const b=empty();[0,1,2,3,4].forEach(i=>b[i]=i%2?'arrow-wild':'wild');assert.equal(clusters(b).length,0);b[0]='ruby';const e=evaluate(b,Array(49).fill(0));assert.equal(e.wins.length,1);assert.equal(e.wins[0].cells.length,5);assert.equal(e.positions.length,5);
});
test('archer trails are horizontal, preserve scatters, and share the attack limit',()=>{
 let arrows=0;
 for(let seed=1;seed<=400;seed++){
  const r=resolveSpin({rng:seedRng(seed)});const attacks=r.events.filter(e=>e.type==='strike'||e.type==='arrow');assert.ok(attacks.length<=1);
  let board;
  for(const e of r.events){
   if(e.type==='arrow'){arrows++;assert.ok(e.cells.length<=5);assert.equal(new Set(e.cells.map(i=>Math.floor(i/7))).size,1);for(let i=0;i<49;i++){if(board[i]==='fs')assert.equal(e.board[i],'fs');if(e.cells.includes(i))assert.equal(e.board[i],'arrow-wild');else assert.equal(e.board[i],board[i]);}}
   if(e.board)board=e.board;
  }
 }
 assert.ok(arrows>10);
});
test('arrow wilds survive gravity with their artwork identity',()=>{
 const b=Array.from({length:49},(_,i)=>SYMBOLS[i%7]);b[0]='arrow-wild';const r=collapse(b,[42],seedRng(1));assert.equal(r.board[7],'arrow-wild');
});
