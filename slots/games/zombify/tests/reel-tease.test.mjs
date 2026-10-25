import test from 'node:test';
import assert from 'node:assert/strict';
import {reelTeasePlan,reelFrames,mysteryScatterBoard} from '../runtime/reel-tease.js';
const boardAt=(positions)=>Array.from({length:30},(_,i)=>({kind:positions.includes(i)?'vial':'j'}));
test('only columns following the second landed FS slow; all share its landing time',()=>{
 const plans=reelTeasePlan(boardAt([6,14,22,29]));
 assert.deepEqual(plans.map(p=>p.tease),[false,false,false,true,true,true]);
 for(const p of plans.slice(3))assert.equal(p.start,plans[2].ms);
 assert.ok(plans[3].ms-plans[2].ms>=1440);
 assert.equal(plans[4].ms-plans[3].ms,710);
 assert.ok(reelTeasePlan(boardAt([6])).every(p=>!p.tease));
 assert.ok(reelTeasePlan(boardAt([6,14,22]),true).every(p=>!p.tease));
 assert.ok(reelTeasePlan(boardAt([0,6])).slice(1).every(p=>p.tease));
 assert.ok(reelTeasePlan(boardAt([4,5])).every(p=>!p.tease));
});
test('tease visibly changes velocity after trigger instead of stretching the entire spin',()=>{
 const plan=reelTeasePlan(boardAt([0,1]))[2],frames=reelFrames({distance:2900,unit:100},plan);
 const y=f=>Number(f.transform.match(/translateY\(([-\d.]+)px/)[1]);
 const fast=(y(frames[1])-y(frames[0]))/plan.start;
 const slow=(y(frames[3])-y(frames[2]))/((frames[3].offset-frames[2].offset)*plan.ms);
 assert.ok(fast>slow*4);assert.equal(frames[1].offset,plan.start/plan.ms);
 for(let i=1;i<frames.length;i++)assert.ok(frames[i].offset>frames[i-1].offset);
 assert.equal(y(frames.at(-1)),0);
});
test('Mystery reveals selected 3/4/5 FS across reels without inventing another outcome',()=>{
 for(const [tier,count] of [['regular',3],['super',4],['hidden',5]]){
  const board=mysteryScatterBoard(tier),plans=reelTeasePlan(board);
  assert.equal(board.filter(c=>c.kind==='vial').length,count);
  assert.deepEqual(plans.map(p=>p.tease),[false,false,true,true,true,true]);
  assert.equal(new Set(board.map(c=>c.id)).size,30);
 }
});

test('braking stays ordered and retains a slow approach even with a turbo initial spin',()=>{
 for(const scale of [1,.45,.16])for(const p of reelTeasePlan(boardAt([0,1])).filter(p=>p.tease)){
  const timing={...p,start:p.start*scale,ms:p.start*scale+p.ms-p.start};
  const frames=reelFrames({distance:2900,unit:100},timing);
  assert.ok(Math.abs((frames[2].offset-frames[1].offset)*timing.ms-380)<1e-8);
  assert.ok(frames[1].easing.includes('cubic-bezier'));
  for(let i=1;i<frames.length;i++)assert.ok(frames[i].offset>frames[i-1].offset);
  assert.ok(timing.ms-timing.start>=1440);
 }
});
