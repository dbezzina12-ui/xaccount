import test from 'node:test';
import assert from 'node:assert/strict';
import {walkZombies,expandedZombies} from '../games/zombify/runtime/math.js';
import {visibleStackCells,stackPresentationMask,otherZombieCells,occludingCells,motionOcclusionMask,stackPortraitCells,stackPortraitRegion} from '../games/zombify/runtime/zombie-layout.js';
import {makePaidRound} from '../games/zombify/runtime/outcome-model.js';
const empty=()=>Array.from({length:30},(_,i)=>({id:`card-${i}`,kind:'j'}));
const svg=mask=>decodeURIComponent(mask.slice(mask.indexOf(',')+1,-2));
for(const direction of ['up','down'])test(`a full vertical ${direction} award does not paint over the horizontal portrait`,()=>{
 const input=empty();input[0]={id:'across',kind:'zombie',direction:'right'};
 for(const i of [1,2,3])input[i]={id:`human-${i}`,kind:'nurse'};
 const origin=direction==='up'?26:8;input[origin]={id:'vertical',kind:'zombie',direction};
 for(const i of [8,14,20,26])if(i!==origin)input[i]={id:`human-${i}`,kind:'cop'};
 const result=walkZombies(input,()=>0),snapshot=JSON.stringify(result);
 const stacks=expandedZombies(result.board),horizontal=stacks.find(s=>s.id==='across'),vertical=stacks.find(s=>s.id==='vertical');
 assert.deepEqual(horizontal.cells,[0,1,2,3]);assert.deepEqual(vertical.cells,[2,8,14,20,26]);
 assert.deepEqual(visibleStackCells(horizontal,result.board),[0,1,3]);
 assert.deepEqual(visibleStackCells(vertical,result.board),vertical.cells);
 assert.deepEqual(stackPortraitCells(horizontal,result.board),[3],'crossing leaves a complete single-cell head, never a sliced body');
 assert.deepEqual(stackPortraitCells(vertical,result.board),vertical.cells);
 assert.deepEqual(stackPortraitRegion(horizontal,result.board),{cells:[3],left:.75,top:0,width:.25,height:1});
 const visible=stacks.flatMap(s=>visibleStackCells(s,result.board));
 assert.equal(new Set(visible).size,visible.length,'every painted cell has one zombie owner');
 assert.notEqual(stackPresentationMask(horizontal,result.board),'none');
 assert.equal(stackPresentationMask(vertical,result.board),'none');
 assert.equal(JSON.stringify(result),snapshot,'presentation must not mutate awarded cells or values');
 const expansion=result.events.findLast(e=>e.type==='expand');
 assert.deepEqual(otherZombieCells(expansion.before,expansion.headId).sort((a,b)=>a-b),[0,1,2,3]);
});
test('leftward claims are masked by the same authoritative ownership rule',()=>{
 const board=empty(),horizontal={id:'left',cells:[7,8,9,10],horizontal:true,direction:'left'};
 for(const i of horizontal.cells)board[i]={id:`trail-${i}`,kind:'wild',owner:'left'};
 board[7]={id:'left',kind:'zombie',direction:'left',spanCells:horizontal.cells};
 board[9]={...board[9],stackId:'down'};
 assert.deepEqual(visibleStackCells(horizontal,board),[7,8,10]);
 const mask=svg(stackPresentationMask(horizontal,board));
 assert.match(mask,/viewBox="0 0 4 1"/);assert.ok(!mask.includes('M2 0h1'));
});
test('moving rigs mask other heads/claims but never mask their own trail',()=>{
 const board=empty();board[5]={id:'waiting',kind:'zombie'};
 board[12]={id:'across',kind:'zombie',spanCells:[12,13,14],direction:'left'};
 for(const i of [13,14])board[i]={kind:'wild',owner:'across'};
 board[20]={id:'moving',kind:'zombie',spanCells:[8,14,20]};
 board[14].stackId='moving';board[8].stackId='moving';board[20].stackId='moving';
 assert.deepEqual(otherZombieCells(board,'moving').sort((a,b)=>a-b),[5,12,13]);
});
test('motion masks use stationary normalized board coordinates and clamp edge cells',()=>{
 const bounds={left:100,top:200,width:600,height:500};
 const mask=svg(motionOcclusionMask(bounds,[{left:200,top:300,right:300,bottom:400}]));
 assert.match(mask,/viewBox="0 0 1 1"/);assert.match(mask,/fill-rule="evenodd"/);
 assert.ok(mask.includes('M0 0h1v1h-1Z'));
 assert.ok(mask.includes('M0.16666666666666666 0.2'));
 assert.equal(motionOcclusionMask(bounds,[{left:0,top:0,right:50,bottom:50}]),'none');
 assert.equal(motionOcclusionMask(bounds,[]),'none');
});

