import {gameReady} from './game-ready.js?v=125';
import {loadImage} from './asset-cache.js';
import {createGuideDemo} from './guide-demo.js';
import {mountMascot} from './subway-mascot.js';
import {createGuideNavigation} from './guide-navigation.js';
import {TOWN_ART} from './scene-character-art.js?v=125';

const welcome=document.getElementById('welcome');
const pages=Object.fromEntries(['studio','guide'].map(name=>[name,document.getElementById(`${name}-page`)]));
const root=document.documentElement;
const demo=createGuideDemo();
const guide=createGuideNavigation({cards:[...document.querySelectorAll('.guide-card')],dots:[...document.querySelectorAll('[data-guide-page]')],previous:document.getElementById('guide-previous'),next:document.getElementById('guide-next'),counter:document.getElementById('guide-page-count'),mobile:matchMedia('(max-width: 759px)'),onVisibilityChange:indices=>demo.show(indices)});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let studioTimer=null,studioEpoch=0,introMascot=null;
const playButton=document.getElementById('guide-play');
const loadingStatus=document.createElement('span');loadingStatus.className='loading-status';loadingStatus.setAttribute('role','status');
document.querySelector('.guide-actions').prepend(loadingStatus);
gameReady.subscribe(state=>{
 playButton.disabled=state.status==='loading'||state.status==='idle';
 if(state.status==='ready')playButton.innerHTML='<span class="continue-desktop">CLICK TO CONTINUE</span><span class="continue-mobile">TAP TO PLAY</span>';
 else playButton.textContent=state.status==='error'?'RETRY LOADING':'LOADING…';
 loadingStatus.hidden=state.status==='ready';
 loadingStatus.textContent=state.status==='ready'?'':state.status==='error'?'Some files could not load. Check your connection and retry.':`Preparing game · ${Math.round(state.loaded/state.total*100)}%`;
 welcome.setAttribute('aria-busy',String(state.status==='loading'));
});

async function prepareTown(){
  const portrait=matchMedia('(max-aspect-ratio: 1/1)').matches;
  await loadImage(TOWN_ART[portrait?'portrait':'desktop'].image);
  root.dataset.townReady='true';
}
void prepareTown().catch(()=>{});
function stopStudio(){
  introMascot?.stop();introMascot=null;
  studioEpoch++;clearTimeout(studioTimer);
  pages.studio.classList.remove('ident-ready');
}
async function startStudio(){
  stopStudio();const token=studioEpoch;
  const source=document.getElementById('studio-logo-source');
  try{await Promise.all([loadImage(source.getAttribute('src')),prepareTown()]);}catch{if(token===studioEpoch)show('guide');return;}
  if(token!==studioEpoch||root.dataset.entry!=='studio'||document.hidden)return;
  const host=document.getElementById('studio-walker');
  const mascot=await mountMascot(host,{mode:'wave'});
  if(token!==studioEpoch||root.dataset.entry!=='studio'||document.hidden){mascot?.stop();return;}
  introMascot=mascot;
  pages.studio.classList.add('ident-ready');
  studioTimer=setTimeout(()=>{if(token===studioEpoch)show('guide');},reduced.matches?1800:3950);
}
function show(page){
  stopStudio();guide.close();root.dataset.entry=page;
  for(const [name,element] of Object.entries(pages))element.hidden=name!==page;
  welcome.setAttribute('aria-labelledby',{studio:'studio-title',guide:'guide-title'}[page]);
  if(!welcome.open)welcome.showModal();
  document.getElementById({studio:'studio-title',guide:'guide-play'}[page]).focus({preventScroll:true});
  if(page==='studio')void startStudio().catch(()=>{if(root.dataset.entry==='studio')show('guide');});
  if(page==='guide')void gameReady.ensure().then(()=>{if(root.dataset.entry==='guide')guide.open();}).catch(()=>{});
}
async function finish(){
  try{await gameReady.ensure();}catch{return;}
  if(!welcome.open)return;
  stopStudio();guide.close();demo.stop();delete root.dataset.entry;
  welcome.close();const mobile=document.getElementById('mobile-controller');
  (getComputedStyle(mobile).display!=='none'?mobile.shadowRoot.getElementById('play'):document.getElementById('spin')).focus({preventScroll:true});
}
document.getElementById('guide-play').addEventListener('click',finish);
document.getElementById('quick-guide').addEventListener('click',()=>{
  document.getElementById('settings').close();show('guide');
});
welcome.addEventListener('cancel',event=>{
  event.preventDefault();
  if(root.dataset.entry==='studio')show('guide');else finish();
});
document.addEventListener('visibilitychange',()=>{
  if(root.dataset.entry==='studio'){
    if(document.hidden)stopStudio();else void startStudio();
  }
});
reduced.addEventListener('change',()=>{if(root.dataset.entry==='studio')void startStudio();});
window.addEventListener('pagehide',()=>{stopStudio();demo.stop();});
window.addEventListener('pageshow',event=>{if(event.persisted&&root.dataset.entry)show(root.dataset.entry);});
show('studio');
