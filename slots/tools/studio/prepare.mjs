// Fetch the imported game's large immutable assets; verify every byte against
// the import manifest. A changed upstream file cannot silently change math/art.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const manifest=JSON.parse(await readFile(new URL('../../games/zombify/import-manifest.json',import.meta.url),'utf8'));
const root=fileURLToPath(new URL('../../games/zombify/runtime/',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
// Reassemble the studio artwork from exact-byte parts for reliable source uploads.
const bundledRoot=new URL('../../games/zombify/bundled-art/',import.meta.url);
const bundles=[JSON.parse(await readFile(new URL('manifest.json',bundledRoot),'utf8')), ...JSON.parse(await readFile(new URL('studio-manifest.json',bundledRoot),'utf8'))];
for(const bundled of bundles){
const bundledPath=resolve(root,bundled.path);
if(!bundledPath.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid bundled asset path.');
let bundledValid=false;
try{bundledValid=hash(await readFile(bundledPath))===bundled.sha256;}catch{}
if(!bundledValid){
 const parts=[];
 for(const part of bundled.parts){
  if(!/^[a-z0-9-]+\.b64$/.test(part))throw Error('Invalid bundled asset part.');
  parts.push(await readFile(new URL(part,bundledRoot),'utf8'));
 }
 const bytes=Buffer.from(parts.join(''),'base64');
 if(bytes.length!==bundled.bytes||hash(bytes)!==bundled.sha256)throw Error('Bundled studio artwork failed verification.');
 await mkdir(dirname(bundledPath),{recursive:true});
 await writeFile(bundledPath+'.part',bytes);await rename(bundledPath+'.part',bundledPath);
}
}
let index=0,downloaded=0,verified=0;
await Promise.all(Array.from({length:6},async()=>{
 while(index<manifest.files.length){const item=manifest.files[index++],path=resolve(root,item.path);if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid import path.');
 try{if(hash(await readFile(path))===item.sha256){verified++;continue;}}catch{}
 const url=new URL(item.path,manifest.source);let response;try{response=await fetch(url,{signal:AbortSignal.timeout(60000)});}catch(error){throw Error(`Could not reach ${url.host} for ${item.path} (${error.cause?.code||error.message}). Behind a proxy, run NODE_USE_ENV_PROXY=1 npm run studio:prepare (Node 22.21+); a 403 from the proxy means that host isn't allowed on this network.`);}if(!response.ok)throw Error(`Import failed (${response.status}): ${item.path}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)throw Error(`Source changed: ${item.path}. Restore the v125 asset from the Studio source archive; do not accept unverified math data.`);
 await mkdir(dirname(path),{recursive:true});await writeFile(path+'.part',bytes);await rename(path+'.part',path);downloaded++;
 }
}));
console.log(`Zombify v125 ready: ${downloaded} downloaded, ${verified} verified.`);
