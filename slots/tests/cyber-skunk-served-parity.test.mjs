import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedPackage,verifyAssets} from '../tools/cyber-skunk-served-parity.mjs';
let expected,server,base;
const RT=fileURLToPath(new URL('../games/cyber-skunk/runtime/',import.meta.url)),evidence=process.env.CYBER_SKUNK_PARITY_EVIDENCE;
before(async()=>{
  expected=await expectedPackage();
  server=createServer(async(req,res)=>{
    const u=new URL(req.url,'http://fixture'),parts=u.pathname.slice(1).split('/'),scenario=parts.shift(),path=parts.join('/');
    if(scenario==='denied'){res.writeHead(403);res.end('private');return;}
    if(scenario==='redirect'){res.writeHead(302,{location:'/login/opaque-session-fixture'});res.end();return;}
    if(scenario==='html'){res.writeHead(200,{'content-type':'text/html'});res.end('<html>Sign in</html>');return;}
    if(scenario==='missing'&&path==='launch.js'){res.writeHead(404);res.end();return;}
    try{
      let body=await readFile(join(RT,path));
      if(scenario==='stale'&&path==='entry-shop.css'&&u.search)body=Buffer.from('/* older served stylesheet */');
      const mime=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.html')?'text/html':'application/octet-stream';
      res.writeHead(200,{'content-type':scenario==='mime'?'application/octet-stream':mime});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
});
after(async()=>{await new Promise(r=>server.close(r));});
async function save(name,report){if(evidence){await mkdir(evidence,{recursive:true});await writeFile(join(evidence,name+'.json'),JSON.stringify(report,null,2)+'\n');}}
const subset=paths=>({...expected,assets:expected.assets.filter(a=>paths.includes(a.path)),requests:expected.requests.filter(r=>paths.includes(r.path))});
test('served parity: all exported files and shipped version URLs match',async()=>{
  assert.equal(expected.runtimeClean,true);assert.ok(expected.assets.length>100);
  const report=await verifyAssets(expected,base+'clean/');assert.equal(report.status,'pass');assert.equal(report.uncheckedRequests,0);assert.equal(report.failedRequests,0);
  assert.ok(report.expectedRequests>report.expectedAssets,'versioned URLs are checked too');await save('clean',report);
});
test('served parity: stale versioned CSS fails even when the bare URL matches',async()=>{
  const report=await verifyAssets(subset(['entry-shop.css']),base+'stale/');assert.equal(report.status,'fail');
  assert.ok(report.rows.some(r=>r.cacheKey?.startsWith('?v=')&&r.reason==='byte-mismatch'),'the shipped ?v= key is checked');assert.ok(report.rows.some(r=>!r.cacheKey&&r.pass));await save('stale-version',report);
});
test('served parity: missing modules and incorrect module MIME fail',async()=>{
  const report=await verifyAssets(subset(['launch.js']),base+'missing/');assert.equal(report.status,'fail');assert.ok(report.rows.every(r=>r.httpStatus===404));await save('missing-module',report);
  const mime=await verifyAssets(subset(['launch.js']),base+'mime/');assert.equal(mime.status,'fail');assert.ok(mime.rows.every(r=>r.reason==='unexpected-content-type'&&r.actualSha256===r.expectedSha256));await save('wrong-mime',mime);
});
test('served parity: access walls, HTML and redirects fail without publishing target data',async()=>{
  for(const scenario of ['denied','redirect','html']){
    const report=await verifyAssets(expected,base+scenario+'/');assert.equal(report.status,'fail');assert.ok(report.blocked);assert.ok(report.uncheckedRequests>0);
    const text=JSON.stringify(report);assert.ok(!text.includes(base));assert.ok(!text.includes('opaque-session-fixture'));assert.ok(!text.includes('<html>'));
    await save(scenario,report);
  }
});
test('served parity: request errors omit URL-bearing exceptions and dirty source cannot pass',async()=>{
  const little=subset(['launch.js']);
  const failed=await verifyAssets(little,'https://fixture.invalid/private-root/',{fetcher:async()=>{throw Error('https://fixture.invalid/private-root/session-token');}});
  assert.equal(failed.status,'fail');assert.ok(failed.rows.every(r=>r.reason==='request-failed'));assert.ok(!JSON.stringify(failed).includes('session-token'));
  const dirty=await verifyAssets({...little,runtimeClean:false},'https://fixture.invalid/',{fetcher:async()=>assert.fail('dirty source must not fetch')});assert.equal(dirty.status,'fail');assert.equal(dirty.checkedRequests,0);
  await assert.rejects(verifyAssets(little,'https://user:password@fixture.invalid/'),/invalid-asset-root/);await save('request-failed',failed);await save('dirty-source',dirty);
});
