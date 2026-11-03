// Cap totals through shipping bought-Super and base-to-Hidden paths. The RNG
// override is confined to this fixture and selects positive-weight tickets.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
const fixture=()=>{
  window.rareKeyTickets=[];const real=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=a=>{
    if(!(a instanceof Uint32Array&&a.length===2&&rareKeyTickets.length))return real(a);
    const {ticket,total}=rareKeyTickets.shift(),n=Math.floor((ticket+.5)/total*2**53);
    a[0]=Math.floor(n/2**21);a[1]=(n%2**21)*2**11;return a;
  };
};
for(const [label,width,height,mode,tier,key] of [
  ['desktop-super-max',1366,768,'overpressure','super','Enter'],
  ['phone-base-hidden-max',390,844,'base','hidden','Escape'],
])test(`rare win keys: ${label}`,async()=>{
  const page=await browser.newPage({viewport:{width,height},isMobile:width<height,hasTouch:width<height});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.addInitScript(fixture);
    await page.goto(server.url+'games/cyber-skunk/runtime/index.html');await page.locator('#intro-go').click();
    const expected=await page.evaluate(async({mode,tier})=>{
      const {default:d}=await import('./catalog-data.js');const {PLAY_OPTIONS}=await import('./rules.js?v=8');
      const poolName=mode==='base'?(d.modes.base.bonuses?.hidden??'bonus-hidden'):d.modes[mode].pool;
      const rows=d.pools[poolName],i=rows.findIndex(r=>r[1]>0&&r[2]===d.cap);
      if(i<0)throw Error('No shipping cap row');
      const queue=ticket=>rareKeyTickets.push({ticket,total:d.total});
      let hiddenTickets=null;
      if(mode==='base'){
        const weights=d.modes.base.tiers;hiddenTickets=weights.hidden;
        if(!(hiddenTickets>0))throw Error('Hidden is not reachable from base');
        queue(weights.none+weights.regular+weights.super);queue(0);
      }
      queue(rows.slice(0,i).reduce((n,r)=>n+r[1],0));
      return {mode,tier,poolName,seed:rows[i][0],rowWeight:rows[i][1],hiddenTickets,totalTickets:d.total,cost:PLAY_OPTIONS[mode].cost*cyberSkunk.state.bet,paid:d.cap};
    },{mode,tier});
    if(mode==='base')await page.locator('[data-action=play]').first().click();
    else{await page.locator('[data-action=buy]').first().click();await page.locator('[data-pick=overpressure]').click();await page.locator('#confirm-ok').click();}
    await page.waitForFunction(()=>cyberSkunk.state.busy);
    const spinPopups=[];let started=false;
    for(let i=0;i<600;i++){
      if(!started&&await page.locator('#bonus-panel-go').isVisible()){
        await page.locator('#bonus-panel-go').click();started=true;
      }else{
        // Inspect and act atomically: an auto-closing spin popup can otherwise
        // become the final total between a visibility check and a click.
        const phase=await page.evaluate(()=>{
          const win=document.getElementById('bigwin');
          if(!win.hidden&&win.dataset.scope==='bonus-total')return {kind:'total'};
          if(document.querySelector('dialog[open]'))return {kind:'dialog'};
          if(!win.hidden){const title=document.getElementById('bigwin-title').textContent;document.getElementById('win-dismiss').click();return {kind:'spin',title};}
          if(cyberSkunk.state.busy){document.querySelector('#controller').shadowRoot.querySelector('[data-action=play]').click();return {kind:'skip'};}
          return {kind:'settled'};
        });
        if(phase.kind==='total')break;
        assert.notEqual(phase.kind,'settled','cap total must be presented before settlement');
        if(phase.kind==='spin')spinPopups.push(phase.title);
      }
      await page.waitForTimeout(60);
    }
    const award=page.locator('#bigwin[data-scope=bonus-total]');assert.ok(await award.isVisible());
    assert.equal(await page.locator('#bigwin-title').textContent(),'MAX WIN');
    const before=await page.evaluate(()=>({balance:cyberSkunk.state.balance,pending:cyberSkunk.state.pending,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history.length}));
    assert.equal(before.balance,1_000_000-expected.cost);assert.equal(before.pending.win,expected.paid);assert.equal(before.history,0);
    await page.locator('[data-action=play]').first().focus();await page.keyboard.down(key);
    await award.waitFor({state:'hidden',timeout:1000});await page.waitForFunction(()=>!cyberSkunk.state.busy);
    await page.keyboard.down(key);await page.waitForTimeout(100);await page.keyboard.up(key);await page.waitForTimeout(100);
    const after=await page.evaluate(()=>({balance:cyberSkunk.state.balance,busy:cyberSkunk.state.busy,amount:document.getElementById('bigwin-amount').textContent,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history}));
    assert.equal(after.busy,false);assert.equal(after.history.length,1,'held cap-dismiss key does not wager again');
    assert.equal(after.history[0].mode,mode);assert.equal(after.history[0].tier,tier);
    assert.equal(after.history[0].cost,expected.cost);assert.equal(after.history[0].win,expected.paid);
    assert.equal(after.balance,1_000_000-expected.cost+expected.paid);assert.equal(after.amount,'$25,000.00');assert.deepEqual(errors,[]);
    const evidence={label,width,height,key,expected,spinPopups,before,after};console.log(JSON.stringify(evidence));
    if(process.env.CYBER_SKUNK_RARE_KEYS_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_RARE_KEYS_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_RARE_KEYS_EVIDENCE,label+'.json'),JSON.stringify(evidence,null,2)+'\n');}
  }finally{await page.close();}
});
