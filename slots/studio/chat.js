import {imageAsset} from './storage.js';
import {NAMES,mentions,segments,typing,resolve} from './mentions.js';
const $=id=>document.getElementById(id);
const KEY='gamboligy-studio-chat-v1';
// Each assistant message records who wrote it; older entries predate Claude and came from ChatGPT (OpenAI).
const speakerOf=m=>m.role==='user'?'user':NAMES[m.speaker]?m.speaker:'openai';
const messages=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]').filter(x=>['user','assistant','system'].includes(x.role)&&typeof x.text==='string').slice(-60);}catch{return[];}};
const OPTIONS=[['claude','@Claude','engine, math, layout'],['openai','@ChatGPT','artwork, scene']];
export function mountChat(editor){
 const markApplied=id=>{try{localStorage.setItem('studio-chat-applied-'+id,'1');}catch{}};
 const wasApplied=id=>{try{return localStorage.getItem('studio-chat-applied-'+id)==='1';}catch{return false;}};
 let transcript=messages(),running=false,attachment=null,pending=null,activeId=null,autoContinue=true,background=false,notice=null,connected=null,recipient='openai',picker=null;
 // A message without a mention goes to whoever answered last.
 try{if(localStorage.getItem('studio-chat-provider')==='claude')recipient='claude';}catch{}
 const log=$('chat-messages'),box=$('chat-input');
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(transcript.slice(-60)));}catch{}};
 function draw(){log.replaceChildren();for(const m of transcript){const article=document.createElement('article');article.className='chat-message '+m.role+(m.role==='assistant'?' '+speakerOf(m):'');const label=document.createElement('b');label.textContent=m.role==='user'?'You':m.role==='assistant'?NAMES[speakerOf(m)]:'Studio';const p=document.createElement('p');if(m.role==='user')for(const s of segments(m.text)){if(s.mention){const span=document.createElement('span');span.className='mention';span.textContent=s.text;p.append(span);}else p.append(s.text);}else p.textContent=m.text;article.append(label,p);log.append(article);}log.scrollTop=log.scrollHeight;}
 function add(role,text,speaker){transcript.push({role,text,...(speaker?{speaker}:{})});persist();draw();return transcript.at(-1);}
 function status(text){$('chat-status').textContent=text;}
 function lock(value){running=value;$('chat-send').disabled=value;$('chat-stop').hidden=!value;box.readOnly=value;}
 async function request(path,body){const res=await fetch('/api/studio/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});if(!res.ok){let data;try{data=await res.json();}catch{}throw Error(data?.error||'Studio chat is unavailable in this checkout. Open the hosted studio.');}return res;}
 const targetsOf=text=>{const m=mentions(text);return m.length?m:[recipient];};
 function showRecipient(){const to=targetsOf(box.value);$('chat-recipient').textContent='To '+to.map(p=>NAMES[p]).join(', then ')+(mentions(box.value).length?'':' · type @ to switch');}
 function remember(p){recipient=p;try{localStorage.setItem('studio-chat-provider',p);}catch{}showRecipient();}
 function hint(){if(!connected)return;const missing=Object.keys(NAMES).filter(p=>!connected[p]);status(missing.length===2?'Chat is installed. Secure API setup is required before sending.':missing.length?NAMES[missing[0]]+' is not connected yet; its handoffs wait in the queue. Type @ to pick an assistant.':'Type @ to pick ChatGPT or Claude, or @both. ChatGPT makes artwork; Claude plans engine and math work.');}
 async function connections(){try{const s=await (await request('status')).json();connected={openai:!!s.openai,claude:!!s.claude};background=!!s.background;$('chat-background-row').hidden=!background;for(const [id,p] of [['chat-connection','openai'],['chat-claude','claude']]){$(id).textContent=NAMES[p]+(s[p]?' · connected':' · setup needed');$(id).classList.toggle('connected',!!s[p]);}if(!running&&!pending)hint();refreshHandoffs();}catch(error){$('chat-connection').textContent='ChatGPT · unavailable';$('chat-claude').textContent='Claude · unavailable';status(error.message);}}
 async function recoverActive(){try{if(localStorage.getItem('studio-chat-active'))return;const data=await (await request('active')).json(),runs=data.runs.slice().reverse(),run=runs.find(r=>r.status==='completed')||runs[0];if(run){activeId=run.id;localStorage.setItem('studio-chat-active',JSON.stringify({id:activeId,snapshot:null}));$('chat-restore').hidden=false;status(run.stale?'An earlier request lost its connection. Resume its handoff from Handoffs, or Restore it to stop it.':'An earlier response is available. Restore it before starting another task.');}}catch{}}
 async function refreshHandoffs(){try{const data=await (await request('handoffs')).json();const list=$('chat-handoffs');list.replaceChildren();for(const h of data.handoffs){const card=document.createElement('article'),heading=document.createElement('b'),p=document.createElement('p');heading.textContent=`To ${NAMES[h.target]||'ChatGPT'} · ${h.status.replaceAll('_',' ')}${h.background?' · background':''}${h.attempts>1?' · attempt '+h.attempts:''}`;p.textContent=h.next_task+(h.error?'\n'+h.error:'');card.append(heading,p);
   const open=['queued','waiting_connection','paused'].includes(h.status);
   if((open||h.stale)&&connected?.[h.target]){const start=document.createElement('button');start.className='quiet';start.textContent=h.stale?'Resume':'Start now';start.disabled=running||!!pending;start.onclick=()=>run('Continue the completed handoff.',{handoff:h});card.append(start);}
   if(open||h.status==='running'){const stop=document.createElement('button');stop.className='quiet';stop.textContent='Stop';stop.onclick=async()=>{try{await request('handoffs/'+h.id+'/stop',{});status('Handoff stopped. Nothing further will run from it.');refreshHandoffs();}catch(error){status(error.message);}};card.append(stop);}
   if(open){const copy=document.createElement('button');copy.className='quiet';copy.textContent='Copy handoff';copy.onclick=async()=>{try{await navigator.clipboard.writeText(`${h.summary}\n\nNext task: ${h.next_task}\n\nHandoff ID: ${h.id}`);status('Handoff copied.');}catch{status('Select and copy the handoff text.');}};card.append(copy);}list.append(card);}if(!data.handoffs.length)list.textContent='Completed handoffs between ChatGPT and Claude will appear here.';}catch{$('chat-handoffs').textContent='The handoff queue will be available after server setup.';}}
 async function acknowledge(applied,id=activeId){const keepGoing=applied&&autoContinue&&background&&$('chat-background').checked,s=keepGoing?editor.snapshot():null;const data=await (await request('runs/'+id+'/ack',{applied,autoContinue,...(keepGoing?{background:true,snapshot:{project:s.project,scene:s.scene,selection:s.selection}}:{})})).json();await refreshHandoffs();notice=data.next?.status;if(data.next?.status==='waiting_connection')status('Handoff saved. Waiting for '+(NAMES[data.next.target]||'ChatGPT')+' to connect.');else if(data.next?.status==='paused_limit')status('Automatic handoff limit reached. Review the work before starting another task.');try{localStorage.removeItem('studio-chat-applied-'+id);}catch{}return data.next;}
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
 // One assistant turn. `entry` is Dylan's message being answered: it travels as `message`, so it is left out of the
 // history, which keeps every other line, including what the other assistant just said.
 async function run(text,{handoff=null,to=handoff?.target,entry=null,attach=null}={}){
  if(running)return false;if(pending){status('Apply or discard the waiting changes first.');return false;}
  notice=null;
  const snapshot=editor.snapshot();
  const id=crypto.randomUUID(),payload={id,message:text,project:snapshot.project,scene:snapshot.scene,selection:snapshot.selection,attachment:attach,history:transcript.filter(m=>m.role!=='system'&&m!==entry).slice(-20).map(m=>({role:m.role,text:m.text,speaker:speakerOf(m)})),provider:to};
  const reply=add('assistant','',to);lock(true);remember(to);activeId=handoff?(handoff.attempts>0?'r'+(handoff.attempts+1)+'-':'')+'next-'+handoff.id.replace(/^handoff-/,'').slice(0,70):id;
  try{localStorage.setItem('studio-chat-active',JSON.stringify({id:activeId,snapshot:snapshot.revision}));}catch{}
  status(NAMES[to]+' is thinking…');
  let next=null,ok=true;
  try{const path=handoff?'handoffs/'+handoff.id+'/start':'chat';next=await consume(await request(path,payload),activeId,snapshot.revision,reply);if(!pending&&!next&&activeId===null&&!['waiting_connection','paused_limit'].includes(notice))status('Ready.');}
  catch(error){ok=false;reply.text=reply.text||error.message;persist();draw();status(error.message);$('chat-restore').hidden=false;}
  finally{lock(false);refreshHandoffs();}
  if(next)return run('Continue the completed handoff.',{handoff:next});
  return ok;
 }
 // Dylan's message goes to everyone it mentions, in order; each later assistant sees the earlier replies.
 async function send(text){
  if(running)return;if(pending){status('Apply or discard the waiting changes first.');return;}
  const to=targetsOf(text),ready=connected?to.filter(p=>connected[p]):to,missing=to.filter(p=>!ready.includes(p));
  if(!ready.length){status(NAMES[to[0]]+' is not connected yet. Mention the other assistant, or finish its secure API setup.');return;}
  const entry=add('user',text),attach=attachment;
  box.value='';attachment=null;$('chat-attachment').textContent='';closePicker();showRecipient();
  if(missing.length)add('system',missing.map(p=>NAMES[p]).join(' and ')+' is not connected yet, so only '+ready.map(p=>NAMES[p]).join(' and ')+' will answer.');
  for(const p of ready){
   if(pending){status('Apply or discard the waiting changes, then ask '+NAMES[p]+' again.');break;}
   if(!(await run(text,{to:p,entry,attach})))break;
  }
 }
 // The @ picker: opens while a mention is being typed, filters by prefix, Enter/Tab or a tap inserts it.
 function closePicker(){picker=null;$('chat-mentions').hidden=true;}
 function openPicker(){
  const t=typing(box.value,box.selectionStart);
  const options=t?OPTIONS.filter(([p,label])=>!t.word||label.slice(1).toLowerCase().startsWith(t.word.toLowerCase())||resolve(t.word).includes(p)):[];
  if(!options.length)return closePicker();
  picker={...t,options,active:Math.min(picker?.active||0,options.length-1)};
  const list=$('chat-mentions');list.replaceChildren();
  options.forEach(([p,label,note],n)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.dataset.mention=p;b.setAttribute('aria-selected',String(n===picker.active));b.append(label);const s=document.createElement('span');s.textContent=note;b.append(s);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>choose(n);list.append(b);});
  list.hidden=false;
 }
 function choose(n){
  const label=picker.options[n][1]+' ',end=picker.start+1+picker.word.length;
  box.value=box.value.slice(0,picker.start)+label+box.value.slice(end);
  const caret=picker.start+label.length;box.setSelectionRange(caret,caret);box.focus();closePicker();showRecipient();
 }
 function mention(p){const label=OPTIONS.find(o=>o[0]===p)[1]+' ';if(!mentions(box.value).includes(p))box.value=label+box.value.replace(/^\s+/,'');box.focus();box.setSelectionRange(box.value.length,box.value.length);showRecipient();}
 $('chat-form').onsubmit=e=>{e.preventDefault();const text=box.value.trim();if(text)send(text);};
 box.onkeydown=e=>{
  if(picker&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();picker.active=(picker.active+(e.key==='ArrowDown'?1:picker.options.length-1))%picker.options.length;openPicker();return;}
  if(picker&&(e.key==='Enter'||e.key==='Tab')){e.preventDefault();choose(picker.active);return;}
  if(picker&&e.key==='Escape'){e.preventDefault();closePicker();return;}
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit();}
 };
 box.oninput=()=>{openPicker();showRecipient();};
 box.onblur=()=>setTimeout(closePicker,150);
 $('chat-open').onclick=()=>{$('chat-dialog').show();connections();box.focus();recoverActive();};
 $('chat-close').onclick=()=>$('chat-dialog').close();
 $('chat-auto').onchange=e=>{autoContinue=e.target.checked;$('chat-background').disabled=!autoContinue;};
 for(const id of ['chat-connection','chat-claude'])$(id).onclick=()=>mention($(id).dataset.provider);
 $('chat-handoffs').closest('details').ontoggle=()=>{log.scrollTop=log.scrollHeight;};
 $('chat-attach').onclick=()=>$('chat-file').click();
 $('chat-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const asset=await imageAsset(file);editor.addAsset(asset);attachment=asset.id;$('chat-attachment').textContent='Attached: '+asset.name;box.focus();}catch(error){status(error.message);}finally{e.target.value='';}};
 $('chat-apply').onclick=async()=>{if(!pending)return;try{editor.apply(pending.result.operations,null,'Reviewed chat changes');markApplied(pending.id);const next=await acknowledge(true,pending.id);pending=null;clearActive();$('chat-change-list').hidden=true;$('chat-apply').hidden=true;$('chat-discard').hidden=true;add('system','Reviewed changes applied · Undo is available.');if(next?.status==='queued'&&autoContinue)await run('Continue the completed handoff.',{handoff:next});else recoverActive();}catch(error){status(error.message);}};
 $('chat-discard').onclick=async()=>{if(!pending)return;try{await acknowledge(false,pending.id);pending=null;clearActive();$('chat-change-list').hidden=true;$('chat-apply').hidden=true;$('chat-discard').hidden=true;status('Changes discarded. Work handed off from them was stopped.');recoverActive();}catch(error){status(error.message);}};
 $('chat-stop').onclick=async()=>{try{if(activeId)await request('runs/'+activeId+'/cancel',{});status('Stop requested. No further changes will be applied.');}catch(error){status(error.message);}};
 $('chat-restore').onclick=async()=>{try{const stored=JSON.parse(localStorage.getItem('studio-chat-active')||'null');if(!stored){$('chat-restore').hidden=true;return;}const data=await (await request('runs/'+stored.id)).json();activeId=stored.id;if(data.status==='completed'&&wasApplied(stored.id)){await acknowledge(true,stored.id);clearActive();status('Scene changes were already applied. Handoff acknowledged.');}else if(data.result&&data.status==='completed'){savePending(stored.id,null,data.result);add('assistant',data.result.text,NAMES[data.provider]?data.provider:'openai');if(!data.result.operations.length){await acknowledge(true,stored.id);pending=null;clearActive();$('chat-change-list').hidden=true;$('chat-apply').hidden=true;$('chat-discard').hidden=true;}}else if(['failed','cancelled','applied','discarded'].includes(data.status)){status(data.error||'Request '+data.status+'.');clearActive();}else{status('Request '+data.status+'. You can stop it before trying again.');$('chat-stop').hidden=false;}$('chat-restore').hidden=!activeId;}catch(error){status(error.message);}};
 document.querySelectorAll('[data-chat-prompt]').forEach(button=>button.onclick=()=>{box.value=button.dataset.chatPrompt;box.focus();showRecipient();});
 if(!transcript.length)add('system','One chat, both assistants. Start a message with @ChatGPT or @Claude, or @both. Without a mention, whoever answered last replies. ChatGPT makes artwork; Claude plans engine and math work. Both can prepare undoable scene changes and hand finished work to each other.');else draw();
 showRecipient();
 try{$('chat-restore').hidden=!localStorage.getItem('studio-chat-active');}catch{}
 return {open:()=>$('chat-open').click()};
}
