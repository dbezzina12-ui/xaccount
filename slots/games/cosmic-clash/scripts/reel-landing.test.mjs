import test from 'node:test';
import assert from 'node:assert/strict';
import {settleReel} from '../dist/reel-motion.js';

function column() {
  const created=[];
  const cells=['HELMET','VS','D','SCATTER','GUN'].map(name=>({
    dataset:{name},querySelector:()=>({animate:()=>{
      let finish,fail;
      const animation={finished:new Promise((resolve,reject)=>{finish=resolve;fail=reject;}),cancelled:false,
        finish:()=>finish(),fail:()=>fail(new Error('cancelled')),cancel(){this.cancelled=true;}};
      created.push(animation);return animation;
    }}),
  }));
  return {created,cells,querySelectorAll:()=>cells};
}

test('Skip finishes every landing and releases the game with no retained animations',async()=>{
  const reel=column(),motions=new Set();let settled=false;
  const job=settleReel(reel,{motions}).then(()=>{settled=true;});
  assert.equal(motions.size,5);await Promise.resolve();assert.equal(settled,false);
  for(const motion of motions)motion.finish();
  await job;
  assert.equal(settled,true);assert.equal(motions.size,0);
  assert(reel.created.every(animation=>animation.cancelled));
  assert.deepEqual(reel.cells.map(cell=>cell.dataset.name),['HELMET','VS','D','SCATTER','GUN']);
});

test('Reduced motion bypasses animation, and an interrupted landing cannot strand settlement',async()=>{
  const reel=column(),motions=new Set();
  await settleReel(reel,{instant:()=>true,motions});assert.equal(reel.created.length,0);
  const job=settleReel(reel,{motions,turbo:true});
  reel.created[0].fail();for(const animation of reel.created.slice(1))animation.finish();
  await job;assert.equal(motions.size,0);assert(reel.created.every(animation=>animation.cancelled));
});
