// Real settings controls, reload persistence and optional-storage behavior.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
const KEY='cyber-skunk-session-v1',BANK=1234567;
const control=(p,a)=>p.locator(`[data-action=${a}]`).first();
async function ready(p){await p.waitForFunction(()=>window.cyberSkunk?.state.ready);await p.locator('#intro-go').click();}
async function menu(p){await control(p,'settings').click();assert.equal(await p.locator('#menu').isVisible(),true);}
async function close(p){await p.locator('[data-close=menu]').click();}
const snapshot=p=>p.evaluate(()=>{
  const s=cyberSkunk.state,d=document.getElementById('menu').getBoundingClientRect();
  return {balance:s.balance,bet:s.bet,music:s.music,effects:s.effects,muted:s.muted,speed:s.speed,busy:s.busy,
    menu:{sound:document.getElementById('menu-sound').checked,music:document.getElementById('menu-music').value,effects:document.getElementById('menu-effects').value,speed:document.getElementById('menu-speed').value},
    bounds:{x:d.x,y:d.y,right:d.right,bottom:d.bottom},viewport:{width:innerWidth,height:innerHeight}};
});
function check(r,bank,music,effects,muted,speed){
  assert.equal(r.balance,bank);assert.equal(r.bet,100);assert.equal(r.busy,false);
  assert.equal(r.music,music);assert.equal(r.effects,effects);assert.equal(r.muted,muted);assert.equal(r.speed,speed);
  assert.deepEqual(r.menu,{sound:!muted,music:String(music),effects:String(effects),speed});
  assert.ok(r.bounds.x>=0&&r.bounds.y>=0&&r.bounds.right<=r.viewport.width&&r.bounds.bottom<=r.viewport.height,'settings dialog stays inside viewport');
}
async function saved(p){return p.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);}
async function record(name,data){console.log(JSON.stringify({name,...data}));if(process.env.CYBER_SKUNK_SETTINGS_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_SETTINGS_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_SETTINGS_EVIDENCE,name+'.json'),JSON.stringify(data,null,2)+'\n');}}
async function levels(p){
  await p.locator('#menu-music').focus();await p.keyboard.press('Home');assert.equal(await p.locator('#menu-music').inputValue(),'0');
  await p.keyboard.press('End');assert.equal(await p.locator('#menu-music').inputValue(),'100');
  await p.keyboard.press('Home');for(let i=0;i<23;i++)await p.keyboard.press('ArrowRight');
  await p.locator('#menu-effects').focus();await p.keyboard.press('Home');assert.equal(await p.locator('#menu-effects').inputValue(),'0');
  await p.keyboard.press('End');assert.equal(await p.locator('#menu-effects').inputValue(),'100');await p.keyboard.press('ArrowLeft');
  await p.locator('#menu-sound').uncheck();await p.locator('#menu-speed').selectOption('quick');
}
for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]]){
  for(const blocked of [false,true])test(`settings ${label}: ${blocked?'storage unavailable':'saved preferences and reset'}`,async()=>{
    const p=await browser.newPage({viewport:{width,height},isMobile:width<height,hasTouch:width<height,
      storageState:{cookies:[],origins:[{origin:new URL(server.url).origin,localStorage:[{name:KEY,value:JSON.stringify({balance:BANK,bet:100,music:37,effects:42,muted:false,speed:'normal',history:[]})}]}]}}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    if(blocked)await p.addInitScript(()=>{for(const key of ['getItem','setItem'])Storage.prototype[key]=()=>{throw new DOMException('Storage disabled for QA','SecurityError');};});
    try{
      await p.goto(server.url+'games/cyber-skunk/runtime/index.html');await ready(p);await menu(p);
      const initial=await snapshot(p);check(initial,blocked?1_000_000:BANK,blocked?60:37,blocked?80:42,false,'normal');
      await levels(p);const changed=await snapshot(p);check(changed,initial.balance,23,99,true,'quick');await close(p);
      if(width<height){await control(p,'turbo').click();await control(p,'sound').click();await menu(p);}
      else {await menu(p);await p.locator('#menu-speed').selectOption('turbo');await p.locator('#menu-sound').check();}
      const controller=await snapshot(p);check(controller,initial.balance,23,99,false,'turbo');await close(p);
      let beforeReload;
      if(!blocked){beforeReload=await saved(p);assert.equal(beforeReload.balance,BANK);assert.deepEqual(beforeReload.history,[]);assert.equal(beforeReload.pending,null);}
      await p.reload();await ready(p);await menu(p);const reloaded=await snapshot(p);
      check(reloaded,initial.balance,blocked?60:23,blocked?80:99,false,blocked?'normal':'turbo');
      let reset;
      if(!blocked){await p.locator('#menu-reset').click();await menu(p);reset=await snapshot(p);check(reset,1_000_000,23,99,false,'turbo');
        const stored=await saved(p);assert.deepEqual(stored.history,[]);assert.equal(stored.balance,1_000_000);assert.equal(stored.pending,null);await close(p);
        await p.reload();await ready(p);await menu(p);check(await snapshot(p),1_000_000,23,99,false,'turbo');}
      assert.deepEqual(errors,[]);await record(`${label}-${blocked?'blocked':'saved'}`,{initial,changed,controller,beforeReload,reloaded,reset,errors,
        scope:'DOM/state controls only; no audible mix, physical device or hosted verification.'});
    }finally{await p.close();}
  });
}
