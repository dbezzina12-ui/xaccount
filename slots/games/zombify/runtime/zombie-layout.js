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
