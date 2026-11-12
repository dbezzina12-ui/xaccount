// Spine 4.3 adapter. Owns presentation only; never selects a result or alters a wallet.
import {applyAim} from './aim.mjs';
const aborted=()=>new DOMException('Animation canceled.','AbortError');
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function createActorDriver({skeleton,state,manifest,physicsNone=0,onEvent=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let destroyed=false,pending=null,target=null,busy=false,active=null,cues=[],transition=null;
 for(const n of ['idle','draw','shoot','holster','hit','duel_win','duel_lose'])if(!skeleton.data.findAnimation(n))throw Error(`Missing Spine animation: ${n}`);
 for(const n of ['shoot_upper','shoot_forearm','revolver','muzzle'])if(!skeleton.findBone(n)?.pose)throw Error(`Missing Spine 4.3 bone: ${n}`);
 state.setAnimation(0,'idle',true);
 function clip(name,{speed=1,signal,onCue=()=>{}}={}){
  if(destroyed||signal?.aborted)return Promise.reject(aborted());
  return new Promise((resolve,reject)=>{
   let done=false,timer,canceled=false;
   const finish=(error)=>{if(done)return;done=true;canceled=!!error;clearTimer(timer);signal?.removeEventListener('abort',cancel);pending=null;error?reject(error):resolve();};
   const cancel=()=>finish(aborted());pending=cancel;
   const entry=state.setAnimation(1,name,false);entry.timeScale=speed;if(name==='aim_mid'||name==='shoot')entry.mixDuration=.08;active={name,entry};
   entry.listener={event:(_,event)=>{if(done||signal?.aborted||destroyed)return;cues.push(()=>{if(canceled||signal?.aborted||destroyed)return;try{onCue(event.data.name,event);onEvent(event.data.name,event);}catch(error){finish(error);}});},complete:()=>finish(),interrupt:cancel,dispose:()=>{if(!done)cancel();}};
   signal?.addEventListener('abort',cancel,{once:true});
   const duration=skeleton.data.findAnimation(name).duration;
   timer=setTimer(()=>finish(Error(`Animation deadline exceeded: ${name}`)),Math.max(1200,duration/speed*1000+1200));
  });
 }
 const idle=()=>{target=null;active=null;cues=[];transition=null;if(!destroyed)state.setEmptyAnimation(1,.12);};
 const driver={
  manifest,
  // Call once AFTER state.apply and the first world-transform update, every frame.
  updateAim(){
   if(destroyed)return;
   if(target&&active){
    const {name,entry}=active,time=entry.trackTime,duration=entry.animation.duration;
    const mix=name==='draw'?smooth(time/duration):name==='holster'?1-smooth(time/duration):(name==='shoot'||name==='aim_mid')?1:0;
    // Preserve the artist's keyed gun recoil relative to the first shoot pose.
    const wristDriven=manifest.aimDriver==='wrist',gun=skeleton.findBone(wristDriven?'shoot_hand':'revolver');
    const recoil=name==='shoot'?gun.pose.rotation-gun.data.setupPose.rotation-(wristDriven?manifest.shootWristBaseOffset:manifest.shootGunBaseOffset):0;
    const blend=transition&&name==='aim_mid'?smooth(time/duration):1;
    const point=transition?{x:transition.x+(target.x-transition.x)*blend,y:transition.y+(target.y-transition.y)*blend}:target;
    if(mix>0)applyAim(skeleton,point,manifest,physicsNone,{mix,recoil});
   }
   const ready=cues;cues=[];for(const cue of ready)cue();
  },
  muzzle(){const p=skeleton.findBone('muzzle').appliedPose;return {x:p.worldX,y:p.worldY,angle:Math.atan2(p.c,p.a)};},
  async shootAt(point,options={}){
   const result=await driver.shootSequence([point],options);
   const {firedCount,...rest}=result;return {fired:firedCount>0,...rest};
  },
  async shootSequence(points,{speed=1,signal,onShot=()=>{},retargetSeconds=.32}={}){
   if(busy)throw Error('Sequence actor shots; do not overlap them.');
   if(!Array.isArray(points)||points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))throw Error('Invalid aim target.');
   if(!(speed>0&&speed<=4))throw Error('Animation speed must be between 0 and 4.');
   if(!(retargetSeconds>=.12&&retargetSeconds<=2))throw Error('Retarget duration must be between .12 and 2 seconds.');
   if(!points.length)return {firedCount:0};
   const targets=points.map(p=>({x:p.x,y:p.y}));
   busy=true;let firedCount=0;
   try{
    target=targets[0];await clip('draw',{speed,signal});
    for(let index=0;index<targets.length;index++){
     if(index){
      transition=target;target=targets[index];
      const hold=skeleton.data.findAnimation('aim_mid').duration;
      await clip('aim_mid',{speed:hold/retargetSeconds*speed,signal});transition=null;
     }
     let fired=false;
     await clip('shoot',{speed,signal,onCue:name=>{
      if(name==='shot'&&!fired){fired=true;firedCount++;onShot({actor:manifest.name,index,target:{...target},muzzle:driver.muzzle()});}
     }});
    }
    await clip('holster',{speed,signal});return {firedCount};
   }catch(error){if(error.name==='AbortError')return {firedCount,canceled:true};return {firedCount,error};}
   finally{busy=false;idle();}
  },
  async react(name,{signal}={}){if(busy||destroyed)return;busy=true;try{await clip(name,{signal});}finally{busy=false;idle();}},
  cancel(){pending?.();idle();},
  dispose(){destroyed=true;pending?.();state.clearTracks();target=null;active=null;cues=[];}
 };
 return driver;
}
