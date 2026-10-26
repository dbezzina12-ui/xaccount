import test from 'node:test';
import assert from 'node:assert/strict';
import {SYMBOLS,RULES,seedRng,clusters,evaluate,collapse,strike,resolveSpin,generateRound,multiplier,fsCount,mageTarget,isWild} from '../runtime/engine.js';
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
test('arrow wilds survive gravity with their artwork identity',()=>{
 const b=Array.from({length:49},(_,i)=>SYMBOLS[i%7]);b[0]='arrow-wild';const r=collapse(b,[42],seedRng(1));assert.equal(r.board[7],'arrow-wild');
});

// The skeleton mage (N-08): one zapped cell in the base game, one roaming wild in free spins.
const mageWilds=board=>board.flatMap((kind,i)=>kind==='arrow-wild'?[i]:[]);
// Free spins of a round: each one's events, from its freeSpin event to the next.
function freeSpins(round){const out=[];for(const e of round.events){if(e.type==='freeSpin')out.push([]);else if(e.type==='bonusEnd')break;else out.at(-1)?.push(e);}return out;}
test('base game: the mage zaps exactly one cell, never a tombstone, and shares the attack limit',()=>{
 let zaps=0,strikes=0;
 for(let seed=1;seed<=3000;seed++){
  const r=resolveSpin({rng:seedRng(seed)});assert.ok(r.events.filter(e=>e.type==='strike'||e.type==='zap').length<=1);assert.ok(!r.events.some(e=>e.type==='arrow'));
  let board;
  for(const e of r.events){
   if(e.type==='zap'){zaps++;assert.equal(e.roam,false);assert.ok(board[e.cell]!=='fs'&&!isWild(board[e.cell]));for(let i=0;i<49;i++)assert.equal(e.board[i],i===e.cell?'arrow-wild':board[i]);}
   if(e.type==='strike'){strikes++;assert.equal(e.horizontal,false);}
   if(e.board)board=e.board;
  }
 }
 // The mage keeps the archer's opportunity: half of the base attacks.
 assert.ok(zaps>100&&zaps/strikes>.8&&zaps/strikes<1.25,`${zaps} zaps, ${strikes} strikes`);
});
test('free spins: one mage wild, placed after the drop, before any win',()=>{
 for(const mode of ['regular','super'])for(let seed=1;seed<=40;seed++){
  const round=generateRound({rng:seedRng(seed),mode});let last=-1;
  assert.ok(!round.events.some(e=>e.type==='arrow'||(e.type==='zap'&&!e.roam)));
  for(const spin of freeSpins(round)){
   assert.equal(spin[0].type,'drop');assert.equal(mageWilds(spin[0].board).length,0);assert.ok(!spin[0].board.includes('wild'));
   const zap=spin[1];assert.equal(zap.type,'zap');assert.equal(zap.roam,true);assert.equal(zap.from,last);
   assert.notEqual(zap.cell,last);assert.notEqual(spin[0].board[zap.cell],'fs');assert.deepEqual(zap.hits,spin[0].hits);
   for(let i=0;i<49;i++)assert.equal(zap.board[i],i===zap.cell?'arrow-wild':spin[0].board[i]);
   for(const e of spin.slice(2)){assert.notEqual(e.type,'zap');if(e.board)assert.deepEqual(mageWilds(e.board),[zap.cell]);}
   last=zap.cell;
  }
  assert.equal(round.roams,round.played);
 }
});
test('the roaming wild holds its cell through every tumble while the column falls past it',()=>{
 let held=0;
 for(let seed=1;seed<=60&&held<20;seed++){
  for(const spin of freeSpins(generateRound({rng:seedRng(seed),mode:'regular'}))){
   const cell=spin[1].cell,tumbles=spin.filter(e=>e.type==='tumble');
   for(const t of tumbles){assert.equal(t.fixed,cell);assert.equal(t.board[cell],'arrow-wild');assert.equal(t.falls[cell],0);}
   // It can win more than once in a spin: its position advances each time.
   const wins=spin.filter(e=>e.type==='win'&&e.positions.includes(cell));
   if(tumbles.length>=2&&wins.length>=2)held++;
  }
 }
 assert.ok(held>=5,`${held} free spins where the wild won twice or more`);
 // Column 0: the wild at row 3 wins with row 5; the rows above fall past it.
 const b=Array.from({length:49},(_,i)=>SYMBOLS[(i+Math.floor(i/7))%7]);b[21]='arrow-wild';
 const before=[0,7,14,21,28,35,42].map(i=>b[i]),r=collapse(b,[21,35],seedRng(3),21);
 assert.deepEqual([42,35,28,21,14,7].map(i=>r.board[i]),[before[6],before[4],before[2],'arrow-wild',before[1],before[0]]);
 assert.deepEqual([0,7,14,21,28,35,42].map(i=>r.falls[i]),[1,1,1,0,2,1,0]);
});
test('tile multipliers stay on their own cells as the wild moves',()=>{
 for(let seed=1;seed<=30;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'super'});let previous=null;
  for(const spin of freeSpins(round)){
   const zap=spin[1];if(previous)assert.deepEqual(spin[0].hits,previous);
   // Winning positions advance as before; the mage's cell only when it wins.
   let hits=zap.hits;for(const e of spin.filter(x=>x.hits)){for(let i=0;i<49;i++)assert.ok(e.hits[i]>=hits[i]);hits=e.hits;}
   previous=hits;
  }
 }
});
test('retriggers keep the one wild; the bonus ends with it gone',()=>{
 let retriggered=0;
 for(let seed=1;seed<=400&&retriggered<3;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'regular'});if(!round.retriggers)continue;retriggered++;
  assert.equal(round.played,10+round.events.filter(e=>e.type==='retrigger').reduce((s,e)=>s+e.count,0));
  assert.equal(round.roams,round.played);assert.equal(round.events.filter(e=>e.type==='zap').length,round.played);
  for(const spin of freeSpins(round))for(const e of spin)if(e.board&&e.type!=='drop')assert.equal(mageWilds(e.board).length,1);
  assert.equal(round.events.at(-1).type,'bonusEnd');
 }
 assert.equal(retriggered,3);
 // A base-game bonus: no roaming wild before the bonus starts.
 for(let seed=1;seed<=4000;seed++){const r=generateRound({rng:seedRng(seed),record:false});if(!r.bonusMode)continue;const round=generateRound({rng:seedRng(seed)}),start=round.events.findIndex(e=>e.type==='bonusStart');assert.ok(!round.events.slice(0,start).some(e=>e.type==='zap'&&e.roam));assert.equal(round.roams,round.played);break;}
});
test('the reaper keeps its opportunities: regular strikes are vertical, Super keeps the cross',()=>{
 for(const mode of ['regular','super'])for(let seed=1;seed<=30;seed++)for(const e of generateRound({rng:seedRng(seed),mode}).events)if(e.type==='strike'){if(mode==='super')assert.equal(e.cross,true);else assert.equal(e.horizontal,false);}
 // A slash across the roaming wild leaves it the mage's.
 const b=Array(49).fill('ruby');b[24]='arrow-wild';let across=0;
 for(let seed=1;seed<400;seed++){const s=strike(b,Array(49).fill(0),'super',seedRng(seed));assert.deepEqual(mageWilds(s.board),[24]);if(s.cells.includes(24))across++;}
 assert.ok(across>20,`${across} cross-cuts over the wild`);
});
test('the cap still ends a spin with the roaming wild on the board',()=>{
 const r=resolveSpin({rng:seedRng(1),board:Array(49).fill('crown'),hits:Array(49).fill(11),cap:100,mage:-1});
 assert.equal(r.events[1].type,'zap');assert.equal(r.total,100);assert.equal(r.capped,true);assert.equal(r.events.at(-1).type,'win');
});
test('no eligible cell: no wild, nothing overwritten',()=>{
 assert.equal(mageTarget(Array(49).fill('fs'),seedRng(1)),-1);
 const walled=Array(49).fill('fs');walled[10]='wild';assert.equal(mageTarget(walled,seedRng(1),-1),-1);
 // One free cell: the wild may stay on it.
 const one=Array(49).fill('fs');one[30]='ruby';assert.equal(mageTarget(one,seedRng(1),30),30);
 const r=resolveSpin({rng:seedRng(2),board:Array(49).fill('fs'),mage:5});
 assert.equal(r.mage,-1);assert.ok(!r.events.some(e=>e.type==='zap'));assert.equal(r.scatters,49);
 // The prior cell is avoided whenever another exists.
 for(let seed=1;seed<200;seed++){const two=Array(49).fill('fs');two[3]='ruby';two[4]='crown';assert.equal(mageTarget(two,seedRng(seed),3),4);}
});
