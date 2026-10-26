import test from 'node:test';
import assert from 'node:assert/strict';
import {ReelMotion} from '../runtime/reel-motion.js';
import {symbolArt} from '../runtime/symbols.js';

test('roaming lanterns travel together between their actual cells, independently of staff attacks',async()=>{
 const targets=[],sprites=[],runs=[];
 const boxes=Array.from({length:49},(_,i)=>({x:i%7*50,y:Math.floor(i/7)*50,w:48,h:48}));
 const motion={reduced:{matches:false},skip:()=>false,geometry:()=>boxes,
  cells:boxes.map((_,i)=>({classList:{add:kind=>targets.push([i,kind])}})),
  sprite:(kind,box)=>{const el={kind,box};sprites.push(el);return el;},
  run:async(tracks,kind)=>runs.push({tracks,kind})};
 await ReelMotion.prototype.roam.call(motion,[{from:42,cell:6},{from:6,cell:42},{from:-1,cell:24}]);
 assert.deepEqual(targets,[[6,'motion-target'],[42,'motion-target'],[24,'motion-target']]);
 assert.ok(sprites.every(s=>s.kind==='roam-wild'));
 assert.equal(runs.length,1);assert.equal(runs[0].kind,'roam');
 const tracks=runs[0].tracks;
 assert.equal(tracks[0].frames[0].transform,'translate(-300px,300px) scale(.9)');
 assert.equal(tracks[1].frames[0].transform,'translate(300px,-300px) scale(.9)');
 assert.equal(tracks[2].frames[0].opacity,0);
 assert.ok(tracks.every(t=>t.delay===0&&t.frames.at(-1).transform==='none'));
});

test('reduced motion and skip leave rendered lanterns visible without moving overlays',async()=>{
 for(const reduced of [true,false])await ReelMotion.prototype.roam.call({reduced:{matches:reduced},skip:()=>!reduced},[{from:0,cell:48}]);
});

test('persistent and temporary mage wilds have distinct artwork',()=>{
 const sticky=symbolArt('roam-wild'),temporary=symbolArt('arrow-wild');
 assert.match(sticky,/roaming-wild\/front.webp/);assert.match(sticky,/fire-strip.webp/);
 assert.match(temporary,/symbols\/wild.webp/);assert.doesNotMatch(temporary,/roaming-wild/);
});
