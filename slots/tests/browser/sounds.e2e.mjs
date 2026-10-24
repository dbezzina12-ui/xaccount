import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serve,chromium} from '../../tools/lib/browser.mjs';
import {AGENT_TOOLS,whenReady,project,runtime} from './helpers.mjs';
function wav(){const b=Buffer.alloc(44+1600);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(1600,40);return b;}
test('sound upload, actual runtime application, undo, reload and export/import',async()=>{
 const browser=await chromium(),srv=await serve();const ctx=await browser.newContext(),page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(AGENT_TOOLS);
 try{
  await page.goto(srv.url+'studio/');await whenReady(page,30000);await page.click('[data-tab=sounds]');
  const frame=runtime(page);await frame.evaluate(()=>{const rt=window.ZombifyStudioRuntime,original=rt.configureAudio;rt.configureAudio=(settings,assets)=>{window.__soundApplied={settings,assets};return original(settings,assets);};});
  await page.setInputFiles('#sound-file',{name:'test.wav',mimeType:'audio/wav',buffer:wav()});
  await page.waitForFunction(()=>document.querySelector('#sound-asset')?.selectedOptions[0].textContent==='test.wav');
  await page.fill('#sound-fade','0.2');await page.locator('#sound-fade').dispatchEvent('change');
  await page.uncheck('#sound-loop');await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved in this browser');
  await frame.waitForFunction(()=>window.__soundApplied?.settings['music-base']?.loop===false);
  const applied=await frame.evaluate(()=>window.__soundApplied);assert.match(applied.assets[0].src,/^blob:/);assert.equal(applied.settings['music-base'].fade,.2);
  await page.click('#undo');assert.notEqual((await project(page)).project.sounds['music-base'].loop,false);await page.click('#redo');
  const download=page.waitForEvent('download');await page.click('#export');const file=await download;const path=await file.path();
  await page.reload();await whenReady(page,30000);await page.click('[data-tab=sounds]');assert.equal(await page.locator('#sound-loop').isChecked(),false);
  await page.click('#sound-reset');await page.setInputFiles('#import-input',path);await page.waitForFunction(()=>document.querySelector('#sound-asset')?.selectedOptions[0].textContent==='test.wav');assert.equal(await page.locator('#sound-loop').isChecked(),false);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('[data-tab=sounds]').isVisible());
  await page.screenshot({path:'/tmp/studio-sounds-mobile.png'});assert.deepEqual(errors,[]);
 }finally{await browser.close();srv.close();}
});
