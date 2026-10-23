import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createProject} from '../studio/project.js';
import {checkRequest,stageEdits,checkHandoff} from '../server/protocol.js';
import {handleStudio,providers} from '../server/service.js';
import {runOpenAI,events} from '../server/openai.js';
function environment(){
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE studio_runs(id TEXT,owner TEXT,project_key TEXT,request_hash TEXT,status TEXT,hops INTEGER,created_at INTEGER,session_id TEXT,result_key TEXT,error TEXT,PRIMARY KEY(id,owner));CREATE TABLE studio_locks(project_key TEXT PRIMARY KEY,owner TEXT,run_id TEXT);CREATE TABLE studio_handoffs(id TEXT,owner TEXT,source_run TEXT,target TEXT,summary TEXT,next_task TEXT,status TEXT,hops INTEGER,created_at INTEGER,PRIMARY KEY(id,owner),UNIQUE(owner,source_run));`);
 const wrap=(sql,args=[])=>({sql,args,bind(...args){return wrap(sql,args)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}});
 const objects=new Map();return {OPENAI_API_KEY:'test-only',DB:{prepare:sql=>wrap(sql),async batch(items){db.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,v){objects.set(k,v)},async get(k){return objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null}}};
}
const input=(id='message-123')=>({id,message:'Make the background brighter.',scene:'mobile',project:createProject(),history:[],provider:'openai'});
const req=(path,body,owner='owner')=>new Request('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(body?{'Content-Type':'application/json',Origin:'https://studio.test'}:{})},body:body?JSON.stringify(body):undefined});
const call=(env,path,body,owner)=>handleStudio(req(path,body,owner),env);
const result=()=>({text:'Ready.',operations:[],handoff:{to:'claude',summary:'Reviewed layout',nextTask:'Check the spin lock.'}});
async function collect(res){return (await res.text()).trim().split('\n').map(JSON.parse);}
test('chat validates project, messages and attachment IDs before spending',()=>{
 assert.throws(()=>checkRequest({...input(),attachment:'missing'}));assert.throws(()=>checkRequest({...input(),message:''}));assert.throws(()=>checkRequest({...input(),scene:'both'}));assert.throws(()=>stageEdits(createProject(),[{type:'asset',asset:{id:'evil',src:'https://example.test'}}]));assert.throws(()=>checkHandoff({to:'openai',summary:'s',nextTask:'n'}));
});
test('chat endpoints require identity and reject cross-origin writes',async()=>{
 const env=environment();assert.equal((await call(env,'status',undefined,null)).status,401);const r=req('chat',input());r.headers.set('origin','https://evil.test');assert.equal((await handleStudio(r,env)).status,403);assert.equal((await call(env,'status')).status,200);
});
test('paid request deduplication, one writer, owner isolation, and handoff acknowledgment',async()=>{
 const original=providers.openai.run;let calls=0;providers.openai.run=async()=>{calls++;return result()};
 try{const env=environment(),body=input();await collect(await call(env,'chat',body));assert.equal(calls,1);
 assert.equal((await call(env,'chat',body)).status,200);assert.equal(calls,1);
 assert.equal((await call(env,'chat',{...body,message:'different'})).status,409);
 assert.equal((await call(env,'chat',input('message-456'))).status,409);
 assert.equal((await call(env,'runs/'+body.id,undefined,'other')).status,404);
 assert.equal((await (await call(env,'handoffs')).json()).handoffs.length,0);
 const ack=await (await call(env,'runs/'+body.id+'/ack',{applied:true,autoContinue:true})).json();assert.equal(ack.next.status,'waiting_connection');
 await call(env,'runs/'+body.id+'/ack',{applied:true,autoContinue:true});assert.equal((await (await call(env,'handoffs')).json()).handoffs.length,1);
 assert.equal((await call(env,'runs/'+body.id+'/ack',{applied:false})).status,409);
 await collect(await call(env,'chat',input('message-456')));assert.equal(calls,2);
 }finally{providers.openai.run=original;}
});
test('discarding a result releases its lock and never advances a handoff',async()=>{
 const original=providers.openai.run;providers.openai.run=async()=>result();try{const env=environment();await collect(await call(env,'chat',input()));await call(env,'runs/message-123/ack',{applied:false,autoContinue:true});assert.equal((await (await call(env,'handoffs')).json()).handoffs.length,0);await collect(await call(env,'chat',input('message-456')));}finally{providers.openai.run=original;}
});
test('connected adapters continue once and stop at the configured handoff limit',async()=>{
 const old=providers.openai.run,claude=providers.claude;providers.openai.run=async()=>result();providers.claude={configured:()=>true,run:async()=>({...result(),handoff:{to:'openai',summary:'Checked the lock',nextTask:'Review art'}})};
 try{const env=environment();await collect(await call(env,'chat',input()));let ack=await (await call(env,'runs/message-123/ack',{applied:true,autoContinue:true})).json();assert.equal(ack.next.status,'queued');
 await collect(await call(env,'handoffs/'+ack.next.id+'/start',input('unused-123')));
 assert.equal((await call(env,'handoffs/'+ack.next.id+'/start',input('unused-123'))).status,409);
 ack=await (await call(env,'runs/next-message-123/ack',{applied:true,autoContinue:true})).json();assert.equal(ack.next.hops,2);
 await collect(await call(env,'handoffs/'+ack.next.id+'/start',input('unused-456')));
 ack=await (await call(env,'runs/next-next-message-123/ack',{applied:true,autoContinue:true})).json();assert.equal(ack.next.status,'paused_limit');
 assert.equal((await call(env,'handoffs/'+ack.next.id+'/start',input('unused-789'))).status,409);
 }finally{providers.openai.run=old;providers.claude=claude;}
});
const sse=list=>new Response(list.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
test('SSE parser accepts chunked events and ignores comments',async()=>{const e=new TextEncoder(),res=new Response(new ReadableStream({start(c){c.enqueue(e.encode(': keepalive\n\ndata: {"type":'));c.enqueue(e.encode('"test"}\n\n'));c.close()}}));const out=[];for await(const value of events(res))out.push(value);assert.deepEqual(out,[{type:'test'}]);});
test('OpenAI adapter stages edits atomically, preserves scene isolation, and checks a completed turn',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{calls.push([url,opts]);if(url.endsWith('/agents/sessions'))return sse([{type:'agent.session.created',session:{id:'sess_test'}},{type:'agent.session.requires_action',session:{id:'sess_test',required_actions:[{type:'function_call',turn_id:'turn_1',call_id:'call_1',name:'stage_scene_edits',arguments:{operations_json:JSON.stringify([{type:'background',scene:'mobile',values:{brightness:120}}]),label:'Brighter mobile'}}]}},{type:'agent.session.turn.output_text.done',item_id:'m1',output_index:0,content_index:0,text:'The mobile background is ready.'},{type:'agent.session.turn.completed',turn:{subagent_id:null}}]);return Response.json({});};
 try{const i=checkRequest(input()),out=await runOpenAI({OPENAI_API_KEY:'not-real'},i);assert.equal(out.operations.length,1);assert.equal(out.operations[0].scene,'mobile');assert.equal(i.project.scenes.mobile.background.brightness,100);assert.match(out.text,/mobile/);assert.equal(calls.filter(x=>x[0].endsWith('/events')).length,1);assert.equal(calls.at(-1)[1].method,'DELETE');}finally{globalThis.fetch=original;}
});
test('idle or disconnected OpenAI streams never count as completed work',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>sse([{type:'agent.session.created',session:{id:'sess_test'}},{type:'agent.session.idle'}]);try{await assert.rejects(runOpenAI({OPENAI_API_KEY:'test'},checkRequest(input())),/before the assistant completed/);}finally{globalThis.fetch=original;}
});
