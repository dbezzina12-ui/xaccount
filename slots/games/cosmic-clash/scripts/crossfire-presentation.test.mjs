import test from 'node:test';
import assert from 'node:assert/strict';
import {pistolAim,pistolLayout,presentCrossfire,PISTOL_ART} from '../dist/crossfire-presentation.js';

test('a mobile pistol aims through its muzzle at every placement without extending beyond the target',()=>{
 for(const width of [300,390,540]){
  const surface={left:0,top:0,width,height:820},reels={bottom:550},targets=[{x:width*.1,y:510},{x:width*.5,y:270},{x:width*.9,y:390}];
  const layout=pistolLayout({surface,reels,targets});assert(layout.width<=340);
  for(const target of targets){
   const a=pistolAim({...layout,target}),dx=target.x-layout.pivot.x,dy=target.y-layout.pivot.y,mx=a.muzzle.x-layout.pivot.x,my=a.muzzle.y-layout.pivot.y;
   assert(Math.abs(dx*my-dy*mx)<1e-7,'Muzzle lies on target vector');
   assert(Math.hypot(mx,my)<Math.hypot(dx,dy),'Muzzle stops before target');
   assert.equal(a.width/a.height,PISTOL_ART.ratio);
  }
 }
});
function fixture(onAnimation=()=>{}){
 const nodes=[],events=[],motions=new Set();
 const doc={createElement(tag){
  const node={tag,className:'',style:{},isConnected:false,children:[],ownerDocument:doc,
   setAttribute(){},addEventListener(){},append(...kids){for(const k of kids){this.children.push(k);k.parent=this;k.isConnected=this.isConnected;}},
   remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},
   animate(frames,options){events.push('animation');onAnimation();return {finished:Promise.resolve(),cancel(){},finish(){}};},
   getBoundingClientRect(){return {left:0,top:0,width:390,height:820,bottom:820};}
  };nodes.push(node);return node;
 }};
 const surface=doc.createElement('surface');surface.isConnected=true;
 const reels={getBoundingClientRect:()=>({left:10,top:100,width:370,height:400,bottom:500})};
 const placements=[{reel:1,row:2},{reel:2,row:1},{reel:3,row:3}];
 return {nodes,events,motions,surface,reels,placements,getTarget:p=>({getBoundingClientRect:()=>({left:20+p.reel*70,top:100+p.row*70,width:70,height:70})}),wait:async()=>{},onPlacement:p=>events.push(`place-${p.reel}`),onShot:p=>events.push(`shot-${p.reel}`)};
}
test('one shot precedes each recorded placement, then all effect nodes and motions are removed',async()=>{
 const f=fixture();await presentCrossfire({...f,mobile:true});
 assert.deepEqual(f.events.filter(e=>e!=='animation'),['shot-1','place-1','shot-2','place-2','shot-3','place-3']);
 assert.equal(f.surface.children.length,0);assert.equal(f.motions.size,0);
 assert(!f.nodes.some(n=>n.className==='shot'),'No beam nodes');
});
test('skipping at entry or after the first shot settles every placement once and suppresses remaining shots',async()=>{
 for(const atEntry of [true,false]){
  const f=fixture();let skip=atEntry;
  await presentCrossfire({...f,mobile:true,instant:()=>skip,onShot:p=>{f.onShot(p);skip=true;}});
  assert.deepEqual(f.events.filter(e=>e.startsWith('place')),['place-1','place-2','place-3']);
  assert.deepEqual(f.events.filter(e=>e.startsWith('shot')),atEntry?[]:['shot-1']);
  assert.equal(f.surface.children.length,0);assert.equal(f.motions.size,0);
 }
});
test('leaving a demo during the entrance aborts its placements and cleans up the pistol',async()=>{
 let canceled=false;const f=fixture(()=>{canceled=true;});
 await presentCrossfire({...f,mobile:true,canceled:()=>canceled});
 assert(!f.events.some(e=>e.startsWith('place')));assert.equal(f.surface.children.length,0);assert.equal(f.motions.size,0);
});
test('desktop emits character shooting cues and impacts without spawning a mobile pistol',async()=>{
 const f=fixture(),cues=[];await presentCrossfire({...f,onActorShot:e=>cues.push(e)});
 assert.deepEqual(cues.map(c=>c.placement),f.placements);assert(!f.nodes.some(n=>n.className==='crossfire-pistol'));
 assert.equal(f.surface.children.length,0);
});
