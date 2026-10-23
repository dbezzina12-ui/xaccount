import {WIN_TIERS,createWinCountup} from './win-tiers.js';
import {createWinZombie,warmWinZombie} from './win-zombie.js';
import {createWinMotion} from './win-motion.js';

export function createWinCelebration({dialog,format,playSound,stopSound,reduced=false,onChange=()=>{},env=globalThis,doc=env.document,createArtist=createWinZombie}){
 if(createArtist===createWinZombie)void warmWinZombie();
 const $=name=>dialog.querySelector('[data-win-'+name+']');
 const title=$('title'),amount=$('amount'),context=$('context'),multiple=$('multiple'),button=$('skip'),status=$('status');
 let active=null,serial=0,disposed=false;
 function close(){
  if(!active)return;const state=active;active=null;++serial;
  if(state.raf!==null)env.cancelAnimationFrame(state.raf);
  if(state.timer!==null)env.clearTimeout(state.timer);
  state.artist?.destroy();state.motion?.destroy();stopSound();
  if(dialog.open)dialog.close();onChange();state.resolve(true);
 }
 function update(state,delta=0){
  const value=state.counter.read();amount.textContent=format(value.amount);
  dialog.dataset.complete=String(value.completed);
  state.motion?.update(value.progress,delta,{completed:value.completed,skipped:state.skipped});
  button.textContent=value.completed?'CONTINUE':'SKIP COUNT-UP';
  if(value.completed&&!state.announced){state.announced=true;status.textContent=`${WIN_TIERS[state.tier].label}. ${format(value.total)}. ${state.scope}.`;}
  state.artist?.draw(state.tier,state.skipped?WIN_TIERS[state.tier].pose:value.progress);
  return value;
 }
 function skip(){
  if(!active)return false;
  active.skipped=true;active.counter.skip();stopSound();const value=update(active);if(value.finished)close();return true;
 }
 function click(event){if(event.target.closest?.('[data-win-skip]')||event.target===dialog)skip();}
 function key(event){if(!active||!['Space','Enter','Escape'].includes(event.code))return;event.preventDefault();event.stopPropagation();if(!event.repeat)skip();}
 function cancel(event){event.preventDefault();skip();}
 dialog.addEventListener('click',click);dialog.addEventListener('keydown',key);dialog.addEventListener('cancel',cancel);
 const pagehide=()=>close();env.addEventListener?.('pagehide',pagehide);
 const visibility=()=>{dialog.dataset.motionPaused=String(!!doc.hidden);if(active)active.last=env.performance.now();};
 doc.addEventListener?.('visibilitychange',visibility);
 return {
  show({tier,amount:cents,units,scope='SPIN WIN',preview=false,speed='normal',shouldSkip=()=>false}){
   if(disposed||!WIN_TIERS[tier])return Promise.resolve(false);
   close();const config=WIN_TIERS[tier],ticket=++serial;
   return new Promise(resolve=>{
    const state={tier,scope,counter:createWinCountup({tier,amount:cents,speed,reduced}),resolve,raf:null,timer:null,artist:null,motion:null,last:env.performance.now(),announced:false,skipped:false};
    active=state;visibility();dialog.dataset.tier=tier;dialog.dataset.reduced=String(reduced);dialog.dataset.preview=String(preview);
    title.textContent=config.label;context.textContent=preview?'PREVIEW · NO BALANCE CHANGE':scope;
    amount.style.setProperty('--win-number-scale',Math.min(1,9/format(Math.round(cents)).length));
    multiple.textContent=`${(units/100).toLocaleString('en-US',{maximumFractionDigits:2})}× BET`;status.textContent='';
    try{
     state.motion=createWinMotion(dialog,{tier,reduced});
     dialog.showModal();button.focus({preventScroll:true});onChange();
     try{state.artist=createArtist($('canvas'),$('fallback'),{reduced});}catch{}
     // Presentation speed must never pitch-shift the approved musical track.
     update(state);playSound(config.cue,{rate:1});
    }catch{close();return;}
    function frame(now){
     if(active!==state||ticket!==serial)return;state.raf=null;state.timer=null;
     const delta=(now-state.last)/1000;state.last=now;
     if(doc.hidden){state.timer=env.setTimeout(()=>frame(env.performance.now()),100);return;}
     if(shouldSkip()&&!state.counter.read().completed){state.skipped=true;state.counter.skip();stopSound();}
     const value=state.counter.advance(delta);
     try{update(state,delta);}catch{state.artist?.destroy();state.artist=null;}
     if(value.finished){close();return;}
     state.raf=env.requestAnimationFrame(frame);
    }
    state.raf=env.requestAnimationFrame(frame);
   });
  },
  skip,cancel:close,read:()=>({active:!!active,tier:active?.tier||null}),
  destroy(){disposed=true;close();dialog.removeEventListener('click',click);dialog.removeEventListener('keydown',key);dialog.removeEventListener('cancel',cancel);env.removeEventListener?.('pagehide',pagehide);doc.removeEventListener?.('visibilitychange',visibility);}
 };
}
