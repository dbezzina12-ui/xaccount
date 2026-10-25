import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../games/zombify/runtime/app.js',import.meta.url),'utf8');
const render=source.slice(source.indexOf('function renderInfection('),source.indexOf('async function walking('));
const PEOPLE=['skater','nurse','builder','cop','scientist'];
function fixture(tier){const nodes=new Map();let displayed;const context=vm.createContext({bonusTier:tier,currentInfection:null,PEOPLE,freshInfection:()=>({}),$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},infectionTubes:{update:p=>{displayed=p;return PEOPLE.filter(k=>p[k]===3).length;}}});vm.runInContext(render,context);return{context,nodes,get displayed(){return displayed;}};}
for(const tier of ['super','hidden'])test(`${tier} opens with all five jars full without mutating the round infection state`,()=>{
 const f=fixture(tier),input={skater:0,nurse:1};f.context.renderInfection(input);
 assert.equal(f.nodes.get('infection-tracker').hidden,false);assert.equal(f.nodes.get('infection-summary').textContent,'5 / 5 INFECTED');
 for(const kind of PEOPLE)assert.equal(f.displayed[kind],3);
 assert.deepEqual(input,{skater:0,nurse:1});assert.equal(f.context.currentInfection.nurse,1);
 f.context.renderInfection({});for(const kind of PEOPLE)assert.equal(f.displayed[kind],3);
});
test('regular bonus preserves earned jar progress and leaving the bonus hides the rack',()=>{
 const f=fixture('regular');f.context.renderInfection({skater:2,nurse:3});assert.equal(f.displayed.skater,2);assert.equal(f.displayed.nurse,3);assert.equal(f.nodes.get('infection-tracker').hidden,false);
 f.context.bonusTier=null;f.context.renderInfection();assert.equal(f.nodes.get('infection-tracker').hidden,true);assert.equal(f.nodes.get('infection-summary').textContent,'0 / 5 INFECTED');
});
