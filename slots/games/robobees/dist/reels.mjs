// The reel strip starts on the outgoing four symbols and finishes on the
// committed layout. The ramp follows Gnome Mercy's reelPosition profile.
import {premiums,ranks} from './rules.mjs?v=31';
import {addHoney,honeyStill} from './honey.mjs';
const regular=[...premiums,...ranks];
export function symbolClass(id){
 const type=ranks.includes(id)?'rank':id==='FS'?'special scatter':id==='W'?'special':'';
 return 'sym-'+id+' '+type;
}
export function symbolUrl(id){return id==='FS'?honeyStill:'assets/'+id+'.webp'}
// Keep a decoded image for every possible landing, including symbols missing
// from a restored board. Concurrent loads and retries share successful decodes.
const symbolImages=new Map();
export function preloadSymbols(){
 return Promise.all([...regular,'W','FS'].map(id=>{
  if(!symbolImages.has(id)){
   const image=new Image();
   image.src=symbolUrl(id);
   symbolImages.set(id,image.decode().then(()=>image).catch(error=>{
    symbolImages.delete(id);
    throw error;
   }));
  }
  return symbolImages.get(id);
 }));
}
// Keep strip travel on the compositor while the camera zooms. The four
// stops describe the same acceleration, cruise and braking distances.
function stripTransform(rows){
 return 'translate3d(0,calc('+(-25*rows)+'% - '+(.5*rows)+'px),0)';
}
export async function rollReels({cells,before,after,spots,place,turbo,reduced,skip,land,purchased=false,onTease}){
 const board=cells[0].parentElement;
 let scatters=0,extra=0;
 const plans=Array.from({length:5},(_,col)=>{
  const idx=row=>row*5+col;
  const rows=[0,1,2,3],tease=scatters>=2&&(!turbo||purchased)&&!reduced;
  if(tease)extra+=purchased?980:760;
  const duration=reduced?0:(850+col*150+extra)*(turbo && !purchased ? .34 : 1);
  const delay=reduced?0:col*(turbo?8:30);
  const fillerCount=9+col*2+Math.round(extra/60);
  const fillers=Array.from({length:fillerCount},()=>regular[Math.floor(Math.random()*regular.length)]);
  const ids=[...rows.map(i=>after[idx(i)]),...fillers,...rows.map(i=>before[idx(i)])];
  const view=document.createElement('div'),strip=document.createElement('div');
  view.style.setProperty('--travel',duration+'ms');view.style.setProperty('--delay',delay+'ms');
  view.className='reel-viewport';strip.className='reel-strip';view.append(strip);board.append(view);
  view.style.gridColumn=(col+1)+' / span 1';view.style.gridRow='1 / span 4';
  // Only the symbols travel. Keep each multiplier bed in its own board position.
  for(const row of rows)cells[idx(row)].classList.add('rolling');
  for(const id of ids){
   const tile=document.createElement('div'),img=new Image();
   tile.className='cell '+symbolClass(id);img.src=symbolUrl(id);img.alt='';tile.append(img);if(id==='FS')addHoney(tile);strip.append(tile);
  }
  scatters+=rows.filter(i=>after[idx(i)]==='FS').length;
  return {view,strip,col,delay,duration,steps:ids.length-4,tease,done:false};
 });
 for(const p of plans){
  if(!p.duration)continue;
  p.motion=p.strip.animate([
   {offset:0,transform:stripTransform(p.steps),easing:'cubic-bezier(.333333,0,.666667,.333333)'},
   {offset:.12,transform:stripTransform(p.steps*(1-.06/.78)),easing:'linear'},
   {offset:.68,transform:stripTransform(p.steps*(1-.62/.78)),easing:'cubic-bezier(.333333,.666667,.666667,1)'},
   {offset:1,transform:'translate3d(0,0,0)'}
  ],{duration:p.duration,delay:p.delay,fill:'both'});
 }
 function frame(){
  let settled=0;
  for(const p of plans){
   if(p.done){settled++;continue}
   if(skip()||!p.motion||p.motion.playState==='finished'){
    for(let row=0;row<4;row++){
     const i=row*5+p.col;
     cells[i].classList.remove('rolling');place(i,after[i],spots);
    }
    p.motion?.cancel();p.view.remove();p.done=true;land(p.col,after.filter((id,i)=>i%5===p.col&&id==='FS').length);settled++;continue;
   }
   if(p.tease&&!p.notified&&plans[p.col-1]?.done){
    p.notified=true;p.view.classList.add('tease');onTease?.(p.col);
   }
  }
  return settled===5;
 }
 await new Promise(resolve=>{function tick(){if(frame())resolve();else requestAnimationFrame(tick)}tick()});
}

// Use a transparent strip over each moving column. Only the artwork falls;
// the coloured beds and multiplier values belong to fixed board positions.
export async function dropTumble({cells,step,turbo,reduced,skip,place}){
 const views=[],motions=[];
 try{
  if(!reduced&&!skip()){
   const grid=cells[0].parentElement;
   for(let col=0;col<5;col++){
    if(step.from[col]===0)continue;
    const view=document.createElement('div');view.className='tumble-column';
    view.style.gridColumn=(col+1)+' / span 1';view.style.gridRow='1 / span 4';grid.append(view);views.push(view);
    for(let row=0;row<4;row++){
     const i=row*5+col,travel=row-step.from[i],id=step.landed[i];
     cells[i].classList.add('rolling');
     const tile=document.createElement('div'),img=new Image();
     tile.className='cell '+symbolClass(id);img.src=symbolUrl(id);img.alt='';tile.append(img);
     if(id==='FS')addHoney(tile);
     view.append(tile);
     if(!travel)continue;
     motions.push(tile.animate([
      {transform:'translateY(calc(-'+(travel*100)+'% - '+(travel*2)+'px))',easing:'cubic-bezier(.45,.02,.82,.50)'},
      {offset:.82,transform:'translateY(2px)',easing:'ease-out'},{transform:'none'}
     ],{duration:(turbo?150:300)+travel*(turbo?11:19),fill:'both'}));
    }
   }
   if(motions.length)await new Promise(resolve=>{
    function tick(){if(skip()||document.hidden||motions.every(m=>m.playState==='finished'))resolve();else requestAnimationFrame(tick)}
    tick();
   });
  }
 }finally{
  cells.forEach((cell,i)=>{
   cell.classList.remove('rolling');place(i,step.landed[i],step.active);
   if(!reduced&&step.from[i]!==Math.floor(i/5)&&step.landed[i]==='FS')cell.querySelector('.fs-rig')?.classList.add('latching');
  });
  views.forEach(view=>view.remove());motions.forEach(motion=>motion.cancel());
 }
}
