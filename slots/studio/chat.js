import {imageAsset} from './storage.js';
const $=id=>document.getElementById(id);
const KEY='gamboligy-studio-chat-v1';
const NAMES={openai:'OpenAI',claude:'Claude'},other=p=>p==='claude'?'openai':'claude';
// Each assistant message records who wrote it; older entries predate Claude and came from OpenAI.
const speakerOf=m=>m.role==='user'?'user':NAMES[m.speaker]?m.speaker:'openai';
const messages=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]').filter(x=>['user','assistant','system'].includes(x.role)&&typeof x.text==='string').slice(-60);}catch{return[];}};
export function mountChat(editor){
 const markApplied=id=>{try{localStorage.setItem('studio-chat-applied-'+id,'1');}catch{}};
 const wasApplied=id=>{try{return localStorage.getItem('studio-chat-applied-'+id)==='1';}catch{return false;}};
 let transcript=messages(),running=false,attachment=null,pending=null,activeId=null,autoContinue=true,background=false,notice=null,connected=null,provider='openai';
 try{if(localStorage.getItem('studio-chat-provider')==='claude')provider='claude';}catch{}
 const log=$('chat-messages');
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(transcript.slice(-60)));}catch{}};
 function draw(){log.replaceChildren();for(const m of transcript){const article=document.createElement('article');article.className='chat-message '+m.role+(m.role==='assistant'?' '+speakerOf(m):'');const label=document.createElement('b');label.textContent=m.role==='user'?'You':m.role==='assistant'?NAMES[speakerOf(m)]:'Studio';const p=document.createElement('p');p.textContent=m.text;article.append(label,p);log.append(article);}log.scrollTop=log.scrollHeight;}
 function add(role,text,speaker){transcript.push({role,text,...(speaker?{speaker}:{})});persist();draw();return transcript.at(-1);}
 function status(text){$('chat-status').textContent=text;}
 function lock(value){running=value;$('chat-send').disabled=value;$('chat-stop').hidden=!value;$('chat-input').readOnly=value;}
 async function request(path,body){const res=await fetch('/api/studio/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});if(!res.ok){let data;try{data=await res.json();}catch{}throw Error(data?.error||'Studio chat is unavailable in this checkout. Open the hosted studio.');}return res;}
 const hints={openai:'Ask about this project, change the scene, or generate art.',claude:'Ask Claude about layout, engine or math plans, or describe a scene change. Claude hands artwork to OpenAI.'};
 function pick(next){
  provider=next;try{localStorage.setItem('studio-chat-provider',next);}catch{}
  for(const id of ['chat-connection','chat-claude']){const b=$(id);b.setAttribute('aria-checked',String(b.dataset.provider===next));}
  $('chat-input').placeholder=next==='claude'?'Ask Claude, or describe a scene change…':'Ask anything, describe a change, or attach artwork…';
  const h=$('chat-handoff-prompt');h.textContent='Hand off to '+NAMES[other(next)];h.dataset.chatPrompt=next==='claude'?'Prepare a handoff to the OpenAI assistant with the artwork this project needs next.':'Prepare a handoff to Claude with the engine work this project needs next.';
  if(!running&&!pending)status(connected&&!connected[next]?NAMES[next]+' is not connected yet. Its handoffs wait in the queue.':hints[next]);
 }
 async function connections(){try{const s=await (await request('status')).json();connected={openai:!!s.openai,claude:!!s.claude};background=!!s.background;$('chat-background-row').hidden=!background;for(const [id,p] of [['chat-connection','openai'],['chat-claude','claude']]){$(id).textContent=NAMES[p]+(s[p]?' · connected':' · setup needed');$(id).classList.toggle('connected',!!s[p]);}pick(provider);refreshHandoffs();}catch(error){$('chat-connection').textContent='OpenAI · unavailable';$('chat-claude').textContent='Claude · unavailable';status(error.message);}}
 async function recoverActive(){try{if(localStorage.getItem('studio-chat-active'))return;const data=await (await request('active')).json(),runs=data.runs.slice().reverse(),run=runs.find(r=>r.status==='completed')||runs[0];if(run){activeId=run.id;localStorage.setItem('studio-chat-active',JSON.stringify({id:activeId,snapshot:null}));$('chat-restore').hidden=false;status(run.stale?'An earlier request lost its connection. Resume its handoff from Handoffs, or Restore it to stop it.':'An earlier response is available. Restore it before starting another task.');}}catch{}}
 async function refreshHandoffs(){try{const data=await (await request('handoffs')).json();const list=$('chat-handoffs');list.replaceChildren();for(const h of data.handoffs){const card=document.createElement('article'),heading=document.createElement('b'),p=document.createElement('p');heading.textContent=`To ${NAMES[h.target]||'OpenAI'} · ${h.status.replaceAll('_',' ')}${h.background?' · background':''}${h.attempts>1?' · attempt '+h.attempts:''}`;p.textContent=h.next_task+(h.error?'\n'+h.error:'');card.append(heading,p);
   const open=['queued','waiting_connection','paused'].includes(h.status);
   if((open||h.stale)&&connected?.[h.target]){const start=document.createElement('button');start.className='quiet';start.textContent=h.stale?'Resume':'Start now';start.disabled=running||!!pending;start.onclick=()=>run('Continue the completed handoff.',h);card.append(start);}
   if(open||h.status==='running'){const stop=document.createElement('button');stop.className='quiet';stop.textContent='Stop';stop.onclick=async()=>{try{await request('handoffs/'+h.id+'/stop',{});status('Handoff stopped. Nothing further will run from it.');refreshHandoffs();}catch(error){status(error.message);}};card.append(stop);}
   if(open){const copy=document.createElement('button');copy.className='quiet';copy.textContent='Copy handoff';copy.onclick=async()=>{try{await navigator.clipboard.writeText(`${h.summary}\n\nNext task: ${h.next_task}\n\nHandoff ID: ${h.id}`);status('Handoff copied.');}catch{status('Select and copy the handoff text.');}};card.append(copy);}list.append(card);}if(!data.handoffs.length)list.textContent='Completed handoffs between OpenAI and Claude will appear here.';}catch{$('chat-handoffs').textContent='The handoff queue will be available after server setup.';}}
 async function acknowledge(applied,id=activeId){const keepGoing=applied&&autoContinue&&background&&$('chat-background').checked,s=keepGoing?editor.snapshot():null;const data=await (await request('runs/'+id+'/ack',{applied,autoContinue,...(keepGoing?{background:true,snapshot:{project:s.project,scene:s.scene,selection:s.selection}}:{})})).json();await refreshHandoffs();notice=data.next?.status;if(data.next?.status==='waiting_connection')status('Handoff saved. Waiting for '+(NAMES[data.next.target]||'OpenAI')+' to connect.');else if(data.next?.status==='paused_limit')status('Automatic handoff limit reached. Review the work before starting another task.');try{localStorage.removeItem('studio-chat-applied-'+id);}catch{}return data.next;}
 function savePending(id,revision,result){pending={id,revision,result};const changes=result.operations.map(op=>op.type==='asset'?'New artwork: '+op.asset.name:[op.type,op.scene||'',op.id||'',op.values?JSON.stringify(op.values):''].filter(Boolean).join(' · '));$('chat-change-list').textContent=changes.join('\n');$('chat-change-list').hidden=false;$('chat-apply').hidden=false;$('chat-discard').hidden=false;status('Changes are ready. The scene changed or a round is running; review before applying.');}
 async function finish(result,id,snapshot,reply){
  reply.text=result.text;persist();draw();let applied=true;
  if(result.operations.length){try{editor.apply(result.operations,snapshot,'Studio chat');markApplied(id);add('system','Scene updated · Undo is available.');}catch{savePending(id,snapshot,result);applied=false;}}
  if(applied){const next=await acknowledge(true,id);clearActive();if(next?.status==='queued'&&autoContinue)return next;}
  return null;
 }
 function clearActive(){activeId=null;try{localStorage.removeItem('studio-chat-active');}catch{}}
 async function consume(res,id,snapshot,reply){
  if(res.headers.get('content-type')?.includes('application/json')){const data=await res.json();if(data.result&&data.status==='completed')return finish(data.result,id,snapshot,reply);throw Error('This request is still running. Use Restore response; it will not be resent.');}
  const reader=res.body.getReader(),decoder=new TextDecoder();let buf='',found=false,next=null;const follow=event=>{if(event.id&&event.id!==id){id=event.id;if(running){activeId=id;try{localStorage.setItem('studio-chat-active',JSON.stringify({id,snapshot}));}catch{}}}};
  try{while(true){const {done,value}=await reader.read();buf+=decoder.decode(value,{stream:!done});let end;while((end=buf.indexOf('\n'))>=0){const line=buf.slice(0,end);buf=buf.slice(end+1);if(!line.trim())continue;const event=JSON.parse(line);follow(event);if(event.type==='status')status(event.text);if(event.type==='text'){reply.text=event.text;draw();}if(event.type==='error')throw Error(event.error);if(event.type==='result'){found=true;next=await finish(event.result,id,snapshot,reply);}}if(done)break;}}finally{reader.releaseLock();}
  if(!found)throw Error('The connection ended. Restore the saved response before sending another message.');return next;
 }
 async function run(text,handoff=null){
  if(running)return;if(pending){status('Apply or discard the waiting changes first.');return;}
  const speaker=handoff?.target||provider;notice=null;
  if(!handoff&&connected&&!connected[speaker]){status(NAMES[speaker]+' is not connected yet. Choose the other assistant or finish its secure API setup.');return;}
  const snapshot=editor.snapshot();if(!handoff)add('user',text);
  const id=crypto.randomUUID(),payload={id,message:text,project:snapshot.project,scene:snapshot.scene,selection:snapshot.selection,attachment,history:transcript.filter(m=>m.role!=='system').slice(handoff?-20:-21,handoff?undefined:-1).map(m=>({role:m.role,text:m.text,speaker:speakerOf(m)})),provider:speaker};
  const reply=add('assistant','',speaker);lock(true);activeId=handoff?(handoff.attempts>0?'r'+(handoff.attempts+1)+'-':'')+'next-'+handoff.id.replace(/^handoff-/,'').slice(0,70):id;
  try{localStorage.setItem('studio-chat-active',JSON.stringify({id:activeId,snapshot:snapshot.revision}));}catch{}
  $('chat-input').value='';attachment=null;$('chat-attachment').textContent='';status('Connecting…');
  let next=null;
  try{const path=handoff?'handoffs/'+handoff.id+'/start':'chat';next=await consume(await request(path,payload),activeId,snapshot.revision,reply);if(!pending&&!next&&activeId===null&&!['waiting_connection','paused_limit'].includes(notice))status('Ready.');}
  catch(error){reply.text=reply.text||error.message;persist();draw();status(error.message);$('chat-restore').hidden=false;}
  finally{lock(false);refreshHandoffs();}
  if(next)await run('Continue the completed handoff.',next);
 }
 $('chat-form').onsubmit=e=>{e.preventDefault();const text=$('chat-input').value.trim();if(text)run(text);};
 $('chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit();}};
 $('chat-open').onclick=()=>{$('chat-dialog').show();connections();$('chat-input').focus();recoverActive();};
 $('chat-close').onclick=()=>$('chat-dialog').close();
 $('chat-auto').onchange=e=>{autoContinue=e.target.checked;$('chat-background').disabled=!autoContinue;};
 for(const id of ['chat-connection','chat-claude'])$(id).onclick=()=>{if(!running)pick($(id).dataset.provider);};
 pick(provider);
 $('chat-handoffs').closest('details').ontoggle=()=>{log.scrollTop=log.scrollHeight;};
 $('chat-attach').onclick=()=>$('chat-file').click();
 $('chat-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const asset=await imageAsset(file);editor.addAsset(asset);attachment=asset.id;$('chat-attachment').textContent='Attached: '+asset.name;$('chat-input').focus();}catch(error){status(error.message);}finally{e.target.value='';}};
 $('chat-apply').onclick=async()=>{if(!pending)return;try{editor.apply(pending.result.operations,null,'Reviewed chat changes');markApplied(pending.id);const next=await acknowledge(true,pending.id);pending=null;clearActive();$('chat-change-list').hidden=true;$('chat-apply').hidden=true;$('chat-discard').hidden=true;add('system','Reviewed changes applied · Undo is available.');if(next?.status==='queued'&&autoContinue)await run('Continue the completed handoff.',next);else recoverActive();}catch(error){status(error.message);}};
 $('chat-discard').onclick=async()=>{if(!pending)return;try{await acknowledge(false,pending.id);pending=null;clearActive();$('chat-change-list').hidden=true;$('chat-apply').hidden=true;$('chat-discard').hidden=true;status('Changes discarded. Work handed off from them was stopped.');recoverActive();}catch(error){status(error.message);}};
 $('chat-stop').onclick=async()=>{try{if(activeId)await request('runs/'+activeId+'/cancel',{});status('Stop requested. No further changes will be applied.');}catch(error){status(error.message);}};
 $('chat-restore').onclick=async()=>{try{const stored=JSON.parse(localStorage.getItem('studio-chat-active')||'null');if(!stored){$('chat-restore').hidden=true;return;}const data=await (await request('runs/'+stored.id)).json();activeId=stored.id;if(data.status==='completed'&&wasApplied(stored.id)){await acknowledge(true,stored.id);clearActive();status('Scene changes were already applied. Handoff acknowledged.');}else if(data.result&&data.status==='completed'){savePending(stored.id,null,data.result);add('assistant',data.result.text,NAMES[data.provider]?data.provider:'openai');if(!data.result.operations.length){await acknowledge(true,stored.id);pending=null;clearActive();$('chat-change-list').hidden=true;$('chat-apply').hidden=true;$('chat-discard').hidden=true;}}else if(['failed','cancelled','applied','discarded'].includes(data.status)){status(data.error||'Request '+data.status+'.');clearActive();}else{status('Request '+data.status+'. You can stop it before trying again.');$('chat-stop').hidden=false;}$('chat-restore').hidden=!activeId;}catch(error){status(error.message);}};
 document.querySelectorAll('[data-chat-prompt]').forEach(button=>button.onclick=()=>{$('chat-input').value=button.dataset.chatPrompt;$('chat-input').focus();});
 if(!transcript.length)add('system','Talk to OpenAI or Claude about this project. Both can prepare undoable scene changes; OpenAI generates artwork, Claude plans engine and math work. Either can hand finished work to the other.');else draw();
 try{$('chat-restore').hidden=!localStorage.getItem('studio-chat-active');}catch{}
 return {open:()=>$('chat-open').click()};
}
