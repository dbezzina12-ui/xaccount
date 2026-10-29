// Stake Engine (Dylan, 2026-10-29). Engine launches the game as
//   index.html?sessionID=…&lang=…&device=…&rgs_url=…[&social=true]
// or, to show a past round, with replay=true&game=…&version=…&mode=…&event=….
// Without rgs_url the game is the free-play build and none of this runs.
//
// The RGS picks every outcome from the published math
// (tools/stake/zombify-export.mjs); the game only replays it
// (outcome-model.js roundFromBook). Money from the RGS is in millionths.
import {roundCostMultiplier} from './config.js';

// Engine's bet modes, in index.json order: Engine name -> the game's round kind.
export const STAKE_MODES=Object.freeze([
 ['base','base'],['enhanced','enhanced'],['outbreak','buy_outbreak'],['super','buy_super'],['mystery','buy_mystery'],['secondlife','buy_feature']
].map(([name,kind])=>Object.freeze({name,kind,cost:roundCostMultiplier(kind)})));
export const stakeMode=kind=>STAKE_MODES.find(m=>m.kind===kind);
export const MONEY=1000000;

export function stakeLaunch(search=globalThis.location?.search||''){
 const q=new URLSearchParams(search),rgs=q.get('rgs_url');
 if(!rgs)return null;
 const replay=q.get('replay')==='true'?{game:q.get('game'),version:q.get('version'),mode:q.get('mode'),event:q.get('event'),amount:Number(q.get('amount'))||MONEY,currency:q.get('currency')||'USD'}:null;
 return Object.freeze({rgsUrl:rgs.replace(/^https?:\/\//,'').replace(/\/$/,''),sessionID:q.get('sessionID')||'',lang:q.get('lang')||'en',device:q.get('device')||'',social:q.get('social')==='true',replay});
}

// The RGS's error codes, in words a player can act on.
const ERRORS={ERR_IPB:'Insufficient balance. Lower your bet or add funds.',ERR_IS:'Your session has expired. Please reload the game.',ERR_ATE:'Your session has expired. Please reload the game.',ERR_GLE:'Gambling limit reached.',ERR_LOC:'This game is not available in your location.',ERR_VAL:'The request was not accepted. Please try again.',ERR_MAINTENANCE:'The game is under maintenance. Please try again later.',ERR_GEN:'Something went wrong. Please try again.'};
export class StakeError extends Error{constructor(code,message){super(ERRORS[code]||message||ERRORS.ERR_GEN);this.code=code||'ERR_GEN';}}

export function createRgs(launch,fetcher=globalThis.fetch.bind(globalThis)){
 const call=async(path,body)=>{
  let response;
  try{response=await fetcher(`https://${launch.rgsUrl}${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{method:'GET'});}
  catch{throw new StakeError('ERR_GEN','Connection lost. Please check your connection and try again.');}
  let data=null;try{data=await response.json();}catch{}
  if(!response.ok||data?.error||data?.code&&/^ERR_/.test(data.code))throw new StakeError(data?.code||data?.error,data?.message);
  return data;
 };
 const session={sessionID:launch.sessionID};
 return {
  authenticate:()=>call('/wallet/authenticate',{...session,language:launch.lang}),
  balance:()=>call('/wallet/balance',session),
  play:(amount,mode)=>call('/wallet/play',{...session,amount,mode}),
  endRound:()=>call('/wallet/end-round',session),
  event:index=>call('/bet/event',{...session,event:String(index)}),
  replay:({game,version,mode,event})=>call(`/bet/replay/${game}/${version}/${mode}/${event}`)
 };
}

// Engine's currencies: symbol, decimals, symbol after the amount.
const CURRENCIES={USD:['$',2],CAD:['CA$',2],JPY:['¥',0],EUR:['€',2],RUB:['₽',2],CNY:['CN¥',2],PHP:['₱',2],INR:['₹',2],IDR:['Rp',0],KRW:['₩',0],BRL:['R$',2],MXN:['MX$',2],DKK:['KR',2,true],PLN:['zł',2,true],VND:['₫',0,true],TRY:['₺',2],CLP:['CLP',0,true],ARS:['ARS',2,true],PEN:['S/',2,true],XGC:['GC',2],XSC:['SC',2]};
// Amounts in the game are hundredths of a currency unit.
export function moneyFormatter(currency){
 const [symbol,decimals,after]=CURRENCIES[currency]||[currency,2,true];
 return hundredths=>{
  const text=(hundredths/100).toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
  return after?`${text} ${symbol}`:`${symbol}${text}`;
 };
}

// Stake.us (social=true) words: no betting or buying language.
export const SOCIAL_WORDS=Object.freeze([
 [/\bBUY BONUS\b/g,'PLAY BONUS'],[/\bBUY FREE SPINS\b/g,'PLAY FREE SPINS'],[/\bBUY MYSTERY\b/g,'PLAY MYSTERY'],[/\bCONFIRM BUY\b/g,'CONFIRM'],
 [/\bBONUS BOUGHT\b/g,'BONUS STARTED'],[/\bBUY\b/g,'PLAY'],[/\bBuy\b/g,'Play'],[/\bbuy\b/g,'play'],
 [/\bBASE BET\b/g,'BASE PLAY'],[/\bBET\b/g,'PLAY'],[/\bBet\b/g,'Play'],[/\bbet\b/g,'play'],[/\bWAGER(ED)?\b/g,'PLAYED']
]);
export const socialText=text=>SOCIAL_WORDS.reduce((t,[pattern,word])=>t.replace(pattern,word),text);
