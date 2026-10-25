import test from 'node:test';
import assert from 'node:assert/strict';
import {copySymbolPaint} from '../games/zombify/runtime/symbol-paint.js';

test('detached effects retain the resolved atlas crop, mask and infection treatment',()=>{
 const paint={'background-image':'url("atlas.webp")','background-size':'722% 1536%','background-position':'58% 41%','background-repeat':'no-repeat','mask-image':'none','filter':'sepia(0.7) hue-rotate(42deg)'};
 const writes=new Map(),source={ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:key=>paint[key]||''})}}},target={style:{setProperty:(key,value,priority)=>writes.set(key,{value,priority})}};
 assert.equal(copySymbolPaint(source,target),target);
 for(const [key,value] of Object.entries(paint))assert.deepEqual(writes.get(key),{value,priority:'important'});
 assert.equal(writes.has('background-color'),false);
});
test('individual image assets keep their contain layout on detached effects',()=>{
 const paint={'background-image':'url("zombie.png")','background-size':'contain','background-position':'50% 50%','background-repeat':'no-repeat'};
 const writes={};copySymbolPaint({ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:key=>paint[key]||''})}}},{style:{setProperty:(key,value)=>writes[key]=value}});
 assert.deepEqual(writes,paint);
});
