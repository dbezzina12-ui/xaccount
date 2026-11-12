import test from 'node:test';
import assert from 'node:assert/strict';
import {duelCast,duelClip,DUEL_CLIPS,DUEL_PLAYBACK_RATE,DUEL_START_TIMEOUT,DUEL_STALL_TIMEOUT,createDuelMotion} from '../dist/duel-motion.js';

test('all matchups show the actual losing character and rotate only Outlaw incumbents',()=>{
 assert.equal(Object.keys(DUEL_CLIPS).length,4);
 for(const fighter of ['hunter','outlaw','boss'])for(const won of [true,false]){
  const duel={fighter,boss:fighter==='boss',won},cast=duelCast(duel),clip=duelClip(duel);
  const loser=won?(fighter==='outlaw'?'hunter':'outlaw'):fighter;
  assert.equal(cast[cast.loser],loser);assert.equal(clip.loser,loser);
  assert.equal(clip.src,fighter==='boss'&&won?'./assets/duel-v73/boss-wins.mp4':`./assets/duel-v73/${loser}-loses.mp4`);
  assert.equal(clip.rotated,fighter==='outlaw');
 }
});
function harness(){
 const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;
 let id=0;const callbacks=new Map();
 globalThis.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};
 globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
 class Video extends EventTarget{
  dataset={};readyState=2;currentTime=0;duration=2.4;ended=false;paused=true;plays=0;
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
  load(){}
 }
 const video=new Video(),node={isConnected:true,querySelector:()=>video};
 return {video,node,callbacks,tick(time){video.currentTime=time;const fns=[...callbacks.values()];callbacks.clear();for(const fn of fns)fn();},close(){globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}};
}
test('one playback starts at frame zero, never seeks at shot cues, and completes on ended',async()=>{
 const h=harness();try{
  let shots=0,finished=false;const motion=createDuelMotion(h.node,{duel:{won:true}});
  assert(await motion.prepare());assert(h.video.src.endsWith('outlaw-loses.mp4'));
  const pending=motion.play({pace:1,onShot:()=>shots++}).then(value=>{finished=true;return value;});
  assert.equal(h.video.currentTime,0);assert.equal(h.video.plays,1);assert.equal(DUEL_PLAYBACK_RATE,1.4);assert.equal(h.video.playbackRate,1.4);
  h.tick(1.4);assert.equal(shots,1);assert.equal(h.video.currentTime,1.4);
  h.tick(2);assert.equal(shots,1);h.tick(2.39);await Promise.resolve();
  assert.equal(finished,false,'Normal playback reaches the end before resolving');
  h.video.dispatchEvent(new Event('ended'));assert.equal(await pending,true);
  assert.equal(h.video.plays,1);assert.equal(h.callbacks.size,0);assert(h.video.paused);
 }finally{h.close();}
});
test('skip, detached guide and explicit stop cancel playback without further shots',async()=>{
 for(const mode of ['skip','detach','stop']){
  const h=harness();let skip=false,shots=0;
  try{
   const motion=createDuelMotion(h.node,{duel:{won:false},instant:()=>skip});
   const pending=motion.play({pace:.3,onShot:()=>shots++});assert.equal(h.video.playbackRate,4);
   if(mode==='skip')skip=true;else if(mode==='detach')h.node.isConnected=false;else motion.stop();
   h.tick(2);assert.equal(await pending,false);assert.equal(shots,0);assert(h.video.paused);assert.equal(h.callbacks.size,0);
  }finally{h.close();}
 }
});
test('skip during loading and media errors release the pending operation',async()=>{
 const h=harness();let skip=false;
 try{
  h.video.readyState=0;const motion=createDuelMotion(h.node,{duel:{won:false},instant:()=>skip});
  assert(await motion.prepare());const loading=motion.play();skip=true;h.tick(0);assert.equal(await loading,false);
  skip=false;h.video.readyState=2;const pending=motion.play();h.video.dispatchEvent(new Event('error'));
  assert.equal(await pending,false);assert(h.video.paused);assert.equal(h.callbacks.size,0);
 }finally{h.close();}
});

test('a stalled decoder has a bounded startup window instead of holding the reel',async t=>{
 const h=harness();let now=0,shots=0;t.mock.method(performance,'now',()=>now);
 try{
  const motion=createDuelMotion(h.node,{duel:{won:true}});
  const playing=motion.play({onShot:()=>shots++});now=DUEL_START_TIMEOUT+1;h.tick(0);
  assert.equal(await playing,false);assert.equal(shots,0);assert(h.video.paused);assert.equal(h.callbacks.size,0);
 }finally{h.close();}
});
test('ready media continues past its single shot without emitting more gunshots',async()=>{
 const h=harness();let shots=0;
 try{
  const motion=createDuelMotion(h.node,{duel:{won:true}});await motion.prepare();
  const playing=motion.play({onShot:()=>shots++});
  for(const time of [.1,.9,1,1.1,1.4,2,2.39])h.tick(time);
  assert.equal(shots,1);h.video.dispatchEvent(new Event('ended'));assert.equal(await playing,true);
 }finally{h.close();}
});

