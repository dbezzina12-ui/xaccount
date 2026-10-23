import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,applyOperation,applyBatch,History,parseCommand,compatible,safeSource,clone} from '../studio/project.js';
import {Reel} from '../engine/client/reels.js';
test('project round-trips with independent mobile and desktop scenes',()=>{const p=createProject();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);const moved=applyOperation(p,{type:'layer',scene:'mobile',id:'reels',values:{x:22,w:340}});assert.equal(moved.scenes.mobile.layers[0].x,22);assert.equal(moved.scenes.desktop.layers[0].x,p.scenes.desktop.layers[0].x);assert.equal(p.scenes.mobile.layers[0].x,10);});
test('grid changes gate Zombify gameplay and reject fractional or extreme grids',()=>{const p=createProject();assert.equal(compatible(p),true);for(const [columns,rows] of [[4,4],[5,4],[7,7],[10,10]])assert.equal(compatible(applyOperation(p,{type:'grid',values:{columns,rows}})),false);for(const values of [{columns:4.5},{rows:1000},{columns:NaN},{symbolScale:Infinity}])assert.throws(()=>applyOperation(p,{type:'grid',values}));});
test('agent batches validate atomically and reject prototype/unknown-property edits',()=>{const p=createProject();assert.throws(()=>applyBatch(p,[{type:'grid',values:{columns:7}},{type:'grid',values:{rows:999}}]));assert.equal(p.grid.columns,6);assert.throws(()=>applyOperation(p,{type:'background',scene:'__proto__',values:{blur:2}}));assert.throws(()=>applyOperation(p,{type:'grid',values:JSON.parse('{"__proto__":{"polluted":true}}')}));assert.throws(()=>applyOperation(p,{type:'layer',id:'reels',values:{id:'title'}}));assert.equal({}.polluted,undefined);});
test('undo and redo restore complete projects and clear abandoned future',()=>{const h=new History(createProject());const p=applyOperation(h.current,{type:'grid',values:{columns:7,rows:7}});h.commit(p,'Grid');h.undo();assert.equal(h.current.grid.columns,6);h.redo();assert.equal(h.current.grid.columns,7);h.undo();h.commit(applyOperation(h.current,{type:'background',values:{blur:3}}),'Blur');assert.equal(h.future.length,0);assert.equal(h.current.scenes.desktop.background.blur,3);});
test('commands drive the same operations and reject unsupported requests honestly',()=>{const p=createProject();assert.equal(applyBatch(p,parseCommand('grid 7×7',p)).grid.rows,7);assert.equal(applyBatch(p,parseCommand('saturation 120 and blur 3',p)).scenes.desktop.background.blur,3);assert.equal(applyBatch(p,parseCommand('symbols 115%',p)).grid.symbolScale,1.15);const changed=applyBatch(p,parseCommand('make reels bigger',p,'mobile'));assert.equal(changed.scenes.mobile.layers[0].w,407);assert.equal(changed.scenes.desktop.layers[0].w,620);assert.throws(()=>parseCommand('invent a new game',p),/AI model is not connected/);});
test('uploads and import sources cannot introduce executable markup',()=>{assert.equal(safeSource('javascript:alert(1)'),false);assert.equal(safeSource('data:image/svg+xml,<svg onload=alert(1)>'),false);assert.equal(safeSource('data:image/png;base64,aGVsbG8='),true);const p=createProject();p.assets[0].src='javascript:alert(1)';assert.throws(()=>validateProject(p));});
test('Claude reel animation lands on requested symbols for all studio presets',()=>{for(const rows of [4,5,7,10]){const strip=Int16Array.from({length:60},(_,i)=>i%12),r=new Reel(0,strip,rows);r.start(0,{speed:18});let stopped=false;for(let frame=0;frame<600;frame++){const t=frame*1000/60;if(t>1100&&!stopped){r.stop(13,{travel:3});stopped=true;}r.update(t,1/60);}assert.equal(r.spinning,false);for(let row=0;row<rows;row++)assert.equal(r.symbol(row),strip[(13+row)%60]);}});

// Regression tests added in Claude's studio review (2026-10-23).
test('undo history shares uploaded image bytes instead of copying them per step', () => {
  const big = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024);
  let p = applyOperation(createProject(), {type: 'asset', asset: {id: 'upload-big', name: 'big.png', src: big, kind: 'image'}});
  const h = new History(p);
  for (let i = 0; i < 60; i++) {
    p = applyOperation(h.current, {type: 'layer', scene: 'desktop', id: 'reels', values: {x: 300 + (i % 2)}});
    h.commit(p, 'Nudge');
  }
  const asset = h.current.assets.find((a) => a.id === 'upload-big');
  for (const snapshot of h.past) assert.equal(snapshot.assets.find((a) => a.id === 'upload-big'), asset, 'snapshots must reference one asset object');
  assert.ok(Object.isFrozen(asset), 'shared assets are immutable');
  assert.throws(() => { asset.src = 'x'; });
});

test('validation rejects mistyped names, flags, asset kinds and layer order', () => {
  const p = createProject();
  const bad = [
    {type: 'layer', scene: 'desktop', id: 'title', values: {name: {html: '<b>'}}},
    {type: 'layer', scene: 'desktop', id: 'title', values: {name: 'x'.repeat(81)}},
    {type: 'layer', scene: 'desktop', id: 'title', values: {visible: 'yes'}},
    {type: 'layer', scene: 'desktop', id: 'title', values: {locked: 1}},
    {type: 'grid', values: {texture: 'on'}},
    {type: 'grid', values: {supports: null}},
    {type: 'asset', asset: {id: 'a1', name: 7, src: 'data:image/png;base64,AA==', kind: 'image'}},
    {type: 'asset', asset: {id: 'a2', name: 'ok', src: 'data:image/png;base64,AA==', kind: 'script'}},
    {type: 'reorder', scene: 'desktop', id: 'title', index: 'top'},
    {type: 'addLayer', scene: 'desktop', layer: null},
  ];
  for (const op of bad) assert.throws(() => applyOperation(p, op), undefined, JSON.stringify(op));
  assert.equal(applyOperation(p, {type: 'layer', scene: 'desktop', id: 'title', values: {name: 'Logo', visible: false}}).scenes.desktop.layers[1].name, 'Logo');
});

test('blob: image URLs are accepted only for the live preview, never in saved or imported projects', () => {
  const p = createProject();
  p.assets[0] = {...p.assets[0], src: 'blob:http://localhost:8080/0b6b1c0e-8a4f-4d6e-9d5a-7f1c2a3b4c5d'};
  assert.throws(() => validateProject(p));
  assert.equal(validateProject(p, {preview: true}), p);
  p.assets[0] = {...p.assets[0], src: 'blob:javascript:alert(1)'};
  assert.throws(() => validateProject(p, {preview: true}));
});

test('history change detection ignores nothing but is cheap for large images', () => {
  const big = 'data:image/png;base64,' + 'B'.repeat(2 * 1024 * 1024);
  const p = applyOperation(createProject(), {type: 'asset', asset: {id: 'upload-big', name: 'big.png', src: big, kind: 'image'}});
  const h = new History(p);
  assert.equal(h.commit(clone(p), 'Same'), false, 'identical project is not a new step');
  assert.equal(h.commit(applyOperation(p, {type: 'grid', values: {divider: 0.5}}), 'Divider'), true);
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) h.commit(applyOperation(h.current, {type: 'grid', values: {divider: (i % 10) / 10}}), 'Divider');
  assert.ok(performance.now() - t0 < 400, 'fifty commits with a 2 MB image stay well under a frame budget each');
});
