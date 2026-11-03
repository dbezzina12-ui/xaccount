// Ordinary game-selection URL must enter the shipping runtime, not model.json.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
for(const [name,width,height] of [['desktop',1366,768],['phone',390,844]])test(`ordinary entry: ${name} launches, settles and resumes credits`,async()=>{
  const p=await browser.newPage({viewport:{width,height},isMobile:name==='phone',hasTouch:name==='phone'}),errors=[],failed=[],paths=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));
  p.on('request',r=>paths.push(new URL(r.url()).pathname));
  try{
    await p.goto(server.url+'index.html?game=cyber-skunk&entry=ordinary#launch');
    await p.waitForURL('**/games/cyber-skunk/runtime/index.html?entry=ordinary#launch');
    await p.waitForFunction(()=>window.cyberSkunk?.state.ready);await p.locator('#intro-go').click();
    const url=new URL(p.url());assert.equal(url.searchParams.get('game'),null);assert.equal(url.searchParams.get('entry'),'ordinary');assert.equal(url.hash,'#launch');
    assert.ok(!paths.some(s=>s.endsWith('/model.json')),'legacy boot must not request a model');
    assert.ok(paths.some(s=>s.endsWith('/catalog-data.js')),'shipping catalog loads');
    await p.locator('[data-action=play]').first().click();
    for(let i=0;i<650;i++){
      const busy=await p.evaluate(()=>{
        if(!cyberSkunk.state.busy)return false;
        if(!document.getElementById('bonus-panel').hidden){const b=document.getElementById('bonus-panel-go');if(!b.disabled)b.click();}
        else if(!document.getElementById('bigwin').hidden)document.getElementById('win-dismiss').click();
        else document.getElementById('controller').shadowRoot.querySelector('[data-action=play]').click();return true;
      });if(!busy)break;await p.waitForTimeout(60);
    }
    const read=()=>p.evaluate(()=>({balance:cyberSkunk.state.balance,busy:cyberSkunk.state.busy,saved:JSON.parse(localStorage.getItem('cyber-skunk-session-v1'))}));
    const settled=await read();assert.equal(settled.busy,false);assert.equal(settled.saved.history.length,1);
    const round=settled.saved.history[0];assert.equal(round.mode,'base');assert.equal(round.cost,100);assert.equal(settled.balance,1_000_000-round.cost+round.win);
    await p.reload();await p.waitForFunction(()=>window.cyberSkunk?.state.ready);const resumed=await read();
    assert.equal(resumed.balance,settled.balance);assert.deepEqual(resumed.saved.history,settled.saved.history);assert.equal(resumed.busy,false);
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    if(process.env.CYBER_SKUNK_ENTRY_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_ENTRY_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_ENTRY_EVIDENCE,name+'.json'),JSON.stringify({width,height,entry:url.pathname+url.search+url.hash,round,balance:settled.balance,resumedBalance:resumed.balance,errors,failedCount:failed.length,requestCount:paths.length,legacyModelRequested:paths.some(s=>s.endsWith('/model.json')),shippingCatalogRequested:paths.some(s=>s.endsWith('/catalog-data.js'))},null,2)+'\n');}
  }finally{await p.close();}
});
