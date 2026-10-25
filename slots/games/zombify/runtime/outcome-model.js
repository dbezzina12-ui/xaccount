import {makeRound,seeded,CAP} from './math.js';
import {BONUS_FEATURES,PREVIEW_MODES} from './config.js';
import data from './outcomes.js';
import featureData from './feature-outcomes.js';
import {makeFeatureRound} from './feature-spin.js';

export const MODEL_VERSION='zombify-96-v1';
// Rejection of the uneven uint32 tail avoids modulo bias in rare events.
export function randomTicket(total,fill=n=>crypto.getRandomValues(n)){
 if(!Number.isSafeInteger(total)||total<1||total>2**32)throw Error('Invalid ticket range');
 const n=new Uint32Array(1),limit=Math.floor(2**32/total)*total;
 do{fill(n);}while(n[0]>=limit);
 return n[0]%total;
}
export function ticket(total,rng){
 if(!rng)return randomTicket(total);
 const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw Error('Invalid random draw');
 return Math.floor(value*total);
}
export function pickEntry(pool,rng){
 const value=ticket(pool.total,rng);let lo=0,hi=pool.entries.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(pool.entries[mid][1]>value)hi=mid;else lo=mid+1;}
 return pool.entries[lo];
}
export function choosePaidTier(kind,rng){
 if(kind==='buy_outbreak')return 'regular';
 if(kind==='buy_super')return 'super';
 if(kind==='buy_mystery'){const n=ticket(10,rng);return n<4?'regular':n<9?'super':'hidden';}
 if(!['base','enhanced'].includes(kind))throw Error('Unknown round type');
 // Separate integer draws give exact 1/275 or 1/50 entry and 90/9/1 tiers.
 if(ticket(kind==='enhanced'?50:275,rng)!==0)return null;
 const n=ticket(100,rng);return n<90?'regular':n<99?'super':'hidden';
}
// The free Super and Hidden previews play a real bonus: a trigger spin and a
// bonus drawn from the same catalogs, replayed and checked exactly as a
// natural bonus is (S-28). The scripted demonstrations in math.js
// (makeRound kind preview_*) land a super zombie in nearly every free spin;
// the game replayed them with one fixed seed, so every Super preview paid
// 6,949.56x and every Hidden preview the 25,000x cap, against real averages
// of 240x and 816x. Previews still never touch credits (session.js).
export const CATALOG_PREVIEWS=Object.freeze({preview_super:'super',preview_hidden:'hidden'});
function catalogPreview(tier,rng){
 if(data.version!==MODEL_VERSION)throw Error('Game update required. Please reload.');
 const entry=pickEntry(data.pools[tier],rng),trigger=pickEntry(data.pools[`entry_${tier}`],rng);
 const expected=Math.min(CAP,entry[2]+trigger[2]);
 const result=makeRound({kind:'base',rng:seeded(trigger[0]),forcedScatters:BONUS_FEATURES[tier].scatters,bonusRng:seeded(entry[0]),clustered:!!entry[4]});
 if(result.total!==expected)throw Error('Outcome validation failed.');
 return result;
}
export function makePaidRound({kind='base',rng}={}){
 if(Object.hasOwn(CATALOG_PREVIEWS,kind))return catalogPreview(CATALOG_PREVIEWS[kind],rng);
 if(kind==='preview_feature')return makeFeatureRound({...(rng?{rng}:{})});
 if(kind==='buy_feature'){
  if(featureData.version!=='second-life-v2')throw Error('Game update required. Please reload.');
  const entry=pickEntry(featureData.pool,rng),result=makeFeatureRound({rng:seeded(entry[0])});
  if(result.total!==entry[2]||result.hearts!==entry[3]||result.spins!==entry[4])throw Error('Outcome validation failed. No credits were charged.');
  return result;
 }
 if(PREVIEW_MODES.includes(kind))return makeRound({kind,...(rng?{rng}:{})});
 if(data.version!==MODEL_VERSION)throw Error('Game update required. Please reload.');
 const tier=choosePaidTier(kind,rng),entry=pickEntry(data.pools[tier||kind],rng);
 let result,expected=entry[2];
 if(!tier){
  result=makeRound({kind,rng:seeded(entry[0]),forcedScatters:entry[3],baseOnly:true});
 }else if(kind.startsWith('buy_')){
  result=makeRound({kind,rng:seeded(entry[0]),forcedTier:tier,clustered:!!entry[4]});
 }else{
  const trigger=pickEntry(data.pools[`entry_${tier}`],rng);
  expected=Math.min(CAP,expected+trigger[2]);
  result=makeRound({kind,rng:seeded(trigger[0]),forcedScatters:BONUS_FEATURES[tier].scatters,bonusRng:seeded(entry[0]),clustered:!!entry[4]});
 }
 if(result.total!==expected)throw Error('Outcome validation failed. No credits were charged.');
 return result;
}
