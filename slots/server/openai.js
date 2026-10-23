import {applyBatch,clone} from '../studio/project.js';
import {contextFor,stageEdits,checkHandoff,instructions,toolDefinitions,MAX_STEPS} from './protocol.js';

export class ProviderError extends Error {constructor(message,status=502){super(message);this.status=status;}}
export async function api(env,path,body,options={}){
 if(!env.OPENAI_API_KEY)throw new ProviderError('OpenAI is not connected yet. Finish secure API setup to enable Studio chat.',503);
 const response=await fetch('https://api.openai.com/v1'+path,{method:options.method||(body?'POST':'GET'),headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json',...(path.startsWith('/agents/')?{'OpenAI-Beta':'agents=v1'}:{})},body:body?JSON.stringify(body):undefined,signal:options.signal});
 if(!response.ok){const safe={400:'The API rejected this request. Check the configured model and agent permissions.',401:'The OpenAI key was rejected. Reconnect it securely.',403:'This API project does not have access to the selected agent or model.',404:'The selected OpenAI model or endpoint is unavailable for this API project.',429:'OpenAI quota or rate limit reached. Check API billing and retry later.'};throw new ProviderError(safe[response.status]||'OpenAI could not complete the request. No edits were applied.',response.status===429?429:502);}
 return response;
}
export async function* events(response){
 if(!response.body)throw Error('The API returned an empty stream.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done}).replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')yield JSON.parse(data);}if(done)break;}}finally{reader.releaseLock();}
}
const publicOrigin='https://gamboligy-studio.djames1.chatgpt.site/';
function imageInput(asset,env){
 if(!asset)return null;
 if(asset.src.startsWith('data:image/'))return asset.src;
 if(asset.src.startsWith('games/zombify/runtime/assets/'))return new URL(asset.src,env.STUDIO_ORIGIN||publicOrigin).href;
 // Do not let a model turn an arbitrary imported URL into a server-side fetch.
 throw Error('For reference edits, upload the image in Studio first.');
}
async function generate(env,args,project,signal){
 if(typeof args.prompt!=='string'||args.prompt.length<3||args.prompt.length>6000)throw Error('Describe the artwork in 3–6,000 characters.');
 if(typeof args.name!=='string'||args.name.length>80||typeof args.transparent!=='boolean'||typeof args.apply_background!=='boolean')throw Error('Invalid art request.');
 const reference=args.reference_asset_id?project.assets.find(a=>a.id===args.reference_asset_id):null;
 if(args.reference_asset_id&&!reference)throw Error('Reference asset was not found.');
 // Private Site assets cannot be fetched by OpenAI; send uploaded bytes or fetch
 // only a known bundled asset through the local asset binding.
 let image=reference?imageInput(reference,env):null;
 if(image?.startsWith('https:')){
  if(!env.ASSETS)throw Error('Upload this reference image before editing it.');
  const res=await env.ASSETS.fetch(new Request(image));if(!res.ok)throw Error('The reference artwork could not be loaded.');
  const mime=res.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg','image/webp','image/gif'].includes(mime))throw Error('Upload a PNG, JPEG or WebP reference.');
  const bytes=new Uint8Array(await res.arrayBuffer());if(bytes.length>10*1024*1024)throw Error('Reference artwork exceeds 10 MB.');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));image=`data:${mime};base64,${btoa(binary)}`;
 }
 const content=[{type:'input_text',text:args.prompt},...(image?[{type:'input_image',image_url:image}]:[])];
 const res=await api(env,'/responses',{model:env.OPENAI_CHAT_MODEL||'gpt-6-astra',input:[{role:'user',content}],tools:[{type:'image_generation',model:env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',background:args.transparent?'transparent':'opaque',output_format:'png'}],tool_choice:{type:'image_generation'}},{signal});
 const body=await res.json(),result=body.output?.find(x=>x.type==='image_generation_call'&&x.result)?.result;
 if(body.status!=='completed'||!result)throw Error('Image generation did not finish. No artwork was applied.');
 if(result.length>15000000)throw Error('Generated artwork is too large for this project.');
 return {id:'generated-'+crypto.randomUUID(),name:args.name||'Generated artwork',kind:args.transparent?'symbol':'image',src:'data:image/png;base64,'+result};
}

export async function runOpenAI(env,input,{progress=()=>{},sessionCreated=()=>{},signal}={}){
 let project=clone(input.project),operations=[],handoff=null,generated=false,steps=0,sessionId=null,completed=false;
 const parts=new Map(),seen=new Set();
 const context={project:contextFor(project),scene:input.scene,selection:input.selection||'reels',attachment:input.attachment||null,recentConversation:input.history};
 const attached=input.attachment?project.assets.find(a=>a.id===input.attachment):null;
 const content=[{type:'input_text',text:JSON.stringify({studioContext:context,userMessage:input.message})}];
 if(attached?.src.startsWith('data:image/')&&attached.src.length<2500000)content.push({type:'input_image',image_url:attached.src});
 const response=await api(env,'/agents/sessions',{agent:{model:env.OPENAI_CHAT_MODEL||'gpt-6-astra',instructions,tools:toolDefinitions,reasoning:{effort:'low'},multi_agent:{enabled:false}},environment:{type:'none'},input:[{role:'user',content}],stream:true},{signal});
 try{
  for await(const event of events(response)){
   if(!sessionId&&event.session?.id){sessionId=event.session.id;await sessionCreated(sessionId);}
   if(event.type==='agent.session.turn.output_text.delta'||event.type==='agent.session.turn.output_text.done'){
    const key=[event.item_id,event.output_index,event.content_index].join(':');parts.set(key,event.type.endsWith('.done')?event.text:(parts.get(key)||'')+(event.delta||''));progress({type:'text',text:[...parts.values()].join('\n')});
   }
   if(event.type==='agent.session.requires_action'){
    if(!sessionId)throw Error('Agent session ID was missing.');
    const session=event.session?.required_actions?event.session:await (await api(env,'/agents/sessions/'+encodeURIComponent(sessionId),null,{signal})).json();
    for(const action of session.required_actions||[]){
     if(action.type!=='function_call')throw Error('This studio session requested an unsupported capability.');
     if(seen.has(action.call_id))continue;seen.add(action.call_id);
     if(++steps>MAX_STEPS)throw Error('The assistant reached its tool limit. Continue with a smaller task.');
     const args=typeof action.arguments==='string'?JSON.parse(action.arguments):action.arguments;
     let outcome;
     try{
      if(action.name==='stage_scene_edits'){
       const edits=JSON.parse(args.operations_json),next=stageEdits(project,edits);if(operations.length+edits.length>50)throw Error('This turn has reached its edit limit.');project=next;operations.push(...edits);progress({type:'status',text:'Preparing scene changes…'});outcome={staged:edits.length,label:String(args.label||'Chat edit').slice(0,80),applied:false,project:contextFor(project)};
      }else if(action.name==='generate_art'){
       if(generated)throw Error('Only one image generation is allowed per message.');if(operations.length>48)throw Error('Apply the staged edits before generating art in another message.');generated=true;progress({type:'status',text:'Generating artwork. This can take a few minutes…'});
       const asset=await generate(env,args,project,signal),edits=[{type:'asset',asset}];if(args.apply_background)edits.push({type:'background',scene:input.scene,values:{assetId:asset.id}});project=applyBatch(project,edits);operations.push(...edits);outcome={assetId:asset.id,name:asset.name,staged:true,applied:false};
      }else if(action.name==='complete_handoff'){handoff=checkHandoff(args);outcome={recorded:true,status:'waiting_for_scene_commit',to:handoff.to};}
      else throw Error('Unknown studio tool.');
      outcome={success:true,output:JSON.stringify(outcome)};
     }catch(error){outcome={success:false,error:error.message};}
     await api(env,'/agents/sessions/'+encodeURIComponent(sessionId)+'/events',{events:[{type:'agent.session.input.tool_result',turn_id:action.turn_id,call_id:action.call_id,...outcome}]},{signal});
    }
   }
   if(event.type==='agent.session.turn.completed'&&!event.turn?.subagent_id){completed=true;break;}
   if(['error','agent.session.failed','agent.session.environment.failed','agent.session.turn.failed','agent.session.turn.cancelled'].includes(event.type))throw Error('The assistant did not complete this turn. No staged changes were applied.');
  }
  if(!completed)throw Error('Connection ended before the assistant completed. Check the saved request before trying again.');
  const text=[...parts.values()].join('\n').trim();
  return {text:text|| (operations.length?'Your scene changes are ready.':'The assistant completed without a text reply.'),operations,handoff};
 }finally{
  // Each run includes a bounded transcript. Completed sessions can be removed;
  // uncertain/failed sessions stay recorded for explicit recovery, never retried.
  if(sessionId&&completed)try{await api(env,'/agents/sessions/'+encodeURIComponent(sessionId),null,{method:'DELETE'});}catch{}
 }
}
