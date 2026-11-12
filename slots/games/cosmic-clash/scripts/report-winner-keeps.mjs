// Reproducible before/after figures from complete fixed ticket pools.
import {readFile,writeFile} from 'node:fs/promises';
const before=JSON.parse(await readFile(new URL('../math/winner-keeps-baseline.json',import.meta.url)));
const after=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
const allocation=report=>{
 const chance=Object.values(report.natural).reduce((sum,p)=>sum+p,0);
 const bonus=Object.entries(report.natural).reduce((sum,[tier,p])=>sum+p*report.pools[tier].meanWinX,0);
 return {bonusProbability:chance,bonusOneIn:1/chance,enhancedBonusOneIn:1/(3*chance),bonusShareOfBaseReturn:bonus/report.modes.base.rtp,ordinaryShareOfBaseReturn:1-bonus/report.modes.base.rtp};
};
const select=p=>({meanWinX:p.meanWinX,anyPayout:p.distribution.anyPayout,coversCost:p.distribution.coversCost,profit:p.distribution.profit,medianWinX:p.distribution.medianWinX,mediumProbability:p.distribution.mediumProbability,maxWinOneIn:p.maxWinOneIn});
const comparison={beforeVersion:before.version,afterVersion:after.version,basis:'Exact fixed-pool complete-round probabilities. Base and Enhanced pool figures exclude naturally triggered bonus rounds. Bonus pools compare complete bonuses with their purchase prices; God Mode has no direct buy, and uses 250x only as a reference. All amounts are multiples of the base bet. A return below the paid price is a net loss.',allocation:{before:allocation(before),after:allocation(after)},pools:Object.fromEntries(Object.keys(after.pools).map(name=>[name,{costX:after.pools[name].distribution.costX,before:select(before.pools[name]),after:select(after.pools[name])}])),modeRtp:Object.fromEntries(Object.keys(after.modes).map(name=>[name,{before:before.modes[name].rtp,after:after.modes[name].rtp}]))};
await writeFile(new URL('../math/winner-keeps-comparison.json',import.meta.url),JSON.stringify(comparison,null,2)+'\n');
console.log(JSON.stringify({allocation:comparison.allocation,pools:comparison.pools,modeRtp:comparison.modeRtp},null,2));
