import {makeRound} from './math.js?v=god-pacing-71';
import {VERSION,MYSTERY_TIERS,SUPER_ANTE_MIX,quote,cashWin,poolOptions} from './config.js?v=ante124';
export function randomTicket(total,fill=n=>crypto.getRandomValues(n)){
 if(!Number.isSafeInteger(total)||total<1||total>4294967296)throw Error('Invalid ticket range.');
 const n=new Uint32Array(1),limit=Math.floor(4294967296/total)*total;
 do{fill(n);}while(n[0]>=limit);
 return n[0]%total;
}
const random=()=>randomTicket(1e9)/1e9;
export function pickEntry(pool,value){
 const target=value===undefined?randomTicket(pool.total):value*pool.total;let lo=0,hi=pool.entries.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(pool.entries[mid][1]>target)hi=mid;else lo=mid+1;}
 return pool.entries[lo];
}
export function chooseTier(mode,data,value=random()){
 if(mode==='bonus')return 'regular';if(mode==='super')return 'super';
 if(mode==='mystery'){
  let threshold=0;
  for(const [tier,probability] of Object.entries(MYSTERY_TIERS)){threshold+=probability;if(value<threshold)return tier;}
  return 'hidden';
 }
 if(mode==='superAnte'){
  if(value<SUPER_ANTE_MIX.super)return 'super';
  return value<1-SUPER_ANTE_MIX.enhanced?'hidden':null;
 }
 if(mode==='duel')return null;
 if(!['base','enhanced'].includes(mode))throw Error('Unknown mode.');
 let threshold=0;for(const [tier,p] of Object.entries(mode==='enhanced'?data.enhanced.natural:data.natural)){threshold+=p;if(value<threshold)return tier;}return null;
}
export async function createSession(){
 const params=new URLSearchParams(location.search);
 if(params.has('sessionID')||params.has('rgs_url'))throw Error('This build is the free-play prototype. An Engine release is not connected yet.');
 const response=await fetch('./outcomes.json?v=god-pacing-71');if(!response.ok)throw Error('The game outcomes could not load. Please reload.');
 const data=await response.json();if(data.version!==VERSION)throw Error('Game update available. Please reload.');let balance=10000e6,pending=null,serial=0;
 return {
  currency:'USD',demo:true,get balance(){return balance;},
  play(stake,mode='base',{preview=null}={}){
   if(pending)throw Error('The previous round is still being settled.');
   if(preview&&!['regular','super','hidden'].includes(preview))throw Error('Unknown preview.');
   const cost=preview?0:quote(stake,mode).cost;if(balance<cost)throw Error('Not enough demo credits. Lower your bet or reset credits in Settings.');
   const tier=preview||chooseTier(mode,data),pool=tier||(mode==='superAnte'?'enhanced':mode),entry=pickEntry(data.pools[pool]);
   const round=makeRound(entry[0],{...poolOptions(pool),trigger:!!tier});
   if(round.payoutMultiplier!==entry[2])throw Error('Outcome validation failed.');
   const win=cashWin(stake,round.payoutMultiplier),id=++serial;
   balance-=cost;pending={id,win,preview:!!preview};
   return {id,...round,tier,stake,cost,win,preview:!!preview,balance};
  },
  settle(id){if(!pending||pending.id!==id)throw Error('Round settlement mismatch.');if(!pending.preview)balance+=pending.win;pending=null;return balance;},
  reset(){if(pending)throw Error('Finish this round first.');balance=10000e6;return balance;}
 };
}
