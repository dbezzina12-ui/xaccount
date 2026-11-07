import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionPlan,vaultTreatment} from './vault.mjs';
test('carried lights and multiple fills consume supplied awards in order',()=>{
  const plan=collectionPlan(3,9,[2,1000]);
  assert.deepEqual(plan.filter(p=>p.award!==null),[{source:1,lights:5,award:2},{source:6,lights:5,award:1000}]);
  assert.equal(plan.at(-1).lights,2);
  assert.deepEqual(collectionPlan(4,0,[]),[]);
});
test('missing or excess awards cannot be invented or silently dropped',()=>{
  for(const args of [[0,5,[]],[0,1,[25]],[0,5,[0]],[5,1,[]],[0,-1,[]]])assert.throws(()=>collectionPlan(...args));
  assert.deepEqual(collectionPlan(4,1,[3]),[{source:0,lights:5,award:3}]);
});
test('celebration boundaries preserve small reveals and reserve top treatment',()=>{
  assert.deepEqual([1,5,24,25,999,1000].map(vaultTreatment),['small','small','small','large','large','top']);
});
