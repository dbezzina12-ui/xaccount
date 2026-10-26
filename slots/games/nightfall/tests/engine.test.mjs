import test from 'node:test';
import assert from 'node:assert/strict';
import {SYMBOLS,RULES,seedRng,clusters,evaluate,collapse,strike,resolveSpin,generateRound,multiplier,fsCount,mageTarget,isWild,bonusFor,adjacent,isScatter,triggerBoard} from '../runtime/engine.js';
const empty=()=>Array(49).fill('fs');
test('clusters connect orthogonally, not diagonally; five required',()=>{const b=empty();[0,8,16,24,32].forEach(i=>b[i]='ruby');assert.equal(clusters(b).length,0);[0,1,2,9,16].forEach(i=>b[i]='ruby');assert.equal(clusters(b)[0].cells.length,6);});
test('first hit marks; second activates 2x; shared cells advance only once',()=>{const b=empty();[0,1,2,3,4].forEach(i=>b[i]='ruby');let e=evaluate(b,Array(49).fill(0));assert.equal(e.wins[0].multiplier,1);assert.equal(e.hits[0],1);e=evaluate(b,e.hits);assert.equal(e.wins[0].multiplier,10);assert.equal(e.hits[0],2);assert.equal(multiplier(99),1024);});
test('wilds connect different symbols, without paying all-wild combinations',()=>{const b=empty();[0,1,2,3,4].forEach(i=>b[i]='wild');assert.equal(clusters(b).length,0);b[0]='ruby';b[11]='sapphire';const e=evaluate(b,Array(49).fill(0));assert.equal(e.wins.length,2);assert.equal(e.hits[4],1);assert.equal(e.positions.length,6);});
test('gravity preserves surviving symbols and scatter order',()=>{const b=Array.from({length:49},(_,i)=>SYMBOLS[i%7]);b[0]='fs';b[7]='crown';const next=collapse(b,[42],seedRng(1));assert.equal(next.board[7],'fs');assert.equal(next.board[14],'crown');assert.equal(next.falls[7],1);assert.equal(next.board.length,49);});
test('strikes never overwrite scatters; regular strike at most five cells',()=>{for(const mode of ['base','feature','super']){for(let i=0;i<100;i++){const b=empty(),r=strike(b,Array(49).fill(0),mode,seedRng(i));assert.deepEqual(r.board,b);assert.equal(r.cells.length,0);const ordinary=Array(49).fill('ruby'),s=strike(ordinary,Array(49).fill(0),mode,seedRng(i));assert.ok(s.cells.length<=5);assert.ok(s.cells.length>=3);}}});
test('seeded rounds reproduce independently of recording events',()=>{for(const mode of ['base','feature','regular','super']){const a=generateRound({rng:seedRng(123),mode}),b=generateRound({rng:seedRng(123),mode,record:false});assert.equal(a.total,b.total);assert.equal(a.played,b.played);}});
test('guaranteed feature has exactly one strike unless cap reached first',()=>{for(let seed=1;seed<80;seed++){const r=resolveSpin({rng:seedRng(seed),mode:'feature'});assert.equal(r.events.filter(x=>x.type==='strike').length,r.capped?0:1);}});
test('super starts with every multiplier at 2x, and bonus history retains cells',()=>{const r=generateRound({rng:seedRng(42),mode:'super'});const start=r.events.findIndex(e=>e.type==='bonusStart');const drop=r.events.slice(start).find(e=>e.type==='drop');assert.ok(drop.hits.every(x=>x===2));let previous=Array(49).fill(2);for(const e of r.events.slice(start)){if(e.hits){for(let i=0;i<49;i++)assert.ok(e.hits[i]>=previous[i]);previous=e.hits;}}});
test('bonus buys visibly start with at least three scatter symbols',()=>{for(const mode of ['regular','super']){const r=generateRound({rng:seedRng(5),mode});assert.equal(r.events[0].type,'drop');assert.ok(r.events[0].board.filter(isScatter).length>=3);assert.ok(r.events.find(e=>e.type==='bonusStart').count>=10);}});
test('cap limits total award and ends the spin',()=>{const r=resolveSpin({rng:seedRng(1),board:Array(49).fill('crown'),hits:Array(49).fill(11),cap:100});assert.equal(r.total,100);assert.equal(r.capped,true);assert.equal(r.events.at(-1).type,'win');});
test('recorded awards sum to round payout without missing bonus awards',()=>{for(const mode of ['base','feature','regular','super'])for(let seed=1;seed<=60;seed++){const r=generateRound({rng:seedRng(seed),mode});const sum=r.events.filter(e=>e.type==='win').reduce((s,e)=>s+e.total,0);assert.ok(Math.abs(sum-r.total)<.0001);assert.ok(r.total<=RULES.maxWin);assert.ok(Number.isFinite(r.total));}});
test('scatter counts and extra scatter overflow are well-defined',()=>{assert.deepEqual([3,4,5,6,7,8].map(fsCount),[10,12,15,20,30,30]);});

