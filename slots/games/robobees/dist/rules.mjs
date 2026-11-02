export const premiums=['hive','nectar','stinger','rotor','beacon'];
export const ranks=['A','K','Q','J','10'];
export const modes={base:'Factory shift',regular:'Worker Shift',super:'Swarm Protocol',hidden:'Queen Override'};
export const lines=[
 [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
 [0,1,2,1,0],[1,2,3,2,1],[2,1,0,1,2],[3,2,1,2,3],
 [0,0,1,2,2],[1,1,2,3,3],[2,2,1,0,0],[3,3,2,1,1],
 [0,1,1,1,0],[1,0,0,0,1],[2,3,3,3,2],[3,2,2,2,3],
 [0,1,0,1,0],[1,2,1,2,1],[2,1,2,1,2],[3,2,3,2,3]
].map(rows=>rows.map((row,col)=>row*5+col));
// Every number that sets the return, fitted by tools/math/robobees-fit.mjs so each mode returns 96%; see MATH.md.
// pays: per line for 3/4/5 of a kind, x the bet. weights: the chance of each premium and each rank in a spin's draw.
// wilds: the chance of a first and of a second Wild each spin. scatter: the FS chance per reel. boosts: Hidden's odds
// of 1, 2 or 3 bee boosts. mystery: Regular, Super, Hidden. cap: the most a round pays, trigger spin included.
export const MATH={
 cap:25000,
 pays:{hive:[2,6,18],nectar:[1.4,4,12],stinger:[1,3,9],rotor:[.8,2,7],beacon:[.6,1.8,6],A:[.4,1.2,4],K:[.4,1.2,4],Q:[.3,.9,3],J:[.3,.9,3],10:[.3,.9,3]},
 weights:{base:[2,3],regular:[2,3],super:[2,3],hidden:[2,3]},
 wilds:{base:[.33,.08],regular:[.33,.08],super:[.33,.08],hidden:[1,.08]},
 scatter:{base:.075,enhanced:.115},
 boosts:[1,1,1],
 mystery:[.5,.4,.1],
};
const symbols=[...premiums,...ranks];
function draw(weights,rng){
 let x=rng()*(premiums.length*weights[0]+ranks.length*weights[1]);
 for(let i=0;i<symbols.length;i++){x-=i<premiums.length?weights[0]:weights[1];if(x<0)return symbols[i]}
 return symbols[symbols.length-1];
}
function weighted(odds,rng){let x=rng()*odds.reduce((a,b)=>a+b,0);for(let i=0;i<odds.length;i++){x-=odds[i];if(x<0)return i}return odds.length-1}
const pick=(items,rng)=>items[Math.floor(rng()*items.length)];
const allCells=()=>Array.from({length:20},(_,i)=>i);
function take(pool,n,rng){const copy=[...pool];return Array.from({length:n},()=>copy.splice(Math.floor(rng()*copy.length),1)[0])}
export const buys={
 regular:{price:100,label:'Worker Shift',type:'Regular',art:'rotor'},
 super:{price:250,label:'Swarm Protocol',type:'Super',art:'hive'},
 mystery:{price:400,label:'Mystery Buy',type:'Mystery',art:'FS'}
};
export const features={
 enhanced:{price:3,label:'Signal Boost',type:'Enhanced spins',art:'beacon',copy:'Each reel has a higher chance to land FS.'},
 scout:{price:10,label:'Scout Run',type:'Feature spins',art:'stinger',copy:'A scout delivers one guaranteed Wild on every paid spin.'}
};
export const scatterCounts={regular:3,super:4,hidden:5};
export function purchaseEntry(id,rng=Math.random){
 if(!Object.hasOwn(buys,id))throw Error('Unknown bonus purchase');
 const mode=id==='mystery'?['regular','super','hidden'][weighted(MATH.mystery,rng)]:id;
 const board=allCells().map(()=>pick(symbols,rng));
 // A purchased reveal stages two early scatters and leaves the tier reveal on reel five.
 for(const col of [0,1,...take([2,3],scatterCounts[mode]-3,rng),4])board[col+5*Math.floor(rng()*4)]='FS';
 return {mode,board};
}
// carry: what the trigger spin paid, counted toward the round's cap
export function start(mode='base',carry=0){
 const spots=Array(20).fill(mode==='super'||mode==='hidden'?2:0);
 return {mode,spots,left:mode==='base'?0:10,bank:0,total:0,carry};
}
export function evaluate(board,spots){
 const wins=[],hit=new Set();let amount=0;
 for(const line of lines){
  let best=null;
  for(const symbol of symbols){
   let n=0;while(n<5 && [symbol,'W'].includes(board[line[n]]))n++;
   if(n<3)continue;
   const cells=line.slice(0,n), multiplier=Math.max(1,cells.reduce((s,i)=>s+spots[i],0));
   const pay=MATH.pays[symbol][n-3]*multiplier;
   if(!best||pay>best.pay)best={cells,pay,symbol};
  }
  if(best){wins.push(best);best.cells.forEach(i=>hit.add(i));amount+=best.pay}
 }
 return {wins,hit:[...hit],amount:Math.round(amount*100)/100};
}
export function spin(state,rng=Math.random,featureMode=null){
 const bonus=state.mode!=='base',swarm=['super','hidden'].includes(state.mode);
 if(bonus&&state.left<1)throw Error('Feature complete');
 const board=allCells().map(()=>draw(MATH.weights[state.mode],rng));
 const [w1,w2]=MATH.wilds[state.mode],wildCount=Number(rng()<w1)+Number(rng()<w2);
 for(const i of take(allCells(),wildCount,rng))board[i]='W';
 const scatter=featureMode==='enhanced'?MATH.scatter.enhanced:MATH.scatter.base;
 if(!bonus)for(let col=0;col<5;col++)if(rng()<scatter)board[col+5*Math.floor(rng()*4)]='FS';
 if(!bonus&&featureMode==='scout'&&!board.includes('W')){
  const [target]=take(allCells().filter(i=>board[i]!=='FS'),1,rng);board[target]='W';
 }
 const landing=[...board],finale=swarm&&state.left===1;
 const drops=finale?take(allCells().filter(i=>board[i]!=='W'),state.bank,rng):[];
 for(const i of drops)board[i]='W';
 // Bee upgrades apply to this spin before scoring; a winning position then
 // advances once more for the following spin. Keep the entrance board intact.
 const eligible=state.spots.flatMap((value,i)=>value<128?[i]:[]);
 const boosts=state.mode==='hidden'?take(eligible,Math.min(eligible.length,1+weighted(MATH.boosts,rng)),rng):[];
 const active=[...state.spots];
 for(const i of boosts)active[i]=Math.min(128,active[i]*2);
 const resolved=evaluate(board,active);
 // The cap: a round never pays more than MATH.cap; reaching it ends the bonus.
 const room=Math.round((MATH.cap-(bonus?state.total+(state.carry||0):0))*100)/100,capped=resolved.amount>=room;
 if(capped)resolved.amount=room;
 const spots=bonus?[...active]:Array(20).fill(0);
 for(const i of resolved.hit)spots[i]=Math.min(128,Math.max(2,active[i]*2));
 const fs=board.filter(s=>s==='FS').length;
 const trigger=fs===5?'hidden':fs===4?'super':fs===3?'regular':null;
 const bank=finale?0:state.bank+(swarm?wildCount:0);
 return {...resolved,board,landing,drops,boosts,active,finale,trigger,capped,prior:state.spots,state:{...state,spots,seeds:[],bank,left:capped&&bonus?0:Math.max(0,state.left-1),total:Math.round((state.total+resolved.amount)*100)/100}};
}
