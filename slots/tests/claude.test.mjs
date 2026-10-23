import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import {createProject,applyBatch} from '../studio/project.js';
import {checkRequest,MAX_STEPS} from '../server/protocol.js';
import {runClaude,claudeInstructions,CLAUDE_MODEL} from '../server/claude.js';
import {input} from './lib/studio-env.mjs';
// Stands in for client.beta.messages.stream: records every request and replays scripted turns.
function fakeClient(turns){
 const calls=[];
 return {calls,beta:{messages:{stream(params,options){
  calls.push({params:structuredClone(params),options});
  const turn=turns[Math.min(calls.length-1,turns.length-1)],listeners={};
  return {on(event,fn){(listeners[event]??=[]).push(fn);return this;},async finalMessage(){
   if(options?.signal?.aborted)throw new Anthropic.APIUserAbortError();
   const message=typeof turn==='function'?turn(params):turn;
   if(message instanceof Error)throw message;
   for(const b of message.content)if(b.type==='text')for(const fn of listeners.text||[])fn(b.text,b.text);
   return message;
  }};
 }}}};
}
const msg=(content,stop_reason='end_turn')=>({id:'msg_test',type:'message',role:'assistant',model:CLAUDE_MODEL,content,stop_reason,usage:{input_tokens:10,output_tokens:20}});
const use=(id,name,args)=>({type:'tool_use',id,name,input:args});
const brighter=[{type:'background',scene:'mobile',values:{brightness:120}}];
const claudeInput=(extra={})=>checkRequest({...input(),provider:'claude',...extra});
const env={ANTHROPIC_API_KEY:'not-real'};

test('Claude stages validated edits and replays its own turns unchanged',async()=>{
 const turn1=msg([{type:'thinking',thinking:'',signature:'sig-1'},{type:'text',text:'Brightening the mobile background.'},use('toolu_1','stage_scene_edits',{operations:brighter,label:'Brighter mobile'})],'tool_use');
 const client=fakeClient([turn1,msg([{type:'text',text:'Ready to apply.'}])]);
 const i=claudeInput({history:[{role:'user',text:'hi',speaker:'user'},{role:'assistant',text:'Art is done.',speaker:'openai'},{role:'assistant',text:'Checked the grid.',speaker:'claude'}]});
 const progress=[],out=await runClaude(env,i,{client,progress:e=>progress.push(e)});
 assert.deepEqual(out.operations,brighter);
 assert.equal(out.handoff,null);
 assert.equal(i.project.scenes.mobile.background.brightness,100,'input project is not mutated');
 assert.equal(out.text,'Brightening the mobile background.\n\nReady to apply.');
 assert.equal(progress.filter(e=>e.type==='text').at(-1).text,out.text);
 const [first,second]=client.calls;
 assert.equal(client.calls.length,2);
 for(const {params} of client.calls){
  assert.equal(params.model,'claude-opus-5-5');
  assert.deepEqual(params.thinking,{type:'adaptive'});
  assert.equal(params.output_config.effort,'medium');
  assert.deepEqual(params.betas,['server-side-fallback-2026-07-01']);
  assert.equal(params.fallbacks,'default');
  assert.equal(params.system,claudeInstructions);
  assert.deepEqual(params.tools.map(t=>[t.name,t.eager_input_streaming]),[['stage_scene_edits',true],['complete_handoff',true]]);
  assert.ok(!JSON.stringify(params).includes('not-real'),'the key never enters a request body');
 }
 // Append-only history: the first request is a strict prefix of the second, and the assistant turn goes back verbatim.
 assert.deepEqual(second.params.messages.slice(0,1),first.params.messages);
 assert.deepEqual(second.params.messages[1],{role:'assistant',content:turn1.content});
 assert.deepEqual(second.params.messages[2].content.map(r=>[r.type,r.tool_use_id,!!r.is_error]),[['tool_result','toolu_1',false]]);
 const context=JSON.parse(first.params.messages[0].content[0].text.replace(/^<studio_context>\n|\n<\/studio_context>$/g,''));
 assert.deepEqual(context.recentConversation.map(m=>m.from),['Dylan','ChatGPT','Claude (you)']);
 assert.equal(first.params.messages[0].content.at(-1).text,i.message);
});

