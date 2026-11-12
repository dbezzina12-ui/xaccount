import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BountyAudio,SFX_FILES,SUPPLIED_SFX,REVISED_SFX} from '../dist/audio.js';
import {createScatterAnticipation} from '../dist/reel-motion.js';

test('all supplied and revised sounds load, while unmatched cues keep their original paths',async()=>{
 const prior=globalThis.fetch,paths=[];
 globalThis.fetch=async url=>{
  paths.push(String(url));const bytes=await readFile(url);
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 try{
  const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
  const loaded=await sound.preloadSfx();
  assert.equal(loaded.filter(Boolean).length,SFX_FILES.length);
  assert.equal(Object.keys(SUPPLIED_SFX).length,15);
  assert.equal(Object.keys(REVISED_SFX).length,5);
  assert.equal(paths.filter(p=>p.includes('/supplied-v105/')).length,13);
  assert.equal(paths.filter(p=>p.includes('/revised-v106/')).length,5);
  for(const name of ['coin-up','coin-down'])assert(paths.some(p=>p.endsWith(`/revised-v106/${name}.mp3`)));
  for(const name of ['duel-land','duel-tease','regular-win','free-spin-start','bonus-trigger','multi-appears','multi-increase','reload'])assert(paths.some(p=>p.endsWith(`/sfx/${name}.mp3`)));
  for(const name of ['spin-engage','ui-confirm','god-boost','crossfire-arm'])assert(paths.some(p=>p.endsWith(`/detail-v103/${name}.mp3`)));
 }finally{globalThis.fetch=prior;}
});

test('revolver variants alternate once per shot and tolerate one unavailable variant',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',currentTime:2,createBufferSource:()=>({})};
 for(const name of ['shot','shot-alt'])sound.sfxBuffers.set(name,{name,duration:.774});
 const calls=[];sound._source=(source,options)=>calls.push({name:source.buffer.name,...options});
 for(let i=0;i<4;i++)sound.duelShot();
 assert.deepEqual(calls.map(c=>c.name),['shot','shot-alt','shot','shot-alt']);
 assert(calls.every(c=>c.tag==='shot'&&c.duration===.774&&!c.room));
 sound.sfxBuffers.delete('shot-alt');sound.duelShot();sound.duelShot();
 assert.deepEqual(calls.slice(-2).map(c=>c.name),['shot','shot']);
 sound.settings.effects=0;sound.duelShot();assert.equal(calls.length,6);
});

test('free-spin landing plays only for a newly landed scatter and follows effects mute',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',createBufferSource:()=>({playbackRate:{value:1}})};
 for(let i=1;i<=5;i++)sound.sfxBuffers.set(`reel-stop-${i}`,{name:`reel-${i}`,duration:.26});
 sound.sfxBuffers.set('fs-land',{name:'fs-land',duration:1.154});
 const calls=[];sound._source=(source,options)=>calls.push({source,...options});
 sound._bell=()=>assert.fail('Loaded scatter sound must replace the placeholder bell');
 sound.reelStop({index:0});
 sound.reelStop({index:1,scatters:1,landedScatters:1});
 sound.reelStop({index:2,landedScatters:1});
 const landings=calls.filter(c=>c.source.buffer.name==='fs-land');
 assert.equal(landings.length,1);assert.equal(landings[0].duration,1.154);
 assert.equal(landings[0].source.playbackRate.value,1);assert.equal(landings[0].room,false);
 assert.equal(landings[0].group,'effects');
 sound.settings.effects=0;sound.reelStop({index:3,scatters:1,landedScatters:1});
 assert.equal(calls.filter(c=>c.source.buffer.name==='fs-land').length,1);
});

