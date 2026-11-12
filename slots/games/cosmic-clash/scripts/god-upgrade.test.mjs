import test from 'node:test';
import assert from 'node:assert/strict';
import {isGodUpgrade,presentGodUpgrade} from '../dist/god-upgrade.js';
import {createSpinResultGate,SKIPPED_RESULT_HOLD} from '../dist/spin-result.js';

test('only ordinary God Mode doubles replace combat; gold Bosses keep their special duel',()=>{
 assert(isGodUpgrade({operation:'double',boss:false},'hidden'));
 for(const [duel,tier] of [[{operation:'multiply',boss:true},'hidden'],[{operation:'keep'},'super'],[{operation:'double'},'regular']])assert(!isGodUpgrade(duel,tier));
});

function fixture(onAnimation=()=>{}){
 const events=[],children=new Set();
 const node=name=>({name,className:'',textContent:'',setAttribute(){},remove(){children.delete(this);},
  animate(frames,options){events.push(name);onAnimation(name);return {finished:Promise.resolve(),cancel(){},finish(){}};},
  getBoundingClientRect:()=>({left:100,top:400,width:100,height:40}),
 });
 const label=node('badge');label.textContent='640×';
 const card={ownerDocument:{createElement:()=>node('token')},querySelector:()=>label,append:el=>children.add(el),getBoundingClientRect:()=>({left:100,top:50,width:100,height:500})};
 return {card,label,events,children};
}
test('new wild reveal precedes the pulse and its impact applies the capped recorded value once',async()=>{
 const f=fixture(),motions=new Set();let resolves=0;
 await presentGodUpgrade({card:f.card,duel:{from:640,to:1024},motions,
  onReveal:async()=>f.events.push('reveal'),onResolve:()=>{resolves++;f.events.push('resolve');f.label.textContent='1024×';}});
 assert.deepEqual(f.events,['reveal','token','resolve','badge']);assert.equal(resolves,1);
 assert.equal(f.label.textContent,'1024×');assert.equal(f.children.size,0);assert.equal(motions.size,0);
});
test('skip or reduced motion at entry, opening or flight still leaves the exact value and no pulse',async()=>{
 for(const phase of ['entry','opening','flight']){
  let instant=phase==='entry',resolves=0;
  const f=fixture(name=>{if(phase==='flight'&&name==='token')instant=true;});
  await presentGodUpgrade({card:f.card,duel:{from:320,to:640},instant:()=>instant,
   onReveal:async()=>{if(phase==='opening')instant=true;},onResolve:()=>{resolves++;f.label.textContent='640×';}});
  assert.equal(resolves,1);assert.equal(f.label.textContent,'640×');assert.equal(f.children.size,0);assert(!f.events.includes('badge'));
 }
});
test('already capped values produce no fake 2x pulse or animation',async()=>{
 const f=fixture();let resolved=0;
 await presentGodUpgrade({card:f.card,duel:{from:1024,to:1024},onResolve:()=>resolved++});
 assert.equal(resolved,1);assert.deepEqual(f.events,[]);
});
test('skipped misses and wins hold their final board before advancing, even with repeated skip taps',async()=>{
 for(const win of [0,1250]){
  let finishHold,advanced=false,shownWin=null;
  const gate=createSpinResultGate({wait:ms=>{assert.equal(ms,SKIPPED_RESULT_HOLD);return new Promise(resolve=>{finishHold=resolve;});}});
  gate.begin();assert(gate.markSkipped());
  const playback=(async()=>{await gate.show(()=>{shownWin=win;});advanced=true;})();
  assert.equal(shownWin,win);assert(gate.holding);assert(!advanced);assert.equal(gate.markSkipped(),false);
  finishHold();await playback;assert(advanced);assert(!gate.holding);
  gate.begin();await gate.show(()=>assert.fail('Previous skip cannot carry into the next spin'));
 }
});
test('reduced motion still permits reading the board and ordinary non-skipped spins add no delay',async()=>{
 let waits=0,renders=0;const gate=createSpinResultGate({wait:async()=>{waits++;}});
 gate.begin();await gate.show(()=>renders++);assert.equal(waits,0);
 gate.begin({reduced:true});await gate.show(()=>renders++);assert.equal(waits,1);assert.equal(renders,1);
});
