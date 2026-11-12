import {RULES,PAYTABLE,LINES,WORD_RULES,multiplierCap} from './config.js?v=god-pacing-71';
const SYMBOLS=Object.keys(PAYTABLE);
const RIVAL_VALUES=[2,3,5,5,8,10,15,20,25,50],BOSS_VALUES=[25,50,75,100,150,250],BOSS_CHANCE=.06;
export function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,n)=>Math.floor(r()*n),copy=value=>structuredClone(value);
export function freshBoard(r){return Array.from({length:5},()=>Array.from({length:5},()=>({name:SYMBOLS[pick(r,8)]})));}
export function wordWin(board){
 let best=null;
 LINES.forEach((line,lineIndex)=>{
  // The actual four letters must be present: wilds cannot spell the word.
  if(!WORD_RULES.letters.every((name,reel)=>board[reel][line[reel]].name===name))return;
  const adjacent=board[4][line[4]],duel=adjacent.name==='WILD'&&adjacent.duelId!=null;
  const multiplier=duel?Math.max(1,Math.min(WORD_RULES.maxMultiplier,adjacent.multiplier||1)):1;
  const win={word:true,line:lineIndex,symbol:'DUEL',count:4,multiplier,sourceMultiplier:duel?adjacent.multiplier:1,positions:line.slice(0,duel?5:4).map((row,reel)=>({row,reel})),amount:WORD_RULES.award*multiplier};
  if(!best||win.amount>best.amount)best=win;
 });
 // One word award per spin, even if several paylines spell it. Its separate
 // cap is 500x; ordinary line wins and the whole-round cap remain independent.
 return best;
}
export function evaluate(board){
 const wins=[];
 LINES.forEach((line,lineIndex)=>{
  const sequence=line.map((row,reel)=>board[reel][row]);
  // An all-wild line uses the highest-paying symbol. Otherwise use the first
  // non-wild symbol, including a leading scatter which blocks that line.
  const symbol=sequence.find(s=>s.name!=='WILD')?.name||'HELMET';
  if(!PAYTABLE[symbol])return;
  let count=0,multiplier=0;const positions=[];
  for(let reel=0;reel<5;reel++){
   const s=sequence[reel];if(s.name!==symbol&&s.name!=='WILD')break;
   count++;positions.push({reel,row:line[reel]});if(s.name==='WILD'&&s.multiplier)multiplier+=s.multiplier;
  }
  if(count>=3)wins.push({line:lineIndex,symbol,count,multiplier:Math.max(1,multiplier),positions,amount:PAYTABLE[symbol][count-3]*Math.max(1,multiplier)});
 });
 const word=wordWin(board);if(word)wins.push(word);
 return {wins,payout:wins.reduce((n,w)=>n+w.amount,0)};
}
export function combineMultipliers(current,rival,boss=false,tier=null){
 const cap=multiplierCap(tier);
 if(!Number.isSafeInteger(current)||!Number.isSafeInteger(rival)||current<1||rival<1||current>cap||rival>cap)throw Error('Invalid duel multiplier');
 if(tier!=='hidden')throw Error('Multiplier growth is exclusive to God Mode');
 return Math.min(cap,boss?current*rival:current*2);
}
export function winnerMultiplier(current,rival,won,tier=null){
 const cap=multiplierCap(tier);
 if(!Number.isSafeInteger(current)||!Number.isSafeInteger(rival)||current<1||rival<1||current>cap||rival>cap)throw Error('Invalid duel multiplier');
 return won?current:rival;
}
export function resolveDuel(state,won,tier,rival){
 if(tier==='regular')throw Error('Regular duels use their revealed winner value.');
 const always=tier==='hidden';
 if(always)return {...state,multiplier:combineMultipliers(state.multiplier,rival,state.boss,tier),lives:null};
 return {...state,multiplier:winnerMultiplier(state.multiplier,rival,won,tier),lives:won?state.lives:state.lives-1,boss:state.boss&&won,fighter:won?state.fighter:state.fighter==='outlaw'?'hunter':'outlaw'};
}
export function applyWildReels(board,states){
 const result=copy(board);
 for(const state of states)result[state.reel]=result[state.reel].map(()=>({name:'WILD',multiplier:state.multiplier,duelId:state.id}));
 return result;
}
export function addCrossfire(board,states,r,rightEdge=false){
 if(states.length<2)return [];
 const available=[];board.forEach((column,reel)=>column.forEach((s,row)=>{if(s.name!=='WILD'&&s.name!=='SCATTER')available.push({reel,row});}));
 const positions=[];const count=Math.min(available.length,2+pick(r,3));
 for(let n=0;n<count;n++){const options=rightEdge?available.filter(p=>p.reel===Math.max(...available.map(q=>q.reel))):available;
  const position=options[pick(r,options.length)];available.splice(available.indexOf(position),1);board[position.reel][position.row]={name:'WILD',temporary:true};positions.push(position);}
 return positions;
}
export function duelCrossfireSources(states){
 const left=states.find(s=>s.reel===0),right=states.find(s=>s.reel===4);
 return left&&right?[left,right]:[];
}
// Candidate scheduling is independent of symbols and fighter rolls. The fixed
// offline weights determine paid frequencies, including each starting reel.
export function godReelPlan(seed){
 const r=rng(seed^0x61C88647),roll=r(),count=roll<.20?1:roll<.60?2:roll<.80?3:roll<.94?4:5;
 const order=[0,1,2,3,4];for(let i=4;i>0;i--){const j=pick(r,i+1);[order[i],order[j]]=[order[j],order[i]];}
 const arrivals=[];
 if(count>1){
  arrivals.push({turn:2+pick(r,5),reel:order[1]});
  // The first reinforcement comes early. Rare larger teams build at the end,
  // keeping room in the return budget for ordinary two-reel bonuses.
  for(let i=2;i<count;i++)arrivals.push({turn:10,reel:order[i]});
  arrivals.sort((a,b)=>a.turn-b.turn||a.reel-b.reel);
 }
 return {start:order[0],arrivals,spacedSymbols:r()<.75,symbolOffset:pick(r,8),quietCrossfire:r()<.85};
}
export function makeRound(seed,{tier=null,trigger=false,feature=null}={}){
 if(feature){if(feature!=='duel'||tier)throw Error('Unknown feature.');return makeDuelRound(seed);}
 if(tier!==null&&!['regular','super','hidden'].includes(tier))throw Error('Unknown feature.');
 const r=rng(seed),fighterRandom=rng(seed^0x3C6EF372),events=[];let total=0,id=0,states=[];
 // Candidate-generation template for legal five-reel gold Boss victories.
 // This is NOT its paid probability: the fixed pool reserves exactly 10,000
 // tickets per billion for all Showdown cap books combined.
 const catalogue=rng(seed^0x61C88647),capTurn=tier==='regular'&&catalogue()<.001?1+pick(catalogue,RULES.spins):0;
 const godPlan=tier==='hidden'?godReelPlan(seed):null;
 const newFighter=reel=>{const boss=r()<BOSS_CHANCE;return {id:++id,reel,multiplier:tier==='hidden'?RULES.startMultiplier:(boss?BOSS_VALUES[pick(fighterRandom,BOSS_VALUES.length)]:RIVAL_VALUES[pick(fighterRandom,RIVAL_VALUES.length)]),lives:tier==='super'?RULES.lives:null,boss,fighter:boss?'boss':'hunter'};};
 const emit=e=>events.push(e);
 const finish=()=>{emit({type:'finalWin',amount:total});return{events,payoutMultiplier:total};};
 if(tier&&trigger){
  const reveal=rng(seed^0xA5A5A5A5),board=freshBoard(reveal),count={regular:3,super:4,hidden:5}[tier];
  const reels=[0,1,2,3,4];for(let n=0;n<count;n++){const reel=reels.splice(pick(reveal,reels.length),1)[0];board[reel][pick(reveal,5)]={name:'SCATTER'};}
  emit({type:'trigger',board,tier,scatters:count});
 }
 if(tier){
  if(tier==='hidden')states=[newFighter(godPlan.start)];
  emit({type:'bonusStart',tier,spins:RULES.spins,states:copy(states)});
 }
 const spins=tier?RULES.spins:1;
 for(let turn=1;turn<=spins;turn++){
  const raw=freshBoard(r),before=copy(states),landings=[],duels=[];
  // Include disconnected symbol-strip candidates alongside ordinary strips.
  // They provide lower-paying legal boards for early immortal arrivals without
  // changing the symbol paytable, growth rules, Crossfire or selected awards.
  if(godPlan?.spacedSymbols)for(let reel=0;reel<5;reel++)for(let row=0;row<5;row++){
   const offset=SYMBOLS.indexOf(raw[reel][row].name)%2;
   raw[reel][row]={name:SYMBOLS[(godPlan.symbolOffset+reel*2+offset)%SYMBOLS.length]};
  }
  const chance=tier==='super'?.09:tier==='regular'?.20:.045;
  for(let reel=0;reel<5;reel++)if(!states.some(w=>w.reel===reel)&&(godPlan?godPlan.arrivals.some(a=>a.turn===turn&&a.reel===reel):(turn===capTurn||r()<chance))){
   const state=newFighter(reel);
   if(turn===capTurn){state.boss=true;state.fighter='boss';state.multiplier=250;}
   states.push(state);landings.push({...state,row:pick(r,5)});raw[reel][landings.at(-1).row]={name:'VS'};
  }
  if(!tier||tier==='regular'){
   // Expand only VS reels that participate in a win after all candidates expand.
   const candidates=states,candidate=applyWildReels(raw,states),used=new Set(evaluate(candidate).wins.flatMap(w=>w.positions.map(p=>p.reel)));
   states=states.filter(s=>used.has(s.reel));
   // Removing unconnected badges can uncover the literal word. Its adjacent
   // reel-five badge also qualifies for a duel, even without an ordinary win.
   const adjacent=candidates.find(s=>s.reel===4);
   if(adjacent&&!states.includes(adjacent)&&wordWin(applyWildReels(raw,states)))states.push(adjacent);
   for(const state of states){
    const from=state.multiplier,boss=state.boss,rival=turn===capTurn?50:RIVAL_VALUES[pick(r,RIVAL_VALUES.length)],won=turn===capTurn||r()<.5,winnerBoss=boss&&won;
    const uncappedTo=winnerMultiplier(from,rival,won);
    state.multiplier=uncappedTo;state.boss=winnerBoss;state.fighter=won?(boss?'boss':'hunter'):'outlaw';
    duels.push({id:state.id,reel:state.reel,from,to:state.multiplier,won,lives:null,dead:false,regular:true,rival,boss,winnerBoss,stateBoss:state.boss,fighter:boss?'boss':'hunter',operation:'keep',uncappedTo,multiplierCapped:uncappedTo>RULES.maxMultiplier});
   }
  }else{
   const resolved=[];
   for(const state of states){
    const rival=RIVAL_VALUES[pick(r,RIVAL_VALUES.length)],won=tier==='hidden'||r()<.53,next=resolveDuel(state,won,tier,rival),dead=next.lives===0;
    const uncappedTo=tier==='hidden'?(state.boss?state.multiplier*rival:state.multiplier*2):next.multiplier;
    duels.push({id:state.id,reel:state.reel,from:state.multiplier,to:next.multiplier,won,lives:next.lives,previousLives:state.lives,dead,rival,boss:state.boss,winnerBoss:state.boss&&won,stateBoss:next.boss,fighter:state.fighter,operation:tier==='hidden'?(state.boss?'multiply':'double'):dead?'hold':'keep',uncappedTo,multiplierCapped:uncappedTo>multiplierCap(tier)});
    if(!dead)resolved.push(next);
   }
   states=resolved;
  }
  // An unconnected badge stays on the board as a non-paying symbol. Keep the
  // replacement draw for seed compatibility; only expanded reels conceal it.
  // A defeated persistent wild still reveals its ordinary underlying column.
  const activeReels=new Set(states.map(s=>s.reel));
  const resultRaw=raw.map((col,reel)=>col.map(s=>{
   if(s.name!=='VS')return s;
   const replacement={name:SYMBOLS[pick(r,8)]};
   return (!tier||tier==='regular')&&!activeReels.has(reel)?s:replacement;
  }));
  const board=applyWildReels(resultRaw,states);
  const shots=tier==='hidden'?addCrossfire(board,states,r,godPlan.quietCrossfire&&r()<.9):[];
  const evaluated=evaluate(board),win=Math.min(evaluated.payout,RULES.maxWin-total);total+=win;
  emit({type:'spin',tier,turn,totalSpins:spins,remaining:spins-turn,raw,underlying:resultRaw,before,landings,duels,states:copy(states),crossfire:shots,board,wins:evaluated.wins,win,totalWin:total,capped:total===RULES.maxWin});
  if(!tier||tier==='regular')states=[];
  if(total===RULES.maxWin)break;
 }
 if(tier)emit({type:'bonusEnd',tier,totalWin:total,capped:total===RULES.maxWin});
 return finish();
}

