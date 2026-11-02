import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tiers,tierFor,createWinCount,swarmFlight} from '../dist/win-show.mjs';
for(const [n,id] of [[0,null],[9.99,null],[10,'nice'],[24.99,'nice'],[25,'big'],[99.99,'big'],[100,'epic'],[499.99,'epic'],[500,'mythic'],[25000,'mythic']])assert.equal(tierFor(n),id);
assert.equal(tierFor(25000,true),'max');
for(const price of [20,250]){
 for(const [cost,tier] of [[0,null],[1.999,null],[2,'nice'],[4.999,'nice'],[5,'big'],[24.999,'big'],[25,'epic'],[49.999,'epic'],[50,'mythic']]){
  assert.equal(tierFor(cost*price,false,price),tier);
 }
 assert.equal(tierFor(25000,true,price),'max');
}
assert.equal(tierFor(500,false,250),'nice');
assert.equal(tierFor(500,false,20),'epic');

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

// Exercise every entrance frame, held flight and reduced-motion pose. Insets
// model a notch in portrait and a sensor housing near the landscape edge.
for(const [w,h,top,right,bottom,left] of [
 [320,568,0,0,0,0],[390,844,47,0,34,0],[844,390,0,47,21,47],
 [1024,768,0,0,0,0],[1366,768,0,0,0,0],[2560,1080,0,0,0,0]
]){
 const sw=Math.min(w,1100,h*1.4),sh=sw*500/720;
 const stage={x:(w-sw)/2,y:(h-sh)/2,w:sw,h:sh};
 const view={w,h,stage,insets:{top,right,bottom,left}};
 for(const {bees} of Object.values(tiers)){
  let above=false,beside=false;
  for(let f=0;f<=360;f++){
   const placed=swarmFlight(view,bees,f/60,f===360);
   if(f>=90)assert.equal(placed.length,bees);
   for(const bee of placed){
    const reach=bee.size*(Math.abs(Math.cos(bee.bank))+Math.abs(Math.sin(bee.bank)))/2;
    assert.ok(bee.x-reach>left&&bee.x+reach<w-right);
    assert.ok(bee.y-reach>top&&bee.y+reach<h-bottom);
    assert.ok(bee.y+reach<=stage.y+sh*.47,'wing overlaps win title');
    above ||= bee.y-reach<stage.y;
    beside ||= bee.x-reach<stage.x||bee.x+reach>stage.x+sw;
    if(f===360&&bee.hero)assert.ok(bee.size>=sw*.285,'foreground bee too small');
   }
  }
  if(h>w)assert.ok(above,'flight trapped at the top of the text stage');
  if(w/h>2.2&&bees>1)assert.ok(beside,'flight trapped at the sides of the text stage');
 }
}
console.log('Full-viewport swarm entrances, wingspans, safe areas and title clearance verified');
