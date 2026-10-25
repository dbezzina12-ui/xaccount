import test from 'node:test';
import assert from 'node:assert/strict';
import {reelTeasePlan,reelFrames} from '../games/zombify/runtime/reel-tease.js';
import {teaseMessage,createTeasePresentation} from '../games/zombify/runtime/tease-presentation.js';
const boardAt=positions=>Array.from({length:30},(_,i)=>({kind:positions.includes(i)?'vial':'j'}));
test('anticipation respects all playback speeds, never mutates the board, and ends on exact symbols',()=>{
 for(const positions of [[0,6],[0,1],[6,14,22,29],[4,5],[]]){
  const b=boardAt(positions),copy=structuredClone(b);let previous=Infinity;
  for(const [speed,scale] of [['normal',1],['quick',.45],['turbo',.16]]){
   const plans=reelTeasePlan(b,false,speed);assert.ok(plans.every((p,i)=>i===0||p.ms>plans[i-1].ms));
   if(plans.some(p=>p.tease)){assert.ok(plans.at(-1).ms<previous);previous=plans.at(-1).ms;}
   for(const p of plans){const t=p.tease?{...p,start:p.start*scale,ms:p.start*scale+p.ms-p.start}:p;const frames=reelFrames({distance:2900,unit:100},t);assert.equal(frames.at(-1).transform,'translateY(0px)');assert.ok(frames.every((f,i)=>f.offset>=0&&f.offset<=1&&(i===0||f.offset>frames[i-1].offset)));assert.ok(frames.every(f=>!('filter' in f)));}
  }
  assert.deepEqual(b,copy);assert.ok(reelTeasePlan(b,true).every(p=>!p.tease));
 }
});
test('tease copy confirms only the already-landed tier',()=>{
 assert.doesNotMatch(teaseMessage(2).title,/SECURED/);assert.equal(teaseMessage(3).title,'OUTBREAK SECURED');assert.equal(teaseMessage(4).title,'SUPER OUTBREAK SECURED');assert.equal(teaseMessage(5).title,'HIDDEN OUTBREAK SECURED');
});
class Node{
 constructor(doc){this.ownerDocument=doc;this.children=[];this.isConnected=true;this.hidden=false;this.clientWidth=600;this.clientHeight=500;this.style={setProperty(){}};const classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
 setAttribute(){}getBoundingClientRect(){return {left:0,top:0,bottom:500,width:600,height:500};}querySelectorAll(){return [];}
}
test('tease HUD and dimming are removed on normal finish and skip; late callbacks cannot recreate them',()=>{
 for(const skip of [false,true]){
  const doc={createElement:()=>new Node(doc),createElementNS:()=>new Node(doc)},camera=new Node(doc),host=new Node(doc),board=new Node(doc);camera.append(host);host.append(board);for(let i=0;i<30;i++)board.append(new Node(doc));
  let skipping=false;const presentation=createTeasePresentation({host,board,shouldSkip:()=>skipping}),cells=boardAt([0,1]),reels=Array.from({length:6},()=>({window:new Node(doc)}));
  presentation.settle({reel:0,count:1,board:cells,reels});assert.equal(camera.children.find(n=>n.className==='tease-status').hidden,true);
  presentation.settle({reel:1,count:2,board:cells,reels});assert.equal(camera.children.find(n=>n.className==='tease-status').hidden,false);assert.equal(board.children[0].classList.contains('fs-locked'),true);
  skipping=skip;presentation.clear();presentation.clear();presentation.settle({reel:2,count:3,board:cells,reels});
  assert.equal(camera.children.length,1);assert.equal(host.children.length,1);assert.equal(camera.classList.contains('tease-camera-in'),false);assert.ok(board.children.every(n=>!n.classList.contains('tease-muted')&&!n.classList.contains('fs-locked')));
 }
});
