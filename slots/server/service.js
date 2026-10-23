import {checkRequest,MAX_HANDOFFS,MAX_ATTEMPTS} from './protocol.js';
import {runOpenAI,cancelOpenAI} from './openai.js';
import {runClaude,cancelClaude} from './claude.js';
import {applyBatch,validateProject} from '../studio/project.js';
// Each provider owns its cancellation: OpenAI stops a remote Agents session, a Claude Messages stream just closes.
// Never put either provider key in the UI.
export const providers={
 openai:{label:'OpenAI',configured:env=>!!env.OPENAI_API_KEY,run:runOpenAI,cancel:cancelOpenAI},
 claude:{label:'Claude',configured:env=>!!env.ANTHROPIC_API_KEY,run:runClaude,cancel:cancelClaude},
};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
// A running request renews its lease every heartbeat; a lapsed lease means the invocation streaming it is gone.
const lease=env=>Number(env.STUDIO_LEASE_MS)||90000,heartbeat=env=>Number(env.STUDIO_HEARTBEAT_MS)||15000;
const OPEN=['queued','waiting_connection','paused'];
const stale=run=>run.status==='running'&&(run.lease_until??0)<Date.now();
const dispatcher=env=>(env.STUDIO_DISPATCH_SECRET||'').length>=32;
async function bodyOf(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('Use JSON.',415);
 const raw=await request.text();
 if(raw.length>32*1024*1024)throw fail('This project is too large for chat. Export it and remove unused uploads.',413);
 try{return JSON.parse(raw);}catch{throw fail('Invalid JSON.');}
}
export function authorize(request){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)throw fail('Sign in to use Studio chat.',401);
 if(request.method!=='GET'&&request.method!=='HEAD'){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)throw fail('Cross-origin writes are not allowed.',403);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw fail('Cross-origin writes are not allowed.',403);
 }
 return owner;
}
async function resultFor(env,run){const object=await env.BUCKET.get(run.result_key);if(!object)throw fail('The saved response could not be loaded.',503);return object.json();}
async function ownedRun(env,owner,id){const run=await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',id,owner).first();if(!run)throw fail('Request not found.',404);return run;}
async function release(env,run){await q(env,'DELETE FROM studio_locks WHERE run_id=? AND owner=?',run.id,run.owner).run();}
// Throws when the provider cannot confirm it stopped; callers then keep the lock.
async function stopProvider(env,run){await providers[run.provider||'openai']?.cancel(env,run);}
// A run whose heartbeat lapsed (closed tab, lost Worker) or whose provider could not be stopped earlier is stopped now,
// failed, and its handoff job requeued for one more attempt.
async function reclaim(env,run){
 try{await stopProvider(env,run);}catch{return false;}
 const r=await q(env,"UPDATE studio_runs SET status='failed',error=?,lease_until=NULL WHERE id=? AND owner=? AND status IN ('running','interrupted') AND COALESCE(lease_until,0)<?",'The connection was lost before this request finished. Nothing was applied.',run.id,run.owner,Date.now()).run();
 if(!r.meta.changes)return false;
 await q(env,"UPDATE studio_handoffs SET status=CASE WHEN attempts<? THEN 'queued' ELSE 'failed' END,error='The connection was lost during the last attempt.' WHERE run_id=? AND owner=? AND status='running'",MAX_ATTEMPTS,run.id,run.owner).run();
 await release(env,run);
 return true;
}
// Frees a project lock whose holder can no longer write.
async function clearLock(env,owner,projectKey){
 const lock=await q(env,'SELECT run_id FROM studio_locks WHERE project_key=? AND owner=?',projectKey,owner).first();
 if(!lock)return true;
 const holder=await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',lock.run_id,owner).first();
 if(!holder||['failed','cancelled','applied','discarded'].includes(holder.status)){await q(env,'DELETE FROM studio_locks WHERE project_key=? AND run_id=?',projectKey,lock.run_id).run();return true;}
 return (stale(holder)||holder.status==='interrupted')&&reclaim(env,holder);
}
// Brings a 'running' job back in line with its run after a lost invocation.
async function recoverJob(env,row){
 if(row.status!=='running')return row;
 const run=row.run_id?await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',row.run_id,row.owner).first():null;
 if(run&&!['running','interrupted'].includes(run.status))await q(env,"UPDATE studio_handoffs SET status=? WHERE id=? AND owner=? AND status='running'",['completed','applied','discarded'].includes(run.status)?'completed':'failed',row.id,row.owner).run();
 else if(run&&!stale(run)&&run.status!=='interrupted')return row;
 else if(run)await reclaim(env,run);
 else await q(env,"UPDATE studio_handoffs SET status=CASE WHEN attempts<? THEN 'queued' ELSE 'failed' END WHERE id=? AND owner=? AND status='running'",MAX_ATTEMPTS,row.id,row.owner).run();
 return q(env,'SELECT * FROM studio_handoffs WHERE id=? AND owner=?',row.id,row.owner).first();
}
// Discarding or stopping work also stops everything derived from it. Bounded by the handoff limit.
async function stopChain(env,owner,runId,reason){
 for(let i=0;runId&&i<=MAX_HANDOFFS;i++){
  const job=await q(env,'SELECT * FROM studio_handoffs WHERE source_run=? AND owner=?',runId,owner).first();
  if(!job)return;
  await q(env,"UPDATE studio_handoffs SET status='stopped',error=? WHERE id=? AND owner=? AND status NOT IN ('completed','failed','stopped')",reason,job.id,owner).run();
  runId=job.run_id;
  const child=runId?await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',runId,owner).first():null;
  if(!child||!['running','interrupted','completed'].includes(child.status))continue;
  // A child still streaming also aborts itself on its next heartbeat and repeats the provider cancel.
  try{if(child.status!=='completed')await stopProvider(env,child);}catch{}
  await q(env,"UPDATE studio_runs SET status='discarded',error=?,lease_until=NULL WHERE id=? AND owner=? AND status IN ('running','interrupted','completed')",reason,child.id,owner).run();
  await release(env,child);
 }
}
async function stopJob(env,owner,row){
 const run=row.run_id?await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',row.run_id,owner).first():null;
 if(row.status==='running'&&run&&['running','interrupted'].includes(run.status)){
  await stopProvider(env,run);
  await q(env,"UPDATE studio_runs SET status='cancelled',lease_until=NULL WHERE id=? AND owner=? AND status IN ('running','interrupted')",run.id,owner).run();
  await release(env,run);
 }
 await q(env,"UPDATE studio_handoffs SET status='stopped',error='Stopped by you.' WHERE id=? AND owner=? AND status NOT IN ('completed','failed','stopped')",row.id,owner).run();
 if(run)await stopChain(env,owner,run.id,'Stopped by you.');
 return {status:'stopped'};
}
// Background jobs run on their stored snapshot (earlier hops' edits included); browser-started jobs use the studio's current project.
async function jobInput(env,row,body={}){
 const snapshot=row.snapshot_key?await (await env.BUCKET.get(row.snapshot_key))?.json():null;
 if(row.snapshot_key&&!snapshot)throw fail('The saved project for this handoff could not be loaded.',503);
 const attempt=row.attempts+1;
 return checkRequest({...body,...snapshot,...(snapshot?{attachment:null,history:[]}:{}),id:(attempt>1?'r'+attempt+'-':'')+'next-'+row.source_run.slice(0,70),provider:row.target,message:`Completed handoff from ${row.target==='claude'?'the OpenAI assistant':'Claude'}:\n${row.summary}\nNext task:\n${row.next_task}`});
}
// Background chains stage each result on the server: the next assistant starts from this run's input plus its edits.
async function chain(env,run,input,result){
 const hops=run.hops+1,target=result.handoff.to,id='handoff-'+run.id,key='studio-snapshots/'+run.project_key+'/'+id+'.json';
 const status=hops>MAX_HANDOFFS?'paused_limit':providers[target]?.configured(env)?'queued':'waiting_connection';
 const project=result.operations.length?applyBatch(input.project,result.operations):input.project;
 await env.BUCKET.put(key,JSON.stringify({project,scene:input.scene,selection:input.selection||'reels'}),{httpMetadata:{contentType:'application/json'}});
 await q(env,'INSERT OR IGNORE INTO studio_handoffs (id,owner,source_run,target,summary,next_task,status,hops,created_at,background,snapshot_key) VALUES (?,?,?,?,?,?,?,?,?,1,?)',id,run.owner,run.id,target,result.handoff.summary,result.handoff.nextTask,status,hops,Date.now(),key).run();
 return {id,target,status,hops};
}
const enc=new TextEncoder();
// Signed trigger for running approved background jobs while the studio is closed (a scheduler or a webhook relay).
// HMAC-SHA256 over "<timestamp>.<body>", five-minute window, and each event ID is accepted once.
async function dispatchHook(request,env){
 if(!dispatcher(env))throw fail('Not found.',404);
 const raw=await request.text();
 if(raw.length>4096)throw fail('Event too large.',413);
 const ts=Number(request.headers.get('x-studio-timestamp')),sig=/^sha256=([0-9a-f]{64})$/.exec(request.headers.get('x-studio-signature')||'');
 if(!sig||!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>300)throw fail('Invalid or expired signature.',401);
 const key=await crypto.subtle.importKey('raw',enc.encode(env.STUDIO_DISPATCH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!(await crypto.subtle.verify('HMAC',key,new Uint8Array(sig[1].match(/../g).map(h=>parseInt(h,16))),enc.encode(ts+'.'+raw))))throw fail('Invalid or expired signature.',401);
 if(!env.DB||!env.BUCKET)throw fail('Studio chat storage is not available yet.',503);
 let event;try{event=JSON.parse(raw);}catch{throw fail('Invalid JSON.');}
 if(typeof event?.id!=='string'||!/^[-\w.:]{8,120}$/.test(event.id))throw fail('An event ID is required.');
 await q(env,'DELETE FROM studio_events WHERE received_at<?',Date.now()-7*864e5).run();
 try{await q(env,'INSERT INTO studio_events (id,received_at) VALUES (?,?)',event.id,Date.now()).run();}catch{return json({status:'duplicate'});}
 const rows=(await q(env,"SELECT * FROM studio_handoffs WHERE background=1 AND status IN ('queued','waiting_connection','running') ORDER BY created_at LIMIT 20").all()).results;
 for(let row of rows){
  row=await recoverJob(env,row);
  if(!['queued','waiting_connection'].includes(row.status)||row.hops>MAX_HANDOFFS||!providers[row.target]?.configured(env))continue;
  try{return await startRun(env,row.owner,await jobInput(env,row),row,{stream:false});}
  catch(error){if(error.status!==409)throw error;}
 }
 return json({status:'idle'});
}
export async function handleStudio(request,env){
 try{
  const path=new URL(request.url).pathname.replace(/^\/api\/studio\/?/,'');
  if(path==='hooks/dispatch'&&request.method==='POST')return await dispatchHook(request,env);
  const owner=authorize(request);
  if(path==='status'&&request.method==='GET')return json({openai:providers.openai.configured(env),claude:providers.claude.configured(env),storage:!!env.DB&&!!env.BUCKET,background:dispatcher(env),maxHandoffs:MAX_HANDOFFS,capabilities:['conversation','scene_edits','image_generation','handoff_queue'],sourceEditing:false});
  if(!env.DB||!env.BUCKET)throw fail('Studio chat storage is not available yet.',503);
  if(path==='active'&&request.method==='GET'){
   const rows=await q(env,"SELECT id,status,error,provider,created_at,lease_until FROM studio_runs WHERE owner=? AND status IN ('running','interrupted','completed') ORDER BY created_at DESC LIMIT 10",owner).all();
   return json({runs:rows.results.map(({lease_until,...r})=>({...r,stale:stale({...r,lease_until})}))});
  }
  if(path==='handoffs'&&request.method==='GET'){
   const rows=await q(env,'SELECT h.id,h.source_run,h.target,h.summary,h.next_task,h.status,h.hops,h.created_at,h.background,h.attempts,h.run_id,h.error,r.status AS run_status,r.lease_until FROM studio_handoffs h LEFT JOIN studio_runs r ON r.id=h.run_id AND r.owner=h.owner WHERE h.owner=? ORDER BY h.created_at DESC LIMIT 30',owner).all();
   // stale: a running job whose request lost its connection; starting it again reclaims that attempt.
   return json({handoffs:rows.results.map(({run_status,lease_until,...h})=>({...h,stale:h.status==='running'&&(!run_status||run_status==='interrupted'||stale({status:run_status,lease_until}))}))});
  }
  const match=path.match(/^runs\/([-a-zA-Z0-9_]{8,80})(?:\/(ack|cancel))?$/);
  if(match){
   const run=await ownedRun(env,owner,match[1]);
   if(!match[2]&&request.method==='GET')return json({id:run.id,status:run.status,error:run.error,provider:run.provider,...(run.result_key?{result:await resultFor(env,run)}:{})});
   if(match[2]==='cancel'&&request.method==='POST'){
    if(['running','interrupted'].includes(run.status))await stopProvider(env,run);
    await q(env,"UPDATE studio_runs SET status='cancelled',lease_until=NULL WHERE id=? AND owner=? AND status NOT IN ('applied','discarded')",run.id,owner).run();
    await q(env,"UPDATE studio_handoffs SET status='stopped',error='Stopped by you.' WHERE run_id=? AND owner=? AND status='running'",run.id,owner).run();
    await stopChain(env,owner,run.id,'Stopped by you.');
    await release(env,run);
    return json({status:'cancelled'});
   }
   if(match[2]==='ack'&&request.method==='POST'){
    const body=await bodyOf(request);
    if(typeof body.applied!=='boolean')throw fail('An applied or discarded result is required.');
    if(!['completed','applied','discarded'].includes(run.status))throw fail('The response has not completed.',409);
    const state=body.applied?'applied':'discarded';
    if(run.status!=='completed'&&run.status!==state)throw fail('This result was already acknowledged differently.',409);
    const changed=await q(env,"UPDATE studio_runs SET status=? WHERE id=? AND owner=? AND status='completed'",state,run.id,owner).run();
    if(changed.meta.changes){
     const result=await resultFor(env,run);
     if(result.handoff&&body.applied){
      const hops=run.hops+1,ready=!!providers[result.handoff.to]?.configured(env),status=hops>MAX_HANDOFFS?'paused_limit':body.autoContinue===true?ready?'queued':'waiting_connection':'paused';
      // Background continuation is an explicit opt-in and needs the dispatcher; it runs from the applied snapshot sent here.
      let snapshotKey=null;
      if(body.background===true&&body.autoContinue===true&&dispatcher(env)&&body.snapshot&&['desktop','mobile'].includes(body.snapshot.scene)){
       validateProject(body.snapshot.project);
       snapshotKey='studio-snapshots/'+run.project_key+'/handoff-'+run.id+'.json';
       await env.BUCKET.put(snapshotKey,JSON.stringify({project:body.snapshot.project,scene:body.snapshot.scene,selection:typeof body.snapshot.selection==='string'?body.snapshot.selection:'reels'}),{httpMetadata:{contentType:'application/json'}});
      }
      await q(env,'INSERT OR IGNORE INTO studio_handoffs (id,owner,source_run,target,summary,next_task,status,hops,created_at,background,snapshot_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)','handoff-'+run.id,owner,run.id,result.handoff.to,result.handoff.summary,result.handoff.nextTask,status,hops,Date.now(),snapshotKey?1:0,snapshotKey).run();
     }
     if(!body.applied)await stopChain(env,owner,run.id,'An earlier result was discarded.');
     await release(env,run);
    }
    const next=await q(env,'SELECT id,target,status,hops,background FROM studio_handoffs WHERE source_run=? AND owner=?',run.id,owner).first();
    return json({status:state,next});
   }
  }
  if(path==='chat'&&request.method==='POST')return await startRun(env,owner,checkRequest(await bodyOf(request)));
  const handoff=path.match(/^handoffs\/(handoff-[-a-zA-Z0-9_]{8,80})\/(start|stop)$/);
  if(handoff&&request.method==='POST'){
   let row=await q(env,'SELECT * FROM studio_handoffs WHERE id=? AND owner=?',handoff[1],owner).first();
   if(!row)throw fail('Handoff not found.',404);
   if(handoff[2]==='stop')return json(await stopJob(env,owner,row));
   row=await recoverJob(env,row);
   if(row.hops>MAX_HANDOFFS)throw fail('Automatic handoff limit reached. Start a new task to continue.',409);
   if(!providers[row.target]?.configured(env))throw fail(`${providers[row.target]?.label||'That assistant'} is not connected. The handoff is saved.`,503);
   if(!OPEN.includes(row.status))throw fail(row.status==='failed'?row.error||'This handoff failed.':'This handoff has already been claimed.',409);
   return await startRun(env,owner,await jobInput(env,row,await bodyOf(request)),row);
  }
  throw fail('Not found.',404);
 }catch(error){
  return json({error:error.status?error.message:'Studio chat could not complete this request. Please try again.'},error.status||500);
 }
}
async function startRun(env,owner,input,parent=null,{stream=true}={}){
 const provider=providers[input.provider];
 if(!provider?.configured(env))throw fail(input.provider==='claude'?'Claude is not connected yet. Its handoff queue is ready.':'OpenAI is not connected yet. Finish secure API setup to enable chat.',503);
 const requestHash=await hash(JSON.stringify(input));
 const existing=await q(env,'SELECT * FROM studio_runs WHERE id=? AND owner=?',input.id,owner).first();
 if(existing){
  if(existing.request_hash!==requestHash)throw fail('That request ID belongs to a different message.',409);
  return json({id:existing.id,status:existing.status,...(existing.result_key?{result:await resultFor(env,existing)}:{})},existing.result_key?200:409);
 }
 const projectKey=await hash(owner+':'+String(input.project.id||'zombify'));
 const run={id:input.id,owner,project_key:projectKey,hops:parent?.hops||0,provider:input.provider};
 // Claim the job first (only one claimant can move it out of an open state), then insert the run and the project lock.
 if(parent){
  const claimed=await q(env,"UPDATE studio_handoffs SET status='running',attempts=attempts+1,run_id=?,error=NULL WHERE id=? AND owner=? AND status IN ('queued','waiting_connection','paused')",run.id,parent.id,owner).run();
  if(!claimed.meta.changes)throw fail('This handoff has already been claimed.',409);
 }
 // D1 batch is transactional: a second writer cannot acquire the project lock. A background child takes over its
 // parent's lock; any other holder makes the lock insert fail and rolls the batch back.
 const acquire=()=>env.DB.batch([
  q(env,"INSERT INTO studio_runs (id,owner,project_key,request_hash,status,hops,created_at,provider,lease_until) VALUES (?,?,?,?,'running',?,?,?,?)",run.id,owner,projectKey,requestHash,run.hops,Date.now(),run.provider,Date.now()+lease(env)),
  ...(parent?[q(env,'DELETE FROM studio_locks WHERE run_id=? AND owner=?',parent.source_run,owner)]:[]),
  q(env,'INSERT INTO studio_locks (project_key,owner,run_id) VALUES (?,?,?)',projectKey,owner,run.id),
 ]);
 let acquired=false;
 try{await acquire();acquired=true;}catch{}
 if(!acquired&&await clearLock(env,owner,projectKey))try{await acquire();acquired=true;}catch{}
 if(!acquired){
  if(parent)await q(env,"UPDATE studio_handoffs SET status=?,attempts=attempts-1,run_id=? WHERE id=? AND owner=? AND run_id=?",parent.status,parent.run_id,parent.id,owner,run.id).run();
  throw fail('Another assistant request is still active for this project. Open its saved result or stop it first.',409);
 }
 const execute=async send=>{
  const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(300000)]);
  // Heartbeat: renews the lease and aborts the provider as soon as the run is cancelled, discarded or reclaimed elsewhere.
  const timer=setInterval(()=>q(env,"UPDATE studio_runs SET lease_until=? WHERE id=? AND owner=? AND status='running'",Date.now()+lease(env),run.id,owner).run().then(r=>{if(!r.meta.changes)controller.abort();},()=>{}),heartbeat(env));
  let sessionId=null;
  try{
   send({type:'status',text:'Reading your project…',id:run.id});
   const result=await provider.run(env,input,{progress:send,sessionCreated:async id=>{sessionId=id;await q(env,'UPDATE studio_runs SET session_id=? WHERE id=? AND owner=?',id,run.id,owner).run();},signal});
   if(signal.aborted)throw Error('Request stopped.');
   const key='studio-results/'+projectKey+'/'+run.id+'.json';
   await env.BUCKET.put(key,JSON.stringify(result),{httpMetadata:{contentType:'application/json'}});
   // Only a run that is still live may complete: a cancelled, discarded or reclaimed run rejects its late result.
   const done=await q(env,"UPDATE studio_runs SET status='completed',result_key=?,lease_until=NULL WHERE id=? AND owner=? AND status='running'",key,run.id,owner).run();
   if(!done.meta.changes){await env.BUCKET.delete?.(key);throw Error('Request stopped. Its late result was discarded.');}
   if(parent)await q(env,"UPDATE studio_handoffs SET status='completed' WHERE id=? AND owner=? AND run_id=?",parent.id,owner,run.id).run();
   const next=result.handoff&&parent?.background?await chain(env,run,input,result):null;
   send({type:'result',id:run.id,result,...(next?{next}:{})});
   return {id:run.id,status:'completed',next};
  }catch(error){
   // A disconnected observer never resubmits input. Stop the provider before releasing the edit lock; keep an
   // interrupted lock if it cannot be stopped. A run already ended elsewhere keeps that outcome.
   const message=error.message||'The assistant could not finish.',fresh=await q(env,'SELECT status FROM studio_runs WHERE id=? AND owner=?',run.id,owner).first();
   let stopped=false;
   try{await provider.cancel(env,{...run,session_id:sessionId});stopped=true;}catch{}
   let status=fresh?.status;
   if(status==='running'){
    status=stopped?'failed':'interrupted';
    await q(env,"UPDATE studio_runs SET status=?,error=?,lease_until=NULL WHERE id=? AND owner=? AND status='running'",status,message.slice(0,500),run.id,owner).run();
    if(parent)await q(env,"UPDATE studio_handoffs SET status='failed',error=? WHERE id=? AND owner=? AND run_id=? AND status='running'",message.slice(0,500),parent.id,owner,run.id).run();
    if(stopped)await release(env,run);
   }
   send({type:'error',error:message,id:run.id});
   return {id:run.id,status,error:message};
  }finally{clearInterval(timer);}
 };
 if(!stream)return json(await execute(()=>{}));
 const encoder=new TextEncoder();
 let closed=false;
 const body=new ReadableStream({
  async start(controller){
   const send=value=>{if(!closed)try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{closed=true;}};
   try{await execute(send);}finally{if(!closed){closed=true;controller.close();}}
  },
  cancel(){closed=true;},
 });
 return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
