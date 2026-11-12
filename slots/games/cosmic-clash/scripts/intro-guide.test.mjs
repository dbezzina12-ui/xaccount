import test from 'node:test';
import assert from 'node:assert/strict';
import {presentIntroDuel} from '../dist/intro-guide.js';
import {presentDuel} from '../dist/duel-presentation.js';

function setup(){
 const fields=new Map(),node={dataset:{},style:{setProperty(){}},hidden:true,querySelector(k){if(!fields.has(k))fields.set(k,{textContent:'',dataset:{}});return fields.get(k);}};
 return {card:{querySelector:()=>node},symbol:{name:'landed VS'},node};
}
test('intro passes its actual landed VS to the native reveal before playing the duel',async()=>{
 const s=setup(),events=[];let finishOpening;
 const opening=new Promise(resolve=>finishOpening=resolve);
 const pending=presentIntroDuel({...s,wait:async()=>{},instant:()=>false,motions:new Set(),onResolve:()=>events.push('resolve'),
  reveal:async({card,symbol})=>{assert.equal(card,s.card);assert.equal(symbol,s.symbol);events.push('open');await opening;},
  present:options=>presentDuel({...options,createMotion:()=>({prepare:async()=>true,play:async()=>events.push('video'),stop:()=>events.push('cleanup')})})});
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(events,['open']);assert.equal(s.node.hidden,false);
 finishOpening();await pending;assert.deepEqual(events,['open','video','resolve','cleanup']);assert.equal(s.node.hidden,true);
});
test('reduced motion resolves the intro example without opening doors or playing video',async()=>{
 const s=setup();let resolved=0;
 await presentIntroDuel({...s,wait:async()=>{},instant:()=>true,motions:new Set(),onResolve:()=>resolved++,reveal:()=>assert.fail('No doors'),
  present:options=>presentDuel({...options,createMotion:()=>({prepare:()=>assert.fail('No media'),play:()=>assert.fail('No video'),stop(){}})})});
 assert.equal(resolved,1);assert.equal(s.node.hidden,true);
});
