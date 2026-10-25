import {SCREEN_PARTS,DEFAULT_PART,FONTS,isTextPart,isCopyPart} from './screens-schema.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FIELDS={x:{label:'Horizontal offset',min:-2000,max:2000,range:500},y:{label:'Vertical offset',min:-2000,max:2000,range:500},scale:{label:'Size (%)',min:10,max:400,factor:100},fontSize:{label:'Text size (0 = original)',min:0,max:200},opacity:{label:'Opacity (%)',min:0,max:100,factor:100}};
export function mountScreens({getProject,getScene,commit,applyBatch,checkEditable,send,toast}){
 const host=document.getElementById('screens-tab');let screen='counter',part='art',showing=false,tier='regular',winTier='nice',guidePage='0',status='',pending=null;
 const options=(items,current)=>Object.entries(items).map(([k,label])=>`<option value="${k}" ${current===k?'selected':''}>${label}</option>`).join('');
 function render(){
  const settings=getProject().scenes[getScene()].screens||{},v={...DEFAULT_PART,...settings[screen]?.[part]},text=isTextPart(screen,part);
  host.innerHTML=`<h3>SCREENS · ${getScene().toUpperCase()}</h3><p>Hold a scene still, then adjust its artwork and text. Changes also apply in the game.</p>
  <label>Screen<select id="screen-kind">${options(Object.fromEntries(Object.entries(SCREEN_PARTS).map(([k,s])=>[k,s.name])),screen)}</select></label>
  ${['counter','infection','bonus','result'].includes(screen)?`<label>Preview bonus<select id="screen-tier">${options({regular:'Regular Outbreak',super:'Super Outbreak',hidden:'Hidden Outbreak'},tier)}</select></label><p class="muted">Styles apply to all bonus tiers. This selector changes the preview.</p>`:''}
  ${screen==='win'?`<label>Preview win<select id="screen-win-tier">${options({nice:'Nice Win',big:'Big Win',epic:'Epic Win',max:'Max Win'},winTier)}</select></label>`:''}
  ${screen==='guide'?`<label>Preview card (mobile)<select id="screen-guide-page">${options({0:'Eat & expand',1:'Super / Hidden',2:'Second Life'},guidePage)}</select></label>`:''}
  <div class="screen-actions"><button id="screen-show">Hold preview</button><button id="screen-close">Close</button></div><p id="screen-status" role="status">${esc(status|| (showing?'Loading preview…':'Preview closed'))}</p>
  ${screen==='base'?'<p>Use Scene to edit the background, reels and title. This view holds the base game without starting a round.</p>':`
  <label>Element<select id="screen-part">${options(Object.fromEntries(Object.entries(SCREEN_PARTS[screen].parts).map(([k,s])=>[k,s[0]])),part)}</select></label>
  ${screen==='counter'?'<p class="muted">Artwork only leaves the text size unchanged. Whole hand + text moves or scales everything together.</p>':''}
  ${Object.entries(FIELDS).filter(([k])=>k!=='fontSize'||text).map(([k,f])=>{const n=Math.round(v[k]*(f.factor||1)*100)/100;return `<div class="screen-adjustment"><label for="screen-number-${k}">${f.label}</label><input id="screen-number-${k}" type="number" data-screen-key="${k}" value="${n}" min="${f.min}" max="${f.max}" step="1"><input type="range" aria-label="${f.label} slider" data-screen-key="${k}" value="${n}" min="${f.range?Math.min(-f.range,n):f.min}" max="${f.range?Math.max(f.range,n):f.max}" step="1"></div>`;}).join('')}
  ${text?`<div class="screen-typography"><label>Font<select data-screen-style="fontFamily">${options(FONTS,v.fontFamily||'')}</select></label><label>Text colour<input data-screen-style="color" type="text" value="${esc(v.color||'')}" placeholder="Original or #ffffff" maxlength="7" pattern="#[0-9a-fA-F]{6}"></label><label>Text alignment<select data-screen-style="textAlign">${options({'':'Original',left:'Left',center:'Centre',right:'Right'},v.textAlign||'')}</select></label>
  ${isCopyPart(screen,part)?`<label>Label wording<textarea data-screen-style="text" maxlength="500" rows="3" placeholder="Leave blank for original wording">${esc(v.text||'')}</textarea></label><p class="muted">Plain text. Blank restores the game's original wording.</p>`:'<p class="muted">Live values stay controlled by the game. You can change their appearance here.</p>'}</div>`:''}
  <button id="screen-reset">Reset this element</button>`}
  <p class="muted">Desktop and Mobile have separate settings. Held counts and winnings are samples; no round is started.</p>`;
 }
 function settingsFor(values,reset=false){const settings=structuredClone(getProject().scenes[getScene()].screens||{});settings[screen]||={};if(reset)delete settings[screen][part];else settings[screen][part]={...settings[screen][part],...values};return settings;}
 function change(values,reset=false){checkEditable();pending=null;commit(applyBatch(getProject(),[{type:'screens',scene:getScene(),values:settingsFor(values,reset)}]),'Adjust '+SCREEN_PARTS[screen].parts[part][0]);}
 // A focused field may not emit change before Ctrl+S, export or pagehide.
 function flush(){if(pending){try{checkEditable();}catch{return;}const values=pending;change(values);}}
 function inputValues(input){if(input.dataset.screenStyle){if(!input.checkValidity())throw Error('Use a six-digit hex colour, or leave it blank.');return {[input.dataset.screenStyle]:input.value};}if(input.value===''||!input.checkValidity())throw Error('Enter a number within the shown limits.');return {[input.dataset.screenKey]:Number(input.value)/(FIELDS[input.dataset.screenKey].factor||1)};}
 host.oninput=e=>{const input=e.target;if(!input.dataset.screenKey&&!input.dataset.screenStyle)return;try{checkEditable();const values=inputValues(input);pending={...pending,...values};if(input.dataset.screenKey)for(const peer of host.querySelectorAll(`[data-screen-key="${input.dataset.screenKey}"]`))if(peer!==input)peer.value=input.value;if(!showing)open();send('screen-adjust',{settings:settingsFor(values)});}catch{pending=null; /* Incomplete input stays local until valid. */ }};
 host.onchange=e=>{try{
  if(e.target.id==='screen-kind'){checkEditable();flush();screen=e.target.value;part=Object.keys(SCREEN_PARTS[screen].parts)[0];render();open();}
  else if(e.target.id==='screen-part'){flush();part=e.target.value;render();}
  else if(['screen-tier','screen-win-tier','screen-guide-page'].includes(e.target.id)){checkEditable();if(e.target.id==='screen-tier')tier=e.target.value;else if(e.target.id==='screen-win-tier')winTier=e.target.value;else guidePage=e.target.value;open();}
  else if(e.target.dataset.screenKey||e.target.dataset.screenStyle)change(inputValues(e.target));
 }catch(e){toast(e.message);render();send('screen-adjust',{settings:getProject().scenes[getScene()].screens||{}});}};
 host.onclick=e=>{try{if(e.target.id==='screen-show')open();if(e.target.id==='screen-close')close();if(e.target.id==='screen-reset')change({},true);}catch(e){toast(e.message);}};
 function feedback(message){status=message;const el=host.querySelector('#screen-status');if(el)el.textContent=status;}
 function open(){checkEditable();showing=true;feedback('Loading preview…');send('screen-preview',{screen,tier,winTier,guidePage:Number(guidePage)});}
 function close(){flush();showing=false;feedback('Preview closed');send('screen-preview',{screen:null});}
 return {render,close,open,feedback,flush};
}
