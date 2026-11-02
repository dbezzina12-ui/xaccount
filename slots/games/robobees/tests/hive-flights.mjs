import assert from 'node:assert/strict';
import {test} from 'node:test';

const queue=new Map();
let now=0,serial=0;
globalThis.performance={now:()=>now};
globalThis.document=new EventTarget();
globalThis.devicePixelRatio=1;
globalThis.Image=class{async decode(){}};
globalThis.fetch=async()=>({ok:true,json:async()=>({clips:{hover:{fps:24,frames:[[0,0,120,100]]}}})});
globalThis.requestAnimationFrame=cb=>{queue.set(++serial,cb);return serial};
globalThis.cancelAnimationFrame=id=>queue.delete(id);
const {flyHiveBees}=await import('../dist/drone-stinger.mjs');

async function flight(collect,skipAt=Infinity){
 now=0;const events=[],positions=[];
 const ctx={save(){},restore(){},rotate(){},scale(){},drawImage(){},setTransform(){},clearRect(){},translate(x,y){positions.push([x,y])}};
 const rect=(x,y,width,height)=>({getBoundingClientRect:()=>({x,y,width,height})});
 const canvas={...rect(0,0,390,844),hidden:true,getContext:()=>ctx};
 const hive=rect(280,100,20,12),targets=[rect(20,400,60,70),rect(100,300,60,70)];
 const done=flyHiveBees({canvas,hive,targets,collect,fast:false,skip:()=>now>=skipAt,
  onDeparture:i=>events.push('out'+i),onArrival:i=>events.push('in'+i)});
 await new Promise(resolve=>setImmediate(resolve));
 for(now=20;queue.size&&now<=1500;now+=20){
  const callbacks=[...queue.values()];queue.clear();for(const cb of callbacks)cb(now);
 }
 await done;assert.equal(canvas.hidden,true);assert.equal(queue.size,0);
 return {events,positions};
}
test('collection ends inside the model door, deployment starts there; both settle once',async()=>{
 for(const collect of [true,false]){
  const {events,positions}=await flight(collect);
  assert.deepEqual(events,['out0','out1','in0','in1']);
  const [x,y]=collect?positions.at(-1):positions[0];
  assert.ok(Math.hypot(x-290,y-106)<2);
 }
});
test('skip and a mid-flight stop settle every departure and arrival exactly once',async()=>{
 for(const at of [0,300]){
  const {events}=await flight(false,at);
  assert.deepEqual([...events].sort(),['in0','in1','out0','out1']);
  for(const i of [0,1])assert.ok(events.indexOf('out'+i)<events.indexOf('in'+i));
 }
});
