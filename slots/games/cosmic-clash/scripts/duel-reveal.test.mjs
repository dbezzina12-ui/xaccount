import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {revealDuel,REVEAL_DURATION} from '../dist/duel-reveal.js';
import {instance,Spine} from '../dist/animation/renderer.mjs';
import {vsReelGeometry,createVsReelModifier,vsPlateMotion} from '../dist/animation/vs-reel-opening.mjs';
import {createFeatureDriver} from '../dist/animation/feature-driver.mjs';
const base=new URL('../dist/assets/spine-v97/vs-symbol/',import.meta.url);
function native(){const atlas=new Spine.TextureAtlas(fs.readFileSync(new URL('parts.atlas',base),'utf8'));return instance({data:new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(new URL('vs-symbol.json',base)))),manifest:JSON.parse(fs.readFileSync(new URL('rig-manifest.json',base))),textures:new Map()});}
test('native reveal reaches both edges from every landing row before the fight cue',()=>{
 assert.equal(REVEAL_DURATION,600);
 for(const width of [52,78,118])for(let row=0;row<5;row++){
  const rig=native(),reel={left:38,top:92,width,height:width*5},size=width*.94,symbol={left:reel.left+(width-size)/2,top:reel.top+row*width+(width-size)/2,width:size,height:size};
  const g=vsReelGeometry({reel,symbol}),slide=createVsReelModifier({skeleton:rig.skeleton,geometry:g});
  rig.state.setAnimation(0,'open',false);rig.state.update(.50);rig.state.apply(rig.skeleton);slide.afterApply();rig.skeleton.updateWorldTransform(Spine.Physics.none);
  const w=slide.window();assert(Math.abs(w.top-reel.top)<.01);assert(Math.abs(w.height-reel.height)<.01);
  for(const slot of rig.skeleton.slots){const mesh=slot.appliedPose.getAttachment(),v=[];mesh.computeWorldVertices(rig.skeleton,slot,0,mesh.worldVerticesLength,v,0,2);const ys=v.filter((_,i)=>i%2).map(y=>g.center.y-y*g.scale);assert(slot.appliedPose.color.a<.001);}
 }
});
test('native markers fire once; replay and cancellation restore the closed rig',async()=>{
 const rig=native(),driver=createFeatureDriver({...rig,physicsNone:Spine.Physics.none});
 for(let pass=0;pass<2;pass++){
  const events=[];const play=driver.play('open',{onCue:(name,event)=>events.push([name,event.time])});
  for(let i=0;i<45;i++)driver.update(1/30);await play;
  assert.equal(events.filter(([name])=>name==='vs_reveal').length,1);assert(events.some(([name,time])=>name==='vs_reveal'&&Math.abs(time-.60)<1e-6));
 }
 const abort=new AbortController(),p=driver.play('open',{signal:abort.signal});driver.update(.3);abort.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(rig.skeleton.findBone('reveal_progress').pose.y,rig.skeleton.findBone('reveal_progress').data.setupPose.y);driver.dispose();
});
test('skip and missing source symbol unlock without asset loading or animation',async()=>{
 const classes=new Set(['pending-duel']);const card={classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x))}};
 await revealDuel({card,instant:()=>true});assert(!classes.has('pending-duel'));assert(classes.has('vs-unlocked'));
 await revealDuel({card,symbol:null});
});

test('reveal grows monotonically within the reel and moving plates meet their final positions',()=>{
 for(const width of [52,118])for(let row=0;row<5;row++){
  const rig=native(),reel={left:0,top:0,width,height:width*5},symbol={left:0,top:row*width,width,height:width};
  const geometry=vsReelGeometry({reel,symbol}),modifier=createVsReelModifier({skeleton:rig.skeleton,geometry});
  rig.state.setAnimation(0,'open',false);let previous=0;
  for(let i=0;i<61;i++){
   rig.state.update(i?1/100:0);rig.state.apply(rig.skeleton);modifier.afterApply();const w=modifier.window();
   assert(w.height>=previous-.001);assert(w.top>=-.001);assert(w.top+w.height<=reel.height+.001);previous=w.height;
  }
  const m=vsPlateMotion({height:reel.height,windowTop:0,windowHeight:reel.height,plateHeight:width*.45,progress:1});
  assert.deepEqual(m,{top:0,bottom:0,scale:1,alpha:1});
 }
});
