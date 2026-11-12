// One quick draw and one shot. Players are decoded ahead of time and reused;
// moving a prepared element avoids rebuilding a decoder for every reel.
export const DUEL_PLAYBACK_RATE=1.4;
export const DUEL_START_TIMEOUT=4000,DUEL_STALL_TIMEOUT=1500;
export const DUEL_CLIPS=Object.freeze(Object.fromEntries([
 ['hunter','hunter-loses',.65,68/24],['outlaw','outlaw-loses',.85,58/24],
 ['boss','boss-loses',.65,68/24],['bossWin','boss-wins',.85,58/24],
].map(([key,file,shot,duration])=>[key,Object.freeze({src:`./assets/duel-v73/${file}.mp4`,poster:`./assets/duel-v73/${file}-poster.webp?v=74`,duration,shots:[shot]})])));
const players=new Map();let preloadTask;
function configure(video,clip){
 video.className='duel-motion';video.dataset.motion='scene';
 video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=false;video.preload='auto';
 video.poster=clip.poster;video.src=clip.src;
}
export function preloadDuelClips(){
 if(preloadTask)return preloadTask;
 if(!globalThis.document?.createElement)return Promise.resolve();
 preloadTask=Promise.all(Object.values(DUEL_CLIPS).map(clip=>new Promise(resolve=>{
  const video=document.createElement('video');configure(video,clip);players.set(clip.src,{video,leased:false});
  let timer;
  const finish=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',finish);video.removeEventListener('error',finish);resolve();};
  video.addEventListener('loadeddata',finish);video.addEventListener('error',finish);
  timer=setTimeout(finish,1500);video.load();
 })));
 return preloadTask;
}
export function duelCast(duel){
 const top=duel.boss?'boss':duel.fighter==='outlaw'?'outlaw':'hunter';
 return {top,bottom:top==='outlaw'?'hunter':'outlaw',winner:duel.won?'top':'bottom',loser:duel.won?'bottom':'top'};
}
export function duelClip(duel){
 const cast=duelCast(duel),loser=cast[cast.loser];
 const key=cast[cast.winner]==='boss'?'bossWin':loser;
 return {...DUEL_CLIPS[key],loser,rotated:cast.top==='outlaw'};
}
export function createDuelMotion(node,{duel,instant=()=>false}={}){
 const placeholder=node.querySelector('[data-motion="scene"]'),clip=duelClip(duel||{}),entry=players.get(clip.src);
 const leased=entry&&!entry.leased&&typeof placeholder?.replaceWith==='function'?entry:null;
 const video=leased?leased.video:placeholder;
 if(typeof video?.play!=='function')return {prepare:async()=>false,play:async()=>false,stop(){}};
 if(leased){leased.leased=true;placeholder.replaceWith(video);}else configure(video,clip);
 let cancelActive=()=>{},stopped=false;
 const canceled=()=>stopped||instant()||node.isConnected===false;
 function monitor(start,{events=[],timeout,check=()=>false}={}){
  cancelActive();
  return new Promise(resolve=>{
   let done=false,frame=0,timer;
   const finish=value=>{
    if(done)return;done=true;clearTimeout(timer);if(frame)cancelAnimationFrame(frame);
    for(const [name,handler] of listeners)video.removeEventListener(name,handler);
    cancelActive=()=>{};resolve(value);
   };
   const listeners=events.map(([name,value])=>[name,()=>finish(value)]);
   for(const [name,handler] of listeners)video.addEventListener(name,handler);
   cancelActive=()=>finish(false);timer=setTimeout(()=>finish(false),timeout);
   const tick=()=>{if(canceled())finish(false);else if(check(finish))finish(true);else if(!done)frame=requestAnimationFrame(tick);};
   if(canceled()){finish(false);return;}
   frame=requestAnimationFrame(tick);
   try{start(finish);}catch{finish(false);}
  });
 }
 return {
  async prepare(){
   if(canceled())return false;
   try{if(video.currentTime)video.currentTime=0;}catch{}
   // Some mobile browsers defer preload/decode until play(). An undecoded
   // video is playable; readiness must never prevent that first play request.
   if(video.error||video.networkState===3||(video.readyState===0&&!leased))video.load();
   return !canceled();
  },
  async prepareFrame(){
   if(canceled())return false;
   video.pause();video.removeAttribute?.('poster');
   if(video.readyState>=2&&!video.seeking)return true;
   // Some phones decode only after a muted play request. Decode while the
   // pending reel is hidden, pause, and return to frame zero before opening.
   const ready=await monitor(finish=>{
    const start=video.play();start?.then(()=>{if(video.readyState>=2)finish(true);}).catch(()=>finish(false));
   },{events:[['loadeddata',true],['error',false]],timeout:2500,check:()=>video.readyState>=2});
   video.pause();if(!ready||canceled())return false;
   try{if(video.currentTime)video.currentTime=0;}catch{return false;}
   if(video.seeking)return monitor(()=>{},{events:[['seeked',true],['error',false]],timeout:1500,check:()=>!video.seeking});
   return true;
  },
  async play({pace=1,onShot=()=>{}}={}){
   if(canceled())return false;
   let nextShot=0,lastTime=video.currentTime,lastProgress=performance.now(),advancing=false;
   video.playbackRate=Math.max(.25,Math.min(4,DUEL_PLAYBACK_RATE/pace));
   const completed=await monitor(finish=>{
    const started=video.play();started?.catch(()=>finish(false));
   },{events:[['ended',true],['error',false]],timeout:DUEL_START_TIMEOUT+clip.duration*1000/video.playbackRate+DUEL_STALL_TIMEOUT,check:finish=>{
    if(video.currentTime>lastTime){advancing=true;lastTime=video.currentTime;lastProgress=performance.now();}
    else if(performance.now()-lastProgress>(advancing?DUEL_STALL_TIMEOUT:DUEL_START_TIMEOUT)){finish(false);return false;}
    if(nextShot===0&&video.currentTime>=clip.shots[0]){nextShot=1;if(!canceled())onShot(1);}
    return video.ended;
   }});
   video.pause();return completed;
  },
  stop(){
   stopped=true;cancelActive();video.pause();
   if(leased){if(video.parentNode)video.replaceWith(placeholder);try{if(video.readyState>=1)video.currentTime=0;}catch{}leased.leased=false;}
  }
 };
}
