import {lineWins} from './paylines.js';
import {makeFeatureRound} from './feature-spin.js';
import {BONUS_BUYS,BONUS_FEATURES,PREVIEW_MODES,SPIN_MODES,bonusTierForScatters,chooseMysteryTier} from './config.js';
export const WIDTH=6, HEIGHT=5, CAP=2500000;
export const CARDS=['j','q','k','a'];
export const PEOPLE=['skater','nurse','builder','cop','scientist'];
export const HUMAN_MULTIS=Object.freeze({skater:2,nurse:3,builder:4,cop:5,scientist:10});
export const freshInfection=()=>Object.fromEntries(PEOPLE.map(kind=>[kind,0]));
export const SYMBOLS=[...CARDS,...PEOPLE];
export const LABELS={j:'Jack',q:'Queen',k:'King',a:'Ace',skater:'Skater',nurse:'Medic',builder:'Builder',cop:'Officer',scientist:'Scientist',zombie:'Zombie',wild:'Wild trail',vial:'FS scatter',heart:'Respin heart'};
const DIRECTIONS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const clone=board=>board.map(cell=>({...cell}));
export const isWild=cell=>cell.kind==='zombie'||cell.kind==='wild';
export function humanBiteValue(cell){return PEOPLE.includes(cell.kind)?([2,3,4,5,10].includes(cell.biteValue)?cell.biteValue:1):0;}
function infectHumans(board,infection,superBonus=false){
 for(const cell of board)if(PEOPLE.includes(cell.kind)){
  cell.infected=superBonus||infection[cell.kind]>=3;
  cell.biteValue=cell.infected?HUMAN_MULTIS[cell.kind]:1;
 }
}
export function seeded(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export function step(index,direction){
 const delta=DIRECTIONS[direction];if(!delta)return -1;
 const x=index%WIDTH+delta[0],y=Math.floor(index/WIDTH)+delta[1];
 return x>=0&&x<WIDTH&&y>=0&&y<HEIGHT?y*WIDTH+x:-1;
}
export function neighbours(index){return Object.keys(DIRECTIONS).map(direction=>step(index,direction)).filter(index=>index>=0);}

// One moving head leaves ordinary wilds. Eaten humans never create more walkers.
export function walkZombies(input,rng=Math.random,{infection=null,hearts=false}={}){
 const board=clone(input),events=[],heads=board.filter(cell=>cell.kind==='zombie').map(cell=>cell.id);
 if(infection)infectHumans(board,infection);
 const lastHeadByReel=new Map(),pending=new Set(heads),completedReels=new Set();let bites=0,serial=0,reels=0,heartCount=0;
 const reachable=cell=>PEOPLE.includes(cell.kind)||(hearts&&cell.kind==='heart');
 function expand(target){
  const head=board[target];
  if(!head||head.kind!=='zombie'||!DIRECTIONS[head.direction]||(head.path?.length||0)<2)return;
  const horizontal=['left','right'].includes(head.direction);
  const cells=head.fullReel&&!horizontal?Array.from({length:HEIGHT},(_,row)=>row*WIDTH+target%WIDTH):head.path;
  const sorted=[...cells].sort((a,b)=>a-b);
  if(head.spanCells?.join(',')===sorted.join(','))return;
  const before=clone(board);
  // Horizontal claims are artwork only; their trail retains its ordinary wild value.
  if(!horizontal)for(const index of sorted)board[index]={...board[index],stackId:head.id,stackMulti:head.multi};
  board[target]={...board[target],spanCells:sorted};
  events.push({type:'expand',before,board:clone(board),cells:sorted,target,multi:head.multi,eaten:head.eaten,headId:head.id,direction:head.direction,fullReel:!!head.fullReel});
 }
 function resolve(id){
  pending.delete(id);const merged=[];
  for(let reel=0;reel<WIDTH;reel++){
   if(completedReels.has(reel))continue;
   const cells=Array.from({length:HEIGHT},(_,y)=>y*WIDTH+reel);
   if(!cells.every(index=>isWild(board[index])))continue;
   const occupants=cells.filter(index=>board[index].kind==='zombie');
   // A head still waiting its turn may leave this reel; do not consume it early.
   if(!occupants.length||occupants.some(index=>pending.has(board[index].id)))continue;
   const target=occupants.find(index=>board[index].id===lastHeadByReel.get(reel))??occupants.at(-1);
   const multi=occupants.reduce((sum,index)=>sum+(board[index].multi||0),0),eaten=occupants.reduce((sum,index)=>sum+(board[index].eaten||0),0),before=clone(board);
   const owners=new Set(occupants.map(index=>board[index].id));
   for(let index=0;index<board.length;index++)if(owners.has(board[index].stackId)){
    const {stackId,stackMulti,...cell}=board[index];board[index]=cell;
   }
   for(const index of occupants)if(index!==target)board[index]={id:board[index].id,kind:'wild',owner:board[target].id};
   const {spanCells,...head}=board[target];board[target]={...head,multi,eaten,fullReel:true};
   completedReels.add(reel);reels++;merged.push(target);
   events.push({type:'reelComplete',before,board:clone(board),reel,cells,target,multi,eaten,reels});
  }
  // Each walker gets its final artwork before the next walker enters the queue.
  expand(board.findIndex(cell=>cell.id===id&&cell.kind==='zombie'));
  for(const target of merged)expand(target);
 }
 for(const id of heads){
  let source=board.findIndex(cell=>cell.id===id&&cell.kind==='zombie');
  if(source<0)continue;
  const available=Object.keys(DIRECTIONS).filter(direction=>{const target=step(source,direction);return target>=0&&reachable(board[target]);});
  const direction=board[source].direction||available[Math.floor(rng()*available.length)];
  if(!DIRECTIONS[direction]){resolve(id);continue;}
  for(;;){
   const target=step(source,direction);
   if(target<0||!reachable(board[target]))break;
   const collected=hearts&&board[target].kind==='heart';
   const before=clone(board),head=board[source],human=collected?null:board[target].kind,gain=humanBiteValue(board[target]);
   const multi=(head.multi||0)+gain,eaten=(head.eaten||0)+(collected?0:1);
   board[source]={id:`trail:${id}:${++serial}`,kind:'wild',owner:id};
   board[target]={...head,multi,eaten,direction,path:[...(head.path||[source]),target]};if(collected)heartCount++;else bites++;lastHeadByReel.set(target%WIDTH,id);
   let unlocked=null;
   if(infection&&human){
    const previous=infection[human];infection[human]=Math.min(3,previous+1);
    if(previous===2)unlocked=human;
    infectHumans(board,infection);
   }
   events.push({type:collected?'heart':'walk',before,board:clone(board),source,target,headId:id,human,direction,multi,gain,eaten,bites,...(collected?{targetKind:'heart',hearts:heartCount}:{}),...(infection?{infection:{...infection},unlocked}:{})});
   source=target;
  }
  resolve(id);
 }
 return {board,events,bites,reels,...(hearts?{hearts:heartCount}:{})};
}
export function expandedZombies(board){return board.filter(cell=>cell.kind==='zombie'&&cell.spanCells?.length>=(cell.superZombie?1:2)).map(cell=>({id:cell.id,cells:cell.spanCells,multi:cell.multi,fullReel:!!cell.fullReel,super:!!cell.superZombie,hidden:!!cell.hiddenBonus,startRow:cell.startRow,direction:cell.direction,horizontal:cell.spanCells.length>1&&Math.floor(cell.spanCells[0]/WIDTH)===Math.floor(cell.spanCells.at(-1)/WIDTH)}));}

// Super retains landing rows. Hidden also supplies each reel's prior total;
// the entire board and eaten counts are fresh in both modes.
export function placeSuperZombies(input,lockedRows=Array(WIDTH).fill(null),rng=Math.random,{landings=null,multipliers=null}={}){
 const board=clone(input),starts=[...lockedRows],upgrades=[];
 if(landings===null){
  const chance=rng(),count=chance<.025?2:chance<.4?1:0;
  let available=Array.from({length:WIDTH*HEIGHT},(_,i)=>i).filter(i=>starts[i%WIDTH]===null||Math.floor(i/WIDTH)>starts[i%WIDTH]);
  landings=[];
  for(let n=0;n<count&&available.length;n++){
   const index=available[Math.floor(rng()*available.length)];landings.push(index);
   available=available.filter(i=>i%WIDTH!==index%WIDTH);
  }
 }
 for(const index of landings){
  const reel=index%WIDTH,row=Math.floor(index/WIDTH),previous=starts[reel];
  if(previous===null||row>previous){starts[reel]=row;upgrades.push({reel,from:previous,to:row});}
 }
 for(let reel=0;reel<WIDTH;reel++)if(starts[reel]!==null){
  board[starts[reel]*WIDTH+reel]={id:`super:${reel}`,kind:'zombie',multi:multipliers?.[reel]||0,eaten:0,direction:'up',superZombie:true,hiddenBonus:multipliers!==null,startRow:starts[reel]};
 }
 return {board,starts,upgrades};
}

// Both modes use identical movement. Hidden's carried value is already on its
// returning head, so each fresh bite is added exactly once by this resolver.
export function walkSuper(input){
 const board=clone(input),events=[],heads=board.filter(cell=>cell.kind==='zombie'&&!cell.spanCells).map(cell=>cell.id);
 let bites=0,reels=0;
 for(const id of heads){
  let source=board.findIndex(cell=>cell.id===id&&cell.kind==='zombie');if(source<0)continue;
  const origin=source,reel=source%WIDTH;
  const prior=board.find(cell=>cell.superZombie&&cell.kind==='zombie'&&cell.spanCells?.[0]%WIDTH===reel);
  for(;;){
   const target=step(source,'up');if(target<0||board[target].stackId)break;
   const before=clone(board),head=board[source],victim=board[target],human=PEOPLE.includes(victim.kind)?victim.kind:null;
   const gain=human?HUMAN_MULTIS[human]:0,multi=(head.multi||0)+gain,eaten=(head.eaten||0)+(human?1:0);
   board[source]={id:`trail:${id}:${source}`,kind:'wild',owner:id};
   board[target]={...head,multi,eaten,direction:'up'};if(human)bites++;
   events.push({type:human?'walk':'pass',before,board:clone(board),source,target,headId:id,human,targetKind:victim.kind,direction:'up',multi,gain,eaten,bites,super:true,hidden:!!head.hiddenBonus,startRow:Math.floor(origin/WIDTH)});
   source=target;
  }
  const head=board[source],before=clone(board),owner=prior?.id||id;
  const multi=(prior?.multi||0)+(head.multi||0),eaten=(prior?.eaten||0)+(head.eaten||0);
  const cells=Array.from({length:Math.floor(origin/WIDTH)+1},(_,row)=>row*WIDTH+reel),fullReel=cells.length===HEIGHT;
  const startRow=Math.floor(origin/WIDTH);
  for(const index of cells)board[index]={id:`super-wild:${owner}:${index}`,kind:'wild',owner,superZombie:true,stackId:owner,stackMulti:multi};
  board[reel]={id:owner,kind:'zombie',direction:'up',multi,eaten,superZombie:true,hiddenBonus:!!head.hiddenBonus,startRow,stackId:owner,stackMulti:multi,spanCells:cells,fullReel};
  events.push({type:'expand',before,board:clone(board),cells,target:reel,multi,eaten,headId:owner,direction:'up',fullReel,super:true,hidden:!!head.hiddenBonus,startRow});
  if(fullReel&&!prior?.fullReel){reels++;events.push({type:'reelComplete',before:clone(board),board:clone(board),reel,cells,target:reel,multi,eaten,reels,super:true,hidden:!!head.hiddenBonus,startRow});}
 }
 return {board,events,bites,reels};
}

// Raw board generator. Paid play selects audited seeds in outcome-model.js.
// Overrides are used to build/replay the fixed catalogue, never to change a
// player's outcome in response to their balance, history or animation state.
export function makeRound({kind='base',rng=Math.random,forcedTier=null,forcedScatters=null,baseOnly=false,bonusRng=null,clustered=false}={}){
 if(kind==='buy_feature'||kind==='preview_feature')return makeFeatureRound({rng});
 if(!Object.hasOwn(SPIN_MODES,kind)&&!PREVIEW_MODES.includes(kind)&&!Object.hasOwn(BONUS_BUYS,kind))throw Error('Unknown round type');
 const bought=Object.hasOwn(BONUS_BUYS,kind);
 const mystery=kind==='buy_mystery';
 let tier=forcedTier||(mystery?chooseMysteryTier(rng):BONUS_BUYS[kind]?.tier||(kind==='preview_hidden'?'hidden':kind==='preview_super'?'super':'regular'));
 let serial=0,total=0,biteCount=0,reelCount=0,turn=0,bonus=false,lastMulti=0,lastEaten=0;
 const events=[],cell=(kind,extra={})=>({id:`s${++serial}`,kind,...extra});
 const infection=freshInfection();let superStarts=Array(WIDTH).fill(null),superUpgrades=[],superMultipliers=Array(WIDTH).fill(0),focus=null;
 // Rare correlated-symbol candidates extend Outbreak's legitimate upper tail.
 // They still obey every bite, payline and infection rule; no award is injected.
 function draw(inSuper=false,inBonus=false){
  if(inBonus&&focus&&rng()<.92)return cell(focus);
  const pool=rng()<(inSuper ? .35 : .48)?CARDS:PEOPLE;return cell(pool[Math.floor(rng()*pool.length)]);
 }
 function initial(inBonus=false,example='',bonusSpin=0){
  const inSuper=inBonus&&(tier==='super'||tier==='hidden');
  if(inBonus&&clustered&&!focus)focus=PEOPLE[Math.floor(rng()*PEOPLE.length)];
  let board=Array.from({length:30},()=>draw(inSuper,inBonus));
  if(inBonus&&kind==='outbreak'){
   // A free preview walks through both bites, then collects the unlocked values.
   const number=bonusSpin,person=PEOPLE[Math.min(4,number)];
   board[25]=cell('zombie',{multi:0,direction:'up'});
   board[19]=cell(person);board[13]=cell(person);board[7]=cell(number<5?person:'scientist');board[1]=cell('q');
   if(number>=5){board[19]=cell(PEOPLE[number-5]);board[13]=cell('scientist');}
   return board;
  }
  if(example){
   board=Array.from({length:30},(_,i)=>cell(SYMBOLS[(i%6+Math.floor(i/6)*2)%9]));
   if(['single','showcase','triple','carriers'].includes(example)){
    board[25]=cell('zombie',{multi:0,direction:'up'});board[19]=cell('nurse');board[13]=cell('scientist');board[7]=cell('k');
    for(const index of [12,14,15])board[index]=cell('skater');
    if(example==='triple'){board[7]=cell('builder');board[1]=cell('k');}
    if(example==='single')board[13]=cell('k');
    if(example==='carriers'){board[19].biteValue=3;board[13].biteValue=5;}
   }else if(example==='down'){
    board[4]=cell('zombie',{multi:0,direction:'down'});[10,16,22].forEach(index=>board[index]=cell('nurse'));board[28]=cell('k');
   }else if(example==='horizontal'){
    board[12]=cell('zombie',{multi:0,direction:'right'});board[13]=cell('nurse');board[14]=cell('scientist');board[15]=cell('k');
   }else if(example==='horizontal_left'){
    board[17]=cell('zombie',{multi:0,direction:'left'});board[16]=cell('nurse');board[15]=cell('scientist');board[14]=cell('k');
   }else if(example==='reel'){
    board[28]=cell('zombie',{multi:0,direction:'up'});[4,10,16,22].forEach((index,n)=>board[index]=cell(PEOPLE[n]));
    for(const index of [12,13,14,15,17])board[index]=cell('skater');
   }else if(example==='outbreak')for(const index of [0,5,29])board[index]=cell('vial');
   return board;
  }
  // Chance per starting board: 8% base, 70% Outbreak. Each spin resolves once.
  if(inSuper){
   const preview=kind==='preview_super'||kind==='preview_hidden';
   // Previews demonstrate returning rows using the same fresh symbol draw as play.
   // Row 3 repeats, upgrades to the bottom, then repeats its full climb.
   const demoLandings=[[12],[],[24],[13],[],[8],[25],[15]][bonusSpin];
   const placed=placeSuperZombies(board,superStarts,rng,{...(preview?{landings:demoLandings}:{}),...(tier==='hidden'?{multipliers:superMultipliers}:{})});
   board=placed.board;superStarts=placed.starts;superUpgrades=placed.upgrades;
  }else{
   const chance=rng(),count=inBonus?(chance<.18?2:chance<.70?1:0):(chance<.006?2:chance<.08?1:0);
   const available=Array.from({length:30},(_,i)=>i);
   for(let n=0;n<count;n++){const chosen=Math.floor(rng()*available.length),index=available.splice(chosen,1)[0];board[index]=cell('zombie',{multi:0});}
  }
  if(!inBonus){
   if(forcedScatters===null){
    for(let i=0;i<30;i++)if(board[i].kind!=='zombie'&&rng()<(SPIN_MODES[kind]?.scatterChance??SPIN_MODES.base.scatterChance))board[i]=cell('vial');
   }else{
    if(!Number.isInteger(forcedScatters)||forcedScatters<0||forcedScatters>30)throw Error('Invalid scatter count');
    const available=board.map((symbol,index)=>symbol.kind==='zombie'?-1:index).filter(index=>index>=0);
    if(forcedScatters>available.length)throw Error('Too many scatters');
    for(let n=0;n<forcedScatters;n++)board[available.splice(Math.floor(rng()*available.length),1)[0]]=cell('vial');
   }
  }
  // Carriers remain one of the five human symbols for normal line pays.
  // Per human: 6% add 3x when eaten, 2% add 5x, and the rest add 1x.
  for(const symbol of board)if(PEOPLE.includes(symbol.kind)){
   if(!inBonus){const carrier=rng();if(carrier<.02)symbol.biteValue=5;else if(carrier<.08)symbol.biteValue=3;}
  }
  return board;
 }
 function spin(inBonus=false,example='',left=0){
  turn++;lastMulti=0;lastEaten=0;let board=initial(inBonus,example,BONUS_FEATURES[tier].spins-1-left);
  const inSuper=inBonus&&(tier==='super'||tier==='hidden');
  if(inBonus)infectHumans(board,infection,inSuper);
  events.push({type:'reveal',board:clone(board),bonus:inBonus,tier,left,turn,multi:0,eaten:0,total,...(inBonus?{infection:{...infection}}:{}),...(inSuper?{superStarts:[...superStarts],upgrades:superUpgrades.map(upgrade=>({...upgrade}))}:{}),...(inBonus&&tier==='hidden'?{carriedMultipliers:[...superMultipliers]}:{})});
  const walk=inSuper?walkSuper(board):walkZombies(board,rng,{infection:inBonus?infection:null});board=walk.board;
  for(const event of walk.events){
   if(event.type==='walk')biteCount++;
   if(event.type==='walk'||event.type==='pass'){lastMulti=event.multi;lastEaten=event.eaten;}
   if(event.type==='reelComplete'){reelCount++;lastMulti=event.multi;lastEaten=event.eaten;}
   if(event.type==='expand'){lastMulti=event.multi;lastEaten=event.eaten;}
   events.push({...event,bonus:inBonus,biteCount,reelCount,turn});
  }
  if(inBonus&&tier==='hidden')superMultipliers=Array.from({length:WIDTH},(_,reel)=>board[reel].superZombie?(board[reel].multi||0):0);
  const wins=lineWins(board);
  if(wins.length){
   const uncapped=wins.reduce((sum,win)=>sum+win.amount,0),win=Math.min(CAP-total,uncapped);total+=win;
   events.push({type:'lineWin',board:clone(board),wins,uncapped,win,total,bonus:inBonus,turn});
  }
  events.push({type:'spinEnd',board:clone(board),total,multi:lastMulti,eaten:lastEaten,biteCount,reelCount,bonus:inBonus,tier,turn,left,...(inBonus?{infection:{...infection}}:{}),...(inSuper?{superStarts:[...superStarts]}:{}),...(inBonus&&tier==='hidden'?{carriedMultipliers:[...superMultipliers]}:{})});
  return board.filter(cell=>cell.kind==='vial').length;
 }
 const canisters=bought?BONUS_FEATURES[tier].scatters:kind==='preview_super'?4:kind==='preview_hidden'?5:spin(false,Object.hasOwn(SPIN_MODES,kind)?'':kind);
 if(!baseOnly&&canisters>=3&&total<CAP){
  tier=bonusTierForScatters(canisters);
  bonus=true;events.push({type:'bonusStart',spins:BONUS_FEATURES[tier].spins,total,tier,bought,mystery,scatters:canisters,infection:{...infection}});
  if(bonusRng)rng=bonusRng;
  for(let left=BONUS_FEATURES[tier].spins-1;left>=0&&total<CAP;left--)spin(true,'',left);
  events.push({type:'bonusEnd',total,tier});
 }
 events.push({type:'roundEnd',total,multi:lastMulti,eaten:lastEaten,biteCount,reelCount,bonus,tier,capped:total>=CAP});
 return {events,total,multi:lastMulti,eaten:lastEaten,biteCount,reelCount,bonus};
}
