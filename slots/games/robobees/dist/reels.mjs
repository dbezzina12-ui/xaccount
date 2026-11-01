// The reel strip starts on the outgoing four symbols and finishes on the
// committed layout. The ramp follows Gnome Mercy's reelPosition profile.
import {premiums,ranks} from './rules.mjs';
const regular=[...premiums,...ranks];
export function symbolClass(id){
 const type=ranks.includes(id)?'rank':id==='FS'?'special scatter':id==='W'?'special':'';
 return 'sym-'+id+' '+type;
}
export function symbolUrl(id){return 'assets/'+id+'.webp'+(id==='FS'?'?v=2':'')}
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
  const fillerCount=9+col*2+Math.round(extra/60);
  const fillers=Array.from({length:fillerCount},()=>regular[Math.floor(Math.random()*regular.length)]);
  const ids=[...rows.map(i=>after[idx(i)]),...fillers,...rows.map(i=>before[idx(i)])];
  const view=document.createElement('div'),strip=document.createElement('div');
  view.className='reel-viewport';strip.className='reel-strip';view.append(strip);board.append(view);
  view.style.gridColumn=(col+1)+' / span 1';view.style.gridRow='1 / span 4';
  for(const id of ids){
   const tile=document.createElement('div'),img=new Image();
   tile.className='cell '+symbolClass(id);img.src=symbolUrl(id);img.alt='';tile.append(img);strip.append(tile);
  }
  scatters+=rows.filter(i=>after[idx(i)]==='FS').length;
  return {view,strip,col,delay:reduced?0:col*(turbo?8:30),duration,steps:ids.length-4,tease,done:false};
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
    for(let row=0;row<4;row++){const i=row*5+p.col;place(i,after[i],spots)}
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
