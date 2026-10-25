// Same proportional artwork and horizontal anchor during landing and hold.
// Tall reels act as a viewing window; they never squeeze the character's face.
export const ZOMBIE_ASPECT=352/1004;
export const zombieAnchor=span=>span>=4?.60:.50;
export function verticalZombieLayout(width,height,span){
 const artWidth=height*ZOMBIE_ASPECT;
 return {x:width/2-artWidth*zombieAnchor(span),y:0,width:artWidth,height};
}

// The exit gag belongs only to an awarded, top-to-bottom five-position column.
// Never infer it from the displayed multiplier, CSS height or a stale DOM tag.
export function fullReelExitIds(board=[]){
 const ids=new Set();
 if(board.length!==30)return ids;
 for(const head of board){
  if(head.kind!=='zombie'||head.fullReel!==true||!['up','down'].includes(head.direction))continue;
  if(!Array.isArray(head.spanCells)||head.spanCells.length!==5)continue;
  const cells=[...new Set(head.spanCells)].sort((a,b)=>a-b),reel=cells[0];
  if(cells.length!==5||!Number.isInteger(reel)||reel<0||reel>=6)continue;
  if(!cells.every((index,row)=>index===row*6+reel))continue;
  if(!cells.every(index=>board[index]?.stackId===head.id))continue;
  ids.add(head.id);
 }
 return ids;
}

// Claims can share a trail cell after a full-reel award. The board's stackId
// decides which portrait is visible there; the underlying payout is untouched.
export function visibleStackCells(stack,board){
 return [...new Set(stack.cells)].filter(index=>{
  const cell=board[index];
  return cell&&(!cell.stackId||cell.stackId===stack.id)&&
   (cell.kind!=='zombie'||cell.id===stack.id);
 }).sort((a,b)=>a-b);
}
// A portrait is never sliced by a crossing claim. Keep its complete silhouette
// in the connected owned segment containing the live head; the backdrop can
// still cover the other owned trail cells without inventing another character.
export function stackPortraitCells(stack,board,width=6){
 const owned=new Set(visibleStackCells(stack,board));
 const head=board.findIndex(cell=>cell.kind==='zombie'&&cell.id===stack.id);
 if(!owned.has(head))return [];
 const horizontal=stack.horizontal??stack.cells.every(i=>Math.floor(i/width)===Math.floor(stack.cells[0]/width));
 const stride=horizontal?1:width,cells=[head];
 for(const direction of [-1,1])for(let i=head+stride*direction;owned.has(i)&&(!horizontal||Math.floor(i/width)===Math.floor(head/width));i+=stride*direction)cells.push(i);
 return cells.sort((a,b)=>a-b);
}
export function stackPortraitRegion(stack,board,width=6){
 const cells=stackPortraitCells(stack,board,width);
 if(!cells.length)return null;
 const bounds=indices=>({left:Math.min(...indices.map(i=>i%width)),right:Math.max(...indices.map(i=>i%width))+1,top:Math.min(...indices.map(i=>Math.floor(i/width))),bottom:Math.max(...indices.map(i=>Math.floor(i/width)))+1});
 const outer=bounds(stack.cells),inner=bounds(cells),w=outer.right-outer.left,h=outer.bottom-outer.top;
 return {cells,left:(inner.left-outer.left)/w,top:(inner.top-outer.top)/h,width:(inner.right-inner.left)/w,height:(inner.bottom-inner.top)/h};
}
const maskURL=(width,height,path)=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="white" fill-rule="evenodd" d="${path}"/></svg>`)}")`;
const boxPath=(x,y,w,h)=>`M${x} ${y}h${w}v${h}h${-w}Z`;
export function stackPresentationMask(stack,board,width=6){
 const visible=visibleStackCells(stack,board);
 if(visible.length===stack.cells.length)return 'none';
 const xs=stack.cells.map(i=>i%width),ys=stack.cells.map(i=>Math.floor(i/width));
 const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x+1,h=Math.max(...ys)-y+1;
 return maskURL(w,h,visible.map(i=>boxPath(i%width-x,Math.floor(i/width)-y,1,1)).join(''));
}
export function otherZombieCells(board,owner){
 const claimed=new Set();
 for(const head of board){
  if(head.kind!=='zombie'||head.id===owner)continue;
  const cells=head.spanCells||[board.indexOf(head)];
  for(const index of visibleStackCells({id:head.id,cells},board))claimed.add(index);
 }
 return [...claimed];
}
// The cells a moving rig is masked out of: those another zombie holds before
// this event and still holds after it. A cell the event awards to the mover
// (a crossing expansion takes one from a horizontal claim) stays visible, or
// the landing zombie loses its head at that cell's edge.
export function occludingCells(event){
 const before=otherZombieCells(event.before,event.headId);
 if(!event.board)return before;
 const after=new Set(otherZombieCells(event.board,event.headId));
 return before.filter(index=>after.has(index));
}
// A board-space mask stays still while the rig animates inside it. Using
// normalized rectangles also handles a scaled Studio iframe without offsets.
export function motionOcclusionMask(bounds,rects){
 if(!bounds.width||!bounds.height||!rects.length)return 'none';
 const paths=[boxPath(0,0,1,1)];
 for(const r of rects){
  const x=Math.max(0,(r.left-bounds.left)/bounds.width),y=Math.max(0,(r.top-bounds.top)/bounds.height);
  const right=Math.min(1,(r.right-bounds.left)/bounds.width),bottom=Math.min(1,(r.bottom-bounds.top)/bounds.height);
  if(right>x&&bottom>y)paths.push(boxPath(x,y,right-x,bottom-y));
 }
 return paths.length>1?maskURL(1,1,paths.join('')):'none';
}
export function maskZombieMotion(host,board,cells=[]){
 if(!board||!cells.length)return;
 const rects=cells.map(index=>board.children[index]?.getBoundingClientRect()).filter(Boolean);
 const mask=motionOcclusionMask(host.getBoundingClientRect(),rects);
 host.style.maskImage=mask;host.style.webkitMaskImage=mask;
 host.style.maskSize='100% 100%';host.style.maskRepeat='no-repeat';
}
