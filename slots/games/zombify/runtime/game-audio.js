import {loadBytes} from './asset-cache.js';
import {AUDIO_ASSETS,AUDIO_CUES} from './audio-manifest.js?v=117';

// Recorded gameplay audio and approved shared win tracks. No outcome changes.
export function createGameAudio({env=globalThis,doc=env.document,assets=AUDIO_ASSETS,cues=AUDIO_CUES,
  createContext=()=>new (env.AudioContext||env.webkitAudioContext)({latencyHint:'interactive'}),onError=()=>{}}={}) {
  const originalAssets={...assets},originalCues=structuredClone(cues);assets={...assets};cues=structuredClone(cues);
  let soundSettings={},configuration='';
  const clamp=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
  let levels={music:.38,effects:.75};
  try{const saved=JSON.parse(env.localStorage?.getItem('zombify-audio-levels')||'null');if(saved)levels={music:clamp(saved.music,.38),effects:clamp(saved.effects,.75)};}catch{}
  let ctx=null,master=null,fxBus=null,musicBus=null,duckBus=null,teaseBus=null,focusBus=null,focused=false,enabled=false,disposed=false,scene='base';
  let revision=0,currentMusic=null,reported=false;
  const buffers=new Map(),loads=new Map(),voices=new Set(),musicVoices=new Set(),lastCue=new Map(),variants=new Map(),positions={base:0,bonus:0};
  const audible=()=>enabled&&!disposed&&!doc?.hidden&&ctx?.state==='running';
  const report=()=>{if(!reported){reported=true;onError();}};
  function ramp(param,value,seconds=.04){
    const now=ctx.currentTime;
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
    else{param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);}
    param.linearRampToValueAtTime(value,now+seconds);
  }
  function setup(){
    if(ctx)return;
    ctx=createContext();master=ctx.createGain();fxBus=ctx.createGain();musicBus=ctx.createGain();duckBus=ctx.createGain();
    const compressor=ctx.createDynamicsCompressor();
    compressor.threshold.value=-8;compressor.knee.value=8;compressor.ratio.value=6;compressor.attack.value=.003;compressor.release.value=.18;
    master.gain.value=.85;fxBus.gain.value=levels.effects;musicBus.gain.value=levels.music;duckBus.gain.value=1;
    // Anticipation swells ride their own bus so they can dip under the cues that
    // matter; focus lowers the music a little while a tease plays.
    teaseBus=ctx.createGain();teaseBus.connect(fxBus);focusBus=ctx.createGain();focusBus.gain.value=focused?FOCUS:1;
    fxBus.connect(master);musicBus.connect(focusBus);focusBus.connect(duckBus);duckBus.connect(master);master.connect(compressor);compressor.connect(ctx.destination);
  }
  async function load(key){
    if(disposed||!ctx||!assets[key])return null;
    if(buffers.has(key))return buffers.get(key);
    if(!loads.has(key)){
      const url=assets[key];
      loads.set(key,(async()=>{
        try{
          const bytes=(await loadBytes(url,env)).slice(0);if(disposed)return null;
          const buffer=await ctx.decodeAudioData(bytes);
          if(!disposed&&assets[key]===url)buffers.set(key,buffer);
          return disposed||assets[key]!==url?null:buffer;
        }catch{if(!disposed)report();return null;}
        finally{if(assets[key]===url)loads.delete(key);}
      })());
    }
    return loads.get(key);
  }
  function prepare(){return enabled&&ctx?Promise.all(Object.keys(assets).filter(key=>levels.music>0||!key.startsWith('music-')).map(load)):Promise.resolve();}
  function warmEffects(){return Promise.all([...new Set(Object.values(cues).flatMap(c=>c.files))].map(load));}
  function release(voice,fade=.015){
    if(voice.stopping)return;voice.stopping=true;
    try{ramp(voice.gain.gain,0,fade);voice.source.stop(ctx.currentTime+fade+.005);}catch{}
  }
  function stopEffects(fade=.015){
    for(const voice of voices)release(voice,fade);voices.clear();lastCue.clear();
    if(duckBus){duckBus.gain.cancelScheduledValues(ctx.currentTime);ramp(duckBus.gain,1,.1);}
  }
  // Ends one cue's voices (an anticipation swell when its reel lands).
  function stopCue(name,fade=.09){
    if(!ctx)return;
    for(const voice of [...voices])if(voice.name===name){release(voice,fade);voices.delete(voice);}
  }
  function focus(on){
    focused=!!on;if(!focusBus)return;
    ramp(focusBus.gain,focused?FOCUS:1,focused?.25:.45);
  }
  function stopMusic(fade=0){
    if(currentMusic){positions[currentMusic.scene]=(currentMusic.offset+ctx.currentTime-currentMusic.started)%currentMusic.source.buffer.duration;currentMusic=null;}
    for(const voice of musicVoices)release(voice,fade);
  }
  async function refreshMusic(){
    const ticket=++revision,wanted=scene;
    if(!audible()||!levels.music){stopMusic(.04);return;}
    if(currentMusic?.scene===wanted&&!currentMusic.stopping)return;
    const buffer=await load('music-'+wanted);
    if(ticket!==revision||!buffer||!audible()||!levels.music||scene!==wanted)return;
    try{
      const settings=soundSettings['music-'+wanted]||{},fade=settings.fade??.9;
      stopMusic(fade);
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=settings.loop!==false;
      source.loopStart=0;source.loopEnd=buffer.duration;gain.gain.value=0;source.connect(gain);gain.connect(musicBus);
      const offset=(positions[wanted]||0)%buffer.duration;
      const voice={source,gain,scene:wanted,offset,started:ctx.currentTime,stopping:false};
      source.onended=()=>{musicVoices.delete(voice);source.disconnect();gain.disconnect();if(currentMusic===voice)currentMusic=null;};
      musicVoices.add(voice);currentMusic=voice;source.start(ctx.currentTime,offset);ramp(gain.gain,settings.volume??1,fade);
      // Load the alternate arrangement after playback starts; no gameplay wait.
      void load('music-'+(wanted==='base'?'bonus':'base'));
    }catch{report();}
  }
  const FOCUS=.68;
  function duckTease(){
    const now=ctx.currentTime;ramp(teaseBus.gain,.4,.02);teaseBus.gain.setValueAtTime(.4,now+.37);teaseBus.gain.linearRampToValueAtTime(1,now+.67);
  }
  function duck(seconds){
    const now=ctx.currentTime;duckBus.gain.cancelScheduledValues(now);duckBus.gain.setValueAtTime(duckBus.gain.value,now);
    duckBus.gain.linearRampToValueAtTime(.46,now+.03);duckBus.gain.setValueAtTime(.46,now+seconds);
    duckBus.gain.linearRampToValueAtTime(1,now+seconds+.45);
  }
  function play(name,{pan=0,intensity=1,rate=1}={}){
    const cue=cues[name];if(!cue||!audible()||!levels.effects)return false;
    const now=ctx.currentTime;if(now-(lastCue.get(name)??-Infinity)<cue.gap)return false;
    const previous=variants.get(name)??-1,index=(previous+1)%cue.files.length,key=cue.files[index],buffer=buffers.get(key);
    if(!buffer){void load(key);return false;} // Never replay a contact after it has passed.
    try{
      variants.set(name,index);lastCue.set(name,now);
      while(voices.size>=16){const oldest=voices.values().next().value;release(oldest);voices.delete(oldest);}
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
      source.playbackRate.value=(['bite','step','stop'].includes(name)?1+(index-1)*.025:1)*Math.max(.5,Math.min(2,Number.isFinite(rate)?rate:1));
      gain.gain.value=cue.gain*Math.max(.5,Math.min(1.12,intensity));source.connect(gain);
      let panner=null;
      const bus=name==='tease'?teaseBus:fxBus;
      if(ctx.createStereoPanner){panner=ctx.createStereoPanner();panner.pan.value=Math.max(-.6,Math.min(.6,pan));gain.connect(panner);panner.connect(bus);}else gain.connect(bus);
      const voice={name,source,gain,panner,stopping:false};voices.add(voice);
      source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();panner?.disconnect();};
      const fade=soundSettings[name]?.fade||0;
      if(fade){const duration=buffer.duration/source.playbackRate.value,edge=Math.min(fade,duration/2),peak=gain.gain.value;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(peak,now+edge);gain.gain.setValueAtTime(peak,now+duration-edge);gain.gain.linearRampToValueAtTime(0,now+duration);}
      source.start();if(cue.duck)duck(cue.duck);
      if(name!=='tease'&&(cue.duck||name==='vial'||name==='tease-up'))duckTease();
      return true;
    }catch{report();return false;}
  }
  async function setEnabled(value){
    if(disposed)return false;enabled=!!value;++revision;
    if(!enabled){stopEffects();stopMusic(.03);return false;}
    try{
      setup();await ctx.resume();if(!enabled||disposed)return false;
      void prepare();void refreshMusic();return true;
    }catch{enabled=false;report();return false;}
  }
  function setScene(value){
    const next=value==='bonus'?'bonus':'base';if(next===scene)return;
    scene=next;if(next==='bonus')positions.bonus=0;void refreshMusic();
  }
  function setLevel(channel,value){
    if(!['music','effects'].includes(channel))return;
    levels[channel]=clamp(Number(value),levels[channel]);
    try{env.localStorage?.setItem('zombify-audio-levels',JSON.stringify(levels));}catch{}
    if(!ctx)return;
    ramp((channel==='music'?musicBus:fxBus).gain,levels[channel]);
    if(channel==='music')void refreshMusic();else if(!levels.effects)stopEffects();
  }
  async function visibility(){
    ++revision;if(!ctx)return;
    if(doc.hidden){stopEffects();stopMusic(0);try{await ctx.suspend();}catch{}return;}
    if(enabled&&!disposed){try{await ctx.resume();if(enabled&&!disposed)void refreshMusic();}catch{}}
  }
  function pagehide(event){if(event.persisted){++revision;stopEffects();stopMusic(0);void ctx?.suspend().catch(()=>{});}else destroy();}
  function pageshow(){if(enabled)void visibility();}
  function destroy(){
    if(disposed)return;disposed=true;enabled=false;++revision;stopEffects();stopMusic(0);buffers.clear();
    doc?.removeEventListener('visibilitychange',visibility);env.removeEventListener?.('pagehide',pagehide);env.removeEventListener?.('pageshow',pageshow);
    void ctx?.close().catch(()=>{});
  }
  doc?.addEventListener('visibilitychange',visibility);env.addEventListener?.('pagehide',pagehide);env.addEventListener?.('pageshow',pageshow);
  function configure(settings={},uploads=[]){
    const signature=JSON.stringify([settings,uploads.map(a=>[a.id,a.src])]);if(signature===configuration)return;
    configuration=signature;const nextAssets={...originalAssets},nextCues=structuredClone(originalCues);
    for(const [name,setting] of Object.entries(settings)){
      const upload=uploads.find(a=>a.id===setting.assetId);
      if(name==='music-base'||name==='music-bonus'){if(upload)nextAssets[name]=upload.src;}
      else if(nextCues[name]){if(upload){const key='studio-'+name;nextAssets[key]=upload.src;nextCues[name].files=[key];}nextCues[name].gain*=setting.volume??1;}
    }
    ++revision;if(ctx){stopEffects();stopMusic(0);}
    for(const key of new Set([...Object.keys(assets),...Object.keys(nextAssets)]))if(assets[key]!==nextAssets[key]){buffers.delete(key);loads.delete(key);}
    assets=nextAssets;cues=nextCues;soundSettings=structuredClone(settings);positions.base=positions.bonus=0;
    if(enabled){void prepare();void refreshMusic();}
  }
  return {configure,play,stopCue,focus,setEnabled,setLevel,setScene,stopEffects,destroy,warmEffects,prepare,
    read:()=>({enabled,scene,levels:{...levels},activeEffects:voices.size,activeMusic:[...musicVoices].filter(v=>!v.stopping).length,loaded:buffers.size,
      teasing:[...voices].filter(v=>v.name==='tease'&&!v.stopping).length,focused})};
}
