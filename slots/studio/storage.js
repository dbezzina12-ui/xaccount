import {uniqueId} from './project.js';
const DB='gamboligy-studio-v1';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function readSaved(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('projects'),r=tx.objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}
// Synchronous fallback for edits made just before the tab closes: IndexedDB
// writes started in pagehide are often lost, localStorage writes are not.
// Uploaded image bytes are referenced (they're already in IndexedDB), so the
// journal stays small.
const JOURNAL='gamboligy-studio-journal';
export function writeJournal(project){try{localStorage.setItem(JOURNAL,JSON.stringify({at:new Date().toISOString(),project:{...project,assets:project.assets.map(a=>a.src.startsWith('data:')?{...a,src:'@saved'}:a)}}));return true;}catch{return false;}}
export function clearJournal(){try{localStorage.removeItem(JOURNAL);}catch{}}
// The journaled project if it is newer than the saved one and every referenced image can be restored.
export function readJournal(saved){
 let j;try{j=JSON.parse(localStorage.getItem(JOURNAL)||'null');}catch{return null;}
 if(!j?.project?.assets||(saved?.savedAt&&j.at<=saved.savedAt))return null;
 const bytes=new Map((saved?.project?.assets||[]).map(a=>[a.id,a.src]));
 if(j.project.assets.some(a=>a.src==='@saved'&&!bytes.has(a.id)))return null;
 return {...j.project,assets:j.project.assets.map(a=>a.src==='@saved'?{...a,src:bytes.get(a.id)}:a)};
}
export async function saveProject(project){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({project,savedAt:new Date().toISOString()},'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>reject(tx.error);});}
export function downloadProject(project){const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.slotstudio.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function imageAsset(file){if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('Use a PNG, JPG, WebP or GIF image.');if(file.size>10*1024*1024)throw Error('Use an image smaller than 10 MB.');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>i.width<=8192&&i.height<=8192?resolve():reject(Error('Maximum image dimensions are 8192×8192.'));i.onerror=()=>reject(Error('This image could not be decoded.'));i.src=src;});return{id:'upload-'+uniqueId(),name:file.name.slice(0,80),src,kind:'image'};}
