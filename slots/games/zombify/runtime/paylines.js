export const PAYLINES=[
 [0,0,0,0,0,0],[1,1,1,1,1,1],[2,2,2,2,2,2],[3,3,3,3,3,3],[4,4,4,4,4,4],
 [0,1,2,2,1,0],[1,2,3,3,2,1],[2,3,4,4,3,2],
 [4,3,2,2,3,4],[3,2,1,1,2,3],[2,1,0,0,1,2],
 [0,1,2,3,4,4],[4,3,2,1,0,0],
 [0,1,0,1,0,1],[1,0,1,0,1,0],[1,2,1,2,1,2],[2,1,2,1,2,1],
 [2,3,2,3,2,3],[3,2,3,2,3,2],[3,4,3,4,3,4],[4,3,4,3,4,3],
 [0,0,1,2,1,0],[4,4,3,2,3,4],[2,2,1,0,1,2],[2,2,3,4,3,2]
];
// Hundredths of the TOTAL stake for 3, 4, 5 and 6 consecutive matching reels.
// Every pay is a whole 0.1x (Stake Engine pays in 0.1x steps; Dylan, 2026-10-29),
// and multipliers are whole numbers, so every win is too.
export const PAYTABLE={
 j:[10,20,50,150],q:[10,20,60,180],k:[10,30,80,240],a:[10,30,100,300],
 skater:[20,50,150,450],nurse:[20,60,200,600],builder:[30,80,250,750],
 cop:[40,110,350,1050],scientist:[50,150,500,1500],wild:[50,150,500,1500]
};
const wild=cell=>cell.kind==='zombie'||cell.kind==='wild';
export function lineWins(board){
 const wins=[];
 for(let line=0;line<PAYLINES.length;line++){
  const path=PAYLINES[line].map((row,reel)=>row*6+reel);let best=null;
  for(const [kind,pays] of Object.entries(PAYTABLE)){
   const cells=[];let actual=false;
   for(const index of path){
    const cell=board[index];
    if(kind==='wild'?!wild(cell):cell.kind!==kind&&!wild(cell))break;
    cells.push(index);if(cell.kind===kind)actual=true;
   }
   if(cells.length<3||(kind!=='wild'&&!actual))continue;
   const factors=new Map();
   for(const index of cells){
    const cell=board[index];
    if(cell.stackId&&cell.stackMulti>0)factors.set(cell.stackId,cell.stackMulti);
    else if(cell.kind==='zombie'&&cell.multi>0)factors.set(cell.id,cell.multi);
   }
   const multi=Math.max(1,[...factors.values()].reduce((sum,n)=>sum+n,0));
   const base=pays[cells.length-3],amount=base*multi;
   const candidate={line:line+1,kind,count:cells.length,cells,path,base,multi,amount};
   if(!best||amount>best.amount||(amount===best.amount&&cells.length>best.count))best=candidate;
  }
  if(best)wins.push(best);
 }
 return wins;
}
