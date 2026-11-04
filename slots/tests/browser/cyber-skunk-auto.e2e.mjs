// Autoplay queue behavior through the real controller, with positive shipping tickets.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
const control=(p,a)=>p.locator(`[data-action=${a}]`).first();
async function open(width,height,balance=1_000_000){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<height,hasTouch:width<height}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(saved=>localStorage.setItem('cyber-skunk-session-v1',JSON.stringify(saved)),{balance,bet:100,speed:'turbo',muted:true});
  await p.goto(server.url+'games/cyber-skunk/runtime/index.html');await p.waitForFunction(()=>window.cyberSkunk?.state.ready);await p.locator('#intro-go').click();
  await p.evaluate(()=>{
    window.autoTickets=[];window.autoUnexpectedDraws=0;window.autoConsumed=0;
    const real=crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues=a=>{
      if(!(a instanceof Uint32Array&&a.length===2))return real(a);
      if(!autoTickets.length){autoUnexpectedDraws++;return real(a);}
      const {ticket,total}=autoTickets.shift(),n=Math.floor((ticket+.5)/total*2**53);autoConsumed++;
      a[0]=Math.floor(n/2**21);a[1]=(n%2**21)*2**11;return a;
    };
  });return {p,errors};
}
async function queue(p,natural=false){return p.evaluate(async natural=>{
  const {default:d}=await import('./catalog-data.js'),{playRound,seeded}=await import('./engine.js'),{drawRound}=await import('./catalog.js?v=8');
  const ticket=(name,find)=>{const rows=d.pools[name],i=rows.findIndex(find);if(i<0||rows[i][1]<=0)throw Error('Missing positive-weight fixture');return rows.slice(0,i).reduce((n,r)=>n+r[1],0);};
  let tickets,draw;
  if(natural){
    const m=d.modes.base,entry=m.entries.regular,bonus=m.bonuses.regular;
    const tier=Object.entries(m.tiers).slice(0,Object.keys(m.tiers).indexOf('regular')).reduce((n,[,w])=>n+w,0);
    const e=ticket(entry,r=>r[1]>0&&r[2]===Math.min(...d.pools[entry].filter(r=>r[1]>0).map(r=>r[2])));
    const b=ticket(bonus,r=>r[1]>0&&r[2]===Math.min(...d.pools[bonus].filter(r=>r[1]>0).map(r=>r[2])));
    tickets=[tier,e,b];let i=0;draw=drawRound('base',()=>tickets[i++]);
  }else{
    const spin=ticket('spin-base',r=>r[1]>0&&r[2]===0&&!playRound({mode:'base',rng:seeded(r[0])}).events.some(e=>e.type==='spray'));
    tickets=[0,spin];let i=0;draw=drawRound('base',()=>tickets[i++]);
  }
  const rounds=natural?1:10;for(let i=0;i<rounds;i++)autoTickets.push(...tickets.map(ticket=>({ticket,total:d.total})));
  return {draw:draw.draw,total:draw.total,natural:draw.natural,tier:draw.tier,ticketsPerRound:tickets.length,queuedRounds:rounds};
},natural);}
async function start(p){await control(p,'auto').click();await p.locator('[data-auto="10"]').click();await p.waitForFunction(()=>cyberSkunk.state.busy);}
async function settled(p){await p.waitForFunction(()=>!cyberSkunk.state.busy&&cyberSkunk.state.auto===0,null,{timeout:60000});await p.waitForTimeout(800);}
const result=p=>p.evaluate(()=>({balance:cyberSkunk.state.balance,busy:cyberSkunk.state.busy,auto:cyberSkunk.state.auto,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history,consumed:autoConsumed,remainingTickets:autoTickets.length,unexpectedDraws:autoUnexpectedDraws}));
async function check(p,startBalance,count,expected){
  const r=await result(p);assert.equal(r.busy,false);assert.equal(r.auto,0);assert.equal(r.history.length,count);assert.equal(r.unexpectedDraws,0);
  assert.equal(r.balance,startBalance+r.history.reduce((n,h)=>n-h.cost+h.win,0));
  for(const h of r.history){assert.equal(h.mode,'base');assert.equal(h.bet,100);assert.equal(h.cost,100);assert.equal(h.win,expected.total);assert.deepEqual(h.seed,expected.draw);}
  assert.equal(r.consumed,count*expected.ticketsPerRound);assert.equal(await control(p,'auto').getAttribute('aria-pressed'),'false');return r;
}
async function record(name,data){console.log(JSON.stringify({name,...data}));if(process.env.CYBER_SKUNK_AUTO_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_AUTO_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_AUTO_EVIDENCE,name+'.json'),JSON.stringify(data,null,2)+'\n');}}
for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]]){
  for(const kind of ['count','cancel','funds','bonus'])test(`autoplay ${label}: ${kind}`,async()=>{
    const bank=kind==='funds'?250:1_000_000,{p,errors}=await open(width,height,bank);
    try{
      const expected=await queue(p,kind==='bonus');await start(p);
      assert.equal(await control(p,'auto').getAttribute('aria-label'),'Stop autoplay');assert.equal(await control(p,'bet').isDisabled(),true);
      let during;
      if(kind==='cancel'){
        await p.waitForFunction(()=>document.querySelectorAll('#reels .spinning').length>0);await control(p,'auto').click();
        during=await p.evaluate(()=>({auto:cyberSkunk.state.auto,busy:cyberSkunk.state.busy,skip:cyberSkunk.state.skip}));assert.equal(during.auto,0);assert.equal(during.busy,true);assert.equal(during.skip,false);
      }
      if(kind==='bonus'){
        assert.equal(expected.natural,true);assert.equal(expected.tier,'regular');
        for(let i=0;i<650;i++){
          const busy=await p.evaluate(()=>{if(!cyberSkunk.state.busy)return false;
            if(!document.getElementById('bonus-panel').hidden){const b=document.getElementById('bonus-panel-go');if(!b.disabled)b.click();}
            else if(!document.getElementById('bigwin').hidden)document.getElementById('win-dismiss').click();
            else document.getElementById('controller').shadowRoot.querySelector('[data-action=play]').click();return true;});
          if(!busy)break;await p.waitForTimeout(60);
        }
      }
      await settled(p);const count=kind==='count'?10:kind==='funds'?2:1,r=await check(p,bank,count,expected);
      assert.equal(r.remainingTickets,(expected.queuedRounds-count)*expected.ticketsPerRound);assert.deepEqual(errors,[]);
      await record(`${label}-${kind}`,{width,height,bank,expected,during,result:r,errors});
    }finally{await p.close();}
  });
}
