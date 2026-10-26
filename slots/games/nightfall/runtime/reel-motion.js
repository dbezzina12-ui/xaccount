import {symbolArt} from './symbols.js';

// One clipped plane above all cells. Moving symbols can cross every row visibly.
export class ReelMotion {
 constructor(board,cells,{paused,skip,turbo,onLand}) {
  this.board=board;this.cells=cells;this.paused=paused;this.skip=skip;this.turbo=turbo;this.onLand=onLand;
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
  this.layer=document.createElement('div');this.layer.className='drop-layer';this.layer.setAttribute('aria-hidden','true');board.append(this.layer);
 }
 geometry(){const board=this.board.getBoundingClientRect();return this.cells.map(cell=>{const r=cell.getBoundingClientRect();return {x:r.left-board.left+1,y:r.top-board.top+1,w:r.width-2,h:r.height-2};});}
 sprite(kind,box){const el=document.createElement('div');el.className='falling-symbol';el.innerHTML=symbolArt(kind);Object.assign(el.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});this.layer.append(el);return el;}
 async run(tracks,kind){
  if(!tracks.length)return;
  this.board.dataset.motion=kind;
  const factor=this.turbo()?.42:1,total=Math.max(...tracks.map(t=>(t.duration+t.delay)*factor));
  const animations=tracks.map(t=>{const a=t.el.animate(t.frames,{duration:t.duration*factor,delay:t.delay*factor,fill:'both',easing:'linear'});a.pause();a.currentTime=0;return a;});
  let elapsed=0,last=performance.now(),resized=false;const onResize=()=>{resized=true;};window.addEventListener('resize',onResize,{once:true});
  try {await new Promise(resolve=>{const frame=now=>{if(!this.paused())elapsed+=Math.min(60,now-last);last=now;if(this.skip()||resized)elapsed=total;for(const a of animations)a.currentTime=Math.min(elapsed,total);if(elapsed>=total){resolve();return;}requestAnimationFrame(frame);};requestAnimationFrame(frame);});}
  finally {window.removeEventListener('resize',onResize);for(const a of animations)a.cancel();this.layer.replaceChildren();for(const cell of this.cells)cell.classList.remove('motion-target');delete this.board.dataset.motion;}
 }
 async leave(board){
  if(this.reduced.matches||this.skip())return;
  const boxes=this.geometry(),pitch=boxes[7].y-boxes[0].y,tracks=[];
  // Empty cells (Hidden's cleared board) have nothing to drop out.
  for(let i=0;i<49;i++){if(!board[i])continue;this.cells[i].classList.add('motion-target');const el=this.sprite(board[i],boxes[i]);tracks.push({el,duration:190,delay:(i%7)*12,frames:[{transform:'translateY(0)',opacity:1},{transform:`translateY(${(7-Math.floor(i/7))*pitch}px)`,opacity:.8}]});}
  await this.run(tracks,'out');
 }
 async scatters(indices,{trigger=false}={}){
  if(this.reduced.matches||this.skip()||!indices.length)return;
  const tracks=[],duration=trigger?700:520;
  for(const i of indices){
   const shield=this.cells[i].querySelector('.fs-shield'),letters=this.cells[i].querySelector('.fs-letters');
   if(!shield||!letters)continue;
   tracks.push({el:shield,duration,delay:0,frames:[
    {transform:'scale(.94) rotate(-4deg)',offset:0,easing:'ease-out'},
    {transform:'scale(1.04) rotate(3deg)',offset:.3,easing:'ease-in-out'},
    {transform:'scale(.99) rotate(-1deg)',offset:.65,easing:'ease-out'},
    {transform:'none',offset:1}
   ]});
   tracks.push({el:letters,duration,delay:0,frames:[
    {transform:'translateY(6%) scale(.72)',offset:0,easing:'cubic-bezier(.16,.8,.25,1)'},
    {transform:`translateY(-3%) scale(${trigger?1.12:1.08})`,offset:.35,easing:'ease-in-out'},
    {transform:'translateY(1%) scale(.98)',offset:.7,easing:'ease-out'},
    {transform:'none',offset:1}
   ]});
  }
  // Use the same paused presentation clock and cleanup as falling symbols.
  await this.run(tracks,'scatter');
 }
 async fall(board,falls,{initial=false}={}){
  if(this.reduced.matches||this.skip())return;
  const boxes=this.geometry(),pitch=boxes[7].y-boxes[0].y,tracks=[];
  for(let i=0;i<49;i++){
   const distance=initial?7:falls[i];if(!distance)continue;
   this.cells[i].classList.add('motion-target');const el=this.sprite(board[i],boxes[i]);
   tracks.push({el,duration:initial?690:350+distance*45,delay:(i%7)*(initial?25:10),frames:[
    {transform:`translateY(${-distance*pitch}px)`,offset:0,easing:'cubic-bezier(.42,0,.74,.54)'},
    {transform:'translateY(3px)',offset:.82,easing:'ease-out'},
    {transform:'translateY(-2px)',offset:.92,easing:'ease-in'},
    {transform:'translateY(0)',offset:1}
   ]});
  }
  await this.run(tracks,initial?'drop':'tumble');this.onLand?.();
 }
}
