// Explicit diagnostic for the known preview blocker; not part of npm test.
// Observes the real UI without supplying tickets or changing the resolver.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {serve,chromium,ROOT} from '../../../../tools/lib/browser.mjs';
import data from '../../runtime/catalog-data.js';
import {playRound,seeded} from '../../runtime/engine.js';

const OUT=resolve(process.argv[2]??fileURLToPath(new URL('.',import.meta.url)));
const app=await readFile(join(ROOT,'games/cyber-skunk/runtime/app.js'),'utf8');
assert.ok(app.includes('rng:seeded(811)'),'This diagnostic targets the legacy path; review it after sampler changes.');
const poolInfo=name=>{
  const rows=data.pools[name].filter(r=>r[1]>0),values=rows.map(r=>r[2]);
  return {name,positiveRows:rows.length,tickets:rows.reduce((n,r)=>n+r[1],0),minHundredths:Math.min(...values),maxHundredths:Math.max(...values),seed811HasPositiveWeight:rows.some(r=>r[0]===811)};
};
const report={source:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),appSha256:createHash('sha256').update(app).digest('hex'),catalogVersion:data.version,scope:'Known-path UI diagnostic; no distribution/frequency estimate or acceptance of a future sampler',pools:Object.fromEntries(['bonus-regular','bonus-super','bonus-regular-natural','bonus-super-natural','bonus-hidden','spin-sprayjob'].map(n=>[n,poolInfo(n)])),runs:[]};
const server=await serve(),browser=await chromium();
try{
  const p=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.url+'games/cyber-skunk/runtime/index.html');await p.waitForFunction(()=>window.cyberSkunk?.state.ready);await p.locator('#intro-go').click();
  await p.evaluate(()=>{
    const real=crypto.getRandomValues.bind(crypto);window.previewDrawCalls=0;
    crypto.getRandomValues=a=>{if(a instanceof Uint32Array&&a.length===2)previewDrawCalls++;return real(a);};
    // Observe rendered amounts; cyberSkunk.state is deliberately a read-only copy.
    window.previewWinValues=[];const amount=document.getElementById('bigwin-amount');
    new MutationObserver(()=>previewWinValues.push(Math.round(Number(amount.textContent.replace(/[^0-9.]/g,''))*100))).observe(amount,{childList:true,characterData:true,subtree:true});
  });
  const snapshot=()=>p.evaluate(()=>({balance:cyberSkunk.state.balance,win:cyberSkunk.state.win,busy:cyberSkunk.state.busy,saved:JSON.parse(localStorage.getItem('cyber-skunk-session-v1'))}));
  for(const tier of ['sprayjob','regular','super','hidden'])for(let repeat=1;repeat<=2;repeat++){
    if(await p.locator('#buy-menu').isHidden())await p.locator('[data-action=buy]').first().click();
    await p.locator('[data-view=preview]').click();const before=await snapshot();
    await p.evaluate(()=>{previewWinValues=[];previewDrawCalls=0;});
    await p.locator(`[data-preview=${tier}]`).click();await p.waitForFunction(()=>cyberSkunk.state.busy);
    let finished=false;
    for(let i=0;i<850;i++){
      const busy=await p.evaluate(()=>{
        if(!cyberSkunk.state.busy)return false;
        if(!document.getElementById('bonus-panel').hidden){const b=document.getElementById('bonus-panel-go');if(!b.disabled)b.click();}
        else if(!document.getElementById('bigwin').hidden)document.getElementById('win-dismiss').click();
        else document.getElementById('controller').shadowRoot.querySelector('[data-action=play]').click();return true;
      });if(!busy){finished=true;break;}await p.waitForTimeout(60);
    }
    assert.ok(finished,'preview must finish');await p.locator('#buy-menu').waitFor({state:'visible'});
    const after=await snapshot(),observed=await p.evaluate(()=>({peakDisplayedWin:Math.max(0,...previewWinValues),catalogEntropyCalls:previewDrawCalls}));
    assert.equal(after.balance,before.balance);assert.deepEqual(after.saved,before.saved);assert.equal(after.win,before.win);assert.equal(after.busy,false);
    const legacy=playRound({rng:seeded(811),...(tier==='sprayjob'?{mode:tier,triggerScatters:0}:{forceBonus:tier})});
    assert.equal(observed.peakDisplayedWin,legacy.total,'UI value agrees with the inspected fixed-seed path at $1 bet');
    const row={tier,repeat,...observed,legacyTotalHundredths:legacy.total,balanceUnchanged:true,savedSessionUnchanged:true,returnsToShop:true};
    report.runs.push(row);console.log(JSON.stringify(row));
  }
  assert.deepEqual(errors,[]);report.pageErrors=errors;
  report.findings={allEightUseNoCatalogEntropy:report.runs.every(r=>r.catalogEntropyCalls===0),eachChoiceRepeats:report.runs.every(r=>r.peakDisplayedWin===report.runs.find(a=>a.tier===r.tier).peakDisplayedWin),hiddenBelowShippingFloor:report.runs.filter(r=>r.tier==='hidden').every(r=>r.peakDisplayedWin<report.pools['bonus-hidden'].minHundredths),walletAndHistoryPreserved:report.runs.every(r=>r.balanceUnchanged&&r.savedSessionUnchanged)};
  report.previewFidelityAccepted=false;
  await mkdir(OUT,{recursive:true});await writeFile(join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.findings));await p.close();
}finally{await browser.close();server.close();}
