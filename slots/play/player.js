import {createBrokenWallProject,validateProject,upgradeRoomComposition} from '../studio/project.js';
import {readSaved,readJournal,onSaved} from '../studio/storage.js';
const frame=document.querySelector('#runtime'),fit=document.querySelector('#fit'),status=document.querySelector('#status');let project=createBrokenWallProject(),ready=false,current='',revision=0;
async function loadProject(){try{const saved=await readSaved(),p=readJournal(saved)||saved?.project;if(p)project=upgradeRoomComposition(validateProject(p));}catch{}current='';layout();}
onSaved(loadProject);window.addEventListener('focus',loadProject);

function layout(){const scene=innerWidth<innerHeight?'mobile':'desktop',s=project.scenes[scene],scale=Math.min(innerWidth/s.width,innerHeight/s.height);fit.style.cssText=`width:${s.width*scale}px;height:${s.height*scale}px`;frame.style.cssText=`width:${s.width}px;height:${s.height}px;transform:scale(${scale})`;if(ready&&current!==scene){current=scene;frame.contentWindow.postMessage({source:'slot-studio',type:'apply',scene,project,rev:++revision},location.origin);}}
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.source!=='slot-runtime')return;const d=e.data;if(d.type==='ready'){ready=true;loadProject();}if(d.type==='game'){status.hidden=d.status==='ready';if(d.status==='error')status.textContent='Artwork could not load. Please refresh.';}if(d.type==='error'){status.hidden=false;status.textContent=d.message;}});
window.addEventListener('resize',layout);document.querySelector('#full').onclick=()=>document.documentElement.requestFullscreen?.().catch(()=>{});layout();
