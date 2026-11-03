// A single Stop must accelerate this free spin, not the rest of the bonus.
// Select real catalog tickets only in this fixture; shipping RNG is untouched.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';

let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
const control=(page)=>page.locator('[data-action=play]').first();
const state=(page)=>page.evaluate(()=>window.cyberSkunk.state);
const ticketFixture=()=>{
  window.stopTickets=[];
  const real=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=a=>{
    if(!(a instanceof Uint32Array&&a.length===2&&window.stopTickets.length))return real(a);
    const {ticket,total}=window.stopTickets.shift(),n=Math.floor((ticket+.5)/total*2**53);
    a[0]=Math.floor(n/2**21);a[1]=(n%2**21)*2**11;return a;
  };
};
async function finish(page){
  for(let i=0;i<500&&(await state(page)).busy;i++){
    await page.evaluate(()=>{
      if(!cyberSkunk.state.busy)return;
      const start=document.getElementById('bonus-panel-go');
      if(!document.getElementById('bonus-panel').hidden)start.click();
      else document.getElementById('controller').shadowRoot.querySelector('[data-action=play]').click();
    });
    await page.waitForTimeout(60);
  }
  assert.equal((await state(page)).busy,false,'bonus settles after subsequent deliberate Stops');
}

for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]]){
  for(const mode of ['ventbreak','overpressure'])test(`${label}: one Stop only skips the active ${mode} free spin`,async()=>{
    const page=await browser.newPage({viewport:{width,height},isMobile:label==='phone',hasTouch:label==='phone'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.addInitScript(ticketFixture);
      await page.goto(server.url+'games/cyber-skunk/runtime/index.html');
      await page.waitForFunction(()=>window.cyberSkunk?.state.ready);
      await page.locator('#intro-go').click();
      const expected=await page.evaluate(async mode=>{
        const {default:data}=await import('./catalog-data.js');
        const {PLAY_OPTIONS}=await import('./rules.js?v=8');
        const rows=data.pools[mode==='ventbreak'?'bonus-regular':'bonus-super'];
        // A quiet shipping round keeps tier popups out of this pacing check.
        const minimum=Math.min(...rows.map(r=>r[2])),index=rows.findIndex(r=>r[2]===minimum);
        window.stopTickets.push({ticket:rows.slice(0,index).reduce((n,r)=>n+r[1],0),total:data.total});
        return {seed:rows[index][0],paid:minimum,cost:PLAY_OPTIONS[mode].cost*cyberSkunk.state.bet};
      },mode);
      await page.locator('[data-action=buy]').first().click();
      await page.locator(`[data-pick=${mode}]`).click();
      await page.locator('#confirm-ok').click();
      await page.locator('#bonus-panel-go').waitFor({state:'visible'});
      await page.locator('#bonus-panel-go').click();
      await page.waitForFunction(()=>document.getElementById('hud-spins').textContent.startsWith('1 /')&&document.querySelector('.reel.spinning'));
      const before=await state(page);
      await control(page).click(); // exactly one Stop before the following checks
      await page.waitForFunction(()=>document.getElementById('hud-spins').textContent.startsWith('2 /')&&document.querySelector('.reel.spinning'));
      await page.waitForTimeout(200); // next spin must continue at normal speed
      const next=await page.evaluate(()=>({spin:document.getElementById('hud-spins').textContent,spinning:document.querySelectorAll('.reel.spinning').length,skip:cyberSkunk.state.skip,busy:cyberSkunk.state.busy,balance:cyberSkunk.state.balance,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history.length}));
      assert.match(next.spin,/^2 \/ /);
      assert.ok(next.spinning>0,'next spin still visibly spins after one Stop');
      assert.equal(next.skip,false,'Stop does not carry into the next free spin');
      assert.equal(next.busy,true);assert.equal(next.history,0,'bonus has not settled early');
      assert.equal(next.balance,before.balance,'no extra debit or early credit');
      assert.equal(next.balance,1_000_000-expected.cost);
      await finish(page);
      const final=await state(page);
      const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history);
      assert.equal(history.length,1);assert.equal(history[0].mode,mode);
      assert.equal(history[0].win,expected.paid);assert.equal(history[0].cost,expected.cost);
      assert.equal(final.balance,1_000_000-expected.cost+expected.paid);
      assert.deepEqual(errors,[]);
      const evidence={label,width,height,mode,expected,next,finalBalance:final.balance};
      console.log(JSON.stringify(evidence));
      if(process.env.CYBER_SKUNK_STOP_EVIDENCE){
        await mkdir(process.env.CYBER_SKUNK_STOP_EVIDENCE,{recursive:true});
        await writeFile(join(process.env.CYBER_SKUNK_STOP_EVIDENCE,`${label}-${mode}.json`),JSON.stringify(evidence,null,2)+'\n');
      }
    }finally{await page.close();}
  });
}
