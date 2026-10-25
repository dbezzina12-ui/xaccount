import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMascot,mascotPose,mascotPlacement} from '../games/zombify/runtime/subway-mascot.js';
function fixture({reduced=false,hidden=false}={}){
 const doc=new EventTarget(),env=new EventTarget(),media=new EventTarget(),frames=new Map();let id=0,paints=0,removed=false,disconnected=false;
 media.matches=reduced;doc.hidden=hidden;env.matchMedia=()=>media;env.devicePixelRatio=3;
 const context=new Proxy({clearRect(){paints++;}},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={style:{},setAttribute(){},getContext:()=>context,remove(){removed=true;}};
 doc.createElement=()=>canvas;doc.defaultView=env;
 env.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};env.cancelAnimationFrame=i=>frames.delete(i);
 env.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}};
 const host={ownerDocument:doc,isConnected:true,dataset:{},replaceChildren(){},getBoundingClientRect:()=>({width:200,height:220})};
 return {doc,env,media,host,canvas,frames,get paints(){return paints;},get removed(){return removed;},get disconnected(){return disconnected;},step(t){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(t));}};
}
test('idle stays subtle, only greeting waves, reduced motion is still',()=>{
 let blinks=0;for(let i=0;i<840;i++){const p=mascotPose(i/100);assert.ok(Math.abs(p.breath)<=1.5);assert.ok(Math.abs(p.head)<=.012);assert.equal(p.arm,0);blinks+=p.blink?1:0;assert.ok(Math.abs(mascotPose(i/100,'wave').arm)<=.13);}
 assert.ok(blinks>0&&blinks<40);assert.deepEqual(mascotPose(3,'wave',true),{breath:0,head:0,blink:false,arm:0});
});
test('actor keeps one loop, stops while hidden or paused, and cleans up',async()=>{
 const f=fixture(),rig=await mountMascot(f.host,{load:async()=>({})});assert.equal(f.frames.size,1);assert.equal(f.canvas.width,400);
 for(let i=1;i<=60;i++)f.step(i*1000/60);assert.ok(f.paints<35,'paint rate must stay below 30 fps plus initial paints');
 rig.setPaused(true);assert.equal(f.frames.size,0);rig.setPaused(false);rig.setPaused(false);assert.equal(f.frames.size,1);
 f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.frames.size,0);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.frames.size,1);
 f.env.dispatchEvent(new Event('pagehide'));assert.equal(f.frames.size,0);f.env.dispatchEvent(new Event('pageshow'));assert.equal(f.frames.size,1);
 rig.stop();rig.stop();assert.equal(f.frames.size,0);assert.ok(f.removed&&f.disconnected);assert.equal(f.host.dataset.mascotReady,undefined);
 f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.frames.size,0);
});
test('reduced motion draws a still character without scheduling animation',async()=>{
 const f=fixture({reduced:true}),rig=await mountMascot(f.host,{mode:'wave',load:async()=>({})});assert.ok(f.paints>0);assert.equal(f.frames.size,0);
 f.media.matches=false;f.media.dispatchEvent(new Event('change'));assert.equal(f.frames.size,1);f.media.matches=true;f.media.dispatchEvent(new Event('change'));assert.equal(f.frames.size,0);rig.stop();
});
test('a host removed while artwork loads cannot start an orphan loop',async()=>{
 const f=fixture();let resolve;const pending=mountMascot(f.host,{load:()=>new Promise(r=>resolve=r)});f.host.isConnected=false;resolve({});assert.equal(await pending,null);assert.equal(f.frames.size,0);
});
test('base and bonus placements remain on screen, and follow background zoom and pan',()=>{
 for(const s of [{width:390,height:844},{width:1280,height:800}])for(const bonus of [false,true]){const p=mascotPlacement(s,bonus);assert.ok(p.x>0&&p.y>0);assert.ok(p.x+p.w<s.width&&p.y+p.h<s.height);}
 const s={width:390,height:844,background:{zoom:140,positionX:0,positionY:0}},left=mascotPlacement(s),right=mascotPlacement({...s,background:{...s.background,positionX:100}});
 assert.ok(Math.abs(left.x-right.x-156)<.001);assert.equal(left.w,right.w);
});
