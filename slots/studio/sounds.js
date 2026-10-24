import {SOUND_EVENTS} from './sound-schema.js';
import {uniqueId} from './project.js';
import {AUDIO_ASSETS,AUDIO_CUES} from '../games/zombify/runtime/audio-manifest.js';
const labels={'music-base':'Base music','music-bonus':'Bonus music',ui:'Button click',buy:'Bonus buy',spin:'Reel spin',stop:'Reel stop',vial:'Scatter / anticipation',land:'Wild landing',grow:'Wild expansion',bonus:'Bonus entry',finish:'Bonus complete','celebrate-nice':'Nice Win','celebrate-big':'Big Win','celebrate-epic':'Epic Win','celebrate-max':'Max Win'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountSounds({getProject,edit,commit,applyBatch,checkEditable,assetURL,toast}){
 const host=document.getElementById('sounds-tab');let event='music-base',player=null,key='',previewGeneration=0;
 const stop=()=>{previewGeneration++;if(player){player.pause();player.removeAttribute('src');player.load();player=null;}};
 function render(){
  const p=getProject(),settings=p.sounds?.[event]||{},audio=p.assets.filter(a=>a.kind==='audio');
  const next=JSON.stringify([event,p.sounds,audio.map(a=>[a.id,a.name])]);if(key===next)return;key=next;
  host.innerHTML=`<section class="sound-panel"><h3>SOUNDS</h3><p class="muted">Shared by desktop and mobile. Turn on game sound in Play to hear your changes.</p><label>Game event<select id="sound-event">${SOUND_EVENTS.map(id=>`<option value="${id}" ${id===event?'selected':''}>${esc(labels[id]||id)}</option>`).join('')}</select></label><label>Recording<select id="sound-asset"><option value="">Original game sound</option>${audio.map(a=>`<option value="${a.id}" ${a.id===settings.assetId?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><button id="sound-upload">＋ Upload audio</button><input id="sound-file" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm" hidden><p class="muted">MP3, WAV, OGG, M4A, WebM · up to 10 MB. Uploaded audio is included in project exports.</p><label>Volume <input id="sound-volume" type="range" min="0" max="100" value="${Math.round((settings.volume??1)*100)}"><output>${Math.round((settings.volume??1)*100)}%</output></label><label>Fade in/out (seconds)<input id="sound-fade" type="number" min="0" max="5" step="0.05" value="${settings.fade??(event.startsWith('music-')?.9:0)}"></label>${event.startsWith('music-')?`<label><input id="sound-loop" type="checkbox" ${settings.loop!==false?'checked':''}> Loop music</label>`:''}<div class="sound-buttons"><button id="sound-preview">▶ Preview</button><button id="sound-stop">■ Stop</button></div><button id="sound-reset">Restore this event</button><p class="muted">Nice / Big / Epic / Max default to the approved shared win tracks. Preview plays the selected recording alone.</p></section>`;
 }
 const guard=fn=>async e=>{try{await fn(e);}catch(error){toast(error.message||'Audio could not be loaded.');}};
 host.onchange=guard(async e=>{
  const t=e.target;if(t.id==='sound-event'){stop();event=t.value;render();return;}
  if(t.id==='sound-file'){
   checkEditable();const targetEvent=event,file=t.files[0];if(!file)return;
   if(file.size>10*1024*1024)throw Error('Use audio smaller than 10 MB.');
   const types={mp3:'mpeg',wav:'wav',ogg:'ogg',m4a:'mp4',webm:'webm'},type=types[file.name.split('.').pop().toLowerCase()];if(!type)throw Error('Use MP3, WAV, OGG, M4A or WebM.');
   const bytes=await file.arrayBuffer(),ctx=new AudioContext();try{await ctx.decodeAudioData(bytes.slice(0));}finally{await ctx.close();}
   const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read audio'));r.readAsDataURL(new Blob([bytes],{type:'audio/'+type}));});
   const asset={id:'audio-'+uniqueId(),kind:'audio',name:file.name.slice(0,80),src};
   checkEditable();stop();commit(applyBatch(getProject(),[{type:'asset',asset},{type:'sound',id:targetEvent,values:{assetId:asset.id}}]),'Upload and assign audio');return;
  }
  const values=t.id==='sound-asset'?{assetId:t.value||null}:t.id==='sound-volume'?{volume:Number(t.value)/100}:t.id==='sound-fade'?{fade:Number(t.value)}:t.id==='sound-loop'?{loop:t.checked}:null;
  if(values){checkEditable();stop();edit({type:'sound',id:event,values},'Edit '+(labels[event]||event));}
 });
 host.oninput=e=>{if(e.target.id==='sound-volume')e.target.nextElementSibling.textContent=e.target.value+'%';};
 host.onclick=guard(async e=>{
  const id=e.target.id;
  if(id==='sound-upload'){checkEditable();host.querySelector('#sound-file').click();}
  if(id==='sound-stop')stop();
  if(id==='sound-reset'){checkEditable();stop();edit({type:'sound',id:event,values:null},'Restore sound');}
  if(id==='sound-preview'){
   stop();const ticket=previewGeneration,p=getProject(),s=p.sounds?.[event]||{},a=p.assets.find(a=>a.id===s.assetId);
   const fallback=AUDIO_ASSETS[event]||AUDIO_ASSETS[AUDIO_CUES[event]?.files[0]];
   player=new Audio(a?assetURL(a):new URL('../games/zombify/runtime/'+fallback.replace(/^\.\//,''),import.meta.url).href);
   const active=player;active.volume=s.volume??1;active.loop=event.startsWith('music-')&&s.loop!==false;
   try{await active.play();}catch{if(ticket===previewGeneration)throw Error('Could not preview audio. The original files may need studio:prepare.');}
  }
 });
 addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 return {render,stop};
}
