#!/usr/bin/env node
// Read-only unauthenticated check of asset bytes and MIME. Omits target URLs/bodies.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const SLOTS=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const RT=join(SLOTS,'games/cyber-skunk/runtime');
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function expectedPackage(){
  const out=await mkdtemp(join(tmpdir(),'cyber-parity-'));
  try{
    execFileSync(process.execPath,['tools/cyber-skunk-artifact.mjs',out],{cwd:SLOTS,stdio:'pipe'});
    const files=JSON.parse(await readFile(join(out,'files.json'),'utf8')),assets=[];
    for(const path of Object.keys(files).sort()){
      if(path.startsWith('/')||path.split('/').includes('..'))throw Error('invalid-package-path');
      const body=await readFile(join(RT,path));
      const requiredMime=path.endsWith('.js')?['text/javascript','application/javascript']:path.endsWith('.css')?['text/css']:path.endsWith('.svg')?['image/svg+xml']:[];
      assets.push({path,sha256:hash(body),bytes:body.length,requiredMime});
    }
    const requests=assets.map(a=>({path:a.path,search:''})),seen=new Set(requests.map(r=>r.path));
    // Include shipped version keys, so fresh bare URLs cannot hide a stale ?v= URL.
    for(const path of ['index.html',...assets.filter(a=>a.path.endsWith('.js')).map(a=>a.path)]){
      const source=await readFile(join(RT,path),'utf8');
      for(const m of source.matchAll(/["']([^"'\s]+\?v=[A-Za-z0-9._-]+)["']/g)){
        if(/^[a-z]+:|^\/\//i.test(m[1]))continue;
        const u=new URL(m[1],'https://local.invalid/'+path),relative=u.pathname.slice(1),key=relative+u.search;
        if(files[relative]&&!seen.has(key)){seen.add(key);requests.push({path:relative,search:u.search});}
      }
    }
    const source=execFileSync('git',['rev-parse','HEAD'],{cwd:SLOTS,encoding:'utf8'}).trim();
    const runtimeClean=execFileSync('git',['status','--porcelain','--','games/cyber-skunk/runtime'],{cwd:SLOTS,encoding:'utf8'}).trim()==='';
    return {source,runtimeClean,assets,requests,manifestSha256:hash(JSON.stringify({assets,requests})),entryFragmentSha256:hash(await readFile(join(out,'cyber-skunk.html')))};
  }finally{await rm(out,{recursive:true,force:true});}
}
export async function verifyAssets(expected,base,{fetcher=fetch,timeoutMs=8000}={}){
  let root;try{root=new URL(base);}catch{throw Error('invalid-asset-root');}
  if(!['https:','http:'].includes(root.protocol)||root.username||root.password||root.search||root.hash||!root.pathname.endsWith('/'))throw Error('invalid-asset-root');
  const assets=new Map(expected.assets.map(a=>[a.path,a])),rows=[];
  let cursor=0,blocked=expected.runtimeClean?null:'local-runtime-has-uncommitted-changes';
  async function worker(){
    while(!blocked&&cursor<expected.requests.length){
      const request=expected.requests[cursor++],asset=assets.get(request.path);
      if(!asset)throw Error('invalid-expected-request');
      const url=new URL(request.path.split('/').map(encodeURIComponent).join('/'),root);url.search=request.search;
      const row={path:request.path,cacheKey:request.search||null,expectedSha256:asset.sha256,pass:false};
      try{
        const response=await fetcher(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});row.httpStatus=response.status;
        if(response.status===401||response.status===403){row.reason='access-denied';blocked='access-denied';}
        else if(response.status>=300&&response.status<400){row.reason='redirect';blocked='asset-root-redirected';}
        else if(response.status!==200)row.reason='http-status';
        else if((response.headers.get('content-type')??'').includes('text/html')&&!asset.path.endsWith('.html')){row.reason='unexpected-html';blocked='asset-root-returned-html';}
        else{
          const bytes=new Uint8Array(await response.arrayBuffer());row.actualSha256=hash(bytes);row.bytes=bytes.length;
          row.mimeValid=asset.requiredMime.length?asset.requiredMime.includes((response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase()):null;
          row.pass=row.actualSha256===asset.sha256&&row.bytes===asset.bytes&&row.mimeValid!==false;
          if(!row.pass)row.reason=row.mimeValid===false?'unexpected-content-type':'byte-mismatch';
        }
        if(!row.actualSha256)await response.body?.cancel();
      }catch{row.reason='request-failed';} // Do not serialize URL-bearing error messages.
      rows.push(row);
    }
  }
  await Promise.all(Array.from({length:Math.min(4,expected.requests.length)},worker));
  rows.sort((a,b)=>(a.path+(a.cacheKey??'')).localeCompare(b.path+(b.cacheKey??'')));
  const passed=rows.filter(r=>r.pass).length;
  return {scope:'Asset bytes and JS/CSS/SVG MIME only; entry document/wrapper, rendering, audio and physical devices are not verified',source:expected.source,manifestSha256:expected.manifestSha256,expectedEntryFragmentSha256:expected.entryFragmentSha256,expectedAssets:expected.assets.length,expectedRequests:expected.requests.length,checkedRequests:rows.length,passedRequests:passed,failedRequests:rows.length-passed,uncheckedRequests:expected.requests.length-rows.length,blocked,status:!blocked&&passed===expected.requests.length&&rows.length>0?'pass':'fail',rows};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const [base,output]=process.argv.slice(2);if(!base)throw Error('usage: node tools/cyber-skunk-served-parity.mjs ASSET_ROOT_URL/ [REPORT.json]');
    const report=await verifyAssets(await expectedPackage(),base),json=JSON.stringify(report,null,2)+'\n';
    if(output)await writeFile(output,json);else process.stdout.write(json);
    process.exitCode=report.status==='pass'?0:1;
  }catch{console.error('Parity check could not run. Supply a direct asset root ending in / with no credentials, query or fragment, and a writable optional report path. Target details are omitted.');process.exitCode=2;}
}
