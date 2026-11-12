import {splitZeroGroups,splitCapGroups,mediumWeights} from './calibrate-medium.mjs';
import {distribution} from './distribution.mjs';
import {createHash} from 'node:crypto';
import {correctBaseRounding} from './rounding.mjs';
import {makeRound} from '../dist/math.js';
import {RULES,VERSION,MODES,SUPER_ANTE_MIX,MYSTERY_TIERS,poolOptions} from '../dist/config.js';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
// The stronger God Mode needs a larger candidate catalogue to retain varied
// boards while preserving its 70% additional-reel and 20% Boss frequencies.
const sizes={base:20000,enhanced:20000,duel:20000,regular:12000,super:14000,hidden:240000};
const targets={regular:96,super:240,hidden:816,duel:48};
// One natural bonus per 250 paid base spins; preserve the existing tier mix.
const natural=Object.fromEntries(Object.entries({regular:2700,super:330,hidden:27}).map(([tier,weight])=>[tier,.004*weight/3057]));
const plainProbability=1-Object.values(natural).reduce((a,b)=>a+b,0);
const enhancedNatural=Object.fromEntries(Object.entries(natural).map(([tier,p])=>[tier,p*3]));
const enhancedPlain=1-Object.values(enhancedNatural).reduce((a,b)=>a+b,0);
targets.enhanced=(2.88-Object.entries(enhancedNatural).reduce((sum,[k,p])=>sum+p*targets[k],0))/enhancedPlain;
targets.base=(.96-Object.entries(natural).reduce((s,[k,p])=>s+p*targets[k],0))/plainProbability;
// Whole-round Boss appearances are protected during payout calibration. They
// count actual fights, not a missed badge or a raw candidate-generation roll.
const bossMix={base:.008,enhanced:.008,regular:.25,super:.20,hidden:.20};
const duelReelMix={2:.82,3:.16,4:.019,5:.001},duelLivesProbability=.01;
const capTickets={duel:20000,regular:10000,super:40000,hidden:5104034}; // Preserve whole-round cap frequencies.
const hiddenStartMix=[.10,.15,.15,.30,.30];
const hiddenReelMix={1:.30,2:.65,3:.045,4:.0045,5:.0005};
const totalTickets=1e9;
const zeroRates={base:.45,enhanced:.35,duel:.10,regular:0,super:0,hidden:0};
const coverTargets={base:.25,enhanced:.22,duel:.45,regular:.45,super:.45};
const spread={base:.80,enhanced:.75,duel:.60,regular:.65,super:.65,hidden:.30};
const costBasis={base:1,enhanced:3,duel:50,regular:100,super:250,hidden:250};
// Optional incremental pass: reuse weights only when every regenerated seed
// and payout matches, then run the same return/feature validation below.
const reuseMatching=process.argv.includes('--reuse-matching');
const refit=new Set(process.argv.find(arg=>arg.startsWith('--refit='))?.slice(8).split(',')||[]);
let previousPools={};
if(reuseMatching){const previous=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url),'utf8'));previousPools=previous.pools;}
const cachePath=process.argv.find(arg=>arg.startsWith('--cache='))?.slice(8);
const signature=createHash('sha256').update(await readFile(new URL('../dist/config.js',import.meta.url))).update(await readFile(new URL('../dist/math.js',import.meta.url))).digest('hex');
let cache={signature,pools:{}};
if(cachePath){try{const saved=JSON.parse(await readFile(cachePath,'utf8'));if(saved.signature===signature)cache=saved;}catch{}}