test('settled scatters trigger alternating slowdown clips and skipping fades the tease',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',currentTime:10,createBufferSource:()=>({playbackRate:{value:1}})};
 sound.buses={music:{gain:{value:sound.settings.music}}};sound._ramp=(param,value)=>{param.value=value;};
 for(const [name,duration] of [['reel-slow-down-1',1.99],['reel-slow-down-2',2.399]])sound.sfxBuffers.set(name,{name,duration});
 const calls=[],faded=[];
 sound._source=(source,options)=>{
  calls.push({source,...options});
  const voice={tag:options.tag,startedAt:10,fading:false,fadeOut:()=>{voice.fading=true;faded.push(source.buffer.name);}};
  sound.voices.add(voice);
 };
 sound._note=()=>assert.fail('Loaded slowdown clips must replace synthesized anticipation');
 let skipped=false;
 const tease=createScatterAnticipation({instant:()=>skipped,change:({active,next})=>sound.anticipation(active,next??0)});
 tease.landed(0,1);assert.equal(calls.length,0);
 tease.landed(1,1);tease.landed(2,0);
 assert.deepEqual(calls.map(c=>c.source.buffer.name),['reel-slow-down-1','reel-slow-down-2']);
 assert.deepEqual(calls.map(c=>c.duration),[1.99,2.399]);
 assert(calls.every(c=>!c.room&&c.group==='effects'&&c.source.playbackRate.value===1));
 skipped=true;tease.landed(3,1);tease.landed(4,0);tease.finish();
 assert.equal(calls.length,2);assert.deepEqual(faded,['reel-slow-down-1','reel-slow-down-2']);
 assert.equal(sound.buses.music.gain.value,sound.settings.music);
 sound.sfxBuffers.delete('reel-slow-down-1');sound.anticipation(true,3);
 assert.equal(calls.at(-1).source.buffer.name,'reel-slow-down-2');
 const count=calls.length;sound.settings.effects=0;sound.anticipation(true,4);
 assert.equal(calls.length,count);sound.anticipation(false);
});

test('main and bonus songs keep independent positions and return to main after bonuses',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 const duration=32*4*60/140,starts=[],fades=[];
 sound.ctx={state:'running',currentTime:10,createBufferSource:()=>({})};
 for(const scene of ['base','regular','super','hidden'])sound.musicBuffers.set(scene,{duration});
 sound._source=(source,options)=>{
  starts.push({...options,scene:sound.scene});
  const voice={tag:options.tag||options.group,startedAt:sound.ctx.currentTime,offset:options.offset,
   fadeOut:seconds=>fades.push(seconds),stop:()=>sound.voices.delete(voice)};
  sound.voices.add(voice);return voice;
 };
 sound._startMusic();assert.equal(starts[0].offset,0);
 sound.ctx.currentTime=18;sound.setScene('regular');assert.equal(starts[1].offset,0);assert.equal(fades[0],.32);
 sound.ctx.currentTime=70;sound.setScene('hidden');
 assert(Math.abs(starts[2].offset-(52%duration))<1e-8);
 assert.equal(sound.voices.size,2);assert.equal(sound.musicVoice.scene,'hidden');
 sound._startMusic();assert.equal(starts.length,3);
 sound.ctx.currentTime=75;sound.setScene('base');assert.equal(starts[3].offset,8);assert.equal(sound.musicVoice.scene,'base');
 sound.setVolume('music',0);assert.equal(sound.voices.size,0);assert.equal(sound.musicVoice,null);
 sound.setScene('super');assert.equal(starts.length,4);
});

test('buffer loops start at the requested offset, while one-shot effects keep their schedule',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 sound.ctx={state:'running',currentTime:7,createGain:()=>({gain:param,connect(){},disconnect(){}})};
 sound.buses={music:{},effects:{}};
 const calls=[];
 const source=()=>({connect(){},disconnect(){},start:(...args)=>calls.push(args),stop(){}});
 const voice=sound._source(source(),{group:'music',loop:true,offset:12.5});
 assert.deepEqual(calls[0],[7,12.5]);assert.equal(voice.startedAt,7);assert.equal(voice.offset,12.5);
 sound._source(source(),{delay:.15});assert.deepEqual(calls[1],[7.15]);
});

 test('each new bonus restarts its trimmed cue while transitions within a bonus continue',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.scene='base';sound.trackPositions.set('bonus',57);sound.setScene('super');assert.equal(sound.trackPositions.has('bonus'),false);
 sound.trackPositions.set('bonus',12);sound.setScene('hidden');assert.equal(sound.trackPositions.get('bonus'),12);
 sound.setScene('base');sound.setScene('regular');assert.equal(sound.trackPositions.has('bonus'),false);
 });

