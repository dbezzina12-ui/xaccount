// Prepared presentation adapter. A mounted renderer supplies its skeleton/state.
// Owns neither outcomes nor wallet state. Call update(dt) from one renderer ticker.
const abortError=()=>new DOMException('Animation canceled.','AbortError');
export function createFeatureDriver({skeleton,state,physicsNone=0,onEvent=()=>{},afterApply=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let pending=null,disposed=false;
 const reset=()=>{state.clearTracks();skeleton.setupPose();afterApply(skeleton);skeleton.updateWorldTransform(physicsNone);};
 function play(name,{speed=1,signal,onCue=()=>{},timeoutMs}={}){
  if(disposed||signal?.aborted)return Promise.reject(abortError());
  if(pending)return Promise.reject(Error('A feature animation is already playing.'));
  const animation=skeleton.data.findAnimation(name);
  if(!animation)return Promise.reject(Error(`Missing feature animation: ${name}`));
  if(!Number.isFinite(speed)||speed<=0||speed>4)return Promise.reject(Error('Speed must be greater than zero and at most 4.'));
  reset();
  return new Promise((resolve,reject)=>{
   let done=false,timer;const seen=new Set();
   const finish=error=>{if(done)return;done=true;pending=null;clearTimer(timer);signal?.removeEventListener('abort',cancel);if(error){reset();reject(error);}else resolve({clip:name,events:[...seen]});};
   const cancel=()=>finish(abortError());pending=cancel;
   const entry=state.setAnimation(0,name,false);entry.timeScale=speed;
   entry.listener={event:(_,event)=>{if(done)return;const key=`${event.data.name}@${event.time}`;if(seen.has(key))return;seen.add(key);try{onCue(event.data.name,event);onEvent(event.data.name,event);}catch(error){finish(error);}},complete:()=>finish(),interrupt:cancel,dispose:()=>{if(!done)cancel();}};
   signal?.addEventListener('abort',cancel,{once:true});
   timer=setTimer(()=>finish(Error(`Animation deadline exceeded: ${name}`)),timeoutMs??Math.max(1500,animation.duration/speed*1000+1500));
  });
 }
 return {play,update(dt){if(disposed)return;if(!Number.isFinite(dt)||dt<0)throw Error('Invalid animation delta.');state.update(dt);state.apply(skeleton);afterApply(skeleton);skeleton.updateWorldTransform(physicsNone);},cancel(){pending?.();reset();},dispose(){if(disposed)return;disposed=true;pending?.();reset();}};
}

// Preload before opening. Synchronous marker callbacks only; start media playback
// inside the host's already-unlocked audio/video session. Promise failures propagate.
export async function presentVsOpening({driver,prepareReveal,showReveal,startDuel,expandReel,signal,instant=false,speed=1}){
 if(signal?.aborted)throw abortError();
 await prepareReveal({signal});
 if(signal?.aborted)throw abortError();
 const called=new Set();const once=(name,fn)=>{if(!called.has(name)){called.add(name);fn();}};
 if(instant){once('show',showReveal);once('expand',expandReel);return {skipped:true};}
 await driver.play('open',{signal,speed,onCue:name=>{
  if(name==='vs_release')once('show',showReveal);
  if(name==='vs_reveal')once('duel',startDuel);
  if(name==='vs_expand')once('expand',expandReel);
 }});
 // Protect the reveal against accidental removal of a marker during editor work.
 once('show',showReveal);once('expand',expandReel);once('duel',startDuel);
 return {skipped:false};
}

export function createEnvironmentDriver({skeleton,state,physicsNone=0,reducedMotion=false,prewarmSeconds=12}){
 if(!Number.isFinite(prewarmSeconds)||prewarmSeconds<0)throw Error('Invalid environment prewarm.');
 let paused=false,disposed=false,reduced=!!reducedMotion;
 function restart(){state.clearTracks();skeleton.setupPose();state.setAnimation(0,reduced?'still':'ambient',true);if(!reduced)state.update(prewarmSeconds);state.apply(skeleton);skeleton.updateWorldTransform(physicsNone);}
 restart();
 return {
  update(dt){if(disposed||paused||reduced)return;state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform(physicsNone);},
  setVisible(visible){paused=!visible;},
  setReducedMotion(value){if(disposed)return;reduced=!!value;restart();},
  flash(side){if(disposed||paused||reduced)return;if(!['left','right'].includes(side))throw Error('Expected left or right.');state.setAnimation(1,`shot_${side}`,false);state.addEmptyAnimation(1,.02,0);},
  dispose(){disposed=true;state.clearTracks();skeleton.setupPose();}
 };
}
