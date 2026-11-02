import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tiers,tierFor,createWinCount} from '../dist/win-show.mjs';
for(const [n,id] of [[0,null],[9.99,null],[10,'nice'],[24.99,'nice'],[25,'big'],[99.99,'big'],[100,'epic'],[499.99,'epic'],[500,'mythic'],[25000,'mythic']])assert.equal(tierFor(n),id);
assert.equal(tierFor(25000,true),'max');
const svg=readFileSync(new URL('../dist/assets/wins/titles.svg',import.meta.url),'utf8');
for(const [id,config] of Object.entries(tiers)){
 assert.ok(svg.includes('<symbol id="'+id+'"'));
 const mp3=readFileSync(new URL('../dist/assets/wins/'+id+'.mp3',import.meta.url));assert.ok(mp3.length>10000);
 const c=createWinCount(2478957,config.seconds,config.hold);assert.equal(c.value,0);let prior=0;
 for(let i=0;i<200&&!c.closed;i++){c.tick(.06);assert.ok(c.value>=prior&&c.value<=2478957);prior=c.value}
 assert.ok(c.closed);assert.equal(c.value,2478957);
}
const tap=createWinCount(17,2,1);tap.tick(.2);tap.advance();assert.ok(tap.complete&&!tap.closed);assert.equal(tap.value,17);tap.advance();assert.ok(tap.closed);
const reduced=createWinCount(12345,0,1);assert.equal(reduced.value,12345);reduced.tick(.8);assert.ok(!reduced.closed);reduced.tick(.2);assert.ok(reduced.closed);
console.log('Five tier assets, boundaries, exact cents, auto-finish, reduced motion and tap controls verified');
