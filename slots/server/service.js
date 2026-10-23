import {checkRequest,MAX_HANDOFFS} from './protocol.js';
import {runOpenAI,api} from './openai.js';
// Claude adds its server-side adapter here. Never put either provider key in the UI.
export const providers={openai:{configured:env=>!!env.OPENAI_API_KEY,run:runOpenAI},claude:null};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
async function bodyOf(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('Use JSON.',415);const raw=await request.text();if(raw.length>32*1024*1024)throw fail('This project is too large for chat. Export it and remove unused uploads.',413);try{return JSON.parse(raw);}catch{throw fail('Invalid JSON.');}}
export function authorize(request){
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)throw fail('Sign in to use Studio chat.',401);
 if(request.method!=='GET'&&request.method!=='HEAD'){
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw fail('Cross-origin writes are not allowed.',403);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw fail('Cross-origin writes are not allowed.',403);
 }
 return owner;
}
async function resultFor(env,run){const object=await env.BUCKET.get(run.result_key);if(!object)throw fail('The saved response could not be loaded.',503);return object.json();}
async function ownedRun(env,owner,id){const run=await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',id,owner).first();if(!run)throw fail('Request not found.',404);return run;}
async function release(env,run){await q(env,'DELETE FROM studio_locks WHERE run_id=? AND owner=?',run.id,run.owner).run();}
export async function handleStudio(request,env){
 try{
  const owner=authorize(request),path=new URL(request.url).pathname.replace(/^\/api\/studio\/?/,'');
  if(path==='status'&&request.method==='GET')return json({openai:providers.openai.configured(env),claude:!!providers.claude?.configured(env),storage:!!env.DB&&!!env.BUCKET,maxHandoffs:MAX_HANDOFFS,capabilities:['conversation','scene_edits','image_generation','handoff_queue'],sourceEditing:false});
  if(!env.DB||!env.BUCKET)throw fail('Studio chat storage is not available yet.',503);
  if(path==='active'&&request.method==='GET'){const rows=await q(env,"SELECT id,status,error FROM studio_runs WHERE owner=? AND status IN ('running','interrupted','completed') ORDER BY created_at DESC LIMIT 10",owner).all();return json({runs:rows.results});}
  if(path==='handoffs'&&request.method==='GET'){const rows=await q(env,'SELECT id,source_run,target,summary,next_task,status,hops,created_at FROM studio_handoffs WHERE owner=? ORDER BY created_at DESC LIMIT 30',owner).all();return json({handoffs:rows.results});}
  const match=path.match(/^runs\/([-a-zA-Z0-9_]{8,80})(?:\/(ack|cancel))?$/);
  if(match){const run=await ownedRun(env,owner,match[1]);
   if(!match[2]&&request.method==='GET')return json({id:run.id,status:run.status,error:run.error,...(run.result_key?{result:await resultFor(env,run)}:{})});
   if(match[2]==='cancel'&&request.method==='POST'){
    if(run.session_id&&['running','interrupted'].includes(run.status))await api(env,'/agents/sessions/'+encodeURIComponent(run.session_id)+'/events',{events:[{type:'agent.session.input.cancel'}]});
    await q(env,"UPDATE studio_runs SET status='cancelled' WHERE id=? AND owner=? AND status NOT IN ('applied','discarded')",run.id,owner).run();await release(env,run);return json({status:'cancelled'});
   }
   if(match[2]==='ack'&&request.method==='POST'){
    const body=await bodyOf(request);if(typeof body.applied!=='boolean')throw fail('An applied or discarded result is required.');
    if(!['completed','applied','discarded'].includes(run.status))throw fail('The response has not completed.',409);
    const state=body.applied?'applied':'discarded';
    if(run.status!=='completed'&&run.status!==state)throw fail('This result was already acknowledged differently.',409);
    const changed=await q(env,"UPDATE studio_runs SET status=? WHERE id=? AND owner=? AND status='completed'",state,run.id,owner).run();
    if(changed.meta.changes){
     const result=await resultFor(env,run);if(result.handoff&&body.applied){
      const hops=run.hops+1,ready=!!providers[result.handoff.to]?.configured(env),status=hops>MAX_HANDOFFS?'paused_limit':body.autoContinue===true?(ready?'queued':'waiting_connection'):'paused';
      await q(env,'INSERT OR IGNORE INTO studio_handoffs (id,owner,source_run,target,summary,next_task,status,hops,created_at) VALUES (?,?,?,?,?,?,?,?,?)','handoff-'+run.id,owner,run.id,result.handoff.to,result.handoff.summary,result.handoff.nextTask,status,hops,Date.now()).run();
     }
     await release(env,run);
    }
    const next=await q(env,'SELECT id,target,status,hops FROM studio_handoffs WHERE source_run=? AND owner=?',run.id,owner).first();return json({status:state,next});
   }
  }
  if(path==='chat'&&request.method==='POST')return await startRun(env,owner,checkRequest(await bodyOf(request)));
  const handoff=path.match(/^handoffs\/(handoff-[-a-zA-Z0-9_]{8,80})\/start$/);
  if(handoff&&request.method==='POST'){
   const row=await q(env,'SELECT * FROM studio_handoffs WHERE id=? AND owner=?',handoff[1],owner).first();if(!row)throw fail('Handoff not found.',404);
   if(row.hops>MAX_HANDOFFS)throw fail('Automatic handoff limit reached. Start a new task to continue.',409);
   if(!providers[row.target]?.configured(env))throw fail(`${row.target==='claude'?'Claude':'OpenAI'} is not connected. The handoff is saved.`,503);
   if(!['queued','waiting_connection','paused'].includes(row.status))throw fail('This handoff has already been claimed.',409);
   const body=await bodyOf(request),input=checkRequest({...body,id:'next-'+row.source_run.slice(0,70),provider:row.target,message:`Completed handoff from the other assistant:\n${row.summary}\nNext task:\n${row.next_task}`});
   return await startRun(env,owner,input,row);
  }
  throw fail('Not found.',404);
 }catch(error){return json({error:error.status?error.message:'Studio chat could not complete this request. Please try again.'},error.status||500);}
}
async function startRun(env,owner,input,parent=null){
 const provider=providers[input.provider];if(!provider?.configured(env))throw fail(input.provider==='claude'?'Claude is not connected yet. Its handoff queue is ready.':'OpenAI is not connected yet. Finish secure API setup to enable chat.',503);
 const requestHash=await hash(JSON.stringify(input));const existing=await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',input.id,owner).first();
 if(existing){if(existing.request_hash!==requestHash)throw fail('That request ID belongs to a different message.',409);return json({id:existing.id,status:existing.status,...(existing.result_key?{result:await resultFor(env,existing)}:{})},existing.result_key?200:409);}
 const projectKey=await hash(owner+':'+String(input.project.id||'zombify'));
 const run={id:input.id,owner,project_key:projectKey,hops:parent?.hops||0};
 // D1 batch is transactional: a second writer cannot acquire the project lock.
 try{await env.DB.batch([
  q(env,"INSERT INTO studio_runs (id,owner,project_key,request_hash,status,hops,created_at) VALUES (?,?,?,?,'running',?,?)",run.id,owner,projectKey,requestHash,run.hops,Date.now()),
  q(env,'INSERT INTO studio_locks (project_key,owner,run_id) VALUES (?,?,?)',projectKey,owner,run.id),
  ...(parent?[q(env,"UPDATE studio_handoffs SET status='running' WHERE id=? AND owner=?",parent.id,owner)]:[])
 ]);}catch{throw fail('Another assistant request is still active for this project. Open its saved result or stop it first.',409);}
 const encoder=new TextEncoder();let closed=false;
 const stream=new ReadableStream({
  async start(controller){
   const send=value=>{if(!closed)try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{closed=true;}};
   let sessionId=null;
   try{
    send({type:'status',text:'Reading your project…',id:run.id});
    const result=await provider.run(env,input,{progress:send,sessionCreated:async id=>{sessionId=id;await q(env,'UPDATE studio_runs SET session_id=? WHERE id=? AND owner=?',id,run.id,owner).run();},signal:AbortSignal.timeout(300000)});
    const fresh=await ownedRun(env,owner,run.id);if(fresh.status==='cancelled')throw Error('Request stopped.');
    const key='studio-results/'+projectKey+'/'+run.id+'.json';await env.BUCKET.put(key,JSON.stringify(result),{httpMetadata:{contentType:'application/json'}});
    await q(env,"UPDATE studio_runs SET status='completed',result_key=? WHERE id=? AND owner=? AND status='running'",key,run.id,owner).run();
    if(parent)await q(env,"UPDATE studio_handoffs SET status='completed' WHERE id=? AND owner=?",parent.id,owner).run();
    send({type:'result',id:run.id,result});
   }catch(error){
    // A disconnected observer never resubmits input. Cancel the provider before
    // releasing the edit lock; keep an interrupted lock if cancellation fails.
    let stopped=!sessionId;
    if(sessionId)try{await api(env,'/agents/sessions/'+encodeURIComponent(sessionId)+'/events',{events:[{type:'agent.session.input.cancel'}]});stopped=true;}catch{}
    const status=stopped?'failed':'interrupted';
    const message=error.message||'The assistant could not finish.';
    await q(env,"UPDATE studio_runs SET status=?,error=? WHERE id=? AND owner=? AND status='running'",status,message.slice(0,500),run.id,owner).run();
    if(stopped)await release(env,run);
    send({type:'error',error:message,id:run.id});
   }finally{if(!closed){closed=true;controller.close();}}
  },cancel(){closed=true;}
 });
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
