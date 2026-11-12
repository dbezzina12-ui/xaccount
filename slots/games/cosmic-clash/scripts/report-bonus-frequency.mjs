import {readFile,writeFile} from 'node:fs/promises';
const before=JSON.parse(await readFile(new URL('../math/bonus-frequency-baseline.json',import.meta.url)));
const after=JSON.parse(await readFile(new URL('../dist/math-report.json',import.meta.url)));
const allocation=r=>{
 const chance=Object.values(r.natural).reduce((sum,p)=>sum+p,0);
 const bonusReturn=Object.entries(r.natural).reduce((sum,[tier,p])=>sum+p*r.pools[tier].meanWinX,0);
 return {naturalBonusOneIn:1/chance,enhancedBonusOneIn:1/(chance*3),bonusShareOfReturn:bonusReturn/r.modes.base.rtp};
};
const select=p=>({anyPayout:p.hitRate,coversCost:p.distribution.coversCost,profit:p.distribution.profit,meanWinX:p.meanWinX,medianWinX:p.distribution.medianWinX,largeShareOfReturn:p.distribution.largeShareOfReturn,...(p.openingConnections?{openingConnections:p.openingConnections}: {})});
const result={beforeVersion:before.version,afterVersion:after.version,basis:'Exact weighted complete-round distributions. Base and Enhanced pool metrics exclude triggered bonuses. Opening connection metrics count ordinary paylines using each Duel reel on the opening spin; different wilds may contribute to different lines. No per-player changes.',allocation:{before:allocation(before),after:allocation(after)},pools:Object.fromEntries(Object.keys(after.pools).map(k=>[k,{before:select(before.pools[k]),after:select(after.pools[k])}])),modeRtp:after.modes};
await writeFile(new URL('../math/bonus-frequency-comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
