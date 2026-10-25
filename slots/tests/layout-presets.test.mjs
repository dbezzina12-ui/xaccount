import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,applyOperation,validateProject,History,clone} from '../studio/project.js';
import {alignment,snapPosition} from '../studio/layout.js';
import {capturePreset,applyPreset,validatePreset} from '../studio/presets.js';
const edit=(p,id,values)=>applyOperation(p,{type:'layer',scene:'mobile',id,values});
test('linked descendants preserve offsets through movement, import and Undo; locked descendants stop the group',()=>{
 let p=createProject();p=edit(p,'title',{anchorId:'reels'});p=edit(p,'controls',{anchorId:'title'});
 const h=new History(p),start=clone(p);h.commit(edit(p,'reels',{x:30,y:190}));
 const s=validateProject(JSON.parse(JSON.stringify(h.current))).scenes.mobile;
 assert.equal(s.layers.find(l=>l.id==='title').x,43);assert.equal(s.layers.find(l=>l.id==='controls').y,630);
 assert.deepEqual(h.current.scenes.desktop,start.scenes.desktop);h.undo();assert.deepEqual(h.current,start);h.redo();assert.equal(h.current.scenes.mobile.layers[1].x,43);
 p=edit(p,'controls',{locked:true});assert.throws(()=>edit(p,'reels',{x:50}),/Unlock linked/);assert.deepEqual(p.scenes.mobile.layers.find(l=>l.id==='reels').x,10);
});
test('links reject missing parents/cycles and deleting a parent detaches children',()=>{
 let p=createProject();p=edit(p,'title',{anchorId:'reels'});assert.throws(()=>edit(p,'reels',{anchorId:'title'}),/cycle/);assert.throws(()=>edit(p,'controls',{anchorId:'missing'}),/existing/);
 p=applyOperation(p,{type:'addLayer',scene:'mobile',layer:{...p.scenes.mobile.layers[1],id:'extra',anchorId:''}});p=edit(p,'title',{anchorId:'extra'});
 p=applyOperation(p,{type:'removeLayer',scene:'mobile',id:'extra'});assert.equal(p.scenes.mobile.layers.find(l=>l.id==='title').anchorId,undefined);validateProject(p);
});
test('alignment uses canvas or safe margins, and snap honours the toggle and excludes moving descendants',()=>{
 const p=createProject(),s=p.scenes.desktop,l=s.layers.find(l=>l.id==='title');
 assert.deepEqual(alignment(s,l,'center'),{x:503});assert.deepEqual(alignment(s,l,'right'),{x:1005});
 s.guides={safe:true,margin:36};assert.deepEqual(alignment(s,l,'right'),{x:969});assert.deepEqual(alignment(s,l,'top'),{y:36});
 assert.equal(snapPosition(s,l,39,203).x,36);assert.equal(snapPosition(s,l,39,203).y,200);
 s.guides.snap=false;assert.deepEqual(snapPosition(s,l,39,203),{x:39,y:203});
 s.guides.snap=true;const reels=s.layers[0];l.anchorId='reels';l.x=106;l.y=106;assert.equal(snapPosition(s,reels,102,102).x,100);
 assert.throws(()=>alignment(s,{...l,locked:true},'center'),/Unlock/);
 for(const guides of [{margin:500},{grid:0},{safe:'yes'},{extra:true}])assert.throws(()=>applyOperation(p,{type:'guides',scene:'mobile',values:guides}));
});
test('cabinet presets round-trip with asset collision remapping, fit another canvas and preserve math settings',()=>{
 let source=createProject();source=applyOperation(source,{type:'cabinet',scene:'desktop',values:{frameAsset:'picture-frame',supports:false,fill:'#123456'}});
 const preset=capturePreset(source,'desktop','cabinet','Wooden');const original=JSON.stringify(preset);validatePreset(JSON.parse(original));
 const target=createProject();target.assets=target.assets.map(a=>a.id==='picture-frame'?{...a,src:'data:image/png;base64,YQ=='}:a);
 const after=applyPreset(target,'mobile',preset),a=after.scenes.mobile.cabinet;
 assert.notEqual(a.frameAsset,'picture-frame');assert.equal(after.assets.find(x=>x.id===a.frameAsset).src,preset.assets[0].src);
 assert.equal(after.scenes.mobile.layers[0].w,189);assert.equal(after.scenes.mobile.layers[0].h,158);assert.equal(a.frameWidth,8);assert.equal(after.scenes.mobile.layers[0].y,148);
 assert.deepEqual(after.grid,target.grid);assert.deepEqual(after.symbols,target.symbols);assert.deepEqual(after.scenes.desktop,target.scenes.desktop);assert.equal(JSON.stringify(preset),original);
 const twice=applyPreset(after,'mobile',preset);assert.equal(twice.assets.length,after.assets.length);
 const h=new History(target);h.commit(after);h.undo();assert.deepEqual(h.current,target);
});
test('sound packs replace overrides, remap audio IDs, preserve scenes and reject missing audio',()=>{
 const source=createProject();source.assets.push({id:'track',name:'Track',kind:'audio',src:'data:audio/wav;base64,YQ=='});source.sounds={'music-base':{assetId:'track',volume:.3,fade:1,loop:true}};
 const preset=capturePreset(source,'mobile','sounds','Quiet');const target=createProject();target.assets.push({id:'track',name:'Other',kind:'audio',src:'data:audio/wav;base64,Yg=='});target.sounds={'music-bonus':{volume:.2}};
 const p=applyPreset(target,'desktop',preset);assert.deepEqual(p.scenes,target.scenes);assert.equal(p.sounds['music-bonus'],undefined);assert.notEqual(p.sounds['music-base'].assetId,'track');assert.equal(p.sounds['music-base'].volume,.3);
 const invalid=structuredClone(preset);invalid.assets=[];assert.throws(()=>validatePreset(invalid),/Missing audio/);
 const empty=capturePreset(createProject(),'mobile','sounds','Original sounds');assert.deepEqual(applyPreset(p,'mobile',empty).sounds,{});
});
test('bonus presets replace only bonus screens and cannot carry math, live value text or injected styles',()=>{
 const p=createProject();p.scenes.mobile.screens={bonus:{panel:{x:12,scale:1.2},heading:{text:'OUTBREAK',color:'#123456'}}};
 const preset=capturePreset(p,'mobile','bonus','Outbreak');const target=createProject();target.scenes.desktop.screens={intro:{tagline:{text:'KEEP'}},bonus:{heading:{text:'OLD'}},result:{panel:{scale:2}}};
 const next=applyPreset(target,'desktop',preset);assert.deepEqual(next.scenes.desktop.screens.bonus,p.scenes.mobile.screens.bonus);assert.equal(next.scenes.desktop.screens.intro.tagline.text,'KEEP');assert.equal(next.scenes.desktop.screens.result,undefined);assert.deepEqual(next.scenes.mobile,target.scenes.mobile);assert.deepEqual(next.grid,target.grid);
 for(const settings of [{result:{total:{text:'1000000'}}},{bonus:{heading:{color:'red;display:none'}}},{intro:{panel:{x:5}}}])assert.throws(()=>validatePreset({...preset,settings}));
 assert.throws(()=>validatePreset({...preset,grid:{rows:7}}));assert.throws(()=>validatePreset({...preset,name:''}));assert.throws(()=>validatePreset({...preset,adapter:'other'}));
});
