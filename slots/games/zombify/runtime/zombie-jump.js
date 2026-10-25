import {copySymbolPaint} from './symbol-paint.js';
import {mountHorizontalRig} from './horizontal-rig.js';
import {verticalZombieLayout,occludingCells,maskZombieMotion} from './zombie-layout.js';
// Presentation only. The round's supplied cells and board remain authoritative.
let animator=null;
export function registerZombieAnimator(adapter){
  if(adapter!==null&&typeof adapter.play!=='function')throw new TypeError('Animator needs play(context).');
  animator=adapter;return()=>{if(animator===adapter)animator=null;};
}
export function getZombieAnimator(){return animator;}
export function jumpClip(cells,width=6,direction='right'){
  if(!cells.length)throw new RangeError('A jump requires target cells.');
  const columns=new Set(cells.map(i=>i%width));
  return columns.size>1?`jump_${direction==='left'?'left':'right'}_${Math.min(6,columns.size)}_cells`:`jump_expand_${Math.min(5,cells.length)}_positions`;
}
export async function playZombieJump({event,board,layer,animate,pause,rate=1,shouldSkip,onImpact}){
  if(shouldSkip())return;
  const occludedCells=occludingCells(event),cells=[...event.cells],clip=jumpClip(cells,6,event.direction),rects=cells.map(i=>board.children[i].getBoundingClientRect());
  const bounds=layer.getBoundingClientRect();
  const left=Math.min(...rects.map(r=>r.left)),right=Math.max(...rects.map(r=>r.right));
  const top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
  const target={x:(left+right)/2-bounds.left,y:bottom-bounds.top,width:right-left,height:bottom-top};
  const debris=[];let impacted=false,impactTask=null;
  const runImpact=async()=>{
    if(impacted||shouldSkip())return;impacted=true;onImpact?.();
    const animations=[];
    for(const [n,index] of cells.entries()){
      const tile=board.children[index],source=tile.firstElementChild;
      // Knock only the cells the math has already awarded to this expansion.
      if(!source||event.before[index].kind==='zombie'||event.before[index].kind==='wild')continue;
      const r=tile.getBoundingClientRect(),ghost=document.createElement('div');
      ghost.className='knocked-symbol';const copy=source.cloneNode(true);copySymbolPaint(source,copy);ghost.append(copy);
      Object.assign(ghost.style,{left:`${r.left-bounds.left}px`,top:`${r.top-bounds.top}px`,width:`${r.width}px`,height:`${r.height}px`});
      layer.append(ghost);debris.push(ghost);source.style.visibility='hidden';
      const direction=n%2?-1:1;
      animations.push(animate(ghost,[{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${direction*r.width*.6}px,${-r.height*.4}px) rotate(${direction*24}deg)`,opacity:1,offset:.3},{transform:`translate(${direction*r.width*1.3}px,${r.height*1.8}px) rotate(${direction*85}deg)`,opacity:0}],430,{fill:'forwards'}));
    }
    animations.push(animate(board,[{transform:'translate(0,0)'},{transform:'translate(0,5px)',offset:.2},{transform:'translate(0,-3px)',offset:.5},{transform:'translate(0,0)'}],220));
    await Promise.all(animations);
  };
  const impact=()=>impactTask||(impactTask=runImpact());
  let mascot,horizontalRig,fallbackLayer;
  const mountFallback=art=>{
    const host=document.createElement('div');
    Object.assign(host.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'70'});
    art.style.position='absolute';host.append(art);document.body.append(host);
    maskZombieMotion(host,board,occludedCells);return host;
  };
  try{
    if(animator){
      const r=board.children[event.target].getBoundingClientRect();
      for(const index of cells)board.children[index].firstElementChild.style.visibility='hidden';
      await animator.play({board,occludedCells,rig:new Set(cells.map(i=>i%6)).size>1?'horizontal':'zombie',clip,cells,target,source:{x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height},layer,rate,direction:event.direction,shouldSkip,onEvent:name=>name==='impact'?impact():undefined});
      await impact();
    }else if(new Set(cells.map(i=>i%6)).size>1){
      mascot=document.createElement('div');mascot.className='horizontal-jump';
      Object.assign(mascot.style,{position:'fixed',zIndex:'70',pointerEvents:'none',left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});fallbackLayer=mountFallback(mascot);
      for(const index of cells)board.children[index].firstElementChild.style.visibility='hidden';
      horizontalRig=await mountHorizontalRig(mascot,{span:cells.length,direction:event.direction,clip:`jump_${event.direction}_${cells.length}_cells`,loop:false,rate});
      await pause(690);if(!shouldSkip())await impact();await pause(430);
    }else{
      mascot=document.createElement('img');mascot.className='jumping-zombie';mascot.src='assets/rework/zombie-slim.png';mascot.alt='';
      const height=target.height,fit=verticalZombieLayout(target.width,height,cells.length);
      Object.assign(mascot.style,{position:'fixed',zIndex:'70',left:`${left+fit.x}px`,top:`${top}px`,width:`${fit.width}px`,height:`${height}px`});fallbackLayer=mountFallback(mascot);
      const small=Math.min(1,rects[0].height/height),startY=-(height-rects[0].height);
      for(const index of cells){if(board.children[index].dataset.kind==='zombie')board.children[index].style.opacity='0';}
      await animate(mascot,[{transform:`translateY(${startY}px) scale(${small})`},{transform:`translateY(${startY+rects[0].height*.08}px) scale(${small*.96})`}],160,{fill:'forwards'});
      await animate(mascot,[{transform:`translateY(${startY}px) scale(${small})`},{transform:`translateY(${-height*.45}px) scale(${Math.max(.65,small)})`,offset:.48},{transform:'translateY(0) scale(1)'}],520,{fill:'forwards',easing:'cubic-bezier(.3,0,.7,1)'});
      const cropLeft=Math.max(0,-fit.x),cropRight=Math.max(0,fit.x+fit.width-target.width);
      mascot.style.clipPath=`inset(0 ${cropRight}px 0 ${cropLeft}px)`;
      await Promise.all([impact(),animate(mascot,[{transform:'translateY(0)'},{transform:'translateY(-4px)',offset:.4},{transform:'translateY(0)'}],300,{fill:'forwards'})]);
      mascot.src='assets/rework/zombie-slim.png';await pause(100);
    }
  }finally{horizontalRig?.stop();fallbackLayer?.remove();mascot?.remove();debris.forEach(n=>n.remove());}
}