const pool={},report={version:VERSION,method:'50 fixed paylines. Winner-keeps ordinary duels, stronger symbol pays, more ordinary-spin return and explicit cost-recovery targets. Protected max-win frequencies, Boss appearances, God Mode reel counts and Duel Spin reel/life frequencies. Prototype model; not certified.',limits:{maxWinX:RULES.maxWin/100,normalReelMultiplier:RULES.maxMultiplier,godReelMultiplier:RULES.godMaxMultiplier},natural,enhanced:{natural:enhancedNatural,plainProbability:enhancedPlain},pools:{},modes:{}};
for(const [tier,size] of Object.entries(sizes)){
 let entries=cache.pools[tier];
 if(!entries||entries.length!==size){
 entries=entries?.slice(0,size)||[];
 for(let seed=entries.length+1;seed<=size;seed++){
  const round=makeRound(seed,poolOptions(tier)),spins=round.events.filter(e=>e.type==='spin');
  const maxReels=['hidden','duel'].includes(tier)?Math.max(...spins.map(e=>e.states.length)):0,hasBoss=spins.some(e=>e.duels.some(d=>d.boss)),hasLives=!!spins[0].hasLives;
  const first=spins[0],connected=new Set(first.wins.filter(w=>!w.word).flatMap(w=>w.positions.map(p=>p.reel))),connectedReels=first.states.filter(s=>connected.has(s.reel)).length;
  entries.push({seed,payout:round.payoutMultiplier,maxReels,hasBoss,hasLives,...(tier==='hidden'?{startReel:round.events[0].states[0].reel,firstAdditional:spins.find(e=>e.landings.length)?.turn??null}:{}),...(tier==='duel'?{hasCrossfire:spins.some(e=>e.crossfire.length>0),connectedReels,connectionScore:connectedReels/first.states.length}: {})});
  if(tier==='hidden'&&seed%50000===0)console.log(`God Mode candidates: ${seed}/${size}`);
 }
 cache.pools[tier]=entries;if(cachePath)await writeFile(cachePath,JSON.stringify(cache));
 }
 const target=targets[tier]*100;let groups=[];
 const indexed=entries.map((e,i)=>({i,...e}));
 const addGroup=(items,tickets)=>{
  if(!items.length)throw Error(`No ${tier} candidates for protected group`);
  groups.push({tickets,items});
 };
 if(tier==='duel'){
  for(const [count,mass] of Object.entries(duelReelMix))for(const hasLives of [false,true])
   addGroup(indexed.filter(e=>e.maxReels===Number(count)&&e.hasLives===hasLives),Math.round(totalTickets*mass*(hasLives?duelLivesProbability:1-duelLivesProbability)));
 }else{
  for(const [count,mass] of Object.entries(tier==='hidden'?hiddenReelMix:{0:1}))for(const boss of [false,true]){
   if(tier==='hidden')for(let reel=0;reel<5;reel++)addGroup(indexed.filter(e=>e.maxReels===Number(count)&&e.hasBoss===boss&&e.startReel===reel),Math.round(totalTickets*mass*(boss?bossMix[tier]:1-bossMix[tier])*hiddenStartMix[reel]));
   else addGroup(indexed.filter(e=>e.maxReels===Number(count)&&e.hasBoss===boss),Math.round(totalTickets*mass*(boss?bossMix[tier]:1-bossMix[tier])));
  }
 }
 function mean(w){return entries.reduce((s,e,i)=>s+e.payout*w[i],0)/w.reduce((a,b)=>a+b,0);}
 const zeroTickets=Math.max(Math.round(zeroRates[tier]*totalTickets),entries.filter(e=>e.payout===0).length);
 if(capTickets[tier])groups=splitCapGroups(groups,capTickets[tier],RULES.maxWin);
 groups=splitZeroGroups(groups,zeroTickets);
 const prior=previousPools[tier];
 const identical=prior?.entries.length===entries.length&&prior.total===totalTickets&&entries.every((e,i)=>e.seed===prior.entries[i][0]&&e.payout===prior.entries[i][2]);
 let w;
 if(identical&&!refit.has(tier)){let previous=0;w=prior.entries.map(([,cumulative])=>{const weight=cumulative-previous;previous=cumulative;return weight;});if(Math.abs(mean(w)/100-targets[tier])>.000001)w=null;}
 if(!w){
 const ideal=mediumWeights(entries,groups,{target,sigma:spread[tier],maximum:totalTickets*(tier==='hidden'?.002:.008),cost:costBasis[tier]*100,targetCover:coverTargets[tier]??null,largerTilt:tier==='duel'?1.2:0,connectionTilt:tier==='duel'?2:0});
 w=Array(entries.length).fill(0);
 // Reserve at least one ticket per seed. Largest remainders preserve the exact
 // Boss and reel-count mix; no adjustment ever happens during a player's round.
 for(const group of groups){
  const allocation=group.items.map(e=>({i:e.i,value:Math.floor(ideal[e.i]),fraction:ideal[e.i]-Math.floor(ideal[e.i])}));
  const remainder=group.tickets-allocation.reduce((s,e)=>s+e.value,0);
  allocation.sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
  allocation.forEach((e,i)=>{w[e.i]=e.value+(i<remainder?1:0);});
 }
 correctBaseRounding(entries,w,groups,target*totalTickets);
 }
 const total=w.reduce((a,b)=>a+b,0),actual=mean(w)/100;
 if(total!==totalTickets||Math.abs(actual-targets[tier])>.005)throw Error(`${tier}: calibration did not converge: ${actual}`);
 let cumulative=0;pool[tier]={total,entries:entries.map(({seed,payout},i)=>[seed,cumulative+=w[i],payout])};
 const cap=entries.reduce((s,e,i)=>s+(e.payout===RULES.maxWin?w[i]:0),0)/total;
 report.pools[tier]={rounds:size,meanWinX:actual,hitRate:entries.reduce((s,e,i)=>s+(e.payout>0?w[i]:0),0)/total,maxWinProbability:cap,maxWinOneIn:cap?1/cap:null};
 const bossProbability=entries.reduce((s,e,i)=>s+(e.hasBoss?w[i]:0),0)/total;
 if(tier!=='duel'&&Math.abs(bossProbability-bossMix[tier])>1e-12)throw Error(`${tier}: Boss frequency drift`);
 report.pools[tier].distribution=distribution(pool[tier],costBasis[tier]);
 if(report.pools[tier].distribution.bands.zero!==zeroTickets/totalTickets)throw Error(`${tier}: zero-return target drift`);
 if(coverTargets[tier]!==undefined&&Math.abs(report.pools[tier].distribution.coversCost-coverTargets[tier])>.00001)throw Error(`${tier}: cost-recovery target drift`);
 report.pools[tier].bossRoundProbability=bossProbability;
 report.pools[tier].bossRoundOneIn=1/bossProbability;
 if(capTickets[tier]&&cap!==capTickets[tier]/totalTickets)throw Error(`${tier}: maximum-win frequency drift`);
 if(tier==='duel'){
  report.pools.duel.initialReelProbabilities=Object.fromEntries(Object.keys(duelReelMix).map(count=>[count,entries.reduce((sum,e,i)=>sum+(e.maxReels===Number(count)?w[i]:0),0)/total]));
  for(const [count,mass] of Object.entries(duelReelMix))if(report.pools.duel.initialReelProbabilities[count]!==mass)throw Error('Duel reel frequency drift');
  report.pools.duel.crossfireRoundProbability=entries.reduce((sum,e,i)=>sum+(e.hasCrossfire?w[i]:0),0)/total;
  report.pools.duel.openingConnections={anyWildPays:entries.reduce((sum,e,i)=>sum+(e.connectedReels>0?w[i]:0),0)/total,allWildsPay:entries.reduce((sum,e,i)=>sum+(e.connectedReels===e.maxReels?w[i]:0),0)/total,bothWildsPayGivenTwo:entries.reduce((sum,e,i)=>sum+(e.maxReels===2&&e.connectedReels===2?w[i]:0),0)/(total*duelReelMix[2])};
  report.pools.duel.livesProbability=entries.reduce((sum,e,i)=>sum+(e.hasLives?w[i]:0),0)/total;
  if(report.pools.duel.livesProbability!==duelLivesProbability||!cap)throw Error('Duel Spin feature coverage failed');
 }
 if(tier==='hidden'){
  const reelProbabilities={};for(const count of Object.keys(hiddenReelMix))reelProbabilities[count]=entries.reduce((s,e,i)=>s+(e.maxReels===Number(count)?w[i]:0),0)/total;
  report.pools[tier].maxDuelReelProbabilities=reelProbabilities;
  report.pools[tier].additionalDuelProbability=1-reelProbabilities[1];
  report.pools[tier].startingReelProbabilities=Array.from({length:5},(_,reel)=>entries.reduce((s,e,i)=>s+(e.startReel===reel?w[i]:0),0)/total);
  report.pools[tier].firstAdditionalBySpin=Object.fromEntries(Array.from({length:10},(_,i)=>[i+1,entries.reduce((s,e,n)=>s+(e.firstAdditional===i+1?w[n]:0),0)/total]));
  if(report.pools[tier].startingReelProbabilities.some((p,reel)=>p!==hiddenStartMix[reel]))throw Error('God Mode starting reel frequency drift');
  if(entries.some(e=>e.firstAdditional!==null&&e.firstAdditional>6))throw Error('God Mode additional reels must begin by spin six');
  report.pools[tier].effectiveOutcomeCount=total*total/w.reduce((s,n)=>s+n*n,0);
  report.pools[tier].mostLikelyOutcomeProbability=w.reduce((a,b)=>Math.max(a,b),0)/total;
  if(report.pools[tier].effectiveOutcomeCount<400||report.pools[tier].mostLikelyOutcomeProbability>.01)throw Error(`God Mode calibration is too concentrated: ${JSON.stringify(report.pools[tier])}`);
 }
 console.log(tier,report.pools[tier]);
}
const p=report.pools;
report.modes.base={cost:1,rtp:plainProbability*p.base.meanWinX+Object.entries(natural).reduce((s,[k,v])=>s+v*p[k].meanWinX,0)};
report.modes.enhanced={cost:3,rtp:(enhancedPlain*p.enhanced.meanWinX+Object.entries(enhancedNatural).reduce((sum,[k,v])=>sum+v*p[k].meanWinX,0))/3,bonusChanceMultiplier:3};
report.modes.superAnte={
 cost:MODES.superAnte.cost,
 rtp:Object.entries(SUPER_ANTE_MIX).reduce((sum,[pool,probability])=>sum+p[pool].meanWinX*probability,0)/MODES.superAnte.cost
};
report.modes.duel={cost:50,rtp:p.duel.meanWinX/50};
report.modes.bonus={cost:100,rtp:p.regular.meanWinX/100};
report.modes.super={cost:250,rtp:p.super.meanWinX/250};
report.modes.mystery={cost:250,rtp:Object.entries(MYSTERY_TIERS).reduce((total,[tier,probability])=>total+p[tier].meanWinX*probability,0)/250,probabilities:MYSTERY_TIERS};
await mkdir(new URL('../math/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/outcomes.json',import.meta.url),JSON.stringify({version:VERSION,natural,plainProbability,enhanced:{natural:enhancedNatural,plainProbability:enhancedPlain},pools:pool}));
await writeFile(new URL('../dist/math-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('../math/report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('Mode RTP',report.modes);
