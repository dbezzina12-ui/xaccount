// Real shipping wins: keyboard dismissal must match the existing click action,
// consume a held key until release, and leave settlement exactly once.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
const fixture=()=>{
  window.winKeyTickets=[];const real=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=a=>{
    if(!(a instanceof Uint32Array&&a.length===2&&winKeyTickets.length))return real(a);
    const {ticket,total}=winKeyTickets.shift(),n=Math.floor((ticket+.5)/total*2**53);
    a[0]=Math.floor(n/2**21);a[1]=(n%2**21)*2**11;return a;
  };
};
for(const [label,width,height,key,controllerFocus,bonus,menu] of [
  ['desktop-space',1366,768,'Space',false,false,false],
  ['desktop-held-enter',1366,768,'Enter',true,false,false],
  ['desktop-escape',1366,768,'Escape',false,false,false],
  ['phone-escape',390,844,'Escape',false,false,false],
  ['phone-bonus-total',390,844,'Space',true,true,false],
  ['desktop-menu-priority',1366,768,'Escape',false,false,true],
])test(`win keys: ${label}`,async()=>{
  const page=await browser.newPage({viewport:{width,height},isMobile:width<height,hasTouch:width<height});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.addInitScript(fixture);
    await page.goto(server.url+'games/cyber-skunk/runtime/index.html');await page.locator('#intro-go').click();
    const expected=await page.evaluate(async bonus=>{
      const {default:d}=await import('./catalog-data.js');const {PLAY_OPTIONS}=await import('./rules.js?v=8');
      const rows=d.pools[bonus?'bonus-regular':'spin-base'];
      const i=bonus?rows.findIndex(r=>r[2]===Math.min(...rows.map(r=>r[2]))):rows.findIndex(r=>r[2]>=2500&&r[2]<10000);
      if(!bonus)winKeyTickets.push({ticket:0,total:d.total});
      winKeyTickets.push({ticket:rows.slice(0,i).reduce((s,r)=>s+r[1],0),total:d.total});
      return {seed:rows[i][0],paid:rows[i][2],cost:PLAY_OPTIONS[bonus?'ventbreak':'base'].cost*cyberSkunk.state.bet};
    },bonus);
    if(bonus){
      await page.locator('[data-action=buy]').first().click();await page.locator('[data-pick=ventbreak]').click();await page.locator('#confirm-ok').click();await page.locator('#bonus-panel-go').click();
      for(let i=0;i<500;i++){
        if(await page.locator('#bigwin[data-scope=bonus-total]').isVisible())break;
        await page.evaluate(()=>{if(cyberSkunk.state.busy)document.querySelector('#controller').shadowRoot.querySelector('[data-action=play]').click();});
        await page.waitForTimeout(60);
      }
    }else if(controllerFocus)await page.locator('[data-action=play]').first().click();
    else{await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Space');}
    await page.locator('#bigwin').waitFor({state:'visible'});
    assert.equal(await page.locator('#bigwin').getAttribute('data-scope'),bonus?'bonus-total':'spin');
    if(controllerFocus)await page.locator('[data-action=play]').first().focus();
    if(menu){
      await page.locator('[data-action=settings]').first().click();
      const sound=await page.locator('#menu-sound').isChecked();await page.locator('#menu-sound').focus();await page.keyboard.press('Space');
      assert.equal(await page.locator('#menu-sound').isChecked(),!sound,'dialog keyboard action retains priority');
      assert.ok(await page.locator('#bigwin').isVisible(),'Space in the menu does not dismiss the award behind it');
      await page.locator('[data-close=menu]').click();
    }
    const before=await page.evaluate(()=>({balance:cyberSkunk.state.balance,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history.length}));
    await page.keyboard.down(key);
    await page.locator('#bigwin').waitFor({state:'hidden',timeout:1000});
    await page.waitForFunction(()=>!cyberSkunk.state.busy);
    await page.keyboard.down(key); // repeat while held, after the overlay has gone
    await page.waitForTimeout(100);await page.keyboard.up(key);await page.waitForTimeout(100);
    const after=await page.evaluate(()=>({balance:cyberSkunk.state.balance,busy:cyberSkunk.state.busy,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history}));
    assert.equal(before.history,0);assert.equal(before.balance,1_000_000-expected.cost);
    assert.equal(after.history.length,1,'held dismissal key does not wager again');assert.equal(after.busy,false);
    assert.equal(after.history[0].cost,expected.cost);assert.equal(after.history[0].win,expected.paid);
    assert.equal(after.balance,1_000_000-expected.cost+expected.paid);assert.deepEqual(errors,[]);
    const evidence={label,width,height,key,controllerFocus,bonus,menu,expected,before,after};console.log(JSON.stringify(evidence));
    if(process.env.CYBER_SKUNK_WIN_KEYS_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_WIN_KEYS_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_WIN_KEYS_EVIDENCE,label+'.json'),JSON.stringify(evidence,null,2)+'\n');}
  }finally{await page.close();}
});