test('independent partial volumes persist without muting the other channel',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(key,value)=>{saved=value;}};
 const sound=new BountyAudio({storage});sound.setVolume('music',.23);sound.setVolume('effects',.81);
 assert.equal(sound.settings.enabled,true);assert.equal(sound.settings.music,.23);assert.equal(sound.settings.effects,.81);
 const restored=new BountyAudio({storage});assert.equal(restored.settings.music,.23);assert.equal(restored.settings.effects,.81);
 sound.setVolume('music',0);assert.equal(sound.settings.effects,.81);
});
test('duel landing and big win have different tagged effect patterns',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});sound.ctx={state:'running'};
 const events=[];sound._note=(freq,options)=>events.push({kind:'note',freq,...options});sound._air=options=>events.push({kind:'air',...options});sound._bell=(freq,options)=>events.push({kind:'bell',freq,...options});
 sound.duelLand();assert(events.some(e=>e.type==='sawtooth'));const landing=events.length;events.length=0;
 sound.winTier('big');assert(events.length>landing);assert(events.every(e=>e.tag==='win-sting'));
});

test('supplied SFX use the effects bus at full clip duration and respect mute',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',createBufferSource:()=>({})};sound.sfxBuffers.set('duel-land',{duration:3});
 const calls=[];sound._source=(source,options)=>{calls.push(options);};sound._note=()=>{throw Error('Should not synthesize replacement');};
 sound.duelLand();assert.equal(calls.length,1);assert.equal(calls[0].group,'effects');assert.equal(calls[0].duration,3);assert.equal(calls[0].sustain,true);
 sound.settings.effects=0;sound.duelLand();assert.equal(calls.length,1);
 sound.settings.effects=.5;sound.settings.enabled=false;sound.duelLand();assert.equal(calls.length,1);
});
test('unavailable sample downloads do not block the game or queue late sounds',async()=>{
 const prior=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline');};
 try{const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});await sound.preloadSfx();sound.ctx={state:'running'};await sound.prepareSfx();assert.equal(sound.sfxBuffers.size,0);assert.equal(sound._sample('shot'),false);}finally{globalThis.fetch=prior;}
});

test('five reel stops ascend in pitch and pan from left to right',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});sound.ctx={state:'running'};
 const notes=[];sound._note=(freq,options)=>notes.push({freq,...options});sound._air=()=>{};
 for(let index=0;index<5;index++)sound.reelStop({index});
 const main=notes.filter(n=>n.type==='triangle');assert.equal(main.length,5);
 assert.deepEqual(main.map(n=>n.pan),[-.8,-.4,0,.4,.8]);
 for(let i=1;i<5;i++)assert(main[i].freq>main[i-1].freq);
});

test('each reel uses its supplied landing at original pitch with a complete tail',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',currentTime:1,createBufferSource:()=>({playbackRate:{value:1}})};
 for(let i=1;i<=5;i++)sound.sfxBuffers.set(`reel-stop-${i}`,{duration:.26,name:i});
 const calls=[];sound._source=(source,options)=>calls.push({source,...options});
 for(let index=0;index<5;index++)sound.reelStop({index});
 assert.deepEqual(calls.map(c=>c.source.buffer.name),[1,2,3,4,5]);
 for(let i=0;i<5;i++){
  assert.equal(calls[i].room,false);assert.equal(calls[i].group,'effects');
  assert.equal(calls[i].duration,.26);assert.equal(calls[i].source.playbackRate.value,1);
  if(i)assert(calls[i].pan>calls[i-1].pan);
 }
 sound.settings.effects=0;sound.reelStop({index:1});assert.equal(calls.length,5);
});

test('duel cleanup preserves reward tails and cancels a future opening cue',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});sound.ctx={state:'running',currentTime:5};
 const stopped=[],faded=[];
 for(const [tag,startedAt] of [['shot',4.9],['multi-increase',5],['god-boost',5],['duel-trigger',6]])sound.voices.add({tag,startedAt,stop:()=>stopped.push(tag),fadeOut:()=>faded.push(tag)});
 sound.endDuel();assert.deepEqual(stopped,['duel-trigger']);assert.deepEqual(faded,[]);
});

