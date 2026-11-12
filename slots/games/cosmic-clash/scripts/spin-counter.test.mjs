import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpinCounter} from '../dist/spin-counter.js';

function fixture(){
 const game={dataset:{}},element={dataset:{},hidden:true},value={},label={},status={};
 const counter=createSpinCounter({game,element,value,label,status,lift:{}});
 return {counter,game,element,value,label,status};
}
test('free spin counter shows the active spin then its exact remaining event count',()=>{
 const f=fixture();f.counter.begin(10,'hidden');
 assert.equal(f.value.textContent,'10');assert.equal(f.element.dataset.tier,'hidden');
 for(let left=9;left>=0;left--){f.counter.reveal(left);assert.equal(f.value.textContent,String(left+1));f.counter.settle(left);assert.equal(f.value.textContent,String(left));}
 f.counter.complete();assert.equal(f.label.textContent,'COMPLETE');
 f.counter.reveal(7);assert.equal(f.value.textContent,'0');
 f.counter.hide();assert(f.element.hidden);assert.equal(f.game.dataset.spinCounter,undefined);
});
test('paid opening duel shows ten respins, without inventing an eleventh, and early completion resets',()=>{
 const f=fixture();f.counter.begin(10,'super','RESPINS');f.counter.settle(10);
 assert.equal(f.value.textContent,'10');assert.equal(f.label.textContent,'RESPINS');
 f.counter.reveal(9);assert.equal(f.value.textContent,'10');f.counter.settle(9);
 f.counter.complete();assert.equal(f.value.textContent,'0');f.counter.hide();
 f.counter.begin(10,'regular');assert.equal(f.label.textContent,'FREE SPINS');assert.equal(f.element.dataset.complete,'false');
});
