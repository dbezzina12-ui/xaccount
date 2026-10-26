import test from 'node:test';
import assert from 'node:assert/strict';
import {SYMBOLS,RULES,seedRng,clusters,evaluate,collapse,strike,resolveSpin,generateRound,multiplier,fsCount,mageTarget,isWild,bonusFor,adjacent} from '../runtime/engine.js';
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

// The skeleton mage (N-08): one zapped cell in the base game. In free spins
// he may strike: a sticky roamer that stays for the rest of the bonus and
// moves every spin, or a one-time burst of three wilds.
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
test('free spins: roamers move after the drop, then the mage may strike: a new roamer or a burst of three',()=>{
 const count={regular:{spins:0,roamer:0,burst:0},super:{spins:0,roamer:0,burst:0}};
 for(const mode of ['regular','super'])for(let seed=1;seed<=400;seed++){
  const round=generateRound({rng:seedRng(seed),mode});
  assert.ok(!round.events.some(e=>e.type==='arrow'));
  const end=walk(round,(spin,roamers)=>{
   count[mode].spins++;
   const [drop,...rest]=spin;assert.equal(drop.type,'drop');assert.ok(!drop.board.some(isWild),'the drop has no wilds');
   let k=0,board=drop.board,now=[];
   // Every roamer from last spin moves, to a cell that is not where it was, not an FS tombstone.
   if(roamers.length){
    const roam=rest[k++];assert.equal(roam.type,'roam');assert.deepEqual(roam.moves.map(m=>m.from),roamers);
    for(const {from,cell} of roam.moves){assert.notEqual(cell,from);assert.notEqual(board[cell],'fs');now.push(cell);}
    assert.equal(new Set(now).size,now.length);assert.deepEqual(roamWilds(roam.board).sort((a,b)=>a-b),[...now].sort((a,b)=>a-b));
    for(let i=0;i<49;i++)if(!now.includes(i))assert.equal(roam.board[i],board[i]);
    assert.deepEqual(roam.hits,drop.hits);board=roam.board;
   }else assert.notEqual(rest[0]?.type,'roam');
   const zap=rest[k]?.type==='zap'?rest[k++]:null;
   if(zap){
    count[mode][zap.roamer?'roamer':'burst']++;assert.equal(zap.cells.length,zap.roamer?1:3);
    for(const c of zap.cells){assert.notEqual(board[c],'fs');assert.ok(!isWild(board[c]));assert.equal(zap.board[c],zap.roamer?'roam-wild':'arrow-wild');}
    if(zap.roamer)now.push(zap.cells[0]);board=zap.board;
   }
   // The rest of the spin: no more mage events; the roamers stay put on every board.
   for(const e of rest.slice(k)){assert.ok(e.type!=='zap'&&e.type!=='roam');if(e.board)assert.deepEqual(roamWilds(e.board).sort((a,b)=>a-b),[...now].sort((a,b)=>a-b));}
   return now;
  });
  assert.equal(round.roamerStrikes+round.bursts,round.events.filter(e=>e.type==='zap').length);
  void end;
 }
 for(const mode of ['regular','super']){
  const c=count[mode],rate=(c.roamer+c.burst)/c.spins,chance=RULES.mage.chance[mode];
  assert.ok(Math.abs(rate-chance)<chance*.25,`${mode}: the mage struck on ${(rate*100).toFixed(1)}% of spins`);
  assert.ok(c.roamer>10&&c.burst>10&&Math.abs(c.roamer/(c.roamer+c.burst)-.5)<.15,`${mode}: ${c.roamer} roamers, ${c.burst} bursts`);
 }
});
test('roamers stay for the rest of the bonus and stack up',()=>{
 let stacked=0;
 for(let seed=1;seed<=3000&&stacked<3;seed++){
  const round=generateRound({rng:seedRng(seed),mode:'regular'});if(round.roamerStrikes<2)continue;stacked++;
  // After each roamer strike there is one more roamer on every later spin.
  let have=0;
  for(const spin of freeSpins(round)){
   const roam=spin.find(e=>e.type==='roam');assert.equal(roam?.moves.length??0,have);
   if(spin.some(e=>e.type==='zap'&&e.roamer))have++;
  }
  assert.equal(have,round.roamerStrikes);assert.ok(have>=2);
 }
 assert.equal(stacked,3);
});
test('roamers hold their cells through every tumble while the column falls past them; bursts do not',()=>{
 let held=0,burstFell=0;
 for(let seed=1;seed<=1500&&(held<5||burstFell<3);seed++){
  for(const spin of freeSpins(generateRound({rng:seedRng(seed),mode:'regular'}))){
   const pinned=[...(spin.find(e=>e.type==='roam')?.moves.map(m=>m.cell)||[]),...(spin.find(e=>e.type==='zap'&&e.roamer)?.cells||[])];
   const tumbles=spin.filter(e=>e.type==='tumble');
   for(const t of tumbles){assert.deepEqual(t.fixed.slice().sort((a,b)=>a-b),pinned.slice().sort((a,b)=>a-b));for(const c of pinned){assert.equal(t.board[c],'roam-wild');assert.equal(t.falls[c],0);}}
   // A roamer can win more than once in a spin: its cell advances each time.
   if(pinned.length&&spin.filter(e=>e.type==='win'&&pinned.some(c=>e.positions.includes(c))).length>=2)held++;
   const burst=spin.find(e=>e.type==='zap'&&!e.roamer);
   if(burst&&tumbles.length&&tumbles.some(t=>burst.cells.some(c=>t.board[c]!=='arrow-wild')))burstFell++;
  }
 }
 assert.ok(held>=5,`${held} free spins where a roamer won twice or more`);
 assert.ok(burstFell>=3,`${burstFell} free spins where a burst wild cleared or fell`);
 // Column 0: the roamer at row 3 wins with row 5; the rows above fall past it.
 const b=Array.from({length:49},(_,i)=>SYMBOLS[(i+Math.floor(i/7))%7]);b[21]='roam-wild';
 const before=[0,7,14,21,28,35,42].map(i=>b[i]),r=collapse(b,[21,35],seedRng(3),[21]);
 assert.deepEqual([42,35,28,21,14,7].map(i=>r.board[i]),[before[6],before[4],before[2],'roam-wild',before[1],before[0]]);
 assert.deepEqual([0,7,14,21,28,35,42].map(i=>r.falls[i]),[1,1,1,0,2,1,0]);
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
  assert.equal(round.played,10+events.filter(e=>e.type==='retrigger').reduce((s,e)=>s+e.count,0));
  // The first spin after the retrigger moves every roamer struck before it.
  const next=events.slice(at).find(e=>e.type==='roam');assert.ok(next.moves.length>=before);
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
 assert.equal(r.events[1].type,'roam');assert.equal(r.total,100);assert.equal(r.capped,true);assert.equal(r.events.at(-1).type,'win');assert.equal(r.roamers.length,2);
});
test('no eligible cell: no wild, nothing overwritten',()=>{
 assert.equal(mageTarget(Array(49).fill('fs'),seedRng(1)),-1);
 const walled=Array(49).fill('fs');walled[10]='wild';assert.equal(mageTarget(walled,seedRng(1),-1),-1);
 // One free cell: a roamer may stay on it.
 const one=Array(49).fill('fs');one[30]='ruby';assert.equal(mageTarget(one,seedRng(1),30),30);
 const r=resolveSpin({rng:seedRng(2),board:Array(49).fill('fs'),roamers:[5,6]});
 assert.deepEqual(r.roamers,[]);assert.ok(!r.events.some(e=>e.type==='zap'||e.type==='roam'));assert.equal(r.scatters,49);
 // Two roamers, one free cell: one roamer lands, the other has nowhere to go.
 const r2=resolveSpin({rng:seedRng(2),board:one,roamers:[5,6]});assert.deepEqual(r2.roamers,[30]);
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
