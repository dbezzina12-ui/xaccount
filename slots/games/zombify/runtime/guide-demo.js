import {humanBiteValue,expandedZombies} from './math.js';
import {createGuideScenes} from './guide-scenes.js';
import {mountApprovedRig,stopApprovedRigs,createApprovedAnimator,ZOMBIE_ACTION_SPEED} from './approved-rig.js';
import {swatTrajectory,debrisFrames} from './zombie-swat.js';

function createPanel(card,scene){
 const board=card.querySelector('.guide-demo-board'),stacks=card.querySelector('.guide-demo-stacks');
 const effects=card.querySelector('.guide-demo-effects'),caption=card.querySelector('.guide-demo-caption'),toggle=card.querySelector('.guide-demo-toggle');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),active=new Set(),timers=new Map(),animator=createApprovedAnimator();
 let epoch=0,shown=false,paused=reduced.matches;
 const alive=token=>shown&&!paused&&!document.hidden&&token===epoch;
 const wait=ms=>new Promise(resolve=>{const id=setTimeout(()=>{timers.delete(id);resolve();},ms);timers.set(id,resolve);});
 async function animate(node,frames,ms,options={}){
  const animation=node.animate(frames,{duration:ms,fill:'both',...options});active.add(animation);
  await animation.finished.catch(()=>{});active.delete(animation);animation.cancel();
 }
 function render(cells){
  stopApprovedRigs(stacks);board.replaceChildren();stacks.replaceChildren();effects.replaceChildren();
  for(const index of scene.indices){
   const cell=cells[index],tile=document.createElement('div'),art=document.createElement('span');
   tile.className='tile';tile.dataset.index=index;tile.dataset.kind=cell.kind;
   const gain=humanBiteValue(cell);if(gain>1)tile.classList.add(`carrier-${gain}`);
   art.className=`symbol art-${cell.kind}`;tile.append(art);
   if(cell.kind==='zombie'&&cell.multi){const value=document.createElement('strong');value.className='guide-head-multi';value.textContent=`${cell.multi}×`;tile.append(value);}
   board.append(tile);
  }
  for(const stack of expandedZombies(cells)){
   if(!stack.cells.every(i=>scene.indices.includes(i)))continue;
   const slots=stack.cells.map(i=>scene.indices.indexOf(i)),frame=document.createElement('div'),art=document.createElement('div'),image=new Image(),multi=document.createElement('strong');
   frame.className='expanded-zombie guide-demo-stack';frame.dataset.direction=stack.direction;frame.dataset.span=stack.cells.length;
   frame.style.gridColumn=`${slots[0]%3+1}`;frame.style.gridRow=`${Math.floor(slots[0]/3)+1} / span ${slots.length}`;
   art.className='stack-art approved-stack-art';image.className='approved-rig-fallback';image.src='assets/approved-rig/front/idle.png';image.alt='';
   multi.className='stack-multi';multi.textContent=`${stack.multi}×`;art.append(image);frame.append(art,multi);stacks.append(frame);
   void mountApprovedRig(art,{staticPose:!shown||paused||document.hidden});
  }
 }
 function stop(settle=false){
  epoch++;stopApprovedRigs(stacks);
  for(const [id,resolve] of timers){clearTimeout(id);resolve();}timers.clear();
  for(const animation of active)animation.cancel();active.clear();effects.replaceChildren();
  if(settle){render(scene.final);caption.textContent=scene.finalCaption;}
 }
 async function walk(event,token){
  const source=board.querySelector(`[data-index="${event.source}"]`),target=board.querySelector(`[data-index="${event.target}"]`);
  const from=source.getBoundingClientRect(),to=target.getBoundingClientRect(),bounds=effects.getBoundingClientRect();
  let debris,flight=null;
  const heart=event.type==='heart';
  const contact=()=>{
   if(flight||!alive(token))return;
   debris=target.cloneNode(true);debris.className='swatted-symbol flying-tile';
   Object.assign(debris.style,{position:'absolute',left:`${to.left-bounds.left}px`,top:`${to.top-bounds.top}px`,width:`${to.width}px`,height:`${to.height}px`});
   effects.append(debris);target.firstElementChild.style.visibility='hidden';
   const value=document.createElement('span');value.className='carrier-value';const digits=document.createElement('strong');digits.className='multiplier-digits';digits.textContent=heart?'+1':`+${event.gain}×`;value.append(digits);target.append(value);target.classList.add('multiplier-revealed');
   const localTarget={left:to.left-bounds.left,right:to.right-bounds.left,top:to.top-bounds.top,width:to.width,height:to.height};
   const frames=heart?[{transform:'scale(1)',opacity:1},{transform:'translateY(-20px) scale(1.25)',opacity:1},{transform:'translateY(-45px) scale(.2)',opacity:0}]:debrisFrames(swatTrajectory(from,localTarget,{width:bounds.width,height:bounds.height},event.direction));
   flight=animate(debris,frames,470/ZOMBIE_ACTION_SPEED,{easing:'linear'}).finally(()=>debris.remove());
  };
  source.style.opacity='0';caption.textContent=heart?'HEART COLLECTED · +1 RESPIN':`BITE +${event.gain}× · MULTIPLIER ${event.multi}×`;
  try{
   await animator.playStep({source:{x:from.left,y:from.top,width:from.width,height:from.height},target:{x:to.left,y:to.top,width:to.width,height:to.height},direction:event.direction,layer:effects,shouldSkip:()=>!alive(token),onEvent:n=>{if(n==='swat_contact'||n==='impact')contact();}});
   await flight;
  }finally{debris?.remove();source.style.opacity='';}
  if(alive(token))render(event.board);
 }
 async function expand(event,token){
  render(event.before);caption.textContent=`${event.multi}× WILD · ${event.cells.length} POSITIONS`;
  const bounds=effects.getBoundingClientRect(),tiles=event.cells.map(i=>board.querySelector(`[data-index="${i}"]`)),rects=tiles.map(t=>t.getBoundingClientRect());
  const left=Math.min(...rects.map(r=>r.left)),right=Math.max(...rects.map(r=>r.right)),top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
  const source=board.querySelector(`[data-index="${event.target}"]`).getBoundingClientRect();
  tiles.forEach(t=>t.firstElementChild.style.visibility='hidden');
  await animator.play({rig:'zombie',cells:event.cells,target:{x:(left+right)/2-bounds.left,y:bottom-bounds.top,width:right-left,height:bottom-top},source:{x:source.left-bounds.left,y:source.top-bounds.top,width:source.width,height:source.height},layer:effects,direction:event.direction,shouldSkip:()=>!alive(token),onEvent:()=>{}});
  if(alive(token))render(event.board);
 }
 async function run(token){
  while(alive(token)){
   render(scene.initial);caption.textContent=scene.openingCaption;await wait(850);
   for(const event of scene.events){
    if(!alive(token))return;
    if(event.type==='walk'||event.type==='heart')await walk(event,token);
    else if(event.type==='expand')await expand(event,token);
    else if(event.type==='hold'){caption.textContent=event.caption;await wait(1450);}
    else if(event.type==='reveal'){render(event.board);caption.textContent=event.caption;await wait(1050);}
   }
   if(!alive(token))return;
   caption.textContent=scene.finalCaption;await wait(2200);
  }
 }
 function sync(){
  toggle.textContent=paused?'PLAY DEMO':'PAUSE';toggle.setAttribute('aria-label',`${paused?'Play':'Pause'} ${card.querySelector('h3').textContent.toLowerCase()} demonstration`);
  stop(true);if(alive(epoch)){const token=epoch;void run(token).catch(()=>{if(token===epoch)stop(true);});}
 }
 toggle.addEventListener('click',()=>{paused=!paused;sync();});
 reduced.addEventListener('change',()=>{paused=reduced.matches;sync();});
 document.addEventListener('visibilitychange',()=>{if(shown)sync();});
 window.addEventListener('resize',()=>{if(shown)sync();});
 render(scene.final);
 return {show(value){if(value===shown)return;shown=value;sync();},stop(){shown=false;stop(true);}};
}

export function createGuideDemo(){
 const scenes=createGuideScenes(),panels=[...document.querySelectorAll('[data-guide-scene]')].map((card,i)=>createPanel(card,scenes[i]));
 return {show(indices){panels.forEach((panel,i)=>panel.show(indices.includes(i)));},stop(){panels.forEach(panel=>panel.stop());}};
}
