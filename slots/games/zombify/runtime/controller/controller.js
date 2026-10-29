// Gamboligy Controller v2 — presentation only; games own play and settlement.
export const CONTROLLER_VERSION='3.3.0';
export const MOBILE_LAYOUT_QUERY='(max-width:760px), (pointer:coarse) and (hover:none)';
const svg=(body,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const icons={
 play:svg('<path d="M18 18.7A9 9 0 1 1 21 12" fill="none" stroke="currentColor" stroke-width="2.7"/><path d="M16.5 10.8h7L20 16.3z"/>','play-icon'),
 continue:svg('<path d="m8 4 13 8-13 8z"/>','continue-icon'),
 stop:svg('<rect x="6" y="6" width="12" height="12" rx="2"/>','stop-icon'),
 turbo:svg('<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>'),
 sound:svg('<path d="M4 9v6h4l5 4V5L8 9zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"/><path class="sound-slash" d="M3 3l18 18"/>'),
 settings:svg('<path d="M3 5h18M3 12h18M3 19h18"/>'),
 auto:svg('<path d="M20.5 10a8.5 8.5 0 1 0-1.6 7.4M20.5 4.5V10H15"/><path d="m10 8 6 4-6 4z" fill="currentColor" stroke="none"/>','auto-icon'),
 minus:svg('<path d="m6 9 6 6 6-6"/>'),plus:svg('<path d="m6 15 6-6 6 6"/>')
};
export const controllerMarkup=()=>`<div class="controller" data-phase="idle">
 <div id="banner" class="feature-banner" hidden></div>
 <div class="deck">
  <button id="buy" class="buy-button" type="button" data-action="buy" aria-label="Buy bonus"><img class="buy-brand" src="${new URL('../assets/studio-gg-diagonal.png',import.meta.url).href}" alt="" aria-hidden="true" draggable="false"><span id="buyLabel">BUY<br><b>BONUS</b></span></button>
  <div class="utility-left"><button id="settings" class="utility settings" type="button" data-action="settings" aria-label="Settings" aria-haspopup="dialog">${icons.settings}<span class="control-label" aria-hidden="true">MENU</span></button><button id="turbo" class="utility turbo mobile-shortcut" type="button" data-action="turbo" aria-label="Enable turbo" aria-pressed="false">${icons.turbo}<span class="control-label" aria-hidden="true">TURBO</span></button></div>
  <div class="money-row">
  <div class="account-readouts"><div class="money balance"><span>BALANCE</span><strong id="balance">$0.00</strong></div>
  <div id="winReadout" class="money win"><span>WIN</span><strong id="win">$0.00</strong></div></div>
  <div id="betGroup" class="bet-group">
   <button id="betPicker" class="money bet" type="button" data-action="bet" aria-label="Change bet" aria-haspopup="dialog"><span>BET</span><strong id="bet">$1.00</strong></button>
   <div id="betSteps" class="bet-steps"><button id="betPlus" class="bet-step plus" type="button" data-action="betPlus" aria-label="Increase bet">${icons.plus}</button><button id="betMinus" class="bet-step minus" type="button" data-action="betMinus" aria-label="Decrease bet">${icons.minus}</button></div>
  </div></div>
  <div id="playControls" class="play-controls">
  <button id="play" class="play-button" type="button" data-action="play" aria-label="Play" disabled>${icons.play}${icons.stop}${icons.continue}</button></div>
  <div class="utility-right"><button id="sound" class="utility sound mobile-shortcut" type="button" data-action="sound" aria-label="Mute sound" aria-pressed="true">${icons.sound}</button><button id="auto" class="utility auto" type="button" data-action="auto" aria-label="Autoplay" aria-pressed="false">${icons.auto}${icons.stop}<span class="control-label" aria-hidden="true">AUTO</span><span id="remaining" hidden></span></button></div>
 </div>
</div>`;
const mobileIcons={
 play:svg('<path d="m8 4 13 8-13 8z"/>','play-icon'),
 settings:svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
 minus:svg('<path d="M5 12h14"/>'),plus:svg('<path d="M5 12h14m-7-7v14"/>')
};
const defaults={ready:false,busy:false,holding:false,continuing:false,autoActive:false,remaining:0,canDecrease:true,canIncrease:true,turbo:false,muted:false,buyActive:false,featureColor:null,banner:'',balance:'$0.00',bet:'$1.00',win:'$0.00'};
export function controllerView(state){
 const s={...defaults,...state},locked=s.busy||s.autoActive;
 return {...s,phase:s.holding?'holding':s.continuing?'continue':s.busy?'busy':'idle',
  playDisabled:!s.ready||s.holding||(!s.busy&&s.autoActive),
  playLabel:s.holding?'Showing result':s.continuing?'Continue':s.busy?'Stop spin':'Play',
  buyDisabled:!s.ready||locked,betDisabled:!s.ready||locked,settingsDisabled:!s.ready,minusDisabled:locked||!s.canDecrease,plusDisabled:locked||!s.canIncrease,
  turboDisabled:!s.ready,soundDisabled:!s.ready,autoDisabled:!s.ready||(!s.autoActive&&s.busy),autoLabel:s.autoActive?'Stop autoplay':'Autoplay'};
}
export function mountController(host,{onAction=()=>{},initial={},layoutTargets=null,layoutMedia=globalThis.matchMedia?.(MOBILE_LAYOUT_QUERY),buyWord='BUY'}={}){
 if(host.shadowRoot)throw Error('Controller is already mounted');
 const root=host.attachShadow({mode:'open'});
 const mobile=!!layoutMedia?.matches;
 root.innerHTML=`<link id="desktopStyles" rel="stylesheet" href="${new URL('./controller.css?v=3.2.2',import.meta.url).href}" media="${mobile?'not all':'all'}"><link id="mobileBaseStyles" rel="stylesheet" href="${new URL('./controller-mobile-base.css?v=3.2.2',import.meta.url).href}" media="${mobile?'all':'not all'}"><link id="mobileStyles" rel="stylesheet" href="${new URL('./controller-mobile.css?v=mobile-scene-123',import.meta.url).href}" media="${mobile?'all':'not all'}">${controllerMarkup()}`;
 const element=id=>root.getElementById(id),surface=root.querySelector('.controller');
 let state={...defaults,...initial};
 // Move the original controls between layout regions; never remount round state.
 const selectLayout=()=>{
  const layout=layoutMedia?.matches?'mobile':'desktop';
  surface.dataset.layout=host.dataset.layout=layout;
  const mobile=layout==='mobile',art=mobile?mobileIcons:icons;
  element('desktopStyles').media=mobile?'not all':'all';
  element('mobileBaseStyles').media=element('mobileStyles').media=mobile?'all':'not all';
  // Reuse the same buttons: mobile's transport plate owns the +/- controls,
  // desktop's bet section owns them. Rotation never remounts game state.
  const steps=element('betSteps'),stepsParent=element(mobile?'playControls':'betGroup');
  if(steps.parentNode!==stepsParent)stepsParent.appendChild(steps);
  element('play').innerHTML=art.play+icons.stop+icons.continue;
  element('settings').innerHTML=art.settings;
  element('betMinus').innerHTML=art.minus;element('betPlus').innerHTML=art.plus;
  element('winReadout').hidden=false;
  if(layout==='mobile')surface.dataset.buyAnchored='false';
  const target=layoutTargets?.[layout];
  if(target&&host.parentNode!==target){
   const focused=root.activeElement;
   target.appendChild(host);
   focused?.focus({preventScroll:true});
  }
 };
 layoutMedia?.addEventListener('change',selectLayout);
 selectLayout();
 const activate=event=>{
  const button=event.target.closest('button[data-action]');
  if(button&&!button.disabled)onAction(button.dataset.action);
 };
 root.addEventListener('click',activate);
 function update(patch={}){
  state={...state,...patch};const view=controllerView(state);surface.dataset.phase=view.phase;
  surface.dataset.featureActive=String(!!view.featureColor);surface.style.setProperty('--feature-color',view.featureColor||'var(--controller-accent)');
  for(const id of ['balance','bet','win']){element(id).textContent=view[id];element(id).style.setProperty('--digits',String(String(view[id]).length));}
  for(const [id,key] of [['play','playDisabled'],['betPicker','betDisabled'],['buy','buyDisabled'],['settings','settingsDisabled'],['betMinus','minusDisabled'],['betPlus','plusDisabled'],['auto','autoDisabled'],['turbo','turboDisabled'],['sound','soundDisabled']])element(id).disabled=view[key];
  element('betPicker').setAttribute('aria-label',`Change bet, current spin cost ${view.bet}`);
  element('winReadout').hidden=false;
  element('turbo').setAttribute('aria-pressed',String(view.turbo));element('turbo').setAttribute('aria-label',view.turbo?'Disable turbo':'Enable turbo');
  element('sound').setAttribute('aria-pressed',String(!view.muted));element('sound').setAttribute('aria-label',view.muted?'Unmute sound':'Mute sound');element('sound').dataset.muted=String(view.muted);
  element('play').setAttribute('aria-label',view.playLabel);element('auto').setAttribute('aria-label',view.autoLabel);
  element('auto').setAttribute('aria-pressed',String(view.autoActive));
  element('remaining').hidden=!view.autoActive;element('remaining').textContent=String(view.remaining);
  element('buy').setAttribute('aria-label',view.buyActive?'Disable feature spins':'Buy bonus');
  element('buy').dataset.active=String(view.buyActive);
  const buyCopy=view.buyActive?'DISABLE':`${buyWord}<br><b>BONUS</b>`;if(element('buyLabel').innerHTML!==buyCopy)element('buyLabel').innerHTML=buyCopy;
  element('banner').textContent=view.banner;element('banner').hidden=!view.banner;
 }
 // Games may place the same Buy button over their scene. Coordinates are the
 // viewport center/top of the button; null restores the compact bottom layout.
 function setBuyAnchor(anchor=null){
  if(surface.dataset.layout==='mobile')anchor=null;
  surface.dataset.buyAnchored=String(!!anchor);
  if(!anchor)return;
  const deck=root.querySelector('.deck').getBoundingClientRect();
  surface.style.setProperty('--buy-x',`${anchor.x-deck.left}px`);
  surface.style.setProperty('--buy-y',`${anchor.y-deck.top}px`);
  surface.style.setProperty('--buy-size',`${anchor.size||88}px`);
 }
 update();
 return {element,update,setBuyAnchor,get state(){return {...state};},destroy(){layoutMedia?.removeEventListener('change',selectLayout);root.removeEventListener('click',activate);root.replaceChildren();}};
}
