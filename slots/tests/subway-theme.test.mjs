import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubwayProject,validateProject} from '../studio/project.js';
import {subwayRules,subwayLayout,INFECTED_CELLS} from '../studio/subway-theme.js';
test('subway preset supplies both layouts with original controller proportions',()=>{
 const p=validateProject(createSubwayProject());
 assert.equal(p.scenes.desktop.background.assetId,'subway-desktop');
 assert.equal(p.scenes.mobile.background.assetId,'subway-background');
 for(const [key,s] of Object.entries(p.scenes)){
  const r=s.layers.find(l=>l.id==='reels'),c=s.layers.find(l=>l.id==='controls');
  assert.ok(r.y+r.h<c.y);
  assert.equal(c.w/c.h,key==='desktop'?880/100:390/214);
  const {counter}=subwayLayout(s);assert.ok(counter.x>=0&&counter.x+counter.w<=s.width);
 }
});
test('infected portraits and FS use dedicated atlas cells in game and guide',()=>{
 const p=createSubwayProject(),s=p.scenes.mobile;
 const css=subwayRules(p,s.layers.find(l=>l.id==='title'),p.grid,s,s.layers.find(l=>l.id==='reels'),id=>id);
 assert.equal(Object.keys(INFECTED_CELLS).length,6);
 assert.match(css,/:is\(#game,#welcome\).*art-vial/);
 assert.match(css,/\.tube-zombie\{background-image:.*subway-infected/);
 assert.doesNotMatch(css,/sepia|hue-rotate/);
 assert.match(css,/box-sizing:border-box!important/);
});
test('custom portrait assignments are preserved by the theme',()=>{
 const p=createSubwayProject();p.symbols.nurse='custom-nurse';const s=p.scenes.mobile;
 const css=subwayRules(p,s.layers.find(l=>l.id==='title'),p.grid,s,s.layers.find(l=>l.id==='reels'),id=>id);
 assert.doesNotMatch(css,/art-nurse/);
});
