// Rendered config prices and integer-cent settlement at selectable stake limits.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
const KEY='cyber-skunk-session-v1',BANK=100_000_000;
const money=c=>'$'+(c/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
let server,browser,limits,options;
async function open({width=1366,height=768,balance=BANK,bet=100}={}){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<height,hasTouch:width<height});
  await page.addInitScript(([key,saved])=>localStorage.setItem(key,JSON.stringify(saved)),[KEY,{balance,bet}]);
  await page.goto(server.url+'games/cyber-skunk/runtime/index.html');await page.locator('#intro-go').click();return page;
}
before(async()=>{
  server=await serve();browser=await chromium();const p=await open();
  try{await p.locator('[data-action=bet]').first().click();const stakes=await p.locator('[data-stake]').evaluateAll(bs=>bs.map(b=>Number(b.dataset.stake)));limits={min:Math.min(...stakes),max:Math.max(...stakes)};options=await p.evaluate(async()=>({...((await import('./rules.js?v=8')).PLAY_OPTIONS)}));}
  finally{await p.close();}
});
after(async()=>{await browser?.close();server?.close();});
async function record(name,data){console.log(JSON.stringify({name,...data}));if(process.env.CYBER_SKUNK_STAKE_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_STAKE_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_STAKE_EVIDENCE,name+'.json'),JSON.stringify(data,null,2)+'\n');}}
const balance=p=>p.evaluate(()=>cyberSkunk.state.balance);
async function stake(p,value){await p.locator('[data-action=bet]').first().click();await p.locator(`[data-stake="${value}"]`).click();}
for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]])test(`stake prices: ${label} minimum and maximum`,async()=>{
  const p=await open({width,height}),rows=[];
  try{for(const edge of ['min','max']){
    const bet=limits[edge];await stake(p,bet);await p.locator('[data-action=buy]').first().click();
    await p.evaluate(()=>document.fonts.ready.then(()=>true));
    assert.equal(await p.locator('#buy-bet').textContent(),money(bet));
    assert.equal(await p.locator(`[data-bet="${edge==='min'?'-1':'1'}"]`).isDisabled(),true);
    for(const mode of ['ventbreak','overpressure','mystery']){
      const cost=bet*options[mode].cost,button=p.locator(`[data-pick=${mode}]`);
      assert.ok((await button.getAttribute('aria-label')).includes(money(cost)));
      assert.ok((await button.locator('.stub-price').textContent()).includes(money(cost)));
      assert.ok(await button.locator('.stub-price').evaluate(e=>{const range=document.createRange();range.selectNode(e.firstChild);const text=range.getBoundingClientRect(),box=e.getBoundingClientRect();return text.left>=box.left-.5&&text.right<=box.right+.5;}),'full price fits the stub content area');
      await button.click();await p.locator('#confirm').waitFor({state:'visible'});
      assert.equal(await p.locator('#confirm-bet').textContent(),money(bet));
      assert.equal(await p.locator('#confirm-cost').textContent(),options[mode].cost+'×');
      assert.equal(await p.locator('#confirm-total').textContent(),money(cost));
      assert.equal(await p.locator('#confirm-balance').textContent(),money(BANK-cost));
      assert.ok(await p.locator('#confirm-ok').isEnabled());
      await p.locator('#confirm-cancel').click();await p.locator('#confirm').waitFor({state:'hidden'});
      assert.equal(await balance(p),BANK,'cancelling never charges');rows.push({edge,bet,mode,cost,cancelBalance:BANK});
    }
    await p.locator('[data-view=feature]').click();
    for(const mode of ['enhanced','sprayjob']){
      const cost=bet*options[mode].cost,button=p.locator(`[data-pick=${mode}]`);
      assert.ok((await button.getAttribute('aria-label')).includes(money(cost)));
      assert.ok((await button.locator('.offer-price').textContent()).includes(money(cost)));
      assert.equal(await button.locator('.offer-price small').textContent(),options[mode].cost+'× base bet');
      assert.ok(await button.isEnabled());rows.push({edge,bet,mode,cost});
    }
    await p.locator('[data-close=buy-menu]').click();assert.equal(await balance(p),BANK);
  }await record('prices-'+label,{limits,rows});}finally{await p.close();}
});
for(const edge of ['min','max'])for(const short of [false,true])test(`stake balance boundary: ${edge} ${short?'one cent short':'exact credit'}`,async()=>{
  const bet=limits[edge],cost=bet*options.ventbreak.cost,start=cost-(short?1:0),p=await open({bet,balance:start});
  try{await p.locator('[data-action=buy]').first().click();const button=p.locator('[data-pick=ventbreak]');assert.equal(await button.isDisabled(),short);
    if(!short){await button.click();await p.locator('#confirm').waitFor({state:'visible'});assert.ok(await p.locator('#confirm-ok').isEnabled());assert.equal(await p.locator('#confirm-balance').textContent(),'$0.00');await p.locator('#confirm-cancel').click();await p.locator('#confirm').waitFor({state:'hidden'});}
    else{await button.evaluate(b=>b.click());assert.ok(await p.locator('#confirm').isHidden());}
    assert.equal(await balance(p),start);await record(`boundary-${edge}-${short?'short':'exact'}`,{bet,cost,balance:start,disabled:short});
  }finally{await p.close();}
});
const tickets=()=>{
  window.stakeTickets=[];const real=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=a=>{if(!(a instanceof Uint32Array&&a.length===2&&stakeTickets.length))return real(a);const {ticket,total}=stakeTickets.shift(),n=Math.floor((ticket+.5)/total*2**53);a[0]=Math.floor(n/2**21);a[1]=(n%2**21)*2**11;return a;};
};
for(const edge of ['min','max'])test(`stake settlement: ${edge} catalog award is whole cents`,async()=>{
  const p=await open({bet:limits[edge]});
  try{
    await p.evaluate(tickets);
    const expected=await p.evaluate(async()=>{const {default:d}=await import('./catalog-data.js'),rows=d.pools['bonus-regular'];const min=Math.min(...rows.map(r=>r[2])),i=rows.findIndex(r=>r[2]===min);stakeTickets.push({ticket:rows.slice(0,i).reduce((n,r)=>n+r[1],0),total:d.total});return {seed:rows[i][0],hundredths:min};});
    const bet=limits[edge],cost=bet*options.ventbreak.cost,paid=bet*expected.hundredths/100;assert.ok(Number.isSafeInteger(paid));
    await p.locator('[data-action=buy]').first().click();await p.locator('[data-pick=ventbreak]').click();await p.locator('#confirm-ok').click();await p.waitForFunction(()=>cyberSkunk.state.busy);
    for(let i=0;i<600;i++){
      const busy=await p.evaluate(()=>{
        if(!cyberSkunk.state.busy)return false;
        if(document.querySelector('dialog[open]')){const start=document.getElementById('bonus-panel-go');if(!document.getElementById('bonus-panel').hidden&&!start.disabled)start.click();}
        else if(!document.getElementById('bigwin').hidden)document.getElementById('win-dismiss').click();
        else document.querySelector('#controller').shadowRoot.querySelector('[data-action=play]').click();return true;
      });if(!busy)break;await p.waitForTimeout(60);
    }
    const after=await p.evaluate(()=>({balance:cyberSkunk.state.balance,busy:cyberSkunk.state.busy,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history}));
    assert.equal(after.busy,false);assert.equal(after.history.length,1);assert.equal(after.history[0].bet,bet);assert.equal(after.history[0].cost,cost);assert.equal(after.history[0].win,paid);assert.equal(after.balance,BANK-cost+paid);
    await record('settlement-'+edge,{bet,cost,paid,expected,after});
  }finally{await p.close();}
});
