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
const pays={hive:[2,6,18],nectar:[1.4,4,12],stinger:[1,3,9],rotor:[.8,2,7],beacon:[.6,1.8,6],A:[.4,1.2,4],K:[.4,1.2,4],Q:[.3,.9,3],J:[.3,.9,3],10:[.3,.9,3]};
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
 scout:{price:10,label:'Scout Run',type:'Feature spins',art:'stinger',copy:'Start each paid spin with at least one ordinary Wild.'},
 random:{price:20,label:'Pollen Charge',type:'Random multipliers',art:'rotor',copy:'Start each spin with 6–12 random cells at 2× to 32×. Winning cells keep doubling through tumbles.'},
 full32:{price:250,label:'Hive Overdrive',type:'Full 32× board',art:'hive',copy:'All 20 cells start at 32× each spin. Winning cells double to 64×, then 128×.'}
};
export const scatterCounts={regular:3,super:4,hidden:5};
export function purchaseEntry(id,rng=Math.random){
 if(!Object.hasOwn(buys,id))throw Error('Unknown bonus purchase');
 const roll=id==='mystery'?rng():0;
 const mode=id==='mystery'?(roll<.5?'regular':roll<.9?'super':'hidden'):id;
 const board=allCells().map(()=>pick([...premiums,...ranks],rng));
 // A purchased reveal stages two early scatters and leaves the tier reveal on reel five.
 for(const col of [0,1,...take([2,3],scatterCounts[mode]-3,rng),4])board[col+5*Math.floor(rng()*4)]='FS';
 return {mode,board};
}
export function start(mode='base'){
 const spots=Array(20).fill(mode==='super'||mode==='hidden'?2:0);
 return {mode,spots,left:mode==='base'?0:10,bank:0,total:0};
}
export function evaluate(board,spots){
 const wins=[],hit=new Set();let amount=0;
 for(const line of lines){
  let best=null;
  for(const symbol of payingSymbols){
   let n=0;while(n<5 && [symbol,'W'].includes(board[line[n]]))n++;
   if(n<3)continue;
   const cells=line.slice(0,n), multiplier=Math.max(1,cells.reduce((s,i)=>s+spots[i],0));
   const pay=pays[symbol][n-3]*multiplier;
   if(!best||pay>best.pay)best={cells,pay,symbol};
  }
  if(best){wins.push(best);best.cells.forEach(i=>hit.add(i));amount+=best.pay}
 }
 return {wins,hit:[...hit],amount:Math.round(amount*100)/100};
}
const bag=[...premiums,...premiums,...ranks,...ranks,...ranks];
const payingSymbols=[...premiums,...ranks];
const randomMultis=[[.15,2],[.30,4],[.50,8],[.7975,16],[1,32]];
const maxBoards=100;
const doubled=n=>Math.min(128,Math.max(2,n*2));

function seedBoard(mode,rng){
 const spots=Array(20).fill(mode==='full32'?32:0);
 if(mode==='random'){
  for(const i of take(allCells(),6+Math.floor(rng()*7),rng)){
   const roll=rng();spots[i]=randomMultis.find(([limit])=>roll<limit)[1];
  }
 }
 return spots;
}

// A source row below zero is a new tile above the top rail. Survivors retain
// their vertical order, including Wilds and FS, but never carry a cell charge.
export function refill(board,hit,scatterChance,rng){
 const removed=new Set(hit),landed=[...board],from=Array(20);
 for(let col=0;col<5;col++){
  const column=[col,col+5,col+10,col+15],kept=column.filter(i=>!removed.has(i));
  const count=4-kept.length;
  for(let row=0;row<4;row++){
   const i=column[row];
   if(row<count){
    from[i]=row-count;
    landed[i]=rng()<.02?'W':pick(bag,rng);
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
 let active=[...prior],landed=allCells().map(()=>pick(bag,rng)),from=null;
 const openingWilds=(state.mode==='hidden'?1:Number(rng()<.33))+Number(rng()<.08);
 for(const i of take(allCells(),openingWilds,rng))landed[i]='W';
 const scatterChance=bonus?0:featureMode==='enhanced'?.115:.075;
 if(scatterChance)for(let col=0;col<5;col++){
  if(rng()<scatterChance)landed[col+5*Math.floor(rng()*4)]='FS';
 }
 if(!bonus&&featureMode==='scout'&&!landed.includes('W')){
  const [i]=take(allCells().filter(i=>landed[i]!=='FS'),1,rng);landed[i]='W';
 }
 const eligible=allCells().filter(i=>active[i]<128);
 const boosts=state.mode==='hidden'?take(eligible,Math.min(eligible.length,1+Math.floor(rng()*3)),rng):[];
 for(const i of boosts)active[i]=doubled(active[i]);

 const steps=[],touched=new Set();
 let amount=0,bank=state.bank,limited=false;
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
  amount=Math.round((amount+result.amount)*100)/100;
  steps.push({landed,from,board,active,after,drops,collected,...result});
  active=after;
  if(!result.hit.length)break;
  if(n===maxBoards-1){limited=true;break}
  ({landed,from}=refill(board,result.hit,scatterChance,rng));
 }
 const board=steps.at(-1).board,fs=board.filter(id=>id==='FS').length;
 const trigger=bonus?null:fs===5?'hidden':fs===4?'super':fs===3?'regular':null;
 // Ordinary paid hits survive for the next paid spin. Feature seeds and their
 // upgrades belong to that purchase; free spins keep all cells between spins.
 const spots=bonus?active:active.map((v,i)=>!seeded&&touched.has(i)?v:0);
 return {steps,landing:steps[0].landed,board,prior,boosts,seeded,finale,trigger,amount,limited,
  state:{...state,spots,bank,left:bonus?state.left-1:0,total:Math.round((state.total+amount)*100)/100}};
}