test('invalid Claude tool input is returned as an error and never staged',async()=>{
 const client=fakeClient([msg([
  use('toolu_1','stage_scene_edits',{operations:'not-an-array',label:'x'}),
  use('toolu_2','stage_scene_edits',{operations:[{type:'asset',asset:{id:'evil',src:'https://example.test/x.png'}}],label:'x'}),
  use('toolu_3','complete_handoff',{to:'claude',summary:'s',nextTask:'n'}),
  use('toolu_4','run_shell',{command:'ls'}),
 ],'tool_use'),msg([{type:'text',text:'Those did not validate.'}])]);
 const out=await runClaude(env,claudeInput(),{client});
 assert.deepEqual(out.operations,[]);
 assert.equal(out.handoff,null);
 const results=client.calls[1].params.messages.at(-1).content;
 assert.deepEqual(results.map(r=>[r.tool_use_id,r.is_error]),[['toolu_1',true],['toolu_2',true],['toolu_3',true],['toolu_4',true]],'all results go back in one user message');
});

test('Claude hands off to OpenAI and keeps to the 50-edit limit across a turn',async()=>{
 const thirty=Array.from({length:30},(_,n)=>({type:'background',scene:'desktop',values:{brightness:100+n}}));
 const client=fakeClient([
  msg([use('toolu_1','stage_scene_edits',{operations:thirty,label:'Grade'})],'tool_use'),
  msg([use('toolu_2','stage_scene_edits',{operations:thirty,label:'Again'}),use('toolu_3','complete_handoff',{to:'openai',summary:'Graded desktop.',nextTask:'Paint a moonlit street background.'})],'tool_use'),
  msg([{type:'text',text:'Handed the artwork to OpenAI.'}]),
 ]);
 const out=await runClaude(env,claudeInput(),{client});
 assert.equal(out.operations.length,30);
 assert.deepEqual(out.handoff,{to:'openai',summary:'Graded desktop.',nextTask:'Paint a moonlit street background.'});
 assert.match(client.calls[2].params.messages.at(-1).content[0].content,/50-edit limit/);
});

test('refusals, truncated tool calls and the step limit stage nothing',async()=>{
 await assert.rejects(runClaude(env,claudeInput(),{client:fakeClient([msg([],'refusal')])}),/declined/);
 await assert.rejects(runClaude(env,claudeInput(),{client:fakeClient([msg([use('toolu_1','stage_scene_edits',{operations:brighter})],'max_tokens')])}),/cut off/);
 let n=0;const loop=fakeClient([()=>msg([use('toolu_'+n++,'stage_scene_edits',{operations:brighter,label:'x'})],'tool_use')]);
 await assert.rejects(runClaude(env,claudeInput(),{client:loop}),/tool limit/);
 assert.ok(loop.calls.length<=MAX_STEPS+1);
});

test('Claude stops on abort, maps API errors safely, and re-issues an unparseable stream at most twice',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(runClaude(env,claudeInput(),{client:fakeClient([msg([])]),signal:controller.signal}),/^Error: Request stopped\.$/);
 await assert.rejects(runClaude(env,claudeInput(),{client:fakeClient([new Anthropic.AuthenticationError(401,{type:'error'},'invalid x-api-key sk-ant-secret',new Headers())])}),e=>e.message==='The Anthropic key was rejected. Reconnect it securely.');
 const bad=()=>new Anthropic.AnthropicError('Unable to parse tool parameter JSON');
 const flaky=fakeClient([bad(),bad(),msg([{type:'text',text:'OK'}])]);
 assert.equal((await runClaude(env,claudeInput(),{client:flaky})).text,'OK');
 assert.equal(flaky.calls.length,3);
 await assert.rejects(runClaude(env,claudeInput(),{client:fakeClient([bad(),bad(),bad(),msg([])])}),/Unable to parse/);
});

test('Claude sees an attached upload and respects model configuration',async()=>{
 const project=applyBatch(createProject(),[{type:'asset',asset:{id:'upload-1',name:'Moon',kind:'image',src:'data:image/png;base64,iVBORw0KGgo='}}]);
 const client=fakeClient([msg([{type:'text',text:'Nice moon.'}])]);
 await runClaude({...env,ANTHROPIC_MODEL:'claude-haiku-5-5',ANTHROPIC_EFFORT:'low'},claudeInput({project,attachment:'upload-1'}),{client});
 const {params}=client.calls[0];
 assert.deepEqual(params.messages[0].content[1],{type:'image',source:{type:'base64',media_type:'image/png',data:'iVBORw0KGgo='}});
 assert.equal(params.model,'claude-haiku-5-5');
 assert.equal(params.output_config.effort,'low');
 assert.equal(params.fallbacks,undefined,'no server-side fallback is sent for models without one');
});
