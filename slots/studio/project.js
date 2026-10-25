import {validateLayout,moveLinked} from './layout.js';
import {validateScreens} from './screens-schema.js';
// Serializable authoring state. No outcome or payout configuration lives here.
import {validateSounds,SOUND_EVENTS} from './sound-schema.js';
export const VERSION = 1;
const CABINET_KEYS=['frameAsset','frameWidth','supports','fill','texture'];
export const sceneAppearance=(p,key)=>({...p.grid,...p.scenes[key].cabinet});
export const uniqueId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
export const PRESETS = [[4,4],[5,4],[6,5],[7,7]];
export const SYMBOLS = ['j','q','k','a','skater','nurse','builder','cop','scientist','zombie','wild','vial'];
const root='games/zombify/runtime/assets/';
const asset=(id,name,file,kind='image')=>({id,name,src:root+file,kind});
const layer=(id,name,kind,x,y,w,h,extra={})=>({id,name,kind,x,y,w,h,visible:true,locked:false,opacity:1,...extra});
export function createProject(){
 const assets=[asset('subway-lab','Subway outbreak lab','studio/subway-lab.webp'),asset('subway-background','Subway · mobile','studio/subway-background.webp'),asset('subway-art','Subway artwork','studio/subway-art.webp'),asset('subway-frame','Subway steel frame','studio/subway-frame.svg'),asset('zombie-broken-wall-mobile','Broken wall zombies · mobile','studio/zombie-broken-wall-mobile.webp'),asset('zombie-room-simple-mobile','Simple zombie room · mobile','studio/zombie-room-simple-mobile.png'),asset('picture-frame','Antique picture frame','studio/picture-frame.png'),asset('zombie-room-mobile','Zombie window room · mobile','studio/zombie-room-mobile.png'),asset('street','Moonlit street · desktop','street-v119/scene.png'),asset('portrait','Moonlit street · mobile','studio/mobile-street.png'),asset('alley','Purple alley','moonlit-v118/street.png'),asset('title','Zombify title','clean-cel-v117/title.png'),asset('frame','Teal cabinet','street-v119/frame.png'),asset('blocks','Concrete supports','street-v119/blocks.png'),asset('mascot','Zombie mascot','clean-cel-v117/mascot.png'),asset('enamel','Reel enamel','street-v119/reel-enamel.svg')];
 const symbols={};for(const id of SYMBOLS){const f=id==='wild'?'w':id==='vial'?'fs':['skater','nurse','builder','cop','scientist'].includes(id)?id+'-human':id;assets.push(asset('symbol-'+id,id.toUpperCase(),'clean-cel-v117/'+f+'.png','symbol'));symbols[id]='symbol-'+id;}
 const bg=(id)=>({assetId:id,brightness:100,contrast:100,saturation:100,hue:0,blur:0,zoom:100,positionX:50,positionY:50,tint:'#152645',tintOpacity:0});
 return {schemaVersion:VERSION,id:'zombify',name:'Zombify',adapter:'zombify-v125',grid:{columns:6,rows:5,symbolScale:1.08,divider:0.22,fill:'#0b1d28',texture:true,frameWidth:26,frameAsset:'frame',supports:true},symbols,assets,
 scenes:{desktop:{width:1280,height:800,background:bg('street'),layers:[layer('reels','Reels & cabinet','reels',330,140,620,520),layer('title','Zombify title','image',30,40,275,112,{assetId:'title'}),layer('controls','Game controls','controls',200,690,880,100)]},mobile:{width:390,height:844,background:bg('portrait'),layers:[layer('reels','Reels & cabinet','reels',10,180,370,350),layer('title','Zombify title','image',12,12,250,100,{assetId:'title'}),layer('controls','Game controls','controls',0,620,390,214)]}}};
}
const finite=(v,min,max,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${name} must be between ${min} and ${max}.`);};
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function safeSource(src){return typeof src==='string'&&src.length<16000000&&(/^(games\/zombify\/runtime\/assets\/|data:(?:image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4|webm));base64,)/.test(src)||/^https:\/\//.test(src));}
// The editor hands the preview iframe same-origin blob: URLs for uploaded
// images so multi-MB data URLs never cross postMessage; saved and imported
// projects must still carry the real bytes.
const previewSource=src=>typeof src==='string'&&/^blob:https?:\/\/[^/\s]+\/[0-9a-f-]{36}$/i.test(src);
const label=(v,what)=>{if(typeof v!=='string'||v.length>80)throw Error(`${what} must be text of up to 80 characters.`);};
const flag=(v,what)=>{if(typeof v!=='boolean')throw Error(`${what} must be true or false.`);};
export function validateProject(p,{preview=false}={}){
 if(!p||p.schemaVersion!==VERSION||p.adapter!=='zombify-v125')throw Error('This is not a supported Studio project.');
 if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80)throw Error('Use a project name of 1–80 characters.');
 if(!Array.isArray(p.assets)||p.assets.length>200)throw Error('A project supports up to 200 assets.');
 const ids=new Set();for(const a of p.assets){if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(a.id)||ids.has(a.id)||!(safeSource(a.src)||preview&&previewSource(a.src))||!['image','symbol','audio'].includes(a.kind))throw Error('Invalid or duplicate asset.');label(a.name,'Asset name');if(a.kind==='audio'&&!(/^(data:audio\/(mpeg|wav|ogg|mp4|webm);base64,|games\/zombify\/runtime\/assets\/)/.test(a.src)||preview&&previewSource(a.src)))throw Error('Invalid audio source.');if(a.kind!=='audio'&&a.src.startsWith('data:audio/'))throw Error('Audio cannot be used as artwork.');ids.add(a.id);
 }
 validateSounds(p.sounds,p.assets);
 const imageIds=new Set(p.assets.filter(a=>a.kind!=='audio').map(a=>a.id));
 const g=p.grid;finite(g.columns,3,10,'Reel count');finite(g.rows,3,10,'Row count');if(!Number.isInteger(g.columns)||!Number.isInteger(g.rows))throw Error('Reels and rows must be whole numbers.');
 finite(g.symbolScale,.5,1.5,'Symbol scale');finite(g.divider,0,1,'Dividers');finite(g.frameWidth,0,60,'Frame width');if(!color(g.fill)||!imageIds.has(g.frameAsset))throw Error('Invalid reel appearance.');flag(g.texture,'Reel texture');flag(g.supports,'Cabinet supports');
 for(const id of SYMBOLS)if(!imageIds.has(p.symbols[id]))throw Error('Missing symbol asset: '+id);
 for(const key of ['desktop','mobile']){const s=p.scenes?.[key];if(!s)throw Error('Both desktop and mobile scenes are required.');finite(s.width,240,3840,'Canvas width');finite(s.height,240,3840,'Canvas height');
 if(s.cabinet!==undefined){const c=s.cabinet;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!CABINET_KEYS.includes(k)))throw Error('Invalid cabinet settings.');const a=sceneAppearance(p,key);if(!imageIds.has(a.frameAsset)||!color(a.fill))throw Error('Invalid cabinet artwork.');finite(a.frameWidth,0,60,'Frame width');flag(a.supports,'Cabinet supports');flag(a.texture,'Reel texture');}
 validateScreens(s.screens);const b=s.background;if(!imageIds.has(b.assetId))throw Error('Missing background asset.');for(const [k,min,max] of [['brightness',25,200],['contrast',25,200],['saturation',0,200],['hue',-180,180],['blur',0,20],['zoom',100,200],['positionX',0,100],['positionY',0,100],['tintOpacity',0,1]])finite(b[k],min,max,k);if(!color(b.tint))throw Error('Invalid tint.');
 if(!Array.isArray(s.layers)||s.layers.length>30)throw Error('A scene supports up to 30 layers.');const layerIds=new Set();for(const l of s.layers){if(!l||typeof l!=='object'||!/^[a-zA-Z0-9_-]{1,80}$/.test(l.id)||layerIds.has(l.id)||!['image','reels','controls'].includes(l.kind))throw Error('Invalid or duplicate layer.');layerIds.add(l.id);finite(l.x,-s.width,s.width,'X');finite(l.y,-s.height,s.height,'Y');finite(l.w,32,s.width*2,'Width');finite(l.h,32,s.height*2,'Height');finite(l.opacity,0,1,'Opacity');label(l.name,'Layer name');flag(l.visible,'Visible');flag(l.locked,'Locked');if(l.kind==='image'&&!imageIds.has(l.assetId))throw Error('Missing layer asset.');}
 validateLayout(s);
 for(const id of ['reels','title','controls'])if(!layerIds.has(id))throw Error('Missing required layer: '+id);
 }
 return p;
}
export const compatible=p=>p.grid.columns===6&&p.grid.rows===5;
// Assets are immutable once added, so copies share them (frozen): undo
// snapshots and drafts never duplicate uploaded image bytes.
const share=a=>Object.isFrozen(a)?a:Object.freeze({...a});
export const clone=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,k==='assets'?v.map(share):structuredClone(v)]));
// Cheap equality for history: long image sources compare by length and tail.
const fingerprint=p=>JSON.stringify(p,(k,v)=>k==='src'&&typeof v==='string'&&v.length>512?`${v.length}:${v.slice(-48)}`:v);
export function applyOperation(project,op){
 if(!op||typeof op!=='object')throw Error('Invalid edit.');
 if(op.scene!==undefined&&!['desktop','mobile'].includes(op.scene))throw Error('Unknown scene.');
 const allowed={guides:['snap','safe','margin','grid'],cabinet:CABINET_KEYS,grid:['columns','rows','symbolScale','divider','fill','texture','frameWidth','frameAsset','supports'],background:['assetId','brightness','contrast','saturation','hue','blur','zoom','positionX','positionY','tint','tintOpacity'],layer:['name','x','y','w','h','visible','locked','opacity','assetId','anchorId']};
 if(allowed[op.type]&&(!op.values||typeof op.values!=='object'||Object.keys(op.values).some(k=>!allowed[op.type].includes(k))))throw Error('Unknown property for this edit.');
 const p=clone(project),scene=p.scenes[op.scene||'desktop'];
 if(op.type==='screens'){if(!scene)throw Error('Unknown scene');validateScreens(op.values);scene.screens=structuredClone(op.values);}
 else if(op.type==='guides')scene.guides={...scene.guides,...op.values};
 else if(op.type==='cabinet')scene.cabinet={...scene.cabinet,...op.values};
 else if(op.type==='grid')Object.assign(p.grid,op.values);
 else if(op.type==='background'){if(!scene)throw Error('Unknown scene.');Object.assign(scene.background,op.values);}
 else if(op.type==='layer'){const l=scene?.layers.find(l=>l.id===op.id);if(!l)throw Error('Unknown layer.');moveLinked(scene,op.id,op.values);}
 else if(op.type==='asset'){if(!op.asset||typeof op.asset!=='object')throw Error('Invalid asset.');if(p.assets.some(a=>a.id===op.asset.id))throw Error('Asset already exists.');p.assets.push(share(op.asset));}
 else if(op.type==='sound'){if(!SOUND_EVENTS.includes(op.id))throw Error('Unknown sound event.');p.sounds={...p.sounds};if(op.values===null)delete p.sounds[op.id];else p.sounds[op.id]={...(p.sounds[op.id]||{}),...op.values};}
 else if(op.type==='symbol'){if(!SYMBOLS.includes(op.id))throw Error('Unknown symbol.');p.symbols[op.id]=op.assetId;}
 else if(op.type==='addLayer'){if(!scene)throw Error('Unknown scene.');if(!op.layer||typeof op.layer!=='object')throw Error('Invalid layer.');scene.layers.push({...op.layer});}
 else if(op.type==='removeLayer'){if(['reels','title','controls'].includes(op.id))throw Error('Core layers can be hidden, not deleted.');scene.layers=scene.layers.filter(l=>l.id!==op.id);for(const l of scene.layers)if(l.anchorId===op.id)delete l.anchorId;}
 else if(op.type==='reorder'){if(!Number.isInteger(op.index))throw Error('Layer position must be a whole number.');const index=scene.layers.findIndex(l=>l.id===op.id);if(index<0)throw Error('Unknown layer.');const [l]=scene.layers.splice(index,1);scene.layers.splice(Math.max(0,Math.min(scene.layers.length,op.index)),0,l);}
 else if(op.type==='rename')p.name=op.name;
 else if(op.type==='canvas'){scene.width=op.width;scene.height=op.height;}
 else throw Error('Unknown edit: '+op.type);
 return validateProject(p);
}
export function applyBatch(project,ops){if(!Array.isArray(ops)||!ops.length||ops.length>50)throw Error('Provide 1–50 edits.');return ops.reduce(applyOperation,project);}
export class History{
 constructor(project){this.current=validateProject(clone(project));this.past=[];this.future=[];this.labels=[];}
 commit(project,label='Edit'){validateProject(project);if(fingerprint(project)===fingerprint(this.current))return false;this.past.push(this.current);this.labels.push(label);if(this.past.length>60){this.past.shift();this.labels.shift();}this.current=clone(project);this.future=[];return true;}
 undo(){if(!this.past.length)return false;this.future.push(this.current);this.current=this.past.pop();this.labels.pop();return true;}
 redo(){if(!this.future.length)return false;this.past.push(this.current);this.current=this.future.pop();this.labels.push('Redo');return true;}
}
export function parseCommand(text,project,scene='desktop',attachment){
 const t=text.trim().toLowerCase(),ops=[];let m;const layer=project.scenes[scene].layers.find(l=>l.id==='reels');
 if((m=t.match(/(?:grid|reels?|size|make it|change to|use|set)(?:\s+(?:to|a|the))*\s*(\d+)\s*[x×*]\s*(\d+)/))|| (m=t.match(/^(\d+)\s*[x×*]\s*(\d+)$/)))ops.push({type:'grid',values:{columns:+m[1],rows:+m[2]}});
 if(/background/.test(t)&&attachment)ops.push({type:'background',scene,values:{assetId:attachment}});
 for(const key of ['brightness','contrast','saturation','blur','hue'])if((m=t.match(new RegExp(`${key}\\s*(?:to|at|=|:)??\\s*(-?\\d+(?:\\.\\d+)?)`))))ops.push({type:'background',scene,values:{[key]:+m[1]}});
 if(/(?:bigger|larger|smaller).*(?:reels|cabinet)|(?:reels|cabinet).*(?:bigger|larger|smaller)/.test(t)){const scale=/smaller/.test(t)?.9:1.1;const w=Math.round(layer.w*scale),h=Math.round(layer.h*scale);ops.push({type:'layer',scene,id:'reels',values:{w,h,x:Math.round(layer.x+(layer.w-w)/2),y:Math.round(layer.y+(layer.h-h)/2)}});}
 if((m=t.match(/symbols?\s*(?:to|at|=|size)?\s*(\d+)\s*%/)))ops.push({type:'grid',values:{symbolScale:+m[1]/100}});
 if(/center (?:the )?(reels|cabinet)/.test(t))ops.push({type:'layer',scene,id:'reels',values:{x:Math.round((project.scenes[scene].width-layer.w)/2)}});
 if(/(?:hide|remove) (?:the )?(title|controls|reels)/.test(t)){const id=t.match(/(?:hide|remove) (?:the )?(title|controls|reels)/)[1];ops.push({type:'layer',scene,id,values:{visible:false}});}
 if(/show (?:the )?(title|controls|reels)/.test(t)){const id=t.match(/show (?:the )?(title|controls|reels)/)[1];ops.push({type:'layer',scene,id,values:{visible:true}});}
 if(!ops.length)throw Error('Try “grid 7×7”, “make reels bigger”, “saturation 120”, “blur 3”, “symbols 115%”, or attach an image and say “change background”. These are local edit commands; an AI model is not connected.');
 applyBatch(project,ops);return ops;
}

export function createBrokenWallProject(){const p=createProject(),s=p.scenes.mobile;s.background.assetId='zombie-broken-wall-mobile';s.cabinet={frameAsset:'picture-frame',supports:false};Object.assign(s.layers.find(l=>l.id==='reels'),{x:10,y:260,w:370,h:345});Object.assign(s.layers.find(l=>l.id==='title'),{x:20,y:6,w:350,h:80});Object.assign(s.layers.find(l=>l.id==='controls'),{x:0,y:650,w:390,h:214});return p;}

// Upgrade only the untouched room preset; keep custom placements intact.
export function upgradeRoomComposition(project){const p=clone(project),s=p.scenes.mobile;if(s.background.assetId!=='zombie-broken-wall-mobile')return p;const t=s.layers.find(l=>l.id==='title'),c=s.layers.find(l=>l.id==='controls');if(t.x===18&&t.y===170&&t.w===240&&t.h===82){Object.assign(t,{x:20,y:6,w:350,h:80});if(c.x===0&&c.w===390&&((c.y===620&&c.h===214)||(c.y===690&&c.h===144)))Object.assign(c,{y:650,h:214});}return p;}

export function createSubwayProject(){const p=createProject(),s=p.scenes.mobile;s.background.assetId='subway-background';s.cabinet={frameAsset:'subway-frame',frameWidth:22,supports:false,fill:'#222323',texture:false};p.grid.symbolScale=1;s.layers.find(l=>l.id==='title').assetId='subway-art';Object.assign(s.layers.find(l=>l.id==='title'),{x:82,y:94,w:226,h:65});Object.assign(s.layers.find(l=>l.id==='reels'),{x:2,y:174,w:386,h:348});Object.assign(s.layers.find(l=>l.id==='controls'),{x:0,y:674,w:390,h:214});return p;}