test('arrow wilds join mixed wild clusters and never pay on their own',()=>{
 const b=empty();[0,1,2,3,4].forEach(i=>b[i]=i%2?'arrow-wild':'wild');assert.equal(clusters(b).length,0);b[0]='ruby';const e=evaluate(b,Array(49).fill(0));assert.equal(e.wins.length,1);assert.equal(e.wins[0].cells.length,5);assert.equal(e.positions.length,5);
});
test('arrow wilds survive gravity with their artwork identity',()=>{
 const b=Array.from({length:49},(_,i)=>SYMBOLS[i%7]);b[0]='arrow-wild';const r=collapse(b,[42],seedRng(1));assert.equal(r.board[7],'arrow-wild');
});

// The skeleton mage (N-08): one zapped cell in the base game. In free spins
// he may strike: a sticky roamer that stays for the rest of the bonus and
// moves only after joining a win, or a one-time burst of three wilds.
const kinds=(board,kind)=>board.flatMap((k,i)=>k===kind?[i]:[]);
const mageWilds=board=>kinds(board,'arrow-wild'),roamWilds=board=>kinds(board,'roam-wild');
// Free spins of a round: each one's events, from its freeSpin event to the next.
function freeSpins(round){const out=[];for(const e of round.events){if(e.type==='freeSpin')out.push([]);else if(e.type==='bonusEnd')break;else out.at(-1)?.push(e);}return out;}
// Plays out a bonus spin by spin: the roamers expected after each one.
function walk(round,check){let roamers=[];for(const spin of freeSpins(round)){roamers=check(spin,roamers);}return roamers;}
test('base game: the mage zaps exactly one cell, never a tombstone, and shares the attack limit',()=>{
 let zaps=0,strikes=0;
 for(let seed=1;seed<=3000;seed++){
  const r=resolveSpin({rng:seedRng(seed)});assert.ok(r.events.filter(e=>e.type==='strike'||e.type==='zap').length<=1);assert.ok(!r.events.some(e=>e.type==='arrow'||e.type==='roam'));
  let board;
  for(const e of r.events){
   if(e.type==='zap'){zaps++;assert.equal(e.roamer,false);assert.equal(e.cells.length,1);const cell=e.cells[0];assert.ok(board[cell]!=='fs'&&!isWild(board[cell]));for(let i=0;i<49;i++)assert.equal(e.board[i],i===cell?'arrow-wild':board[i]);}
   if(e.type==='strike'){strikes++;assert.equal(e.horizontal,false);}
   if(e.board)board=e.board;
  }
  assert.deepEqual(r.roamers,[]);
 }
 // The mage keeps the archer's opportunity: half of the base attacks.
 assert.ok(zaps>100&&zaps/strikes>.8&&zaps/strikes<1.25,`${zaps} zaps, ${strikes} strikes`);
});
test('all bonus tiers hold lanterns between spins and move only the ones used in a win',()=>{
 let moves=0,held=0,bursts=0,singles=0;
 for(const mode of ['regular','super','hidden'])for(let seed=1;seed<=400;seed++){
  const round=generateRound({rng:seedRng(seed),mode});let previous=[];
  for(const spin of freeSpins(round)){
   const drop=spin[0];assert.equal(drop.type,'drop');
   assert.deepEqual(drop.fixed.slice().sort((a,b)=>a-b),previous.slice().sort((a,b)=>a-b));
   assert.deepEqual(roamWilds(drop.board).sort((a,b)=>a-b),previous.slice().sort((a,b)=>a-b));
   held+=previous.length;
   let board=drop.board,win=null,lastType='drop';
   for(const e of spin.slice(1)){
    if(e.type==='win')win=e;
    if(e.type==='roam'){
     const existing=e.moves.filter(m=>m.from>=0);
     if(existing.length){
      assert.equal(lastType,'tumble');assert.ok(win);
      for(const m of existing){assert.ok(win.positions.includes(m.from));assert.notEqual(m.cell,m.from);moves++;}
     }else{assert.equal(mode,'hidden');assert.ok(e.moves.every(m=>m.from===-1));}
     assert.equal(new Set(e.fixed).size,e.fixed.length);
     assert.deepEqual(roamWilds(e.board).sort((a,b)=>a-b),e.fixed.slice().sort((a,b)=>a-b));
     for(const i of roamWilds(board))if(!existing.some(m=>m.from===i))assert.equal(e.board[i],'roam-wild','unused lantern remains in its cell');
     for(let i=0;i<49;i++)if(['fs','sfs','hfs'].includes(board[i]))assert.equal(e.board[i],board[i]);
    }
    if(e.type==='zap'){
     assert.equal(e.cells.length,e.roamer?1:3);e.roamer?singles++:bursts++;
     for(const i of e.cells){assert.ok(!isWild(board[i]));assert.equal(e.board[i],e.roamer?'roam-wild':'arrow-wild');}
    }
    if(e.type==='tumble')for(const i of e.fixed){assert.equal(e.board[i],'roam-wild');assert.equal(e.falls[i],0);}
    if(e.board)board=e.board;lastType=e.type;
   }
   previous=roamWilds(board);
  }
  const created=round.roamerStrikes+(mode==='hidden'?1:0);
  assert.equal(previous.length,created,'lanterns accumulate for the whole bonus');
 }
 assert.ok(moves>100&&held>100&&bursts>100&&singles>100);
});
test('an unused lantern stays at the same cell across consecutive non-winning spins',()=>{
 const board=Array.from({length:49},(_,i)=>SYMBOLS[(i+Math.floor(i/7))%7]);
 let roamers=[24];
 for(let i=0;i<5;i++){
  const r=resolveSpin({mode:'regular',rng:()=>.99,board,roamers});
  assert.deepEqual(r.roamers,[24]);assert.equal(r.events.length,1);assert.equal(r.events[0].board[24],'roam-wild');roamers=r.roamers;
 }
});
test('lanterns hold through the winning tumble, then swap only with eligible symbols; bursts can clear',()=>{
 const b=Array.from({length:49},(_,i)=>SYMBOLS[(i+Math.floor(i/7))%7]);b[21]='roam-wild';
 const before=[0,7,14,21,28,35,42].map(i=>b[i]),r=collapse(b,[21,35],seedRng(3),[21]);
 assert.deepEqual([42,35,28,21,14,7].map(i=>r.board[i]),[before[6],before[4],before[2],'roam-wild',before[1],before[0]]);
 assert.deepEqual([0,7,14,21,28,35,42].map(i=>r.falls[i]),[1,1,1,0,2,1,0]);
 let cleared=0;
 for(let seed=1;seed<300&&cleared<3;seed++)for(const spin of freeSpins(generateRound({mode:'regular',rng:seedRng(seed)}))){
  const burst=spin.find(e=>e.type==='zap'&&!e.roamer);
  if(burst&&spin.some(e=>e.type==='tumble'&&burst.cells.some(i=>e.board[i]!=='arrow-wild')))cleared++;
 }
 assert.ok(cleared>=3);
});
test('tile multipliers stay on their own cells as the wilds move',()=>{
 for(let seed=1;seed<=30;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'super'});let previous=null;
  for(const spin of freeSpins(round)){
   if(previous)assert.deepEqual(spin[0].hits,previous);
   // Winning positions advance as before; a wild's cell only when it wins.
   let hits=spin[0].hits;for(const e of spin.filter(x=>x.hits)){for(let i=0;i<49;i++)assert.ok(e.hits[i]>=hits[i]);hits=e.hits;}
   previous=hits;
  }
 }
});
test('retriggers keep the roamers; the bonus ends with them gone',()=>{
 let retriggered=0;
 for(let seed=1;seed<=3000&&retriggered<3;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'regular'});if(!round.retriggers||!round.roamerStrikes)continue;
  const events=round.events,at=events.findIndex(e=>e.type==='retrigger'),before=events.slice(0,at).filter(e=>e.type==='zap'&&e.roamer).length;
  if(!before)continue;retriggered++;
  assert.equal(round.played,events.find(e=>e.type==='bonusStart').count+events.filter(e=>e.type==='retrigger').reduce((s,e)=>s+e.count,0));
  // The first drop after a retrigger still holds every existing lantern.
  const next=events.slice(at).find(e=>e.type==='drop');assert.ok(next.fixed.length>=before);
  assert.equal(events.at(-1).type,'bonusEnd');
 }
 assert.equal(retriggered,3);
 // A base-game bonus: no roamers before the bonus starts, none after it.
 for(let seed=1;seed<=4000;seed++){const r=generateRound({rng:seedRng(seed),record:false});if(!r.bonusMode)continue;const round=generateRound({rng:seedRng(seed)}),start=round.events.findIndex(e=>e.type==='bonusStart');assert.ok(!round.events.slice(0,start).some(e=>e.type==='roam'||(e.type==='zap'&&e.roamer)));break;}
 const after=resolveSpin({rng:seedRng(9)});assert.deepEqual(after.roamers,[]);
});
test('the reaper keeps its opportunities: regular strikes are vertical, Super keeps the cross',()=>{
 for(const mode of ['regular','super'])for(let seed=1;seed<=30;seed++)for(const e of generateRound({rng:seedRng(seed),mode}).events)if(e.type==='strike'){if(mode==='super')assert.equal(e.cross,true);else assert.equal(e.horizontal,false);}
 // A slash across a roamer leaves it the mage's.
 const b=Array(49).fill('ruby');b[24]='roam-wild';let across=0;
 for(let seed=1;seed<400;seed++){const s=strike(b,Array(49).fill(0),'super',seedRng(seed));assert.deepEqual(roamWilds(s.board),[24]);if(s.cells.includes(24))across++;}
 assert.ok(across>20,`${across} cross-cuts over the roamer`);
});
test('the cap still ends a spin with roamers on the board',()=>{
 const r=resolveSpin({rng:seedRng(1),board:Array(49).fill('crown'),hits:Array(49).fill(11),cap:100,roamers:[3,4]});
 assert.deepEqual(r.events[0].fixed,[3,4]);assert.equal(r.total,100);assert.equal(r.capped,true);assert.equal(r.events.at(-1).type,'win');assert.equal(r.roamers.length,2);
});
test('no eligible cell: no wild, nothing overwritten',()=>{
 assert.equal(mageTarget(Array(49).fill('fs'),seedRng(1)),-1);
 const walled=Array(49).fill('fs');walled[10]='wild';assert.equal(mageTarget(walled,seedRng(1),-1),-1);
 // One free cell: a roamer may stay on it.
 const one=Array(49).fill('fs');one[30]='ruby';assert.equal(mageTarget(one,seedRng(1),30),30);
 const r=resolveSpin({rng:seedRng(2),board:Array(49).fill('fs'),roamers:[5,6]});
 assert.deepEqual(r.roamers,[5,6]);assert.ok(!r.events.some(e=>e.type==='zap'||e.type==='roam'));assert.equal(r.scatters,47);
 // Previously occupied cells remain reserved even when the supplied board is full of scatters.
 const r2=resolveSpin({rng:seedRng(2),board:one,roamers:[5,6]});assert.deepEqual(r2.roamers,[5,6]);
 // The prior cell is avoided whenever another exists.
 for(let seed=1;seed<200;seed++){const two=Array(49).fill('fs');two[3]='ruby';two[4]='crown';assert.equal(mageTarget(two,seedRng(seed),3),4);}
});

