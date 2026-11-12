import test from 'node:test';
import assert from 'node:assert/strict';
import {actorPlacement,sceneControlPlacement} from '../dist/scene-characters.js';
import {SCENE_ACTORS} from '../dist/scene-actor-art.js';
const geometry=(w,h)=>({left:20,top:12,right:w+20,bottom:h+12,width:w,height:h});
test('Buy stays beside the controller at the cabinet lower-left corner across desktop sizes',()=>{
 for(const [w,h,size] of [[1903,911,800],[1715,794,675],[1920,1080,980],[1280,720,586],[1100,650,508]]){
  const game=geometry(w,h),reels={left:game.left+(w-size)/2+22,right:game.left+(w+size)/2-22,height:(size-44)/1.12};
  const controller={top:game.top+h-94,height:80};
  const layout=sceneControlPlacement({game,reels,controller});assert(layout);
  assert.equal(layout.buy.size,88);
  assert.equal(layout.buy.y+44,controller.top+controller.height/2);
  const cabinetLeft=reels.left-22,gap=cabinetLeft-(layout.buy.x+44);
  assert(gap>=16&&gap<=20);assert(layout.buy.x-44>game.left);
 }
 for(const [w,h] of [[390,844],[820,1180],[844,390],[1280,500]])assert.equal(sceneControlPlacement({game:geometry(w,h),reels:{},controller:{}}),null);
});
test('the cast stays full-body at scene scale, with feet on the road and space beside the reels',()=>{
 for(const [w,h,size] of [[1903,911,800],[1715,794,675],[1920,1080,980],[1280,720,586],[1100,650,508]]){
  const game=geometry(w,h),reels={left:game.left+(w-size)/2+12,right:game.left+(w+size)/2-12,height:(size-24)/1.12};
  for(const art of Object.values(SCENE_ACTORS)){
   const p=actorPlacement({game,reels,art,side:art.side});assert(p.visible);
   assert(p.ink.height<=game.height*.56);assert(p.ink.top>=0);
   assert(Math.abs(p.ink.top+p.ink.height-p.floor)<1e-8);
   assert(p.floor>=game.height*.72&&p.floor<=game.height*.94);
   assert(p.ink.left>=16&&p.ink.left+p.ink.width<=game.width-16);
   if(art.side==='left')assert(p.ink.left+p.ink.width<=reels.left-game.left-18+1e-8);
   else assert(p.ink.left>=reels.right-game.left+18);
   assert.equal(p.contacts.length,art.feet.length);
   assert(p.contacts.every(c=>c.top<=p.floor&&c.width>0));
   assert(Math.abs(p.width/p.height-art.width/art.height)<1e-8);
  }
 }
});
