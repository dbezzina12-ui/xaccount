// Knightfall v1 — transparent prototype math, independent of presentation.
export const RULES = Object.freeze({size:7,cluster:5,maxWin:25000,maxMultiplier:1024,bonusCost:120,superCost:500,featureCost:4,payScale:.46,scatterChance:.0055,strikeChance:{base:.18,regular:.32,super:.25,feature:1},roamChance:{regular:1,super:.5}});
export const SYMBOLS=['ruby','sapphire','emerald','amethyst','amber','shield','crown'];
export const isWild = kind => kind==='wild'||kind==='arrow-wild';
export const PAYTABLE=[
 [.20,.30,.40,.60,.80,1.20,2,4,8,12,20],
 [.25,.40,.50,.70,1,1.60,2.50,5,10,15,25],
 [.30,.45,.60,.80,1.20,2,3,6,12,20,30],
 [.40,.60,.80,1,1.50,2.50,4,8,16,25,40],
 [.50,.75,1,1.50,2,3,5,10,20,35,60],
 [.75,1,1.25,1.75,2.50,4,6,12,30,60,100],
 [1,1.50,1.75,2,2.50,5,7.50,15,35,70,150]
];
export const seedRng = seed => () => {seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
export const adjacent = i => [i%7?i-1:-1,i%7<6?i+1:-1,i>=7?i-7:-1,i<42?i+7:-1].filter(j=>j>=0);
export const multiplier = hits => hits<2?0:Math.min(1024,2**(hits-1));
export const fsCount = n => [0,0,0,10,12,15,20,30][Math.min(7,n)];
export function symbol(rng,scatter=true){
 if(scatter&&rng()<RULES.scatterChance)return 'fs';
 // Seven equally weighted paying symbols; feature shapes do not choose high-value cells.
 return SYMBOLS[Math.floor(rng()*7)];
}
export function createBoard(rng,scatter=true){return Array.from({length:49},()=>symbol(rng,scatter));}
export function clusters(board){
 const out=[];
 for(const kind of SYMBOLS){
  const seen=new Set();
  for(let i=0;i<49;i++){
   if(seen.has(i)||(board[i]!==kind&&!isWild(board[i])))continue;
   const group=[],stack=[i];let natural=0;seen.add(i);
   while(stack.length){const p=stack.pop();group.push(p);if(board[p]===kind)natural++;for(const j of adjacent(p))if(!seen.has(j)&&(board[j]===kind||isWild(board[j]))){seen.add(j);stack.push(j);}}
   if(group.length>=5&&natural)out.push({symbol:kind,cells:group});
  }
 }
 return out;
}
export function evaluate(board,hits){
 const wins=clusters(board),positions=[...new Set(wins.flatMap(x=>x.cells))];
 const next=hits.slice();for(const i of positions)next[i]=Math.min(11,next[i]+1);
 let total=0;
 for(const win of wins){win.base=PAYTABLE[SYMBOLS.indexOf(win.symbol)][Math.min(15,win.cells.length)-5];win.multiplier=Math.max(1,win.cells.reduce((s,i)=>s+multiplier(next[i]),0));win.pay=win.base*win.multiplier*RULES.payScale;total+=win.pay;}
 return {wins,positions,hits:next,total};
}
// `fixed` is the mage's roaming wild: it stays on its cell, even when it wins,
// and the column's other symbols fall past it.
export function collapse(board,positions,rng,fixed=-1){
 const gone=new Set(positions),next=Array(49),falls=Array(49).fill(0);
 for(let c=0;c<7;c++){
  const keep=[],slots=[];for(let r=6;r>=0;r--){const p=r*7+c;if(p===fixed)continue;slots.push(r);if(!gone.has(p))keep.push({s:board[p],r});}
  const fresh=slots.length-keep.length;
  for(let j=0;j<slots.length;j++){const r=slots[j],p=r*7+c;if(j<keep.length){next[p]=keep[j].s;falls[p]=r-keep[j].r;}else{next[p]=symbol(rng);falls[p]=r-(slots.length-1-j)+fresh;}}
  if(fixed%7===c)next[fixed]=board[fixed];
 }
 return {board:next,falls};
}
// The mage's target: one cell that is neither an FS tombstone nor already wild,
// away from `avoid` (its last cell) when another exists; -1 when none is free.
export function mageTarget(board,rng,avoid=-1){
 let open=board.flatMap((kind,i)=>kind==='fs'||isWild(kind)?[]:[i]);
 if(open.length>1)open=open.filter(i=>i!==avoid);
 return open.length?open[Math.floor(rng()*open.length)]:-1;
}
export function strike(board,hits,mode,rng){
 const row=Math.floor(rng()*7),col=Math.floor(rng()*7),horizontal=rng()<.5;
 const length=mode==='feature'?(rng()<.2?3:(rng()<.5?4:5)):3+Math.floor(rng()*3),cross=mode==='super',gold=mode==='super'&&rng()<.10;
 const cells=[];
 if(cross){for(let d=-1;d<=1;d++){if(col+d>=0&&col+d<7)cells.push(row*7+col+d);if(row+d>=0&&row+d<7)cells.push((row+d)*7+col);}}
 else {const start=Math.min(horizontal?col:row,7-length);for(let d=0;d<length;d++)cells.push(horizontal?row*7+start+d:(start+d)*7+col);}
 const affected=[...new Set(cells)].filter(i=>board[i]!=='fs'),next=board.slice(),marks=hits.slice();
 // A slash across the mage's roaming wild leaves it the mage's.
 for(const i of affected){if(next[i]!=='arrow-wild')next[i]='wild';if(gold)marks[i]=Math.min(11,marks[i]<2?2:marks[i]+1);}
 return {board:next,hits:marks,cells:affected,cross,gold,row,col,horizontal};
}
// `mage` (free spins only): the cell the roaming wild was last on, -1 before
// it first appears. It lands on a new cell after the drop: every regular free
// spin, about half of Super's (Dylan, 2026-10-26: the mage shouldn't feel like
// every spin; Super is priced for it at 500x, MATH.md).
export function resolveSpin({rng,mode='base',hits=Array(49).fill(0),board=null,cap=RULES.maxWin,record=true,mage=null}){
 let grid=board?.slice()||createBoard(rng),marks=hits.slice(),total=0,usedStrike=false,roam=-1,zaps=0;
 const events=[];const emit=e=>{if(record)events.push(e);};
 emit({type:'drop',board:grid.slice(),hits:marks.slice()});
 const chance=RULES.roamChance[mode]??1;
 if(mage!==null&&(chance>=1||rng()<chance)){
  roam=mageTarget(grid,rng,mage);
  if(roam>=0){grid[roam]='arrow-wild';emit({type:'zap',cell:roam,from:mage,roam:true,board:grid.slice(),hits:marks.slice()});}
 }
 for(let iteration=0;iteration<300;iteration++){
  const ev=evaluate(grid,marks);
  if(ev.wins.length){
   marks=ev.hits;const paid=Math.min(cap-total,ev.total);total+=paid;
   emit({type:'win',...ev,total:paid,roundTotal:total});
   if(total>=cap)return {total,events,hits:marks,scatters:0,capped:true,mage:roam,zaps};
   const fall=collapse(grid,ev.positions,rng,roam);grid=fall.board;emit({type:'tumble',...fall,hits:marks.slice(),fixed:roam});
  }else if(!usedStrike){
   usedStrike=true;
   if(rng()<RULES.strikeChance[mode]){
    const attack=strike(grid,marks,mode,rng);
    // Horizontal standard/regular attacks were the archer's. In the base game the
    // mage zaps one cell wild instead; in free spins the roaming wild is the mage's
    // whole feature, so those draws do nothing. The reaper keeps the rest.
    if((mode==='base'||mode==='regular')&&attack.horizontal&&!attack.cross){
     if(mode==='base'){const cell=mageTarget(grid,rng);if(cell>=0){grid=grid.slice();grid[cell]='arrow-wild';zaps++;emit({type:'zap',cell,from:-1,roam:false,board:grid.slice(),hits:marks.slice()});}}
     else break;
    }else{grid=attack.board;marks=attack.hits;emit({type:'strike',...attack});}
   }
   else break;
  }else break;
  if(iteration===299)throw Error('Unexpected tumble limit; no wager should be committed.');
 }
 return {total,events,hits:marks,scatters:grid.filter(x=>x==='fs').length,capped:false,mage:roam,zaps};
}
export function triggerBoard(rng,count=3){
 const b=createBoard(rng,false),available=Array.from({length:49},(_,i)=>i);
 for(let j=0;j<count;j++){const k=Math.floor(rng()*available.length);b[available.splice(k,1)[0]]='fs';}return b;
}
export function generateRound({rng,mode='base',record=true}){
 let total=0,events=[],bonusMode=null,remaining=0,played=0,retriggers=0,mageZaps=0,roams=0;
 const emit=e=>{if(record)events.push(e);};
 if(mode==='regular'||mode==='super'){
  bonusMode=mode;remaining=10;emit({type:'drop',board:triggerBoard(rng),hits:Array(49).fill(0),trigger:true});
 }else{
  const base=resolveSpin({rng,mode,record});total=base.total;mageZaps=base.zaps;if(record)events.push(...base.events);
  if(base.scatters>=3&&!base.capped){bonusMode='regular';remaining=fsCount(base.scatters);}
 }
 if(bonusMode){
  emit({type:'bonusStart',mode:bonusMode,count:remaining,total});
  // One mage roaming wild for the whole bonus, retriggers included.
  let hits=Array(49).fill(bonusMode==='super'?2:0),mage=-1;
  while(remaining>0&&total<RULES.maxWin){
   if(played>=2000)throw Error('Unexpected free-spin limit; no wager should be committed.');
   remaining--;played++;emit({type:'freeSpin',remaining,number:played,mode:bonusMode,total});
   const spin=resolveSpin({rng,mode:bonusMode,hits,cap:RULES.maxWin-total,record,mage});
   if(record)events.push(...spin.events);hits=spin.hits;if(spin.mage>=0){mage=spin.mage;roams++;}total=Math.min(RULES.maxWin,total+spin.total);
   if(spin.scatters>=3&&!spin.capped){const add=fsCount(spin.scatters);remaining+=add;retriggers++;emit({type:'retrigger',count:add,remaining});}
  }
  emit({type:'bonusEnd',mode:bonusMode,total,played,capped:total>=RULES.maxWin});
 }
 return {total:Math.round(total*10000)/10000,events,bonusMode,played,retriggers,capped:total>=RULES.maxWin,mageZaps,roams};
}