// Super tombstones and the bonus tiers (Dylan, 2026-10-26).
test('the tombstones on a base spin pick the bonus: Free Spins, Super, Hidden',()=>{
 const t=(fs,sfs,hfs=0)=>bonusFor(fs,sfs,hfs);
 assert.equal(t(2,0),null);assert.equal(t(1,1),null);assert.equal(t(0,2),null);assert.equal(t(1,0,1),null);
 assert.deepEqual(t(3,0),{mode:'regular',count:10,prize:0});assert.deepEqual(t(4,0),{mode:'regular',count:12,prize:0});assert.deepEqual(t(5,0),{mode:'regular',count:15,prize:0});
 // 2 tombstones + a gold one: Super; 3 + 1: Super + 2 spins; 4 + 1: Super + 4.
 assert.deepEqual(t(2,1),{mode:'super',count:10,prize:0});assert.deepEqual(t(1,2),{mode:'super',count:10,prize:0});assert.deepEqual(t(0,3),{mode:'super',count:10,prize:0});
 assert.deepEqual(t(3,1),{mode:'super',count:12,prize:0});assert.deepEqual(t(4,1),{mode:'super',count:14,prize:0});assert.deepEqual(t(6,1),{mode:'super',count:14,prize:0});
 // A Hidden tombstone among 3: Hidden; among 4: Hidden + 3; among 5+: 1,000x and Hidden + 5. It beats gold.
 assert.deepEqual(t(2,0,1),{mode:'hidden',count:10,prize:0});assert.deepEqual(t(1,1,1),{mode:'hidden',count:10,prize:0});
 assert.deepEqual(t(3,0,1),{mode:'hidden',count:13,prize:0});assert.deepEqual(t(2,2,1),{mode:'hidden',count:15,prize:1000});assert.deepEqual(t(4,0,1),{mode:'hidden',count:15,prize:1000});
});
test('gold and Hidden tombstones land only in base and Reaper Strike spins, never pay, and nothing replaces them',()=>{
 let fs=0,sfs=0,hfs=0;
 for(let seed=1;seed<=20000;seed++){
  const r=resolveSpin({rng:seedRng(seed),mode:seed%4?'base':'feature'});
  // The drop's tombstones (later boards repeat the ones that stay).
  const drop=r.events[0].board;fs+=drop.filter(k=>k==='fs').length;sfs+=drop.filter(k=>k==='sfs').length;hfs+=drop.filter(k=>k==='hfs').length;
  let board;for(const e of r.events){if((e.type==='zap'||e.type==='strike')&&board)for(let i=0;i<49;i++)if(board[i]==='sfs'||board[i]==='hfs')assert.equal(e.board[i],board[i]);if(e.board)board=e.board;}
 }
 const all=fs+sfs+hfs,share=sfs/all;assert.ok(Math.abs(share-RULES.superScatter.base)<.02,`${(share*100).toFixed(1)}% of tombstones were gold`);assert.ok(hfs/all<.01,`${hfs} of ${all} tombstones were Hidden`);
 for(const mode of ['regular','super','hidden'])for(let seed=1;seed<=20;seed++)for(const e of generateRound({rng:seedRng(seed),mode}).events)if(e.board&&!e.trigger)assert.ok(!e.board.includes('sfs')&&!e.board.includes('hfs'),`${mode}: a gold or Hidden tombstone in free spins`);
 for(const k of ['sfs','hfs']){const b=empty();b.fill(k);[0,1,2,3,4].forEach(i=>b[i]='ruby');assert.equal(clusters(b).length,1);assert.equal(clusters(b)[0].cells.length,5);assert.equal(mageTarget(Array(49).fill(k),seedRng(1)),-1);}
});
test('a natural Super from a base spin: tiles at 2x, the spins its tombstones earned',()=>{
 let found=0;
 for(let seed=1;seed<=60000&&found<3;seed++){
  const r=generateRound({rng:seedRng(seed),record:false});if(r.bonusMode!=='super')continue;found++;
  const round=generateRound({rng:seedRng(seed)}),start=round.events.findIndex(e=>e.type==='bonusStart'),last=round.events.slice(0,start).filter(e=>e.board).at(-1).board;
  const n=k=>last.filter(x=>x===k).length,want=bonusFor(n('fs'),n('sfs'),n('hfs'));
  assert.equal(want.mode,'super');assert.equal(round.events[start].mode,'super');assert.equal(round.events[start].count,want.count);
  assert.ok(round.events.slice(start).find(e=>e.type==='drop').hits.every(h=>h===2));
 }
 assert.equal(found,3);
});
test('Hidden Free Spins: tiles at 2x or more, a roamer out from the first spin, cross-cuts',()=>{
 for(let seed=1;seed<=20;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'hidden'});
  assert.equal(round.events[0].board.filter(k=>k==='hfs').length,3);
  // Every tile at 2x or more; the opening strikes raised some.
  const spins=freeSpins(round);assert.ok(spins[0][0].hits.every(h=>h>=2)&&spins[0][0].hits.some(h=>h>2));
  const roam=spins[0].find(e=>e.type==='roam');assert.ok(roam&&roam.moves.length>=1&&roam.moves[0].from===-1,'a roamer lands on the first spin');
  for(const e of round.events)if(e.type==='strike')assert.equal(e.cross,true);
 }
});
test('Hidden opens with 3 to 5 mage strikes that raise a plus of tiles one step each',()=>{
 const counts=new Set();
 for(let seed=1;seed<=60;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'hidden'}),at=round.events.findIndex(e=>e.type==='hiddenStrikes'),e=round.events[at];
  assert.equal(round.events[at-1].type,'bonusStart');assert.equal(round.events[at+1].type,'freeSpin');
  assert.ok(e.strikes.length>=3&&e.strikes.length<=5);counts.add(e.strikes.length);
  const want=Array(49).fill(2);for(const s of e.strikes){assert.deepEqual(s.cells.slice().sort((a,b)=>a-b),[s.cell,...adjacent(s.cell)].sort((a,b)=>a-b));for(const i of s.cells)want[i]=Math.min(11,want[i]+1);}
  assert.deepEqual(e.hits,want);
  // The first free spin's drop starts from those tiles.
  assert.deepEqual(round.events.slice(at).find(x=>x.type==='drop').hits,want);
 }
 assert.deepEqual([...counts].sort(),[3,4,5]);
 // No other bonus opens this way.
 for(const mode of ['regular','super'])assert.ok(!generateRound({rng:seedRng(7),mode}).events.some(e=>e.type==='hiddenStrikes'));
});

