// Real keyboard navigation must not turn a closed dialog into a paid spin.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {serve,chromium} from '../../tools/lib/browser.mjs';
let server,browser;
before(async()=>{server=await serve();browser=await chromium();});
after(async()=>{await browser?.close();server?.close();});
const focus=p=>p.evaluate(()=>{
  let e=document.activeElement;while(e.shadowRoot?.activeElement)e=e.shadowRoot.activeElement;
  return {id:e.id,action:e.dataset.action,dialog:e.closest('dialog')?.id,tag:e.tagName};
});
const control=(p,a)=>p.locator(`[data-action=${a}]`).first();
async function pristine(p){
  const s=await p.evaluate(()=>({balance:cyberSkunk.state.balance,busy:cyberSkunk.state.busy,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1'))?.history??[]}));
  assert.equal(s.balance,1_000_000);assert.equal(s.busy,false);assert.equal(s.history.length,0);
  return s;
}
async function modal(p,id){
  await p.locator('#'+id).waitFor({state:'visible'});
  assert.equal((await focus(p)).dialog,id,'focus enters the visible dialog');
  const name=await p.locator('#'+id).evaluate(d=>document.getElementById(d.getAttribute('aria-labelledby'))?.textContent.trim());
  assert.ok(name,'dialog has a rendered accessible heading');
  // Forward/backward traversal must never focus an underlying game control.
  for(let i=0;i<6;i++)for(const key of ['Tab','Shift+Tab']){
    await p.keyboard.press(key);const f=await focus(p);
    assert.ok(f.dialog===id||f.tag==='BODY',`focus leaked to ${JSON.stringify(f)}`);
    assert.equal(f.action,undefined);
  }
}
for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]])test(`dialog keys: ${label} containment, cancellation and focus restoration`,async()=>{
  const p=await browser.newPage({viewport:{width,height},isMobile:label==='phone',hasTouch:label==='phone'}),errors=[],checks=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto(server.url+'games/cyber-skunk/runtime/index.html');await p.locator('#intro-go').click();
    for(const [action,id] of [['buy','buy-menu'],['bet','bet-picker'],['auto','autoplay'],['settings','menu']]){
      await control(p,action).focus();await p.keyboard.press('Enter');await modal(p,id);
      await p.keyboard.press('Escape');await p.locator('#'+id).waitFor({state:'hidden'});
      assert.equal((await focus(p)).action,action);checks.push({dialog:id,returnTo:action,...await pristine(p)});
    }
    for(const [button,id] of [['menu-rules','rules'],['menu-history','history']]){
      await control(p,'settings').focus();await p.keyboard.press('Enter');
      await p.locator('#'+button).focus();await p.keyboard.press('Enter');await modal(p,id);
      await p.keyboard.press('Escape');assert.equal((await focus(p)).action,'settings');await pristine(p);
      checks.push({dialog:id,returnTo:'settings'});
    }
    await control(p,'buy').focus();await p.keyboard.press('Enter');
    for(const mode of ['ventbreak','overpressure','mystery'])for(const key of ['Escape','Enter']){
      await p.waitForFunction(()=>!document.querySelector('#buy-menu .pass.tearing'),null,{timeout:5000});
      console.log(`${label}: ${mode} cancellation with ${key}`);
      await p.locator(`[data-pick=${mode}]`).focus();await p.keyboard.press('Enter');await modal(p,'confirm');
      if(key==='Enter')await p.locator('#confirm-cancel').focus();
      await p.keyboard.press(key);await p.locator('#confirm').waitFor({state:'hidden'});
      await p.waitForFunction(m=>!document.querySelector('#buy-menu .pass.tearing')&&document.activeElement?.dataset.pick===m,mode,{timeout:5000});
      assert.equal((await focus(p)).dialog,'buy-menu');checks.push({mode,cancelKey:key,...await pristine(p)});
    }
    await p.keyboard.press('Escape');assert.equal((await focus(p)).action,'buy');
    assert.deepEqual(errors,[]);await pristine(p);
    if(process.env.CYBER_SKUNK_DIALOG_EVIDENCE){await mkdir(process.env.CYBER_SKUNK_DIALOG_EVIDENCE,{recursive:true});await writeFile(join(process.env.CYBER_SKUNK_DIALOG_EVIDENCE,label+'.json'),JSON.stringify({width,height,checks,errors},null,2)+'\n');}
  }finally{await p.close();}
});
