import test from 'node:test';
import assert from 'node:assert/strict';
let requests=0,decodes=0;
globalThis.Image=class{set src(value){this.url=value;requests++;queueMicrotask(()=>this.onload());}async decode(){decodes++;}};
const {preloadWinArt,presentWin,WIN_ART}=await import('../dist/win-presentation.js');
const element=()=>({dataset:{},hidden:false,textContent:'',children:[],style:{setProperty(){}},classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},replaceChildren(...children){this.children=children;},focus(){},show(){},close(){}});
const makeNodes=()=>Object.fromEntries(['dialog','title','art','value','multiple','hint','proceed','coins','context'].map(k=>[k,element()]));
test('win graphics load and decode once, then reuse decoded nodes across payouts',async()=>{
 await preloadWinArt();await preloadWinArt();assert.equal(requests,4);assert.equal(decodes,4);
 const nodes=makeNodes();let first;
 for(const payout of [1000,2500,1000]){
  await presentWin({nodes,payout,units:payout,format:String,reduced:true,wait:async()=>{}});
  const image=nodes.art.children[0];assert.equal(image.url,payout===2500?WIN_ART.big:WIN_ART.nice);
  if(!first)first=image;else if(payout===1000)assert.equal(image,first);
  assert.equal(nodes.value.textContent,String(payout));assert.equal(nodes.art.hidden,false);
 }
 assert.equal(requests,4);assert.equal(decodes,4);
});
test('landing pause is brief and turbo shortens it further',async()=>{
 for(const turbo of [false,true]){
  const waits=[];await presentWin({nodes:makeNodes(),payout:1000,units:1000,format:String,reduced:true,turbo,wait:async ms=>{waits.push(ms);}});
  assert.equal(waits[0],turbo?80:200);
 }
});
