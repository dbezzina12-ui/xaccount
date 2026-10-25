import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,sceneAppearance,applyBatch,applyOperation,validateProject,History} from '../studio/project.js';
test('legacy frames stay intact while desktop and mobile can diverge and round-trip',()=>{
 const p=createProject();p.grid.frameAsset='alley';
 assert.equal(sceneAppearance(p,'desktop').frameAsset,'alley');
 assert.equal(sceneAppearance(p,'mobile').frameAsset,'alley');
 const h=new History(p);h.commit(applyOperation(p,{type:'cabinet',scene:'mobile',values:{frameAsset:'picture-frame',frameWidth:18,supports:false,fill:'#123456',texture:false}}));
 const saved=validateProject(JSON.parse(JSON.stringify(h.current)));
 assert.equal(sceneAppearance(saved,'mobile').frameAsset,'picture-frame');
 assert.equal(sceneAppearance(saved,'mobile').supports,false);
 assert.deepEqual(saved.scenes.desktop,p.scenes.desktop);
 assert.deepEqual(saved.grid,p.grid);
 h.undo();assert.deepEqual(h.current,p);h.redo();assert.equal(sceneAppearance(h.current,'mobile').frameWidth,18);
});
test('uploaded frame assignment stays scoped and cabinet overrides reject math or missing assets',()=>{
 const p=createProject(),asset={id:'uploaded-frame',name:'Custom frame',kind:'image',src:'data:image/png;base64,AAAA'};
 const next=applyBatch(p,[{type:'asset',asset},{type:'cabinet',scene:'desktop',values:{frameAsset:asset.id}}]);
 assert.equal(sceneAppearance(next,'desktop').frameAsset,asset.id);
 assert.equal(sceneAppearance(next,'mobile').frameAsset,p.grid.frameAsset);
 assert.throws(()=>applyOperation(p,{type:'cabinet',scene:'mobile',values:{columns:7}}));
 assert.throws(()=>applyOperation(p,{type:'cabinet',scene:'mobile',values:{frameAsset:'missing'}}));
 const invalid=structuredClone(p);invalid.scenes.mobile.cabinet={rows:7};assert.throws(()=>validateProject(invalid));
});
