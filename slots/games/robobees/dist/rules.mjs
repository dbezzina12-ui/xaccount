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
// Every number that sets the return, fitted by tools/math/robobees-fit.mjs so each mode returns 96% (MATH.md).
// pays: per line for 3/4/5 of a kind, x the base bet. Per kind of spin (base, the two seeded features, each bonus):
// weights, the draw chance of each premium and each rank; wilds, the chance of a first and of a second opening Wild.
// refillWild: per kind of spin, a dropped tile's chance to be a Wild. scatter: the FS chance per reel. boosts: Hidden's odds of 1, 2 or
// 3 bee boosts. pollen: Pollen Charge's 6-12 seeded cells' odds of 2x, 4x, 8x, 16x and 32x. mystery: Regular, Super,
// Hidden. cap: the most a round pays, its trigger spin included.
export const MATH={
 cap:25000,
 pays:{10:[0.35,1.06,3.52],hive:[2.35,7.05,21.14],nectar:[1.64,4.7,14.09],stinger:[1.17,3.52,10.57],rotor:[0.94,2.35,8.22],beacon:[0.7,2.11,7.05],A:[0.47,1.41,4.7],K:[0.47,1.41,4.7],Q:[0.35,1.06,3.52],J:[0.35,1.06,3.52]},
 weights:{base:[2,3],random:[2,3],full32:[4,2],regular:[4,2],super:[2,3],hidden:[2,3]},
 wilds:{base:[0.33,0.08],random:[1,0.041246],full32:[1,0.15],regular:[1,0.269261],super:[0.414122,0.1],hidden:[1,0.03]},
 refillWild:{base:0.02,random:0.08,full32:0.176597,regular:0.02,super:0.02,hidden:0.02},
 scatter:{base:0.075056,enhanced:0.132926},
 boosts:[1,0.179471,0.059824],
 pollen:[0.05,0.08,0.12,0.35,0.4],
 mystery:[0.5,0.4,0.1],
};
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
 random:{price:20,label:'Pollen Charge',type:'Random multipliers',art:'rotor',copy:'Start each spin with 6–12 random cells at 2× to 32×. Winning cells keep doubling through tumbles.'},
 full32:{price:250,label:'Hive Overdrive',type:'Full 32× board',art:'hive',copy:'All 20 cells start at 32× each spin. Winning cells double to 64×, then 128×.'}
};
export const scatterCounts={regular:3,super:4,hidden:5};
function weighted(odds,rng){let x=rng()*odds.reduce((a,b)=>a+b,0);for(let i=0;i<odds.length;i++){x-=odds[i];if(x<0)return i}return odds.length-1}
function draw(weights,rng){
 let x=rng()*(premiums.length*weights[0]+ranks.length*weights[1]);
 for(let i=0;i<payingSymbols.length;i++){x-=i<premiums.length?weights[0]:weights[1];if(x<0)return payingSymbols[i]}
 return payingSymbols[payingSymbols.length-1];
}
export function purchaseEntry(id,rng=Math.random){
 if(!Object.hasOwn(buys,id))throw Error('Unknown bonus purchase');
 const mode=id==='mystery'?['regular','super','hidden'][weighted(MATH.mystery,rng)]:id;
 const board=allCells().map(()=>pick([...premiums,...ranks],rng));
 // A purchased reveal stages two early scatters and leaves the tier reveal on reel five.
 for(const col of [0,1,...take([2,3],scatterCounts[mode]-3,rng),4])board[col+5*Math.floor(rng()*4)]='FS';
 return {mode,board};
}
// carry: what a natural trigger spin paid; it counts toward the bonus round's cap
export function start(mode='base',carry=0){
 const spots=Array(20).fill(mode==='super'||mode==='hidden'?2:0);
 return {mode,spots,left:mode==='base'?0:10,bank:0,total:0,carry};
}
// The cents a spin credits at a bet in cents per 1x. A bonus spin credits the change in its round's rounded total, so a
// round's credits add up to its total, and to exactly the cap, at every stake. Sums run in whole hundredths of the bet,
// so a half cent always rounds the same way.
export function credit(state,amount,bet){
 const paid=state.mode==='base'?0:Math.round(((state.carry||0)+state.total)*100),cents=h=>Math.round(h*bet/100);
 return cents(paid+Math.round(amount*100))-cents(paid);
}
export function evaluate(board,spots){
 const wins=[],hit=new Set();let amount=0;
 for(const line of lines){
  let best=null;
  for(const symbol of payingSymbols){
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
const payingSymbols=[...premiums,...ranks];
const pollenMultis=[2,4,8,16,32];
const maxBoards=100;
const doubled=n=>Math.min(128,Math.max(2,n*2));

function seedBoard(mode,rng){
 const spots=Array(20).fill(mode==='full32'?32:0);
 if(mode==='random'){
  for(const i of take(allCells(),6+Math.floor(rng()*7),rng)){
   spots[i]=pollenMultis[weighted(MATH.pollen,rng)];
  }
 }
 return spots;
}

// A source row below zero is a new tile above the top rail. Survivors retain
// their vertical order, including Wilds and FS, but never carry a cell charge.
export function refill(board,hit,scatterChance,rng,weights=MATH.weights.base,wild=MATH.refillWild.base){
 const removed=new Set(hit),landed=[...board],from=Array(20);
 for(let col=0;col<5;col++){
  const column=[col,col+5,col+10,col+15],kept=column.filter(i=>!removed.has(i));
  const count=4-kept.length;
  for(let row=0;row<4;row++){
   const i=column[row];
   if(row<count){
    from[i]=row-count;
    landed[i]=rng()<wild?'W':draw(weights,rng);
   }else{
    const source=kept[row-count];
    from[i]=Math.floor(source/5);landed[i]=board[source];
   }
  }
  // At most one FS per reel, including a scatter surviving from an earlier drop.
  if(count&&scatterChance&&!kept.some(i=>board[i]==='FS')&&rng()<1-(1-scatterChance)**(count/4)){
   landed[column[Math.floor(rng()*count)]]='FS';
  }
 }
 return {landed,from};
}

export function spin(state,rng=Math.random,featureMode=null){
 const bonus=state.mode!=='base',swarm=state.mode==='super'||state.mode==='hidden';
 if(bonus&&state.left<1)throw Error('Feature complete');
 const finale=swarm&&state.left===1,seeded=!bonus&&['random','full32'].includes(featureMode);
 const prior=seeded?seedBoard(featureMode,rng):[...state.spots];
 // which numbers this spin draws with: its bonus, its seeded feature, or the base game
 const kind=bonus?state.mode:seeded?featureMode:'base',weights=MATH.weights[kind],[w1,w2]=MATH.wilds[kind];
 let active=[...prior],landed=allCells().map(()=>draw(weights,rng)),from=null;
 const openingWilds=Number(rng()<w1)+Number(rng()<w2);
 for(const i of take(allCells(),openingWilds,rng))landed[i]='W';
 const scatterChance=bonus?0:featureMode==='enhanced'?MATH.scatter.enhanced:MATH.scatter.base;
 if(scatterChance)for(let col=0;col<5;col++){
  if(rng()<scatterChance)landed[col+5*Math.floor(rng()*4)]='FS';
 }
 const eligible=allCells().filter(i=>active[i]<128);
 const boosts=state.mode==='hidden'?take(eligible,Math.min(eligible.length,1+weighted(MATH.boosts,rng)),rng):[];
 for(const i of boosts)active[i]=doubled(active[i]);

 const steps=[],touched=new Set();
 // the cap: what this round may still pay; reaching it ends the chain and the round
 const room=Math.round((MATH.cap-(bonus?state.total+(state.carry||0):0))*100)/100;
 let amount=0,bank=state.bank,limited=false,maxWin=false;
 for(let n=0;n<maxBoards;n++){
  const collected=swarm&&!finale?allCells().filter(i=>landed[i]==='W'&&(!from||from[i]<0)):[];
  bank+=collected.length;
  // A full bank may exceed the grid. Deploy the remainder on the next refill
  // of this same final spin; a fully Wild grid always clears all four rows.
  const targets=finale&&bank?allCells().filter(i=>landed[i]!=='W'):[];
  const drops=take(targets,Math.min(bank,targets.length),rng);
  bank-=drops.length;
  const board=[...landed];for(const i of drops)board[i]='W';
  const result=evaluate(board,active),after=[...active];
  for(const i of result.hit){after[i]=doubled(active[i]);touched.add(i)}
  if(amount+result.amount>=room){result.amount=Math.round((room-amount)*100)/100;maxWin=true}
  amount=Math.round((amount+result.amount)*100)/100;
  steps.push({landed,from,board,active,after,drops,collected,...result});
  active=after;
  if(!result.hit.length||maxWin)break;
  if(n===maxBoards-1){limited=true;break}
  ({landed,from}=refill(board,result.hit,scatterChance,rng,weights,MATH.refillWild[kind]));
 }
 const board=steps.at(-1).board,fs=board.filter(id=>id==='FS').length;
 const trigger=bonus||maxWin?null:fs===5?'hidden':fs===4?'super':fs===3?'regular':null;
 // Ordinary paid hits survive for the next paid spin. Feature seeds and their
 // upgrades belong to that purchase; free spins keep all cells between spins.
 const spots=bonus?active:active.map((v,i)=>!seeded&&touched.has(i)?v:0);
 return {steps,landing:steps[0].landed,board,prior,boosts,seeded,finale,trigger,amount,limited,maxWin,
  state:{...state,spots,bank,left:bonus&&!maxWin?state.left-1:0,total:Math.round((state.total+amount)*100)/100}};
}
