// User-supplied Outlaw Protocol tracks edited into long loops. Quiet rotating
// ambience is baked into each music loop every 30–40 seconds and across its seam.
// Sound never participates in outcome generation.
const KEY='bounty-audio-v1',MAX_VOICES=80;
const MUSIC_LEVELS={base:1,regular:1,super:1,hidden:1},MUSIC_FADE=.32;
const DETAIL_SFX=new Set(['spin-engage','reel-stop-1','reel-stop-2','reel-stop-3','ui-confirm','god-boost','crossfire-arm','coin-up','coin-down']);
// Keep the existing event names. Only these supplied replacements use the new
// pack; unmatched effects and music keep their original files and routing.
export const SUPPLIED_SFX=Object.freeze({
 'nice-win':'nice-win','big-win':'big-win','epic-win':'epic-win','max-win':'max-win',
 'bonus-buy':'buy-bonus-button','coin-up':'coin-up','coin-down':'coin-down',
 'reel-stop-1':'reel-landing-1','reel-stop-2':'reel-landing-2','reel-stop-3':'reel-landing-3',
 'reel-stop-4':'reel-landing-4','reel-stop-5':'reel-landing-5',
 'duel-trigger':'slide-to-open-vs','shot':'space-revolver-version-1','shot-alt':'space-revolver-version-2'
});
export const REVISED_SFX=Object.freeze({
 'coin-up':'coin-up','coin-down':'coin-down','fs-land':'fs-landing',
 'reel-slow-down-1':'reel-slow-down-version-1','reel-slow-down-2':'reel-slow-down-version-2'
});
export const SFX_FILES=[...new Set(["max-win", "multi-increase", "multi-appears", "nice-win", "regular-win", "reload", "shot", "big-win", "bonus-buy", "bonus-trigger", "duel-land", "duel-tease", "duel-trigger", "epic-win", "free-spin-start",...DETAIL_SFX,...Object.keys(SUPPLIED_SFX),...Object.keys(REVISED_SFX)])];
const clamp=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
export class BountyAudio {
 constructor({contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),storage=null,onChange=()=>{},loadMusic=async(context,scene)=>{const response=await fetch(new URL(`./assets/audio/${scene==='base'?'outlaw-base':'outlaw-bonus'}.mp3?v=95`,import.meta.url));if(!response.ok)throw Error('Music could not load');return context.decodeAudioData(await response.arrayBuffer());}}={}){
  this.sfxBuffers=new Map();this.sfxBytes=null;this.sfxDecode=null;this.factory=contextFactory;this.onChange=onChange;this.loadMusic=loadMusic;this.musicBuffers=new Map();this.musicLoads=new Map();this.musicErrors=new Set();this.musicVoice=null;this.trackPositions=new Map();
  this.lastVolumes={music:.55,effects:.75};
  try{this.storage=storage??globalThis.localStorage;const p=JSON.parse(this.storage?.getItem(KEY)||'null');this.settings={enabled:typeof p?.enabled==='boolean'?p.enabled:true,music:clamp(p?.music,.55),effects:clamp(p?.effects,.75)};for(const channel of ['music','effects'])this.lastVolumes[channel]=this.settings[channel]||clamp(p?.lastVolumes?.[channel],this.lastVolumes[channel])||this.lastVolumes[channel];}catch{this.settings={enabled:true,music:.55,effects:.75};}
  this.ctx=null;this.voices=new Set();this.hidden=false;this.scene='base';this.disposed=false;this.unavailable=false;this.shotTake=0;this.slowDownTake=0;
 }
 preloadSfx(){
  if(!this.sfxBytes)this.sfxBytes=Promise.all(SFX_FILES.map(async name=>{try{const file=REVISED_SFX[name]?`revised-v106/${REVISED_SFX[name]}`:SUPPLIED_SFX[name]?`supplied-v105/${SUPPLIED_SFX[name]}`:`${DETAIL_SFX.has(name)?'detail-v103/':''}${name}`;const r=await fetch(new URL(`./assets/audio/sfx/${file}.mp3`,import.meta.url));if(!r.ok)return null;return [name,await r.arrayBuffer()];}catch{return null;}}));
  return this.sfxBytes;
 }
 prepareSfx(){
  if(!this.ctx)return Promise.resolve();
  if(!this.sfxDecode)this.sfxDecode=this.preloadSfx().then(files=>Promise.all(files.filter(Boolean).map(async([name,bytes])=>{try{const buffer=await this.ctx.decodeAudioData(bytes);if(!this.disposed)this.sfxBuffers.set(name,buffer);}catch{}})));
  return this.sfxDecode;
 }
 _sample(name,{tag=name,volume=.75,delay=0,rate=1,pan=null,room=!DETAIL_SFX.has(name)&&!SUPPLIED_SFX[name]&&!REVISED_SFX[name],overlap=1}={}){
  const buffer=this.sfxBuffers.get(name);if(!buffer)return false;
  if(!this.ready||!this.settings.effects)return true;
  try{
   const active=[...this.voices].filter(v=>v.tag===tag&&!v.fading);
   while(active.length>=overlap){const voice=active.shift();if(voice.startedAt>this.ctx.currentTime||!voice.fadeOut)voice.stop();else voice.fadeOut(.025);}
   const source=this.ctx.createBufferSource();source.buffer=buffer;
   if(source.playbackRate)source.playbackRate.value=rate;
   this._source(source,{group:'effects',tag,volume,delay,duration:buffer.duration/rate,attack:.003,sustain:true,pan,room});return true;
  }catch{return false;}
 }
 uiClick(){this._sample('ui-confirm',{volume:.17});}
 buyClick(){if(!this._sample('bonus-buy',{volume:.55}))this.duelOpen();}
 freeSpinStart(){if(!this._sample('free-spin-start'))this.preview();}
 multiplierAppears(){if(!this._sample('multi-appears',{volume:.55}))this._safe(()=>this._bell(440,{duration:.4,volume:.07}));}
 duelResult(duel,{god=false}={}){
  if(duel.dead||duel.operation==='hold')return;
  // God Mode creates a new value instead of choosing between the two fighters.
  if(duel.operation==='double'||duel.operation==='multiply'){
   if(duel.to>duel.from)this.upgrade(duel.to,{god});
   return;
  }
  if(!Number.isFinite(duel.from)||!Number.isFinite(duel.rival)||!Number.isFinite(duel.to))return;
  // Compare with the defeated fighter, not just the previous reel value:
  // an incumbent 5× beating a 20× rival is still the lower-value result.
  const loser=duel.won?duel.rival:duel.from,direction=Math.sign(duel.to-loser);
  if(!direction){this.multiplierAppears();return;}
  if(this._sample(direction>0?'coin-up':'coin-down',{tag:'duel-result',volume:.48,overlap:2}))return;
  this._safe(()=>{
   const notes=direction>0?[739.99,987.77,1174.66,1479.98]:[1479.98,1174.66,987.77,739.99];
   notes.forEach((freq,i)=>this._bell(freq,{delay:[0,.065,.137,.215][i],duration:.19,volume:.065,tag:'duel-result',room:false}));
  });
 }
 duelTease(){this._sample('duel-tease',{tag:'duel-tease',volume:.35,delay:.2});}
 endReels(){this._stopTagged('duel-tease');}
 // Result cues may begin just before presentation cleanup. Let their bounded
 // one-shot tails finish instead of cutting the reward off after 100–300 ms.
 endDuel(){this._fadeTagged('duel-trigger');}
 endWin(){this._fadeTagged('win-sting',.1);}
 get ready(){return !!(this.settings.enabled&&!this.hidden&&!this.disposed&&this.ctx?.state==='running');}
 _changed(){try{this.storage?.setItem(KEY,JSON.stringify({...this.settings,lastVolumes:this.lastVolumes}));}catch{}this.onChange({...this.settings},this.ready,this.unavailable);}
 _ramp(param,value,duration=.06){const t=this.ctx.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(value,t+duration);}
 _setup(){
  if(this.ctx)return;
  const c=this.factory();this.ctx=c;
  c.onstatechange=()=>{if(this.ready){this.unavailable=false;this._ramp(this.master.gain,.65);this._startMusic();}else this._quiet();this._changed();};
  this.master=c.createGain();this.master.gain.value=0;
  const compressor=c.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=18;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.2;
  this.master.connect(compressor);compressor.connect(c.destination);
  this.buses={music:c.createGain(),effects:c.createGain()};
  const reverb=c.createConvolver(),wet=c.createGain();wet.gain.value=.2;
  const impulse=c.createBuffer(2,Math.ceil(c.sampleRate*1.6),c.sampleRate);
  for(let ch=0;ch<2;ch++){const data=impulse.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);}
  reverb.buffer=impulse;reverb.connect(wet);wet.connect(this.master);
  // Music-only EQ: sub weight on headphones plus audible upper bass on small
  // speakers. Keep effects, mute controls and the master limiter independent.
  const bass=c.createBiquadFilter(),body=c.createBiquadFilter();
  bass.type='lowshelf';bass.frequency.value=120;bass.gain.value=4.5;
  body.type='peaking';body.frequency.value=220;body.Q.value=.75;body.gain.value=2.5;
  this.buses.music.gain.value=this.settings.music;this.buses.music.connect(bass);bass.connect(body);body.connect(this.master);
  this.buses.effects.gain.value=this.settings.effects;this.buses.effects.connect(this.master);
  // Unreplaced effects retain their original room. Detail and supplied cues
  // keep their printed tails and bypass the long shared reverb.
  this.effectsRoom=c.createGain();this.effectsRoom.gain.value=this.settings.effects;this.effectsRoom.connect(reverb);
  this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 }
 async unlock(){
  if(!this.settings.enabled||this.hidden||this.disposed)return false;
  try{this._setup();await this.ctx.resume();
   if(!this.ready){this._changed();return false;}this.unavailable=false;this._ramp(this.master.gain,.65);this._startMusic();void this.prepareSfx();this._changed();return true;
  }catch{this.unavailable=true;this._quiet();this._changed();return false;}
 }
 async setEnabled(enabled){this.settings.enabled=!!enabled;this._changed();if(enabled)return this.unlock();this._quiet();if(this.ctx)this._ramp(this.master.gain,0,.025);return false;}
 setVolume(channel,value){if(!['music','effects'].includes(channel))return;this.settings[channel]=clamp(value,this.settings[channel]);if(this.settings[channel]>0)this.lastVolumes[channel]=this.settings[channel];if(this.buses)this._ramp(this.buses[channel].gain,this.settings[channel]);if(channel==='effects'&&this.effectsRoom)this._ramp(this.effectsRoom.gain,this.settings.effects);if(channel==='music'){if(!this.settings.music)this._stopMusic();else if(this.ready)this._startMusic();}this._changed();}
 async toggleChannel(channel){
  if(!['music','effects'].includes(channel))return false;
  if(this.settings.enabled&&this.settings[channel]>0){this.setVolume(channel,0);return false;}
  // Enabling one tile from master mute must not also enable the other channel.
  if(!this.settings.enabled)this.setVolume(channel==='music'?'effects':'music',0);
  this.setVolume(channel,this.lastVolumes[channel]);
  if(channel==='music')this.musicErrors.delete(this.scene);
  return this.setEnabled(true);
 }
 setHidden(hidden){this.hidden=!!hidden;if(hidden){this._quiet();if(this.ctx){this.master.gain.value=0;try{Promise.resolve(this.ctx.suspend()).catch(()=>{});}catch{}}}else if(this.ctx)void this.unlock();this._changed();}
 setScene(scene){const next=['base','regular','super','hidden'].includes(scene)?scene:'base';if(this.scene===next)return;if(this.scene==='base'&&next!=='base')this.trackPositions.delete('bonus');this.scene=next;if(this.ready)this._startMusic();this._changed();}
 _stopTagged(tag){for(const v of [...this.voices])if(v.tag===tag)v.stop();}
 _fadeTagged(tag,seconds=.04){for(const v of [...this.voices])if(v.tag===tag&&!v.fading){if(v.startedAt>this.ctx.currentTime||!v.fadeOut)v.stop();else v.fadeOut(seconds);}}
 _stopMusic(){this._stopTagged('music');this._stopTagged('music-out');this.musicVoice=null;}
 _quiet(){this._stopMusic();for(const v of [...this.voices])v.stop();}
 _source(source,{duration=.3,delay=0,volume=.1,attack=.005,group='effects',tag=group,filter=null,sustain=false,loop=false,offset=0,pan=null,room=true}={}){
  if(!this.ready||this.settings[group]===0||this.voices.size>=MAX_VOICES){try{source.disconnect();}catch{}return;}
  const c=this.ctx,t=c.currentTime+delay,gain=c.createGain(),nodes=[source,gain];
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+Math.min(attack,duration*.35));
  if(!loop){if(sustain){gain.gain.setValueAtTime(volume,t+Math.max(duration-.04,duration*.65));gain.gain.linearRampToValueAtTime(0,t+duration);}else gain.gain.exponentialRampToValueAtTime(.0001,t+duration);}
  if(filter){const f=c.createBiquadFilter();f.type=filter.type||'lowpass';f.frequency.value=filter.frequency;f.Q.value=filter.q||.7;source.connect(f);f.connect(gain);nodes.push(f);}else source.connect(gain);
  let output=gain;
  if(pan!==null&&typeof c.createStereoPanner==='function'){const panner=c.createStereoPanner();panner.pan.setValueAtTime(Math.max(-1,Math.min(1,pan)),t);gain.connect(panner);output=panner;nodes.push(panner);}
  output.connect(this.buses[group]);if(group==='effects'&&room&&this.effectsRoom)output.connect(this.effectsRoom);
  const voice={tag,startedAt:t,offset,fading:false,fadeOut:seconds=>{if(voice.fading)return;voice.fading=true;this._ramp(gain.gain,0,seconds);source.stop(c.currentTime+seconds+.03);},stop:()=>{try{source.stop();}catch{}for(const n of nodes)try{n.disconnect();}catch{}this.voices.delete(voice);if(this.musicVoice===voice)this.musicVoice=null;}};
  source.onended=voice.stop;this.voices.add(voice);if(loop)source.start(t,offset);else source.start(t);if(!loop)source.stop(t+duration+.03);
  return voice;
 }
 _note(freq,{to=null,type='sine',...options}={}){if(!this.ready)return;const o=this.ctx.createOscillator(),t=this.ctx.currentTime+(options.delay||0);o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+(options.duration||.3));this._source(o,options);}
 _air(options={}){if(!this.ready)return;const s=this.ctx.createBufferSource();s.buffer=this.noise;s.loop=true;this._source(s,options);}
 _bell(freq,options={}){const v=options.volume??.08;this._note(freq,{duration:.7,...options,volume:v});this._note(freq*2.76,{duration:.3,...options,volume:v*.22});}
 _safe(fn){if(!this.ready)return;try{fn();}catch{/* Audio failure must never interrupt a paid round. */}}
 get musicState(){
  if(!this.settings.enabled)return 'off';if(!this.settings.music)return 'muted';
  if(this.musicErrors.has(this.scene))return 'error';
  if(this.musicVoice?.scene===this.scene&&this.ready)return 'playing';
  return this.musicLoads.has(this.scene)?'loading':'waiting';
 }
 _loadMusic(scene){
  if(this.musicBuffers.has(scene)||this.musicLoads.has(scene)||this.musicErrors.has(scene))return;
  const pending=Promise.resolve().then(()=>this.loadMusic(this.ctx,scene)).then(buffer=>{
   if(this.disposed)return;this.musicBuffers.set(scene,buffer);
   if(this.scene===scene)this._startMusic();
  }).catch(()=>{if(!this.disposed)this.musicErrors.add(scene);}).finally(()=>{this.musicLoads.delete(scene);if(!this.disposed)this._changed();});
  this.musicLoads.set(scene,pending);this._changed();
 }
 _startMusic(){
  if(!this.ready||!this.settings.music||this.musicVoice?.scene===this.scene)return;
  const scene=this.scene;
  // Keep the current music until the incoming track is decoded and ready.
  if(!this.musicBuffers.has(scene)){this._loadMusic(scene);return;}
  this._safe(()=>{
   // At most one outgoing track can overlap the current one during a transition.
   this._stopTagged('music-out');
   const previous=this.musicVoice,source=this.ctx.createBufferSource();source.buffer=this.musicBuffers.get(scene);source.loop=true;
   // Main and bonus are independent songs. Resume each at its own position.
   const track=scene==='base'?'main':'bonus';
   if(previous)this.trackPositions.set(previous.scene==='base'?'main':'bonus',previous.offset+this.ctx.currentTime-previous.startedAt);
   const offset=(this.trackPositions.get(track)||0)%source.buffer.duration;
   const voice=this._source(source,{group:'music',loop:true,duration:2,attack:previous?MUSIC_FADE:.2,volume:MUSIC_LEVELS[scene],offset});
   if(!voice)return;voice.scene=scene;this.musicVoice=voice;
   if(previous){previous.tag='music-out';previous.fadeOut(MUSIC_FADE);}
   // Warm the other scenes after audible music starts, so bonus entry needs no download.
   for(const next of Object.keys(MUSIC_LEVELS))this._loadMusic(next);
  });
 }
 async playMusic(){
  if(!this.settings.music)this.setVolume('music',.55);
  this.musicErrors.delete(this.scene);
  return this.setEnabled(true);
 }
 spinStart(){if(this._sample('spin-engage',{volume:.38}))return;this._safe(()=>{this._note(95,{to:48,duration:.18,type:'triangle',volume:.1});this._air({duration:.24,attack:.035,volume:.06,filter:{type:'bandpass',frequency:700}});});}
 anticipation(active,next=0){if(!active&&this.buses)this.buses.music.gain.value=this.settings.music;this._safe(()=>{
  this._fadeTagged('anticipation');
  this._ramp(this.buses.music.gain,this.settings.music*(active?.48:1),.2);
  if(!active)return;
  const take=this.slowDownTake++%2,options={tag:'anticipation',volume:.38};
  if(this._sample(`reel-slow-down-${take+1}`,options)||this._sample(`reel-slow-down-${2-take}`,options))return;
  this._note(100+next*22,{to:340+next*55,type:'triangle',duration:1.5,attack:.5,volume:.085,tag:'anticipation'});
  this._air({duration:1.5,attack:.55,volume:.07,tag:'anticipation',filter:{type:'bandpass',frequency:900+next*230}});
  for(let i=0;i<5;i++)this._note(700+next*90,{duration:.045,delay:i*.19,volume:.035,tag:'anticipation',type:'triangle'});
 });}
 bonusHit(){if(this._sample('bonus-trigger'))return;this._safe(()=>{this._note(145,{to:38,duration:.65,volume:.23,type:'triangle'});this._air({duration:.3,volume:.14,filter:{frequency:1900}});this._bell(587.33,{delay:.07,duration:1,volume:.11});});}
 reelStop({index=0,scatters=0,landedScatters=0,newWilds=0}={}){this._safe(()=>{
  const reel=Math.max(0,Math.min(4,Math.trunc(index))),freq=[220,246.94,277.18,329.63,369.99][reel],pan=[-.8,-.4,0,.4,.8][reel];
  if(!this._sample(`reel-stop-${reel+1}`,{tag:'reel-stop',volume:.28,pan:pan*.7,overlap:5})){
   this._note(freq,{duration:.18,type:'triangle',volume:.095,pan});
   this._note(freq*2,{duration:.095,volume:.025,pan});
   this._air({duration:.045,volume:.035,filter:{frequency:1300+reel*180},pan});
  }
  if(newWilds)this.duelLand();
  if(scatters&&!this._sample('fs-land',{volume:.42,pan:pan*.7,overlap:5})){this._bell([392,440,523.25,659.25,783.99][Math.min(4,Math.max(0,landedScatters-1))],{duration:1,volume:.14});}
  if(landedScatters>=2&&index<4){this._note(220+index*55,{to:660+index*80,duration:.4,volume:.05,attack:.14});}
 });}
 duelLand(){if(this._sample('duel-land',{volume:.44}))return;this._safe(()=>{
  this._note(185,{to:62,type:'triangle',duration:.22,volume:.18});
  this._air({duration:.065,volume:.13,filter:{type:'highpass',frequency:2100}});
  this._note(1050,{to:310,type:'sawtooth',delay:.035,duration:.16,volume:.06,filter:{type:'lowpass',frequency:1600}});
  this._bell(370,{delay:.09,duration:.42,volume:.065});
 });}
 winTier(tier){const sample={nice:'nice-win',big:'big-win',super:'epic-win',relic:'epic-win',max:'max-win'}[tier];if(sample&&this._sample(sample,{tag:'win-sting',volume:['epic-win','max-win'].includes(sample)?.45:.75}))return;this._safe(()=>{
  const level={nice:0,big:1,super:2,relic:2,max:3}[tier];if(level===undefined)return;
  this._stopTagged('win-sting');
  const notes=[[440,554.37],[220,329.63,440],[146.83,220,293.66,440],[110,164.81,220,329.63,440]][level];
  this._note(100+level*18,{to:38,duration:.3+level*.15,type:'triangle',volume:.1+level*.035,tag:'win-sting'});
  this._air({duration:.25+level*.15,attack:.025,volume:.045+level*.02,filter:{type:'bandpass',frequency:1200},tag:'win-sting'});
  notes.forEach((freq,i)=>{this._note(freq,{type:'triangle',delay:i*.09,duration:.5+level*.18,attack:.025,volume:.08,tag:'win-sting'});this._bell(freq*2,{delay:.05+i*.09,duration:.5,volume:.045,tag:'win-sting'});});
 });}
 wander(){this._safe(()=>{this._air({duration:.55,attack:.15,volume:.09,filter:{type:'bandpass',frequency:1400}});this._bell(293.66,{delay:.12,duration:.5,volume:.07});});}
 duelOpen(){if(this._sample('duel-trigger',{volume:.6}))return;this._safe(()=>{this._air({duration:.15,volume:.065,filter:{type:'highpass',frequency:1500}});this._note(125,{to:55,duration:.2,volume:.07});this._bell(740,{duration:.16,volume:.035});});}
 duelShot(){this._fadeTagged('duel-trigger',.06);const sample=this.shotTake++%2?'shot-alt':'shot';if(this._sample(sample,{tag:'shot',volume:.7,overlap:3})||this._sample(sample==='shot'?'shot-alt':'shot',{tag:'shot',volume:.7,overlap:3}))return;this._safe(()=>{
  this._note(155,{to:43,duration:.24,volume:.21,type:'triangle'});
  this._note(880,{to:130,duration:.105,volume:.095,type:'sawtooth',filter:{frequency:1800}});
  this._air({duration:.11,volume:.12,filter:{frequency:2400}});
 });}
 upgrade(multiplier=6,{god=false}={}){if(god&&this._sample('god-boost',{volume:.6,overlap:2}))return;if(this._sample('multi-increase',{volume:.65}))return;this._safe(()=>{const base=440*Math.pow(2,(Math.min(10,multiplier)-5)/12);[1,1.25,1.5].forEach((r,i)=>this._bell(base*r,{delay:i*.07,duration:.45,volume:.075}));});}
 win({amount=0,capped=false,turbo=false}={}){if(amount&&this._sample('regular-win',{tag:'win-sting',volume:.55}))return;this._safe(()=>{
  if(!amount)return;
  if(amount>=1000)this._note(98,{to:49,duration:.35,volume:.09,type:'triangle'});
  const notes=capped?[293.66,369.99,440,587.33,739.99,880,1174.66]:amount>=5000?[293.66,369.99,440,587.33]:amount>=2000?[392,493.88,587.33]:[523.25,659.25];
  notes.forEach((f,i)=>this._bell(f,{delay:i*(turbo?.045:capped?.13:.085),duration:capped?1.5:.55,volume:capped?.14:amount<100?.045:.08}));
  if(capped){this._note(73.42,{duration:1.8,volume:.2,attack:.03});this._air({duration:1.2,attack:.08,volume:.12,filter:{frequency:2000}});}
 });}
 bonusStart(superBonus=false,hiddenBonus=false){this.setScene(hiddenBonus?'hidden':superBonus?'super':'regular');if(this.sfxBuffers.has('bonus-trigger'))return;this._safe(()=>{
  this._air({duration:1.3,attack:.16,volume:.16,filter:{frequency:1600}});
  this._note(110,{to:55,duration:1.1,volume:.22});
  (superBonus?[293.66,440,587.33,739.99,880]:[293.66,349.23,440,587.33]).forEach((f,i)=>this._bell(f,{delay:.12+i*.15,duration:1.4,volume:.12}));
 });}
 ritualReveal(){this._safe(()=>{this._note(110,{to:55,duration:.9,volume:.13,attack:.08});this._air({duration:.9,attack:.25,volume:.09,filter:{type:'bandpass',frequency:850}});});}
 ritualCharge(charges){this._safe(()=>this._bell([293.66,440,587.33][Math.max(0,Math.min(2,charges-1))],{duration:.65,volume:.10}));}
 ritualIgnite(){if(this._sample('crossfire-arm',{volume:.55}))return;this._safe(()=>{this._note(82.41,{to:41.2,duration:.8,volume:.17});this._air({duration:.6,attack:.06,volume:.12,filter:{frequency:1800}});[329.63,493.88,659.25].forEach((f,i)=>this._bell(f,{delay:i*.07,duration:.8,volume:.08}));});}
 bonusEnd(capped=false){if(!capped)this._safe(()=>[440,349.23,293.66].forEach((f,i)=>this._bell(f,{delay:i*.13,duration:.8,volume:.07})));}
 preview(){this._safe(()=>[293.66,440,587.33].forEach((f,i)=>this._bell(f,{delay:i*.16,duration:.9,volume:.1})));}
 dispose(){this.disposed=true;this._quiet();if(this.ctx)try{Promise.resolve(this.ctx.close()).catch(()=>{});}catch{}}
}
