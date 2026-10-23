// Keep decoded images alive; failed requests are removed so Retry really retries.
const images=new Map(),byteStores=new WeakMap();
export function loadImage(url){
 const key=new URL(url,import.meta.url).href;
 if(!images.has(key))images.set(key,new Promise((resolve,reject)=>{
  const image=new Image(),timer=setTimeout(()=>{image.src='';reject(Error('Image loading timed out'));},30000);
  image.src=key;
  image.decode().then(()=>{clearTimeout(timer);resolve(image);},error=>{clearTimeout(timer);reject(error);});
 }).catch(error=>{images.delete(key);throw error;}));
 return images.get(key);
}
export function loadBytes(url,env=globalThis){
 if(!byteStores.has(env))byteStores.set(env,new Map());
 const bytes=byteStores.get(env);
 const key=new URL(url,import.meta.url).href;
 if(!bytes.has(key))bytes.set(key,(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{const response=await env.fetch(key,{signal:controller.signal});if(!response.ok)throw Error('Asset unavailable');return await response.arrayBuffer();}
  finally{clearTimeout(timer);}
 })().catch(error=>{bytes.delete(key);throw error;}));
 return bytes.get(key);
}
