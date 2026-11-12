// Exact weighted probabilities, conditional on receiving God Mode.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const [before,report,data]=await Promise.all([read('../math/god-pacing-baseline.json'),read('../dist/math-report.json'),read('../dist/outcomes.json')]);
const after=report.pools.hidden;
const preservedPools=Object.fromEntries(['base','enhanced','duel','regular','super'].map(name=>[name,createHash('sha256').update(JSON.stringify(data.pools[name])).digest('hex')===before.poolHashes[name]]));
if(Object.values(preservedPools).some(value=>!value))throw Error('An unrelated outcome pool changed');
const extra=Object.entries(after.firstAdditionalBySpin).reduce((sum,[turn,p])=>sum+Number(turn)*p,0)/after.additionalDuelProbability;
const comparison={beforeVersion:before.version,afterVersion:report.version,
 basis:'Exact integer-ticket probabilities of complete God Mode bonuses. The 250x cost-recovery reference is the Mystery Buy price, not a direct God Mode purchase. No player inputs enter calibration.',
 preservedPools,
 before:{...before.hidden,startingReelProbabilities:before.startingReelProbabilities,forcedLastSpinArrivalProbability:before.forcedLastSpinArrivalProbability},
 after:{...after,meanFirstAdditionalSpinGivenAdditional:extra},
 modes:report.modes,
 mystery:{godMaxWinOneIn:1/(.1*after.maxWinProbability),allTierMaxWinOneIn:1/(.4*report.pools.regular.maxWinProbability+.5*report.pools.super.maxWinProbability+.1*after.maxWinProbability)},
};
await writeFile(new URL('../math/god-pacing-comparison.json',import.meta.url),JSON.stringify(comparison,null,2)+'\n');
console.log(JSON.stringify({preservedPools,god:comparison.after,mystery:comparison.mystery},null,2));