test('rapid reel stops fade the oldest voice without cutting the other tails',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',currentTime:2,createBufferSource:()=>({playbackRate:{value:1}})};sound.sfxBuffers.set('reel-stop-1',{duration:.34});
 const faded=[];
 for(let i=0;i<3;i++)sound.voices.add({tag:'reel-stop',startedAt:1.8+i*.05,fadeOut:seconds=>faded.push([i,seconds]),stop:()=>assert.fail('Do not cut off active reel tails')});
 sound._source=()=>{};sound._sample('reel-stop-1',{tag:'reel-stop',overlap:3});assert.deepEqual(faded,[[0,.025]]);
});

test('unreplaced VS landing and God Mode keep their gain and routing',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',createBufferSource:()=>({})};
 for(const name of ['shot','duel-land','god-boost','multi-increase'])sound.sfxBuffers.set(name,{name,duration:1});
 const calls=[];sound._source=(source,options)=>calls.push({name:source.buffer.name,...options});
 sound.duelShot();sound.duelLand();sound.upgrade(10,{god:true});sound.upgrade(10);
 assert.deepEqual(calls.map(c=>c.name),['shot','duel-land','god-boost','multi-increase']);
 assert.equal(calls[0].volume,.7);assert.equal(calls[0].room,false);
 assert.equal(calls[1].volume,.44);assert.equal(calls[1].room,true);
 assert.equal(calls[2].room,false);
});

test('effects level also controls the room send without altering the music level',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.buses={effects:{gain:{}},music:{gain:{}}};sound.effectsRoom={gain:{}};
 const calls=[];sound._ramp=(param,value)=>calls.push([param,value]);
 sound.setVolume('effects',0);
 assert.deepEqual(calls,[[sound.buses.effects.gain,0],[sound.effectsRoom.gain,0]]);
 assert.equal(sound.settings.music,.55);
});

test('coin direction follows the winning value for either fighter, including unchanged incumbent wins',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});
 sound.ctx={state:'running',createBufferSource:()=>({})};
 for(const name of ['coin-up','coin-down','multi-appears'])sound.sfxBuffers.set(name,{name,duration:.67});
 const calls=[];sound._source=(source,options)=>calls.push({name:source.buffer.name,...options});
 for(const regular of [true,false]){
  for(const [from,rival,won,to,expected] of [[20,5,true,20,'coin-up'],[5,20,false,20,'coin-up'],[5,20,true,5,'coin-down'],[20,5,false,5,'coin-down'],[5,5,true,5,'multi-appears']]){
   sound.duelResult({from,rival,won,to,regular,operation:'keep'});
   assert.equal(calls.at(-1).name,expected);
   if(expected.startsWith('coin'))assert.equal(calls.at(-1).room,false);
  }
 }
 const count=calls.length;
 sound.settings.effects=0;sound.duelResult({from:5,rival:20,won:false,to:20,operation:'keep'});assert.equal(calls.length,count);
});

test('missing coin samples retain the direction; reel removals and unchanged God caps are silent',()=>{
 const sound=new BountyAudio({storage:{getItem:()=>null,setItem:()=>{}}});sound.ctx={state:'running'};
 const notes=[];sound._bell=(freq)=>notes.push(freq);
 sound.duelResult({from:20,rival:5,won:false,to:5,operation:'keep'});
 assert.equal(notes.length,4);for(let i=1;i<notes.length;i++)assert(notes[i]<notes[i-1]);
 notes.length=0;sound.duelResult({from:20,rival:5,won:true,to:20,operation:'keep'});
 assert.equal(notes.length,4);for(let i=1;i<notes.length;i++)assert(notes[i]>notes[i-1]);
 notes.length=0;
 sound.duelResult({from:20,rival:5,won:false,to:5,dead:true,operation:'hold'});
 sound.duelResult({from:1024,to:1024,rival:50,won:true,operation:'double'},{god:true});
 assert.equal(notes.length,0);
 const upgrades=[];sound.upgrade=(value,options)=>upgrades.push([value,options]);
 sound.duelResult({from:20,to:40,rival:5,won:true,operation:'double'},{god:true});
 assert.deepEqual(upgrades,[[40,{god:true}]]);
});
