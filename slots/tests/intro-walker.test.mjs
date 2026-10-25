import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntroWalker} from '../games/zombify/runtime/intro-walker.js';

test('intro uses a canvas-only host and discards the old portrait on every restart',()=>{
 const doc={createElement:tag=>({tag,attributes:{},setAttribute(key,value){this.attributes[key]=value;}})};
 const container={ownerDocument:doc,children:[{className:'symbol art-zombie zombie-walk-sprite'}],replaceChildren(...nodes){this.children=nodes;}};
 const first=createIntroWalker(container);
 assert.equal(first.tag,'div');assert.equal(first.className,'approved-intro-walker');
 assert.doesNotMatch(first.className,/symbol|art-zombie|zombie-walk-sprite/);
 assert.equal(first.attributes['aria-hidden'],'true');assert.deepEqual(container.children,[first]);
 first.children=[{tag:'canvas'}];
 const restarted=createIntroWalker(container);
 assert.notEqual(restarted,first);assert.deepEqual(container.children,[restarted]);
});
