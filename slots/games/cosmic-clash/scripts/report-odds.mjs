// Read the published ticket pools. This report never changes game weights.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RULES,MODES,MYSTERY_TIERS,SUPER_ANTE_MIX,poolOptions} from '../dist/config.js';
import {makeRound} from '../dist/math.js';
import {mixtureDistribution} from './distribution.mjs';
const source=await readFile(new URL('../dist/outcomes.json',import.meta.url));
const data=JSON.parse(source),report=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
const pools={};
for(const [tier,pool] of Object.entries(data.pools)){
 let previous=0,weightedPayout=0,hit=0,cap=0,atLeast100=0,atLeast500=0,atLeast1000=0,atLeast5000=0,highest=0,highestSeed;
 for(const [seed,cumulative,payout] of pool.entries){
  const weight=cumulative-previous;previous=cumulative;
  if(weight<=0||payout>RULES.maxWin)throw Error('Invalid outcome pool');
  weightedPayout+=weight*payout;
  if(payout>0)hit+=weight;
  if(payout===RULES.maxWin)cap+=weight;
  if(payout>=10000)atLeast100+=weight;
  if(payout>=50000)atLeast500+=weight;
  if(payout>=100000)atLeast1000+=weight;
  if(payout>=500000)atLeast5000+=weight;
  if(payout>highest){highest=payout;highestSeed=seed;}
 }
 if(previous!==pool.total)throw Error('Ticket total mismatch');
 const expected=makeRound(highestSeed,poolOptions(tier)).payoutMultiplier;
 if(expected!==highest)throw Error('Highest outcome did not replay');
 const result={meanWinX:weightedPayout/pool.total/100,anyPayout:hit/pool.total,maxWinProbability:cap/pool.total,atLeast100x:atLeast100/pool.total,atLeast500x:atLeast500/pool.total,atLeast1000x:atLeast1000/pool.total,atLeast5000x:atLeast5000/pool.total,highestAvailableX:highest/100};
 if(Math.abs(result.meanWinX-report.pools[tier].meanWinX)>1e-8||result.maxWinProbability!==report.pools[tier].maxWinProbability)throw Error('Math report mismatch');
 pools[tier]=result;
}
function mixture(mix){const result={};for(const key of ['meanWinX','anyPayout','maxWinProbability','atLeast100x','atLeast500x','atLeast1000x','atLeast5000x'])result[key]=Object.entries(mix).reduce((sum,[tier,p])=>sum+p*pools[tier][key],0);return result;}
const modes={
 base:{denominator:'One paid base spin, including its naturally triggered bonus',costX:MODES.base.cost,...mixture({base:data.plainProbability,...data.natural})},
 enhanced:{denominator:'One paid Enhanced Spin, including its naturally triggered bonus',costX:MODES.enhanced.cost,...mixture({enhanced:data.enhanced.plainProbability,...data.enhanced.natural})},
 superAnte:{denominator:'One paid Super Ante spin, including any Last Stand or God Mode bonus',costX:MODES.superAnte.cost,...mixture(SUPER_ANTE_MIX)},
 duel:{denominator:'One paid Duel Spin, including any free life respins',costX:MODES.duel.cost,...pools.duel},
 showdown:{denominator:'One complete Showdown bonus',costX:MODES.bonus.cost,...pools.regular},
 lastStand:{denominator:'One complete Last Stand bonus',costX:MODES.super.cost,...pools.super},
 mystery:{denominator:'One Mystery Buy, including all three possible bonus tiers',costX:MODES.mystery.cost,...mixture(MYSTERY_TIERS)},
 godMode:{denominator:'One God Mode bonus, conditional on already being awarded it',costX:null,...pools.hidden}
};
for(const mode of Object.values(modes)){mode.maxWinOneIn=mode.maxWinProbability?1/mode.maxWinProbability:null;mode.rtp=mode.costX?mode.meanWinX/mode.costX:null;}
const mixes={base:{base:data.plainProbability,...data.natural},enhanced:{enhanced:data.enhanced.plainProbability,...data.enhanced.natural},superAnte:SUPER_ANTE_MIX,duel:{duel:1},showdown:{regular:1},lastStand:{super:1},mystery:MYSTERY_TIERS,godMode:{hidden:1}};
for(const [name,mode] of Object.entries(modes))mode.distribution=mixtureDistribution(data,mixes[name],mode.costX||250);
const odds={modelVersion:report.version,outcomesSha256:createHash('sha256').update(source).digest('hex'),basis:'Theoretical integer ticket weights of the current free-play prototype. Multipliers are relative to base bet; bonus denominators refer to complete bonuses, not individual free spins.',maxWinX:RULES.maxWin/100,naturalBonusProbability:1-data.plainProbability,naturalBonusOneIn:1/(1-data.plainProbability),enhancedBonusProbability:1-data.enhanced.plainProbability,enhancedBonusOneIn:1/(1-data.enhanced.plainProbability),duelFeatures:{initialReels:report.pools.duel.initialReelProbabilities,livesProbability:report.pools.duel.livesProbability,crossfireRoundProbability:report.pools.duel.crossfireRoundProbability},modes};
// Compact, generated UI data. The game and audit use the same weighted outcomes.
const menuOdds={
 modelVersion:odds.modelVersion,
 outcomesSha256:odds.outcomesSha256,
 enhancedBonusOneIn:odds.enhancedBonusOneIn,
 crossfire:odds.duelFeatures.crossfireRoundProbability,
 modes:Object.fromEntries(Object.entries({enhanced:'enhanced',superAnte:'superAnte',duel:'duel',bonus:'showdown',super:'lastStand',mystery:'mystery'}).map(([key,name])=>{
  const row=modes[name];
  return [key,{profit:row.distribution.profit,maxWinOneIn:row.maxWinOneIn}];
 }))
};
await writeFile(new URL('../dist/shop-odds.js',import.meta.url),'// Generated by scripts/report-odds.mjs from the shipped outcomes.\nexport const shopOdds='+JSON.stringify(menuOdds,null,2)+';\n');
await writeFile(new URL('../math/odds.json',import.meta.url),JSON.stringify(odds,null,2)+'\n');
try{
 const baseline=JSON.parse(await readFile(new URL('../math/playability-baseline.json',import.meta.url),'utf8'));
 const comparison={beforeVersion:baseline.version,afterVersion:data.version,basis:'Exact complete-round ticket distributions. Returns below the paid cost are net losses. God Mode uses the 250x Mystery Buy price as a comparison reference, not a direct purchase price.',modes:Object.fromEntries(Object.entries(modes).map(([name,mode])=>[name,{before:baseline.modes[name],after:mode.distribution}]))};
 await writeFile(new URL('../math/playability-comparison.json',import.meta.url),JSON.stringify(comparison,null,2)+'\n');
}catch(error){if(error.code!=='ENOENT')throw error;}
console.log(JSON.stringify(odds,null,2));
