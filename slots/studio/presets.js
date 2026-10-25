import {clone,validateProject,createProject,sceneAppearance,uniqueId} from './project.js';
import {validateSounds} from './sound-schema.js';
export const PRESET_KINDS={cabinet:'Cabinet',sounds:'Sound pack',bonus:'Bonus screens'};
const CABINET=['frameAsset','frameWidth','supports','fill','texture'];
const BONUS=['counter','infection','win','bonus','result'];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
export function capturePreset(project,scene,kind,name){
 validateProject(project);if(!Object.hasOwn(PRESET_KINDS,kind))throw Error('Choose a preset type.');
 const s=project.scenes[scene];if(!s)throw Error('Unknown scene.');let settings,ids=[];
 if(kind==='cabinet'){
  const a=sceneAppearance(project,scene),l=s.layers.find(l=>l.id==='reels');
  settings={appearance:Object.fromEntries(CABINET.map(k=>[k,a[k]])),bounds:{x:l.x/s.width,y:l.y/s.height,w:l.w/s.width,h:l.h/s.height}};ids=[a.frameAsset];
 }else if(kind==='sounds'){settings=structuredClone(project.sounds||{});ids=Object.values(settings).map(v=>v.assetId).filter(Boolean);}
 else settings=Object.fromEntries(BONUS.filter(k=>s.screens?.[k]).map(k=>[k,structuredClone(s.screens[k])]));
 const preset={format:'gamboligy-studio-preset',version:1,adapter:project.adapter,kind,name:name.trim(),source:{width:s.width,height:s.height},settings,assets:project.assets.filter(a=>ids.includes(a.id)).map(a=>({...a}))};
 return validatePreset(preset);
}
export function validatePreset(v){
 if(!only(v,['format','version','adapter','kind','name','source','settings','assets'])||v.format!=='gamboligy-studio-preset'||v.version!==1||v.adapter!=='zombify-v125'||!Object.hasOwn(PRESET_KINDS,v.kind)||typeof v.name!=='string'||!v.name.trim()||v.name.length>80)throw Error('This is not a supported Studio preset.');
 if(!only(v.source,['width','height'])||![v.source.width,v.source.height].every(n=>Number.isFinite(n)&&n>=240&&n<=3840)||!Array.isArray(v.assets)||v.assets.length>100)throw Error('Invalid preset assets or canvas.');
 const probe=createProject(),s=probe.scenes.desktop;
 // Validate the preset's assets separately from the project receiving them.
 const originalIds=new Set(),probeIds=new Map();
 for(const [i,a] of v.assets.entries()){
  if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(a.id)||originalIds.has(a.id))throw Error('Invalid or duplicate preset asset.');
  originalIds.add(a.id);probeIds.set(a.id,'preset-probe-'+i);probe.assets.push({...a,id:'preset-probe-'+i});
 }
 if(v.kind==='cabinet'){
  if(!only(v.settings,['appearance','bounds'])||!only(v.settings.appearance,CABINET)||CABINET.some(k=>!(k in v.settings.appearance))||!only(v.settings.bounds,['x','y','w','h']))throw Error('Invalid cabinet preset.');
  const b=v.settings.bounds;for(const k of ['x','y','w','h'])if(!Number.isFinite(b[k])||b[k]<(k==='x'||k==='y'?-1:0.001)||b[k]>(k==='x'||k==='y'?1:2))throw Error('Invalid cabinet placement.');
  if(!v.assets.some(a=>a.id===v.settings.appearance.frameAsset&&a.kind!=='audio')||v.assets.some(a=>a.kind==='audio'))throw Error('Cabinet artwork is missing.');
  s.cabinet={...v.settings.appearance,frameAsset:probeIds.get(v.settings.appearance.frameAsset)};
 }else if(v.kind==='sounds'){
  if(!object(v.settings)||v.assets.some(a=>a.kind!=='audio'))throw Error('A sound pack can only contain audio.');
  validateSounds(v.settings,v.assets);probe.sounds=structuredClone(v.settings);
  for(const sound of Object.values(probe.sounds))if(sound.assetId)sound.assetId=probeIds.get(sound.assetId);
 }else{
  if(!only(v.settings,BONUS)||v.assets.length)throw Error('Invalid bonus screen preset.');s.screens=v.settings;
 }
 validateProject(probe);return v;
}
export function applyPreset(project,scene,preset){
 validatePreset(preset);const p=clone(project),s=p.scenes[scene];if(!s)throw Error('Unknown scene.');
 const map=new Map();for(const a of preset.assets){
  const existing=p.assets.find(b=>b.kind===a.kind&&b.src===a.src);if(existing){map.set(a.id,existing.id);continue;}
  const id=p.assets.some(b=>b.id===a.id)?'preset-'+uniqueId():a.id;p.assets.push({...a,id});map.set(a.id,id);
 }
 const settings=structuredClone(preset.settings);
 if(preset.kind==='cabinet'){
  settings.appearance.frameAsset=map.get(settings.appearance.frameAsset);s.cabinet=settings.appearance;
  const l=s.layers.find(l=>l.id==='reels'),b=settings.bounds;
  if(l.locked)throw Error('Unlock the reels before applying a cabinet preset.');
  // Reuse the same linked-motion semantics as drag/align, atomically.
  const scale=Math.min(s.width/preset.source.width,s.height/preset.source.height);
  const values={x:Math.round(b.x*s.width),y:Math.round(b.y*s.height),w:Math.max(32,Math.round(b.w*preset.source.width*scale)),h:Math.max(32,Math.round(b.h*preset.source.height*scale))};
  s.cabinet.frameWidth=Math.min(60,Math.round(s.cabinet.frameWidth*scale));
  moveCabinet(s,l.id,values);
 }else if(preset.kind==='sounds'){
  for(const v of Object.values(settings))if(v.assetId)v.assetId=map.get(v.assetId);p.sounds=settings;
 }else{
  s.screens={...s.screens};for(const key of BONUS)delete s.screens[key];Object.assign(s.screens,settings);
 }
 return validateProject(p);
}
import {moveLinked as moveCabinet} from './layout.js';
