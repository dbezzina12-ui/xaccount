// Exact offline audit of the shipped tickets; no simulated confidence claim.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BETS,VERSION} from '../dist/config.js';
const data=JSON.parse(await readFile(new URL('../dist/outcomes.json',import.meta.url)));
const odds=JSON.parse(await readFile(new URL('../math/odds.json',import.meta.url)));
const baseline=JSON.parse(await readFile(new URL('../math/max-win-baseline.json',import.meta.url)));
const mixes={base:{base:data.plainProbability,...data.natural},enhanced:{enhanced:data.enhanced.plainProbability,...data.enhanced.natural},duel:{duel:1},showdown:{regular:1},lastStand:{super:1},mystery:{regular:.4,super:.5,hidden:.1}};
const audit={version:VERSION,basis:'Exact complete-round probabilities from the prototype ticket pools. God Mode is conditional, not a directly purchasable mode. This is a local mathematical check, not Engine certification or approval.',guidanceSource:'https://stake-engine.com/docs/approval-guidelines/math-verification',guidanceReadDate:'2026-09-10',maxBaseBet:BETS.at(-1),maximumCashPayout:BETS.at(-1)*odds.maxWinX,maximumRoundCost:BETS.at(-1)*250,preservedPools:{},modes:{}};
for(const name of ['base','enhanced','hidden']){
 const hash=createHash('sha256').update(JSON.stringify(data.pools[name])).digest('hex');
 audit.preservedPools[name]=hash===baseline.poolHashes[name];
 if(!audit.preservedPools[name])throw Error(`Unrequested ${name} pool change`);
}
for(const [name,mix] of Object.entries(mixes)){
 const current=odds.modes[name],before=baseline.odds.modes[name],cost=current.costX,entries=[];
 let second=0,maxOutcomeProbability=0,returnAbove40Cost=0,returnAbove10000=0;
 for(const [tier,chance] of Object.entries(mix)){let previous=0;for(const [,cumulative,payout] of data.pools[tier].entries){const probability=(cumulative-previous)/data.pools[tier].total*chance,x=payout/100;previous=cumulative;
  entries.push([x,probability]);second+=x*x*probability;maxOutcomeProbability=Math.max(maxOutcomeProbability,probability);
  if(x>40*cost)returnAbove40Cost+=x*probability;if(x>10000)returnAbove10000+=x*probability;
 }}
 entries.sort((a,b)=>b[0]-a[0]);let remaining=.001,tail=0;
 for(const [x,p]of entries){const used=Math.min(remaining,p);tail+=used*x;remaining-=used;if(remaining<=1e-15)break;}
 const cvar=tail/.001,baseStdDev=Math.sqrt(Math.max(0,second-current.meanWinX**2));
 audit.modes[name]={costX:cost,rtp:current.rtp,maxWinOneIn:current.maxWinOneIn,maxWinRtpPercentagePoints:100*odds.maxWinX*current.maxWinProbability/cost,
  before:{maxWinOneIn:before.maxWinOneIn,medianWinX:before.distribution.medianWinX,coversCost:before.distribution.coversCost,profit:before.distribution.profit},
  after:{medianWinX:current.distribution.medianWinX,coversCost:current.distribution.coversCost,profit:current.distribution.profit},
  thresholdProbabilities:Object.fromEntries([500,1000,5000].map(x=>[x,current[`atLeast${x}x`]])),
  rawStandardDeviation:baseStdDev,standardDeviationPerCost:baseStdDev/cost,cvarWorstPointOnePercent:cvar,cvarPerCost:cvar/cost,
  returnAbove40CostShare:returnAbove40Cost/current.meanWinX,returnAbove10000Share:returnAbove10000/current.meanWinX,
  p5000:current.atLeast5000x,p10000:entries.reduce((s,[x,p])=>s+(x>=10000?p:0),0),mostLikelyOutcomeProbability:maxOutcomeProbability,
  checks:{rtpBand:current.rtp>=.9&&current.rtp<=.967,maxWinGuidance:current.maxWinOneIn<1e7,nonzeroProbability:current.anyPayout>=.02,cvarPerCost:cvar/cost<=700,cvarAbsoluteTwoStar:cvar<=20000,cvarAbsoluteThreeStar:cvar<=50000,baseVolatility:name!=='base'||baseStdDev>=.6&&baseStdDev<=50,tail5000TwoStar:current.atLeast5000x<=.01,tail10000TwoStar:entries.reduce((s,[x,p])=>s+(x>=10000?p:0),0)<=.005,tailReturn40CostTwoStar:returnAbove40Cost/current.meanWinX<=.8,tailReturn10000TwoStar:returnAbove10000/current.meanWinX<=.6,tailReturnSumTwoStar:(returnAbove40Cost+returnAbove10000)/current.meanWinX<=1.3}
 };
 if(Math.abs(current.rtp-.96)>1e-6)throw Error(`${name} RTP changed`);
 if(Object.values(audit.modes[name].checks).some(p=>!p))throw Error(`${name} mathematical check failed`);
}
audit.requestedBetExposure={twoStarStartingExposureFits:audit.maximumCashPayout<=15000000,twoStarStartingRoundCostFits:audit.maximumRoundCost<=100000,threeStarStartingExposureFits:audit.maximumCashPayout<=50000000,threeStarStartingRoundCostFits:audit.maximumRoundCost<=500000,note:'The $500 prototype base bet means a $125,000 highest-priced purchase and $12.5 million cap. It exceeds the published 2-Star starting round-cost allowance, but fits the 3-Star starting cost/exposure allowances before other review adjustments. Engine assigns the actual production bet template.'};
await writeFile(new URL('../math/max-win-comparison.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({version:audit.version,preservedPools:audit.preservedPools,modes:Object.fromEntries(Object.entries(audit.modes).map(([k,v])=>[k,{maxWinOneIn:v.maxWinOneIn,rtp:v.rtp,median:v.after.medianWinX,cvarPerCost:v.cvarPerCost}])),requestedBetExposure:audit.requestedBetExposure},null,2));
