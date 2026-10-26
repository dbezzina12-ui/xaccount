// Knightfall v1 — transparent prototype math, independent of presentation.
export const RULES = Object.freeze({size:7,cluster:5,maxWin:25000,maxMultiplier:1024,bonusCost:120,superCost:500,mysteryCost:370,mystery:Object.freeze({regular:.4,super:.5,hidden:.1}),featureCost:4,payScale:.46,scatterChance:.0055,strikeChance:{base:.19,regular:.32,super:.25,hidden:.25,feature:1},mage:{chance:{regular:.11,super:.075,hidden:.15},roamer:.5,burst:3},superScatter:{base:.042,feature:.042},hiddenScatter:{base:.00107,feature:.00107},hiddenPrize:1000,hiddenStrikes:[3,5]});
export const SYMBOLS=['ruby','sapphire','emerald','amethyst','amber','shield','crown'];
// `arrow-wild` is the mage's one-time wild; `roam-wild` his sticky roamer.
export const isWild = kind => kind==='wild'||kind==='arrow-wild'||kind==='roam-wild';
// `fs` is the FS tombstone; `sfs` the gold Super tombstone and `hfs` the Hidden
// tombstone (those two in base and Reaper Strike spins only).
export const isScatter = kind => kind==='fs'||kind==='sfs'||kind==='hfs';
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
// `special`: the shares of tombstones that land Hidden and gold ({hidden, gold};
// none in free spins).
export function symbol(rng,scatter=true,special=null){
 if(scatter&&rng()<RULES.scatterChance){if(!special)return 'fs';const r=rng();return r<special.hidden?'hfs':r<special.hidden+special.gold?'sfs':'fs';}
 // Seven equally weighted paying symbols; feature shapes do not choose high-value cells.
 return SYMBOLS[Math.floor(rng()*7)];
}
export function createBoard(rng,scatter=true,special=null){return Array.from({length:49},()=>symbol(rng,scatter,special));}
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
// `fixed`: the mage's roamers. They stay on their cells, even when they win,
// and the rest of each column falls past them.
export function collapse(board,positions,rng,fixed=[],special=null){
 const pin=new Set(fixed),gone=new Set(positions),next=Array(49),falls=Array(49).fill(0);
 for(let c=0;c<7;c++){
  const keep=[],slots=[];for(let r=6;r>=0;r--){const p=r*7+c;if(pin.has(p))continue;slots.push(r);if(!gone.has(p))keep.push({s:board[p],r});}
  const fresh=slots.length-keep.length;
  for(let j=0;j<slots.length;j++){const r=slots[j],p=r*7+c;if(j<keep.length){next[p]=keep[j].s;falls[p]=r-keep[j].r;}else{next[p]=symbol(rng,true,special);falls[p]=r-(slots.length-1-j)+fresh;}}
  for(const f of pin)if(f%7===c)next[f]=board[f];
 }
 return {board:next,falls};
}
// The mage's target: one cell that is neither an FS tombstone nor already wild,
// away from `avoid` (its last cell) when another exists; -1 when none is free.
export function mageTarget(board,rng,avoid=-1){
 let open=board.flatMap((kind,i)=>isScatter(kind)||isWild(kind)?[]:[i]);
 if(open.length>1)open=open.filter(i=>i!==avoid);
 return open.length?open[Math.floor(rng()*open.length)]:-1;
}
export function strike(board,hits,mode,rng){
 const row=Math.floor(rng()*7),col=Math.floor(rng()*7),horizontal=rng()<.5;
 const length=mode==='feature'?(rng()<.2?3:(rng()<.5?4:5)):3+Math.floor(rng()*3),cross=mode==='super'||mode==='hidden',gold=cross&&rng()<.10;
 const cells=[];
 if(cross){for(let d=-1;d<=1;d++){if(col+d>=0&&col+d<7)cells.push(row*7+col+d);if(row+d>=0&&row+d<7)cells.push((row+d)*7+col);}}
 else {const start=Math.min(horizontal?col:row,7-length);for(let d=0;d<length;d++)cells.push(horizontal?row*7+start+d:(start+d)*7+col);}
 const affected=[...new Set(cells)].filter(i=>!isScatter(board[i])),next=board.slice(),marks=hits.slice();
 // A slash across a wild (the mage's included) leaves it as it is.
 for(const i of affected){if(!isWild(next[i]))next[i]='wild';if(gold)marks[i]=Math.min(11,marks[i]<2?2:marks[i]+1);}
 return {board:next,hits:marks,cells:affected,cross,gold,row,col,horizontal};
}
// `roamers` (free spins only): the cells the mage's sticky roamers were on
// last spin. They remain in those cells through the next drop. Then the mage may strike
// (RULES.mage.chance): a new roamer that stays for the rest of the bonus
// (RULES.mage.roamer of strikes), or a one-time burst of RULES.mage.burst wilds
// for this spin only (Dylan, 2026-10-26).
export function resolveSpin({rng,mode='base',hits=Array(49).fill(0),board=null,cap=RULES.maxWin,record=true,roamers=null}){
 const special=RULES.superScatter[mode]?{gold:RULES.superScatter[mode],hidden:RULES.hiddenScatter[mode]||0}:null;
 let pinned=[...new Set((roamers||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<49))];
 const held=new Set(pinned);
 let grid=board?.slice()||Array.from({length:49},(_,i)=>held.has(i)?'roam-wild':symbol(rng,true,special)),marks=hits.slice(),total=0,usedStrike=false,zaps=0,mageStrike=null;
 for(const i of pinned)grid[i]='roam-wild';
 const events=[];const emit=e=>{if(record)events.push(e);};
 emit({type:'drop',board:grid.slice(),hits:marks.slice(),fixed:pinned.slice()});
 if(roamers!==null){
  const moves=[];
  // Hidden's starting lantern has no previous cell. Existing ones never move on a drop.
  for(const from of roamers.filter(i=>i===-1)){const cell=mageTarget(grid,rng);if(cell>=0){grid[cell]='roam-wild';pinned.push(cell);moves.push({from,cell});}}
  if(moves.length)emit({type:'roam',moves,board:grid.slice(),hits:marks.slice(),fixed:pinned.slice()});
  if(rng()<RULES.mage.chance[mode]){
   const roamer=rng()<RULES.mage.roamer,cells=[];
   for(let k=0;k<(roamer?1:RULES.mage.burst);k++){const cell=mageTarget(grid,rng);if(cell<0)break;grid[cell]=roamer?'roam-wild':'arrow-wild';cells.push(cell);}
   if(roamer)pinned.push(...cells);
   if(cells.length){mageStrike=roamer?'roamer':'burst';emit({type:'zap',cells,roamer,board:grid.slice(),hits:marks.slice()});}
  }
 }
 for(let iteration=0;iteration<300;iteration++){
  const ev=evaluate(grid,marks);
  if(ev.wins.length){
   marks=ev.hits;const paid=Math.min(cap-total,ev.total);total+=paid;
   emit({type:'win',...ev,total:paid,roundTotal:total});
   if(total>=cap)return {total,events,hits:marks,scatters:0,supers:0,hiddens:0,capped:true,roamers:pinned,zaps,mageStrike};
   const fall=collapse(grid,ev.positions,rng,pinned,special);grid=fall.board;emit({type:'tumble',...fall,hits:marks.slice(),fixed:pinned.slice()});
   // Only lanterns used in this win roam, after its tumble resolves. Swap with
   // a paying symbol so no scatter or wild is overwritten and no cell is empty.
   // The multiplier stays on the tile; unused lanterns do not move.
   const used=pinned.filter(i=>ev.positions.includes(i)),moves=[];
   if(used.length){grid=grid.slice();for(const from of used){const cell=mageTarget(grid,rng,from);if(cell<0)continue;
    grid[from]=grid[cell];grid[cell]='roam-wild';pinned[pinned.indexOf(from)]=cell;moves.push({from,cell});
   }}
   if(moves.length)emit({type:'roam',moves,board:grid.slice(),hits:marks.slice(),fixed:pinned.slice()});
  }else if(!usedStrike){
   usedStrike=true;
   if(rng()<RULES.strikeChance[mode]){
    const attack=strike(grid,marks,mode,rng);
    // Horizontal standard/regular attacks were the archer's. In the base game the
    // mage zaps one cell wild instead; in free spins the mage has his own strike
    // (above), so those draws do nothing. The reaper keeps the rest.
    if((mode==='base'||mode==='regular')&&attack.horizontal&&!attack.cross){
     if(mode==='base'){const cell=mageTarget(grid,rng);if(cell>=0){grid=grid.slice();grid[cell]='arrow-wild';zaps++;emit({type:'zap',cells:[cell],roamer:false,board:grid.slice(),hits:marks.slice()});}}
     else break;
    }else{grid=attack.board;marks=attack.hits;emit({type:'strike',...attack});}
   }
   else break;
  }else break;
  if(iteration===299)throw Error('Unexpected tumble limit; no wager should be committed.');
 }
 return {total,events,hits:marks,scatters:grid.filter(x=>x==='fs').length,supers:grid.filter(x=>x==='sfs').length,hiddens:grid.filter(x=>x==='hfs').length,capped:false,roamers:pinned,zaps,mageStrike};
}
export function triggerBoard(rng,count=3,kind='fs',extraScatters=false){
 // Buys guarantee three tier tombstones. The other 46 cells retain the normal
 // scatter chance, so 4/5+ starts can earn the same awards as natural triggers.
 const b=createBoard(rng,extraScatters),available=Array.from({length:49},(_,i)=>i);
 for(let j=0;j<count;j++){const k=Math.floor(rng()*available.length);b[available.splice(k,1)[0]]=kind;}return b;
}
// Hidden opens with the mage's strikes on the cleared board (Dylan, 2026-10-26):
// 3 to 5 of them, each raising its tile and the tiles touching it one step.
export function hiddenStrikes(hits,rng){
 const [lo,hi]=RULES.hiddenStrikes,marks=hits.slice(),strikes=[],n=lo+Math.floor(rng()*(hi-lo+1));
 for(let k=0;k<n;k++){const cell=Math.floor(rng()*49),cells=[cell,...adjacent(cell)];for(const i of cells)marks[i]=Math.min(11,marks[i]+1);strikes.push({cell,cells});}
 return {strikes,hits:marks};
}
// What a base spin's tombstones start (Dylan, 2026-10-26), counting all kinds:
// 3+ with a Hidden tombstone, Hidden Free Spins (+3 spins for 4; 5+ pay 1,000x
// and +5); else 3+ with a gold one, Super Free Spins (+2 for 4, +4 for 5+);
// else 3+, Free Spins.
export function bonusFor(scatters,supers=0,hiddens=0){
 const n=scatters+supers+hiddens;
 if(n<3)return null;
 if(hiddens)return {mode:'hidden',count:10+(n>=5?5:n===4?3:0),prize:n>=5?RULES.hiddenPrize:0};
 if(supers)return {mode:'super',count:10+(n>=5?4:n===4?2:0),prize:0};
 return {mode:'regular',count:fsCount(n),prize:0};
}
export function mysteryBonus(rng){
 const draw=rng();let edge=0;
 for(const [mode,chance] of Object.entries(RULES.mystery)){edge+=chance;if(draw<edge)return mode;}
 return 'hidden';
}
export function generateRound({rng,mode='base',record=true}){
 const purchaseMode=mode;
 if(mode==='mystery')mode=mysteryBonus(rng);
 let total=0,events=[],bonusMode=null,remaining=0,played=0,retriggers=0,mageZaps=0,roams=0,roamerStrikes=0,bursts=0,supers=0;
 const emit=e=>{if(record)events.push(e);};
 if(mode==='regular'||mode==='super'||mode==='hidden'){
  bonusMode=mode;
  const opening=triggerBoard(rng,3,mode==='hidden'?'hfs':mode==='super'?'sfs':'fs',true);
  const bonus=bonusFor(opening.filter(k=>k==='fs').length,opening.filter(k=>k==='sfs').length,opening.filter(k=>k==='hfs').length);
  remaining=bonus.count;
  emit({type:'drop',board:opening,hits:Array(49).fill(0),trigger:true});
  if(bonus.prize){total=bonus.prize;emit({type:'prize',amount:bonus.prize,tombstones:opening.filter(isScatter).length,roundTotal:total});}
 }else{
  const base=resolveSpin({rng,mode,record});total=base.total;mageZaps=base.zaps;supers=base.supers;if(record)events.push(...base.events);
  const bonus=base.capped?null:bonusFor(base.scatters,base.supers,base.hiddens);
  if(bonus){
   bonusMode=bonus.mode;remaining=bonus.count;
   if(bonus.prize){const paid=Math.min(RULES.maxWin-total,bonus.prize);total+=paid;emit({type:'prize',amount:paid,tombstones:base.scatters+base.supers+base.hiddens,roundTotal:total});}
  }
 }
 if(bonusMode){
  emit({type:'bonusStart',mode:bonusMode,count:remaining,total});
  // The mage's roamers stay for the whole bonus, retriggers included. Super
  // and Hidden tiles start at 2x; Hidden starts with one roamer already out.
  let hits=Array(49).fill(bonusMode==='regular'?0:2),roamers=bonusMode==='hidden'?[-1]:[];
  if(bonusMode==='hidden'){const opening=hiddenStrikes(hits,rng);hits=opening.hits;emit({type:'hiddenStrikes',...opening});}
  while(remaining>0&&total<RULES.maxWin){
   if(played>=2000)throw Error('Unexpected free-spin limit; no wager should be committed.');
   remaining--;played++;emit({type:'freeSpin',remaining,number:played,mode:bonusMode,total});
   const spin=resolveSpin({rng,mode:bonusMode,hits,cap:RULES.maxWin-total,record,roamers});
   if(record)events.push(...spin.events);hits=spin.hits;roamers=spin.roamers;roams+=roamers.length;if(spin.mageStrike==='roamer')roamerStrikes++;if(spin.mageStrike==='burst')bursts++;total=Math.min(RULES.maxWin,total+spin.total);
   if(spin.scatters>=3&&!spin.capped){const add=fsCount(spin.scatters);remaining+=add;retriggers++;emit({type:'retrigger',count:add,remaining});}
  }
  emit({type:'bonusEnd',mode:bonusMode,total,played,capped:total>=RULES.maxWin});
 }
 return {total:Math.round(total*10000)/10000,events,bonusMode,purchaseMode,played,retriggers,capped:total>=RULES.maxWin,mageZaps,roams,roamerStrikes,bursts,supers};
}