test('sequential reels reuse the prepared decoder and restore each reel placeholder',async t=>{
 const h=harness(),created=[];
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');
 class PooledVideo extends EventTarget{
  dataset={};readyState=0;currentTime=0;duration=2.4;loads=0;parentNode=null;
  play(){return Promise.resolve();}pause(){}
  load(){this.loads++;this.readyState=2;this.dispatchEvent(new Event('loadeddata'));}
  replaceWith(other){this.parentNode.video=other;other.parentNode=this.parentNode;this.parentNode=null;}
 }
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){const v=new PooledVideo();created.push(v);return v;}}});
 try{
  const {preloadDuelClips}=await import('../dist/duel-motion.js');
  await preloadDuelClips();await preloadDuelClips();assert.equal(created.length,4);
  let reused;
  for(let i=0;i<2;i++){
   const placeholder=new PooledVideo(),host={isConnected:true,video:placeholder,querySelector(){return this.video;}};placeholder.parentNode=host;
   const motion=createDuelMotion(host,{duel:{won:true}});assert.notEqual(host.video,placeholder);
   assert(await motion.prepare());if(reused)assert.equal(host.video,reused);reused=host.video;
   host.video.currentTime=2.4;motion.stop();assert.equal(host.video,placeholder);
  }
  assert.equal(reused.currentTime,0);assert(created.every(video=>video.loads===1));
 }finally{
  if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;h.close();
 }
});


test('cold media decodes then pauses at frame zero before the VS opens, with one combat shot',async t=>{
 const h=harness();const order=[];let resolved=0,shots=0;
 try{
  const {presentDuel}=await import('../dist/duel-presentation.js');
  const fields=new Map();Object.assign(h.node,{hidden:true,dataset:{},style:{setProperty(){}},querySelector(selector){
   if(selector==='[data-motion="scene"]')return h.video;
   if(!fields.has(selector))fields.set(selector,{textContent:'',dataset:{}});return fields.get(selector);
  }});
  h.video.readyState=0;h.video.removeAttribute=name=>{if(name==='poster')h.video.poster='';};
  h.video.play=()=>{h.video.plays++;h.video.paused=false;order.push(h.video.plays===1?'decode':'play');return Promise.resolve();};
  const job=presentDuel({node:h.node,duel:{won:true,regular:true,from:5,to:5,rival:20,operation:'keep'},createMotion:createDuelMotion,
   wait:async()=>{},onReveal:async()=>{assert.equal(h.video.readyState,2);assert(h.video.paused);assert.equal(h.video.currentTime,0);assert.equal(h.video.poster,'');order.push('open');},
   onShot:()=>{shots++;order.push('shot');},onResolve:()=>{resolved++;order.push('result');}});
  for(let i=0;i<5;i++)await Promise.resolve();assert.deepEqual(order,['decode']);
  h.video.readyState=2;h.video.currentTime=.04;h.video.dispatchEvent(new Event('loadeddata'));
  for(let i=0;i<8;i++)await Promise.resolve();assert.deepEqual(order,['decode','open','play']);
  h.tick(.9);assert.equal(shots,1);h.tick(2.4);h.video.dispatchEvent(new Event('ended'));await job;
  assert.equal(resolved,1);assert.deepEqual(order,['decode','open','play','shot','result']);assert(h.video.paused);assert.equal(h.callbacks.size,0);
 }finally{h.close();}
});
test('buffering after playback starts gets its own bounded stall window',async t=>{
 const h=harness();let now=0,settled=false;t.mock.method(performance,'now',()=>now);
 try{
  const motion=createDuelMotion(h.node,{duel:{won:true}});
  const playing=motion.play().then(value=>{settled=true;return value;});
  h.tick(.1);now=700;h.tick(.1);await Promise.resolve();assert.equal(settled,false);
  now=DUEL_STALL_TIMEOUT+1;h.tick(.1);assert.equal(await playing,false);assert(h.video.paused);assert.equal(h.callbacks.size,0);
 }finally{h.close();}
});
test('a rejected play request cleans up and does not emit a shot',async()=>{
 const h=harness();try{
  h.video.play=()=>Promise.reject(new Error('Media unavailable'));
  const motion=createDuelMotion(h.node,{duel:{won:true}});
  assert.equal(await motion.play({onShot:()=>assert.fail('No shot without playback')}),false);
  assert(h.video.paused);assert.equal(h.callbacks.size,0);
 }finally{h.close();}
});
