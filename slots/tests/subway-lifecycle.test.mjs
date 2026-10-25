import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createBonusScreen} from '../games/zombify/runtime/bonus-screen.js';
import {createFreeSpinCounter} from '../games/zombify/runtime/free-spin-counter.js';
import {createPlayback} from '../games/zombify/runtime/playback.js';

// Exercise the application's real callbacks, rather than a second copy of its
// scene-switching logic. This is deterministic lifecycle coverage, not a claim
// that Node emulates a background browser tab or paints the opaque doors.
const source=readFileSync(new URL('../games/zombify/runtime/app.js',import.meta.url),'utf8');
const callbacks=source.slice(source.indexOf('function enterFeature('),source.indexOf('async function play('));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({reduced=false}={}){
 const pending=[],nodes=new Map(),mutations=[],playback=createPlayback();
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set(),el={id,open:false,hidden:true,textContent:'',dataset:{},style:{setProperty(){}},
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},
   setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},
   animate(){let resolve;const finished=new Promise(done=>resolve=done);const a={id,finished,finish:resolve,cancel:resolve};pending.push(a);return a;}};
  nodes.set(id,el);return el;
 }
 const dialog=node('feature'),content=node('feature-content'),doors=[node('left'),node('right')],game=node('game');
 const raw={};game.dataset=new Proxy(raw,{set(target,key,value){if(key==='freeSpins')mutations.push({value,phase:dialog.dataset.phase,doors:doors.map(d=>d.style.transform)});target[key]=value;return true;},deleteProperty(target,key){if(key==='freeSpins')mutations.push({value:null,phase:dialog.dataset.phase,doors:doors.map(d=>d.style.transform)});delete target[key];return true;}});
 const bonusScreen=createBonusScreen({dialog,content,doors,button:node('feature-continue'),reduced,wait:async()=>{}});
 const freeSpins=createFreeSpinCounter({game,element:node('free-spins-counter'),value:node('free-spins-value'),label:node('free-spins-label'),status:node('free-spins-status'),lift:node('lift'),animate:async()=>{}});
 const ctx=vm.createContext({$:node,bonusScreen,freeSpins,bonusTier:null,renderInfection(){},soundEffect(){},
  audioDirector:{stopEffects(){},setScene(){}},
  BONUS_FEATURES:Object.fromEntries(['regular','super','hidden'].map(tier=>[tier,{scatters:3,title:tier}])),
  FEATURE_PRESENTATION:Object.fromEntries(['regular','super','hidden'].map(tier=>[tier,{description:tier}])),WIN_TIERS:{max:{threshold:25000}}});
 const api=vm.runInContext(callbacks+';({enterFeature,finishFeature})',ctx);
 async function finishAnimations(){for(const a of pending.splice(0))a.finish();await tick();}
 async function until(phase){for(let i=0;i<12&&bonusScreen.read().phase!==phase;i++)await finishAnimations();assert.equal(bonusScreen.read().phase,phase);}
 return {...api,bonusScreen,freeSpins,game,node,doors,pending,mutations,playback,finishAnimations,until};
}
function coveredChanges(f){
 for(const event of f.mutations){
  assert.ok(['covered','leaving'].includes(event.phase),`scene changed while ${event.phase}`);
  assert.deepEqual(event.doors,['translateX(0)','translateX(0)']);
 }
}

for(const tier of ['regular','super','hidden'])test(`${tier}: reduced-motion entry and exit swap the subway scene only while covered`,async()=>{
 const f=fixture({reduced:true});
 const entering=f.enterFeature({tier,spins:10});await tick();
 assert.equal(f.bonusScreen.read().phase,'ready');
 assert.equal(f.game.dataset.freeSpins,'pending');
 assert.equal(f.freeSpins.read().active,false);
 assert.equal(f.bonusScreen.continue(),true);assert.equal(f.bonusScreen.continue(),false);
 await entering;assert.equal(f.game.dataset.freeSpins,'active');
 assert.equal(f.node('free-spins-value').textContent,'10');
 assert.equal(f.pending.length,0,'reduced motion must not wait on a visual animation');
 const exiting=f.finishFeature({tier,total:123},{},null,String);await tick();
 assert.equal(f.game.dataset.freeSpins,'active','result keeps lab until Continue');
 assert.equal(f.node('feature-result-value').textContent,'123');
 f.bonusScreen.continue();await exiting;
 assert.equal(f.game.dataset.freeSpins,undefined);assert.equal(f.freeSpins.read().active,false);
 coveredChanges(f);
});

test('Skip before the bonus cannot switch rooms before both doors close or bypass Continue',async()=>{
 const f=fixture();f.playback.beginSpin(1);f.playback.skipSpin();
 const entering=f.enterFeature({tier:'regular',spins:10});await tick();
 assert.equal(f.bonusScreen.continue(),false);
 assert.equal(f.game.dataset.freeSpins,undefined);
 assert.equal(f.pending.length,2);f.pending.shift().finish();await tick();
 assert.equal(f.game.dataset.freeSpins,undefined,'one closed door cannot reveal the lab');
 await f.until('ready');assert.equal(f.game.dataset.freeSpins,'pending');
 assert.equal(f.freeSpins.read().active,false);
 f.bonusScreen.continue();await f.until('idle');await entering;
 assert.equal(f.game.dataset.freeSpins,'active');coveredChanges(f);
});

test('delayed door completion resumes the scene lifecycle without a stale base/lab swap',async()=>{
 const f=fixture();const entering=f.enterFeature({tier:'regular',spins:10});await tick();
 // Model paused animation promises. Browser visibility scheduling is a
 // separate browser check; no timer or visibility signal changes scene state.
 await tick();await tick();assert.equal(f.game.dataset.freeSpins,undefined);
 await f.until('ready');await tick();assert.equal(f.game.dataset.freeSpins,'pending');
 f.bonusScreen.continue();await f.until('idle');await entering;
 const exiting=f.finishFeature({tier:'regular',total:0},{},null,String);await tick();
 await tick();assert.equal(f.game.dataset.freeSpins,'active');
 await f.until('ready');f.bonusScreen.continue();await f.until('idle');await exiting;
 assert.equal(f.game.dataset.freeSpins,undefined);coveredChanges(f);
 const again=f.enterFeature({tier:'super',spins:10});await f.until('ready');
 assert.equal(f.game.dataset.freeSpins,'pending');f.bonusScreen.continue();await f.until('idle');await again;
 assert.equal(f.freeSpins.read().tier,'super');
});

test('cancelling during closure prevents a delayed callback from switching to the lab',async()=>{
 const f=fixture();const entering=f.enterFeature({tier:'regular',spins:10});await tick();
 f.bonusScreen.cancel();await entering;await f.finishAnimations();
 assert.equal(f.game.dataset.freeSpins,undefined);assert.equal(f.bonusScreen.read().phase,'idle');
 assert.equal(f.mutations.length,0);assert.equal(f.node('feature').open,false);
});