// One purchase, one guaranteed 2–5-reel reveal. Rare life-bearing fighters
// persist into free respins; no further purchase or replacement fighter is
// added during that round. Every award is evaluated from the displayed board.
export function makeDuelRound(seed){
 // Crossfire has its own deterministic draw stream, so adding shots does not
 // change the underlying reel or fight draws of subsequent life respins.
 const r=rng(seed),shotRandom=rng(seed^0x73A5D92B),fighterRandom=rng(seed^0x3C6EF372),events=[];let total=0;
 const count=2+pick(r,4),hasLives=r()<.15,reels=[0,1,2,3,4],initial=[];
 for(let id=1;id<=count;id++){
  const boss=r()<BOSS_CHANCE;
  initial.push({id,reel:reels.splice(pick(r,reels.length),1)[0],multiplier:boss?BOSS_VALUES[pick(fighterRandom,BOSS_VALUES.length)]:RIVAL_VALUES[pick(fighterRandom,RIVAL_VALUES.length)],lives:hasLives?RULES.lives:null,boss,fighter:boss?'boss':'hunter'});
 }
 let states=copy(initial);const limit=hasLives?1+RULES.duelRespins:1;
 for(let turn=1;turn<=limit;turn++){
  const raw=freshBoard(r),before=turn===1?[]:copy(states),landings=turn===1?states.map(s=>({...s,row:pick(r,5)})):[],duels=[];
  for(const landing of landings)raw[landing.reel][landing.row]={name:'VS'};
  const resolved=[];
  for(const state of states){
   const rival=RIVAL_VALUES[pick(r,RIVAL_VALUES.length)],won=r()<.53,boss=state.boss,regular=!hasLives;
   const next=regular?{...state,multiplier:winnerMultiplier(state.multiplier,rival,won),boss:boss&&won,fighter:won?(boss?'boss':'hunter'):'outlaw'}:resolveDuel(state,won,'super',rival);
   const dead=next.lives===0,uncappedTo=next.multiplier;
   duels.push({id:state.id,reel:state.reel,from:state.multiplier,to:next.multiplier,won,lives:next.lives,previousLives:state.lives,dead,regular,rival,boss,winnerBoss:boss&&won,stateBoss:next.boss,fighter:state.fighter,operation:dead?'hold':'keep',uncappedTo,multiplierCapped:uncappedTo>RULES.maxMultiplier});
   if(!dead)resolved.push(next);
  }
  states=resolved;
  const underlying=raw.map(col=>col.map(s=>s.name==='VS'?{name:SYMBOLS[pick(r,8)]}:s));
  const board=applyWildReels(underlying,states),sources=duelCrossfireSources(states);
  const shots=sources.length?addCrossfire(board,sources,shotRandom):[];
  const evaluated=evaluate(board),win=Math.min(evaluated.payout,RULES.maxWin-total);total+=win;
  const remaining=states.length?limit-turn:0;
  events.push({type:'spin',tier:null,feature:'duel',hasLives,initialReels:count,turn,totalSpins:limit,remaining,raw,underlying,before,landings,duels,states:copy(states),crossfire:shots,crossfireSources:sources.map(s=>s.id),board,wins:evaluated.wins,win,totalWin:total,capped:total===RULES.maxWin});
  if(!remaining||total===RULES.maxWin)break;
 }
 if(hasLives)events.push({type:'featureEnd',feature:'duel',totalWin:total,capped:total===RULES.maxWin});
 events.push({type:'finalWin',amount:total});return{events,payoutMultiplier:total};
}
