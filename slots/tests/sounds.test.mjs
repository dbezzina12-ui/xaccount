import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,applyBatch,applyOperation,History,validateProject} from '../studio/project.js';
import {createGameAudio} from '../games/zombify/runtime/game-audio.js';
const asset={id:'test-audio',name:'Test WAV',kind:'audio',src:'data:audio/wav;base64,UklGRg=='};
test('audio assignments survive JSON, undo/redo, and old projects remain valid',()=>{
 const h=new History(createProject());h.commit(applyBatch(h.current,[{type:'asset',asset},{type:'sound',id:'music-base',values:{assetId:asset.id,volume:.4,fade:.2,loop:false}}]));
 assert.equal(validateProject(JSON.parse(JSON.stringify(h.current))).sounds['music-base'].volume,.4);h.undo();assert.equal(h.current.sounds,undefined);h.redo();assert.equal(h.current.sounds['music-base'].assetId,asset.id);
});
test('rejects invalid audio sources, assignments, values and audio used as art',()=>{
 const p=applyOperation(createProject(),{type:'asset',asset});
 for(const values of [{assetId:'street'},{volume:NaN},{fade:-1},{loop:'yes'},{arbitrary:1}])assert.throws(()=>applyOperation(p,{type:'sound',id:'music-base',values}));
 assert.throws(()=>applyOperation(p,{type:'sound',id:'spin',values:{loop:true}}));assert.throws(()=>applyOperation(p,{type:'symbol',id:'wild',assetId:asset.id}));
 assert.throws(()=>applyOperation(createProject(),{type:'asset',asset:{...asset,src:'data:text/html;base64,abc'}}));
});
test('real audio director swaps recordings, applies gain/fade/loop and restores defaults',async()=>{
 const requests=[],sources=[],gains=[];let time=10;
 const param=()=>({value:1,cancelAndHoldAtTime(){},cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}});
 const ctx={state:'running',get currentTime(){return time;},destination:{},resume:async()=>{},close:async()=>{},createGain(){const n={gain:param(),connect(){},disconnect(){}};gains.push(n);return n;},createDynamicsCompressor(){return Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,param()]).concat([['connect',()=>{}]]));},createBufferSource(){const n={playbackRate:param(),connect(){},disconnect(){},start(){},stop(){this.onended?.();}};sources.push(n);return n;},decodeAudioData:async()=>({duration:2})};
 const env={fetch:async url=>{requests.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};},addEventListener(){},removeEventListener(){}};
 const a=createGameAudio({env,doc:{hidden:false,addEventListener(){},removeEventListener(){}},createContext:()=>ctx,assets:{spin:'https://example.test/original', 'music-base':'https://example.test/base'},cues:{spin:{files:['spin'],gain:.5,gap:0}}});
 a.configure({'spin':{assetId:asset.id,volume:.4,fade:.2},'music-base':{assetId:asset.id,volume:.3,fade:.1,loop:false}},[asset]);await a.setEnabled(true);await a.prepare();await new Promise(r=>setTimeout(r,0));
 assert.ok(requests.includes(asset.src));assert.equal(sources[0].loop,false);assert.equal(a.play('spin'),true);assert.equal(gains.at(-1).gain.value,0); // scheduled fade reaches silence
 const before=sources.length;a.configure({'spin':{assetId:asset.id,volume:.4,fade:.2},'music-base':{assetId:asset.id,volume:.3,fade:.1,loop:false}},[asset]);assert.equal(sources.length,before);
 a.configure({},[]);await a.prepare();time++;assert.equal(a.play('spin'),true);assert.equal(gains.at(-1).gain.value,.5);assert.ok(requests.includes('https://example.test/original'));a.destroy();
});
