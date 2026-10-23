import test from 'node:test';
import assert from 'node:assert/strict';
import {applyBatch} from '../studio/project.js';
import {checkRequest} from '../server/protocol.js';
import {handleStudio,providers} from '../server/service.js';
import {environment,input,call,collect} from './lib/studio-env.mjs';
const SECRET='s'.repeat(40);
const keys={ANTHROPIC_API_KEY:'test-only'};
// Provider stubs are swapped per test and restored afterwards.
function stub(t,changes){
 const saved={openai:{...providers.openai},claude:{...providers.claude}};
 for(const [name,value] of Object.entries(changes))Object.assign(providers[name],value);
 t.after(()=>{Object.assign(providers.openai,saved.openai);Object.assign(providers.claude,saved.claude);});
}
const gate=()=>{let open;const p=new Promise(r=>open=r);return Object.assign(p,{open});};
const blockUntilAborted=(env,i,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('Request stopped.'))));
const status=async(env,id)=>(await (await call(env,'runs/'+id)).json()).status;
const handoffs=async env=>(await (await call(env,'handoffs')).json()).handoffs;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const brighter=[{type:'background',scene:'mobile',values:{brightness:120}}];
async function signed(env,body,{ts=Math.floor(Date.now()/1000),secret=SECRET}={}){
 const raw=JSON.stringify(body),e=new TextEncoder(),key=await crypto.subtle.importKey('raw',e.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,e.encode(ts+'.'+raw))).toString('hex');
 return handleStudio(new Request('https://studio.test/api/studio/hooks/dispatch',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Timestamp':String(ts),'X-Studio-Signature':'sha256='+sig},body:raw}),env);
}

test('history keeps who said what',()=>{
 const i=checkRequest({...input(),history:[{role:'assistant',text:'a',speaker:'claude'},{role:'assistant',text:'b',speaker:'root'},{role:'user',text:'c',speaker:'user'}]});
 assert.deepEqual(i.history,[{role:'assistant',text:'a',speaker:'claude'},{role:'assistant',text:'b'},{role:'user',text:'c',speaker:'user'}]);
});

test('cancellation goes to the provider that owns the run',async t=>{
 const cancelled=[];
 stub(t,{
  claude:{run:blockUntilAborted,cancel:async(env,run)=>{cancelled.push(['claude',run.id]);return true;}},
  openai:{run:async(env,i,o)=>{await o.sessionCreated('sess_1');return blockUntilAborted(env,i,o);},cancel:async(env,run)=>{cancelled.push(['openai',run.id,run.session_id]);return true;}},
 });
 const env=environment({...keys,STUDIO_HEARTBEAT_MS:5});
 // Claude: the cancel route marks the run; the streaming invocation's heartbeat sees it and aborts the request.
 const claude=collect(await call(env,'chat',{...input('claude-run-1'),provider:'claude'}));
 assert.equal((await (await call(env,'runs/claude-run-1/cancel',{})).json()).status,'cancelled');
 const events=await claude;
 assert.ok(!events.some(e=>e.type==='result'));
 assert.equal(await status(env,'claude-run-1'),'cancelled');
 assert.ok(cancelled.every(c=>c[0]==='claude')&&cancelled.length>=1);
 // OpenAI: the recorded Agents session is cancelled at OpenAI.
 cancelled.length=0;
 const openai=collect(await call(env,'chat',input('openai-run-1')));
 await wait(5);
 await call(env,'runs/openai-run-1/cancel',{});
 await openai;
 assert.deepEqual(cancelled[0],['openai','openai-run-1','sess_1']);
 assert.ok(cancelled.every(c=>c[0]==='openai'));
});

test('a provider that cannot be stopped keeps the project lock',async t=>{
 let refuse=true;
 stub(t,{openai:{run:blockUntilAborted,cancel:async()=>{if(refuse)throw Object.assign(Error('OpenAI could not confirm the stop.'),{status:502});return true;}}});
 const env=environment({STUDIO_HEARTBEAT_MS:5});
 const running=collect(await call(env,'chat',input('stuck-run-1')));
 const res=await call(env,'runs/stuck-run-1/cancel',{});
 assert.equal(res.status,502);
 assert.equal(await status(env,'stuck-run-1'),'running');
 assert.equal((await call(env,'chat',input('second-run-1'))).status,409,'nobody else may write while it might still be running');
 refuse=false;
 assert.equal((await call(env,'runs/stuck-run-1/cancel',{})).status,200);
 await running;
});

test('a late completion from a reclaimed run is rejected',async t=>{
 const late=gate();
 let calls=0;
 stub(t,{claude:{run:async()=>{if(!calls++){await late;return {text:'late',operations:brighter,handoff:null};}return {text:'fresh',operations:[],handoff:null};},cancel:async()=>true}});
 // Leases lapse immediately and are never renewed: the first run looks abandoned as soon as it starts.
 const env=environment({...keys,STUDIO_LEASE_MS:1,STUDIO_HEARTBEAT_MS:60000});
 const first=collect(await call(env,'chat',{...input('first-run-1'),provider:'claude'}));
 await wait(5);
 assert.deepEqual((await (await call(env,'active')).json()).runs.map(r=>[r.id,r.stale]),[['first-run-1',true]]);
 const second=await collect(await call(env,'chat',{...input('second-run-1'),provider:'claude'}));
 assert.equal(second.at(-1).type,'result');
 assert.equal(await status(env,'first-run-1'),'failed');
 late.open();
 const events=await first;
 assert.ok(!events.some(e=>e.type==='result'),'the stale run never delivers its edits');
 assert.match(events.at(-1).error,/late result was discarded/);
 assert.equal(await status(env,'first-run-1'),'failed');
});

test('concurrent writers: one chat and one handoff claimant win',async t=>{
 stub(t,{openai:{run:async()=>({text:'ok',operations:[],handoff:{to:'claude',summary:'s',nextTask:'n'}})},claude:{run:async()=>({text:'ok',operations:[],handoff:null})}});
 const env=environment(keys);
 const [a,b]=await Promise.all([call(env,'chat',input('writer-a-1')),call(env,'chat',input('writer-b-1'))]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 const winner=a.status===200?'writer-a-1':'writer-b-1';
 await collect(a.status===200?a:b);
 const ack=await (await call(env,'runs/'+winner+'/ack',{applied:true,autoContinue:true})).json();
 assert.equal(ack.next.status,'queued');
 const starts=await Promise.all([call(env,'handoffs/'+ack.next.id+'/start',input('ignored-1')),call(env,'handoffs/'+ack.next.id+'/start',input('ignored-1'))]);
 assert.deepEqual(starts.map(r=>r.status).sort(),[200,409]);
 await Promise.all(starts.filter(r=>r.status===200).map(collect));
});

test('a lost handoff connection is reclaimed once, then the chain stops',async t=>{
 const lost=[gate(),gate()];
 let attempt=0;
 stub(t,{openai:{run:async()=>({text:'ok',operations:[],handoff:{to:'claude',summary:'Layout done.',nextTask:'Check the lock.'}})},claude:{run:async()=>{const n=attempt++;if(n<lost.length&&!t.reconnects?.includes(n)){await lost[n];return {text:'late',operations:[],handoff:null};}return {text:'Checked.',operations:[],handoff:null};},cancel:async()=>true}});
 const setup=async()=>{
  const env=environment({...keys,STUDIO_LEASE_MS:1,STUDIO_HEARTBEAT_MS:60000});
  await collect(await call(env,'chat',input()));
  const ack=await (await call(env,'runs/message-123/ack',{applied:true,autoContinue:true})).json();
  return {env,id:ack.next.id};
 };
 // Reconnect after one lost attempt: the job is requeued and the second attempt runs under a new request ID.
 t.reconnects=[1];
 let {env,id}=await setup();
 const dropped=collect(await call(env,'handoffs/'+id+'/start',input('ignored-1')));
 await wait(5);
 assert.deepEqual((await handoffs(env)).map(h=>[h.status,h.stale]),[['running',true]],'the queue offers Resume for a lost attempt');
 const retried=await collect(await call(env,'handoffs/'+id+'/start',input('ignored-1')));
 assert.equal(retried.at(-1).id,'r2-next-message-123');
 assert.equal(retried.at(-1).type,'result');
 assert.equal(await status(env,'next-message-123'),'failed');
 assert.deepEqual((await handoffs(env)).map(h=>[h.status,h.attempts]),[['completed',2]]);
 lost[0].open();await dropped;
 // Two lost attempts: the job fails instead of retrying forever.
 attempt=0;t.reconnects=[];lost.splice(0,2,gate(),gate());
 ({env,id}=await setup());
 const one=collect(await call(env,'handoffs/'+id+'/start',input('ignored-1')));
 await wait(5);
 const two=collect(await call(env,'handoffs/'+id+'/start',input('ignored-1')));
 await wait(5);
 const res=await call(env,'handoffs/'+id+'/start',input('ignored-1'));
 assert.equal(res.status,409);
 assert.match((await res.json()).error,/connection was lost/);
 assert.equal((await handoffs(env))[0].status,'failed');
 lost[0].open();lost[1].open();await one;await two;
});

test('signed dispatch runs background hops from stored snapshots and stops at the handoff limit',async t=>{
 const seen=[];
 stub(t,{
  openai:{run:async(env,i)=>{seen.push(['openai',i.project.scenes.mobile.background]);return seen.length===1?{text:'Brighter.',operations:brighter,handoff:{to:'claude',summary:'Brightened mobile.',nextTask:'Raise contrast.'}}:{text:'Done.',operations:[],handoff:{to:'claude',summary:'Reviewed.',nextTask:'Again.'}};}},
  claude:{run:async(env,i)=>{seen.push(['claude',i.project.scenes.mobile.background]);return {text:'Contrast up.',operations:[{type:'background',scene:'mobile',values:{contrast:130}}],handoff:{to:'openai',summary:'Raised contrast.',nextTask:'Review the grade.'}};}},
 });
 const env=environment({...keys,STUDIO_DISPATCH_SECRET:SECRET}),start=input();
 const first=await collect(await call(env,'chat',start));
 const ops=first.at(-1).result.operations;
 const ack=await (await call(env,'runs/message-123/ack',{applied:true,autoContinue:true,background:true,snapshot:{project:applyBatch(start.project,ops),scene:'mobile'}})).json();
 assert.deepEqual([ack.next.status,ack.next.background],['queued',1]);
 // Hop 1 (Claude) runs from the applied snapshot; hop 2 (OpenAI) from hop 1's staged edits on top of it.
 assert.equal((await (await signed(env,{id:'tick-0001'})).json()).status,'completed');
 assert.equal((await (await signed(env,{id:'tick-0002'})).json()).status,'completed');
 assert.deepEqual(seen.slice(1).map(([who,bg])=>[who,bg.brightness,bg.contrast]),[['claude',120,100],['openai',120,130]]);
 assert.deepEqual((await handoffs(env)).map(h=>[h.target,h.status,h.hops]),[['claude','paused_limit',3],['openai','completed',2],['claude','completed',1]]);
 assert.equal((await (await signed(env,{id:'tick-0003'})).json()).status,'idle');
 assert.equal((await (await signed(env,{id:'tick-0002'})).json()).status,'duplicate');
 assert.equal(seen.length,3,'a duplicate event never runs a provider again');
 // The chain keeps the project lock until its staged results are reviewed in the studio.
 assert.equal((await call(env,'chat',input('message-456'))).status,409);
 for(const id of ['next-message-123','next-next-message-123'])assert.equal((await (await call(env,'runs/'+id+'/ack',{applied:true})).json()).status,'applied');
 assert.equal((await call(env,'chat',input('message-456'))).status,200);
});

test('discarding a result stops background work derived from it',async t=>{
 stub(t,{
  openai:{run:async()=>({text:'ok',operations:[],handoff:{to:'claude',summary:'s',nextTask:'n'}})},
  claude:{run:async()=>({text:'ok',operations:brighter,handoff:{to:'openai',summary:'s',nextTask:'n'}})},
 });
 const env=environment({...keys,STUDIO_DISPATCH_SECRET:SECRET}),start=input();
 await collect(await call(env,'chat',start));
 await call(env,'runs/message-123/ack',{applied:true,autoContinue:true,background:true,snapshot:{project:start.project,scene:'mobile'}});
 await signed(env,{id:'tick-0001'});
 assert.equal((await handoffs(env))[0].status,'queued');
 await call(env,'runs/next-message-123/ack',{applied:false});
 assert.deepEqual((await handoffs(env)).map(h=>h.status),['stopped','completed']);
 assert.equal((await (await signed(env,{id:'tick-0002'})).json()).status,'idle');
 assert.equal((await call(env,'chat',input('message-456'))).status,200,'the lock is released');
});

test('the dispatch trigger is off without a secret and rejects bad signatures',async()=>{
 assert.equal((await signed(environment(keys),{id:'tick-0001'})).status,404);
 const env=environment({...keys,STUDIO_DISPATCH_SECRET:SECRET});
 assert.equal((await signed(env,{id:'tick-0001'},{secret:'x'.repeat(40)})).status,401);
 assert.equal((await signed(env,{id:'tick-0001'},{ts:Math.floor(Date.now()/1000)-600})).status,401);
 assert.equal((await signed(env,{id:'bad id!'})).status,400);
 assert.equal((await (await signed(env,{id:'tick-0001'})).json()).status,'idle');
 assert.equal((await (await signed(env,{id:'tick-0001'})).json()).status,'duplicate');
 assert.equal((await (await call(env,'status')).json()).background,true);
});

test('a queued handoff can be stopped before it runs',async t=>{
 stub(t,{openai:{run:async()=>({text:'ok',operations:[],handoff:{to:'claude',summary:'s',nextTask:'n'}})}});
 const env=environment(keys);
 await collect(await call(env,'chat',input()));
 const {next}=await (await call(env,'runs/message-123/ack',{applied:true,autoContinue:true})).json();
 assert.equal((await (await call(env,'handoffs/'+next.id+'/stop',{})).json()).status,'stopped');
 assert.equal((await call(env,'handoffs/'+next.id+'/start',input('ignored-1'))).status,409);
});