for(const direction of ['left','right'])test(`a ${direction} horizontal portrait fits its contiguous head segment without a chopped body`,()=>{
 const board=empty(),cells=[12,13,14,15,16,17],head=direction==='left'?12:17;
 for(const i of cells)board[i]={id:`trail-${i}`,kind:'wild',owner:'horizontal'};
 board[head]={id:'horizontal',kind:'zombie',direction,spanCells:cells};
 board[14].stackId='vertical';
 const stack={id:'horizontal',cells,horizontal:true,direction};
 const portrait=stackPortraitCells(stack,board),region=stackPortraitRegion(stack,board);
 assert.ok(portrait.includes(head));assert.ok(!portrait.includes(14));
 for(let i=1;i<portrait.length;i++)assert.equal(portrait[i]-portrait[i-1],1);
 assert.deepEqual(portrait,direction==='left'?[12,13]:[15,16,17]);
 assert.equal(region.width,portrait.length/cells.length);assert.equal(region.height,1);
 assert.equal(visibleStackCells(stack,board).length,5,'backdrop retains every owned trail cell');
});
test('a vertical portrait remains in the contiguous owned segment around its head',()=>{
 const board=empty(),stack={id:'vertical',cells:[1,7,13,19,25],horizontal:false};
 for(const i of stack.cells)board[i]={id:`trail-${i}`,kind:'wild',stackId:'vertical'};
 board[25]={id:'vertical',kind:'zombie',spanCells:stack.cells,stackId:'vertical'};
 board[13].stackId='other';
 assert.deepEqual(stackPortraitCells(stack,board),[19,25]);
 assert.deepEqual(stackPortraitRegion(stack,board),{cells:[19,25],left:0,top:.6,width:1,height:.4});
});

// The moving rig is masked out of other zombies' cells, but not out of a cell
// the event itself awards to it: there the landing zombie lost its head at
// the edge of the horizontal claim it crosses.
test('a crossing expansion stays visible in the cell it takes from another claim',()=>{
 const input=empty();input[0]={id:'across',kind:'zombie',direction:'right'};
 for(const i of [1,2,3])input[i]={id:`human-${i}`,kind:'nurse'};
 input[26]={id:'vertical',kind:'zombie',direction:'up'};
 for(const i of [8,14,20])input[i]={id:`human-${i}`,kind:'cop'};
 const result=walkZombies(input,()=>0),expansion=result.events.findLast(e=>e.type==='expand'&&e.headId==='vertical');
 assert.deepEqual(occludingCells(expansion).sort((a,b)=>a-b),[0,1,3]);
 for(const walk of result.events.filter(e=>e.type==='walk'&&e.headId==='vertical'))assert.deepEqual(occludingCells(walk).sort((a,b)=>a-b),[0,1,2,3]);
});
test('a real Outbreak crossing: every move is masked only out of cells another zombie keeps',()=>{
 // Regular-Outbreak catalog entry (seed 851) at ticket 29300000: on free spin 7 a vertical
 // award (cells 4-28) crosses a 5-cell horizontal one (cells 1-5).
 const queue=[29300000],result=makePaidRound({kind:'buy_outbreak',rng:()=>(queue.shift()+.5)/1e9});
 assert.equal(result.total,8730);
 const moves=result.events.filter(e=>e.before&&e.board&&e.headId);
 const crossing=moves.find(e=>e.type==='expand'&&e.cells.includes(4)&&e.cells.includes(28));
 assert.ok(crossing,'the crossing expansion is in this outcome');
 assert.deepEqual(otherZombieCells(crossing.before,crossing.headId).sort((a,b)=>a-b),[1,2,3,4,5]);
 assert.deepEqual(occludingCells(crossing).sort((a,b)=>a-b),[1,2,3,5]);
 for(const e of moves){
  const own=new Set([...(e.cells||[]),e.target]),masked=occludingCells(e);
  assert.ok(masked.every(i=>!own.has(i)),`${e.type} ${e.headId} is masked out of a cell it is awarded`);
  assert.ok(masked.every(i=>otherZombieCells(e.board,e.headId).includes(i)));
 }
});
