import {validatePreset} from './presets.js';
import {uniqueId} from './project.js';
const DB='gamboligy-studio-presets-v1';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('presets',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(mode,run){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('presets',mode);let result;const request=run(tx.objectStore('presets'));request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Preset storage failed.'));};});}
export const listPresets=async()=>{const records=await transaction('readonly',s=>s.getAll());return records.map(({id,preset,createdAt})=>({id,name:preset.name,kind:preset.kind,createdAt})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));};
export const readPreset=async id=>(await transaction('readonly',s=>s.get(id)))?.preset;
export async function savePreset(preset){validatePreset(preset);const id=uniqueId();await transaction('readwrite',s=>s.add({id,preset,createdAt:new Date().toISOString()}));return id;}
export const deletePreset=id=>transaction('readwrite',s=>s.delete(id));
export async function portablePreset(preset,assetURL){
 const result=structuredClone(preset);let total=0;
 for(const a of result.assets){
  if(!a.src.startsWith('data:')){
   const response=await fetch(assetURL(a),{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Could not include '+a.name+' in this preset.');
   const limit=10*1024*1024,declared=Number(response.headers.get('content-length'));
   if(declared>limit)throw Error('Preset assets must be 10 MB or smaller.');
   const reader=response.body.getReader(),chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Preset assets must be 10 MB or smaller.');chunks.push(value);}}finally{await reader.cancel();}
   const type=response.headers.get('content-type')?.split(';')[0];
   if(!/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4|webm))$/.test(type||''))throw Error('Unsupported file type for '+a.name+'. Upload a PNG, JPG, WebP, GIF or supported audio file first.');
   a.src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(new Blob(chunks,{type}));});
  }
  total+=a.src.length;if(total>70*1024*1024)throw Error('This preset is too large. Use smaller assets.');
 }
 return validatePreset(result);
}
export function downloadPreset(preset){
 const url=URL.createObjectURL(new Blob([JSON.stringify(preset,null,2)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download=preset.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.studiopreset.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