test('bonus buys drop the scatter artwork for their own tier',()=>{
 for(const [mode,kind] of [['regular','fs'],['super','sfs'],['hidden','hfs']]){
  const first=generateRound({mode,rng:seedRng(42)}).events[0];
  assert.equal(first.type,'drop');assert.equal(first.trigger,true);assert.ok(first.board.filter(x=>x===kind).length>=3);
 }
});

test('buy openings can land 4 and 5+ scatters at the existing scatter chance',()=>{
 const counts={3:0,4:0,more:0};
 for(let seed=1;seed<=20000;seed++){
  const b=triggerBoard(seedRng(seed),3,'sfs',true),n=b.filter(isScatter).length;
  assert.equal(b.filter(k=>k==='sfs').length,3);assert.ok(n>=3&&n<=49);
  counts[n===3?3:n===4?4:'more']++;
 }
 assert.ok(counts[4]>1000&&counts.more>100);
 const noExtras=(1-RULES.scatterChance)**46;
 assert.ok(Math.abs(counts[3]/20000-noExtras)<.015);
});

test('all purchased tiers use the natural 3/4/5+ awards, including the Hidden prize',()=>{
 const reached=new Set();
 for(const mode of ['regular','super','hidden','mystery'])for(let seed=1;seed<=1200;seed++){
  const r=generateRound({mode,rng:seedRng(seed)}),b=r.events[0].board;
  const count=b.filter(isScatter).length,award=bonusFor(b.filter(k=>k==='fs').length,b.filter(k=>k==='sfs').length,b.filter(k=>k==='hfs').length);
  assert.equal(r.bonusMode,award.mode);assert.equal(r.events.find(e=>e.type==='bonusStart').count,award.count);
  assert.equal(r.events.find(e=>e.type==='prize')?.amount||0,award.prize);
  const paid=r.events.reduce((sum,e)=>sum+(e.type==='win'?e.total:e.type==='prize'?e.amount:0),0);
  assert.ok(Math.abs(paid-r.total)<.0001);assert.ok(r.total<=RULES.maxWin);
  reached.add(`${mode}:${Math.min(5,count)}`);
 }
 for(const mode of ['regular','super','hidden','mystery'])for(const n of [3,4,5])assert.ok(reached.has(`${mode}:${n}`));
});
