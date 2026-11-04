// Test the artifact builder's output with only files.json's files available.
// The local wrapper models a static skeleton, not the hosted artifact service.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,extname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {ROOT,chromium} from '../../tools/lib/browser.mjs';

const RT=join(ROOT,'games/cyber-skunk/runtime'),BANK=1_000_000;
const evidence=process.env.CYBER_SKUNK_ARTIFACT_EVIDENCE;
const hash=b=>createHash('sha256').update(b).digest('hex');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf'};
let temp,server,browser,url,manifest,fragment,hashes={},requests=[],rows=[];
before(async()=>{
  temp=await mkdtemp(join(tmpdir(),'cyber-artifact-'));
  execFileSync(process.execPath,['tools/cyber-skunk-artifact.mjs',temp],{cwd:ROOT});
  manifest=JSON.parse(await readFile(join(temp,'files.json'),'utf8'));
  fragment=await readFile(join(temp,'cyber-skunk.html'),'utf8');
  for(const [path,spec] of Object.entries(manifest)){
    const source=typeof spec==='string'?spec:spec.from;
    assert.equal(source,path);assert.ok(!path.startsWith('/')&&!path.split('/').includes('..'));
    await mkdir(dirname(join(temp,path)),{recursive:true});await copyFile(join(RT,source),join(temp,path));
    hashes[path]=hash(await readFile(join(RT,source)));
  }
  await writeFile(join(temp,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+fragment+'</body></html>');
  server=createServer(async(req,res)=>{
    const path=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html';
    try{
      assert.ok(resolve(temp,path).startsWith(temp+'/'));
      const body=await readFile(join(temp,path));requests.push({path,status:200,hash:hash(body)});
      res.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});res.end(body);
    }catch{requests.push({path,status:404});res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium();
});
after(async()=>{
  await browser?.close();await new Promise(r=>server?server.close(r):r());
  if(evidence){await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'audit.json'),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),builder:hash(await readFile(join(ROOT,'tools/cyber-skunk-artifact.mjs'))),fragment:hash(fragment),manifestFiles:Object.keys(hashes).length,hashes,requests,rows},null,2)+'\n');}
  if(temp)await rm(temp,{recursive:true,force:true});
});
async function open(width,height){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<height,hasTouch:width<height}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.cyberSkunk?.state.ready);await p.locator('#intro-go').click();
  return {p,errors};
}
const control=(p,a)=>p.locator(`[data-action=${a}]`).first();
async function finish(p){
  for(let i=0;i<650;i++){
    const busy=await p.evaluate(()=>{
      if(!cyberSkunk.state.busy)return false;
      if(!document.getElementById('bonus-panel').hidden){const b=document.getElementById('bonus-panel-go');if(!b.disabled)b.click();}
      else if(!document.getElementById('bigwin').hidden)document.getElementById('win-dismiss').click();
      else document.querySelector('#controller').shadowRoot.querySelector('[data-action=play]').click();return true;
    });if(!busy)return;await p.waitForTimeout(60);
  }assert.fail('packaged round did not settle');
}

test('artifact manifest: every exported byte matches its source',async()=>{
  assert.ok(Object.keys(manifest).length>100);
  for(const [path,expected] of Object.entries(hashes)){
    assert.equal(hash(await readFile(join(temp,path))),expected,path);
    const response=await fetch(url+path);assert.equal(response.status,200,path);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),expected,path);
  }
  for(const value of ['entry-shop.css?v=neon-ident-1','launch.js?v=win-keys-1'])assert.ok(fragment.includes(value));
  assert.ok(!fragment.includes('<head>')&&!fragment.includes('<body>'));
});

for(const [width,height] of [[360,740],[390,844],[430,932],[1366,768]])test(`artifact launch and shop: ${width}×${height}`,async()=>{
  const {p,errors}=await open(width,height);
  try{
    await p.evaluate(()=>document.fonts.ready.then(()=>true));
    const layout=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth,bar:document.getElementById('controller').getBoundingClientRect().toJSON(),balance:cyberSkunk.state.balance}));
    assert.ok(layout.scroll<=width,'no horizontal scroll');assert.ok(layout.bar.left>=-1&&layout.bar.right<=width+1);assert.equal(layout.balance,BANK);
    await control(p,'buy').click();
    for(const mode of ['ventbreak','overpressure','mystery']){
      const expected=await p.evaluate(async m=>(await import('./rules.js?v=8')).PLAY_OPTIONS[m].cost,mode);
      await p.locator(`[data-pick=${mode}]`).click();await p.locator('#confirm').waitFor({state:'visible'});
      assert.equal(await p.locator('#confirm-cost').textContent(),expected+'×');await p.locator('#confirm-cancel').click();
    }
    await p.locator('[data-view=feature]').click();for(const m of ['enhanced','sprayjob'])assert.ok(await p.locator(`[data-pick=${m}]`).isVisible());
    await p.locator('[data-close=buy-menu]').click();assert.equal(await p.evaluate(()=>cyberSkunk.state.balance),BANK);
    if(evidence&&(width===390||width===1366)){await mkdir(evidence,{recursive:true});await p.screenshot({path:join(evidence,`artifact-${width}.jpg`),type:'jpeg',quality:78});}
    assert.deepEqual(errors,[]);rows.push({width,height,layout,shop:'three buy confirmations cancelled; two feature cards visible',errors});
  }finally{await p.close();}
});

for(const [width,height] of [[390,844],[1366,768]])test(`artifact shipping outcomes and settlement: ${width}×${height}`,async()=>{
  const {p,errors}=await open(width,height);
  try{
    // Ordinary crypto draws: no fixed seed, forced bonus or preview bypass.
    await control(p,'play').click();await finish(p);
    for(const mode of ['enhanced','sprayjob']){
      await control(p,'buy').click();await p.locator('[data-view=feature]').click();await p.locator(`[data-pick=${mode}]`).click();
      await control(p,'play').click();await finish(p);
      await control(p,'buy').click(); // turns off the selected feature
    }
    await control(p,'buy').click();await p.locator('[data-pick=ventbreak]').click();await p.locator('#confirm-ok').click();await finish(p);
    const result=await p.evaluate(()=>({balance:cyberSkunk.state.balance,history:JSON.parse(localStorage.getItem('cyber-skunk-session-v1')).history}));
    assert.deepEqual(result.history.map(r=>r.mode).reverse(),['base','enhanced','sprayjob','ventbreak']);
    assert.deepEqual(result.history.map(r=>r.cost).reverse(),[100,300,1000,10000]);
    assert.equal(result.balance,BANK+result.history.reduce((n,r)=>n-r.cost+r.win,0));
    assert.ok(result.history.every(r=>Number.isSafeInteger(r.win)&&r.win>=0));assert.deepEqual(errors,[]);
    rows.push({width,height,...result,errors});
  }finally{await p.close();}
});

test('artifact requests: no missing game dependencies or changed source bytes',async()=>{
  assert.deepEqual(requests.filter(r=>r.status!==200&&r.path!=='favicon.ico'),[]);
  for(const r of requests.filter(r=>r.path in hashes))assert.equal(r.hash,hashes[r.path],r.path);
  for(const [path,expected] of Object.entries(hashes))assert.equal(hash(await readFile(join(RT,path))),expected,path);
});
