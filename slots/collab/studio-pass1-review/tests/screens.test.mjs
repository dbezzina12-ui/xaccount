import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,applyOperation,History,validateProject} from '../studio/project.js';
import {screenCSS} from '../studio/screens-schema.js';
import {createScreenText} from '../studio/screens-text.js';
test('screen adjustments survive export/import and undo without changing desktop or math',()=>{
 const original=createProject(),history=new History(original);
 const edited=applyOperation(original,{type:'screens',scene:'mobile',values:{counter:{hand:{scale:1.5},label:{x:4,fontSize:13}}}});
 history.commit(edited,'Adjust hand');
 const imported=validateProject(JSON.parse(JSON.stringify(history.current)));
 assert.equal(imported.scenes.mobile.screens.counter.hand.scale,1.5);
 assert.deepEqual(imported.scenes.desktop,original.scenes.desktop);
 assert.deepEqual(imported.grid,original.grid);
 history.undo();assert.equal(history.current.scenes.mobile.screens,undefined);
 history.redo();assert.equal(history.current.scenes.mobile.screens.counter.label.fontSize,13);
});
test('panel offsets preserve native vertical centering and scope intro/result separately',()=>{
 const css=screenCSS({bonus:{panel:{y:12}},result:{panel:{y:-8},total:{fontSize:40}}});
 assert.match(css,/calc\(-50% \+ 12px\)/);
 assert.match(css,/#feature\[data-view="result"\] #feature-content/);
 assert.match(css,/#feature-result-value.*font-size:40px/);
 assert.throws(()=>screenCSS({counter:{hand:{scale:NaN}}}));
});
test('jar position and scale survive save and Undo independently of the hand',()=>{
 const p=createProject(),h=new History(p);
 h.commit(applyOperation(p,{type:'screens',scene:'mobile',values:{infection:{rack:{x:-12,y:8,scale:1.25}},counter:{hand:{scale:1.5}}}}));
 const saved=validateProject(JSON.parse(JSON.stringify(h.current)));
 assert.equal(saved.scenes.mobile.screens.infection.rack.scale,1.25);
 assert.equal(saved.scenes.mobile.screens.counter.hand.scale,1.5);
 assert.equal(saved.scenes.desktop.screens,undefined);
 h.undo();assert.deepEqual(h.current,p);
});
test('art-only scaling and typography round-trip without changing live values',()=>{
 const p=createProject(),h=new History(p);
 const screens={counter:{art:{scale:1.8},label:{text:'SPINS LEFT',color:'#ffcc88',fontFamily:'lilita'},value:{fontSize:28}}};
 h.commit(applyOperation(p,{type:'screens',scene:'mobile',values:screens}));
 const saved=validateProject(JSON.parse(JSON.stringify(h.current)));
 assert.deepEqual(saved.scenes.mobile.screens,screens);
 assert.deepEqual(saved.scenes.desktop,p.scenes.desktop);
 const css=screenCSS(screens);assert.match(css,/\.counter-art\{[^}]*scale:1.8/);
 assert.doesNotMatch(css,/#free-spins-counter\{/);
 assert.match(css,/font-family:"Lilita One",sans-serif/);
 for(const invalid of [{counter:{value:{text:'999'}}},{result:{total:{text:'999'}}},{counter:{label:{color:'red;display:none'}}},{counter:{label:{fontFamily:'url(evil)'}}}])assert.throws(()=>screenCSS(invalid));
 h.undo();assert.deepEqual(h.current,p);h.redo();assert.equal(h.current.scenes.mobile.screens.counter.label.text,'SPINS LEFT');
});
test('label overrides restore the latest game wording and remain plain text',()=>{
 const el={textContent:'FREE SPINS',contains:()=>false},root={querySelectorAll:s=>s==='#free-spins-label'?[el]:[]};
 let callback;class Observer{constructor(fn){callback=fn;}observe(){}disconnect(){}}
 const text=createScreenText(root,Observer);
 text.set({counter:{label:{text:'<b>LEFT</b>'}}});assert.equal(el.textContent,'<b>LEFT</b>');assert.equal(text.original(el),'FREE SPINS');
 el.textContent='BONUS COMPLETE';callback([{type:'childList',target:el}]);assert.equal(el.textContent,'<b>LEFT</b>');
 text.set({});assert.equal(el.textContent,'BONUS COMPLETE');
 text.set({counter:{label:{text:'LEFT'}}});text.set({counter:{label:{text:''}}});assert.equal(el.textContent,'BONUS COMPLETE');
});

test('focused screen edits enter save history before blur, once only',async()=>{
 const {mountScreens}=await import('../studio/screens.js');
 const {applyBatch}=await import('../studio/project.js');
 const previous=globalThis.document,host={querySelector:()=>null,querySelectorAll:()=>[]};
 globalThis.document={getElementById:()=>host};
 try{
  const h=new History(createProject());
  const panel=mountScreens({getProject:()=>h.current,getScene:()=> 'mobile',commit:p=>h.commit(p),applyBatch,checkEditable:()=>{},send:()=>{},toast:()=>{}});
  host.onchange({target:{id:'screen-part',value:'label'}});
  host.oninput({target:{dataset:{screenStyle:'text'},value:'SPINS TO GO',checkValidity:()=>true}});
  assert.equal(h.current.scenes.mobile.screens,undefined);
  panel.flush();
  assert.equal(h.current.scenes.mobile.screens.counter.label.text,'SPINS TO GO');
  assert.equal(h.current.scenes.desktop.screens,undefined);
  const steps=h.past.length;panel.flush();assert.equal(h.past.length,steps);
  h.undo();assert.equal(h.current.scenes.mobile.screens,undefined);
  h.redo();assert.equal(h.current.scenes.mobile.screens.counter.label.text,'SPINS TO GO');
  host.oninput({target:{dataset:{screenStyle:'color'},value:'#bad!',checkValidity:()=>false}});
  panel.flush();assert.equal(h.past.length,steps);
 }finally{globalThis.document=previous;}
});
