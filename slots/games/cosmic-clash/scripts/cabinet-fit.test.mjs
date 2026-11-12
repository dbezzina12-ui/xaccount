import test from 'node:test';
import assert from 'node:assert/strict';
import {cabinetSize} from '../dist/cabinet-fit.js';

test('the complete cabinet fits above a separate phone controller in portrait and landscape',()=>{
 for(const [width,height,compact] of [[300,310,false],[340,430,false],[370,602,false],[392,685,false],[748,820,false],[824,276,true],[940,308,true],[1326,610,false]]){
  const fit=cabinetSize({width,height,mobile:true,compact});
  const reels=(fit.width-2*fit.inset)/fit.ratio;
  const whole=fit.cap+fit.top+reels+fit.sill;
  assert(fit.width<=width);assert(whole<=height-7,`${width}×${height}: cabinet overflow`);
  assert(reels>150,`${width}×${height}: playable reel area`);
 }
});

test('browser chrome and desktop controller height are included without stretching the reels',()=>{
 const tall=cabinetSize({width:392,height:600,mobile:true});
 const short=cabinetSize({width:392,height:340,mobile:true});
 assert(short.width<tall.width);assert.equal(short.ratio,1);assert.equal(tall.ratio,1);
 for(const controls of [80,92,135]){
  const fit=cabinetSize({width:1000,height:640,controls});
  const total=controls+fit.cap+fit.top+(fit.width-2*fit.inset)/fit.ratio+fit.sill;
  assert(total<=632);assert.equal(fit.ratio,1.12);
 }
});

test('desktop reels and controller match the reference footprint and scale down together',()=>{
 for(const [vw,vh,controls] of [[1918,1079,112],[1280,720,84],[960,600,80]]){
  const width=vw-36,height=vh-13;
  const fit=cabinetSize({width,height,controls});
  const reelWidth=fit.width-2*fit.inset,reelHeight=reelWidth/fit.ratio;
  assert(reelHeight/vh>.63 && reelHeight/vh<.72);
  assert(fit.deck>1.35*fit.width && fit.deck<=width);
  if(vw===1918){
   assert(Math.abs(reelWidth-832)<35);
   assert(Math.abs(reelHeight-743)<32);
   assert(Math.abs(fit.deck-1258)<45);
  }
 }
});
