// The game's session (session.js's interface) on Stake Engine's RGS: the
// balance, bet levels and every outcome come from Engine. Amounts here are
// hundredths of a currency unit, as in the free-play session; the RGS's are
// millionths. begin and finish are asynchronous (they call the RGS).
import {roundFromBook} from './outcome-model.js';
import {FEATURE_SPIN,SPIN_MODES,PREVIEW_MODES} from './config.js';
import {MONEY,STAKE_MODES,stakeMode,StakeError} from './stake.js';

const hundredths=micro=>micro/(MONEY/100);
const micro=amount=>Math.round(amount*(MONEY/100));

// The RGS sends the book's events as round.state; its payoutMultiplier may be
// the book's whole hundredths or a plain multiple of the bet.
export function replayStakeRound(kind,round){
 const m=Number(round?.payoutMultiplier),candidates=new Set([m,Math.round(m*100)]);
 if(!Number.isFinite(m)&&round?.amount)candidates.add(Math.round(round.payout/round.amount*100));
 for(const payoutMultiplier of candidates){
  try{return roundFromBook(kind,{events:round.state,payoutMultiplier});}
  catch(error){if(error.message!=='Outcome validation failed.')throw error;}
 }
 throw new StakeError('ERR_GEN','This round could not be shown. Please reload the game.');
}

export function createStakeSession(rgs,{now=()=>performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const bets=[];
 let balance=0,betIndex=0,spinMode='base',active=null,lastWin=0,config={},resume=null,started=0,replayData=null;
 return {
  bets,currency:'USD',
  get jurisdiction(){return config.jurisdiction||{};},
  // Authenticate: balance, bet levels, rules and any round left unfinished.
  async connect(){
   const data=await rgs.authenticate();
   balance=data.balance?.amount??0;this.currency=data.balance?.currency||'USD';config=data.config||{};
   const levels=(config.betLevels?.length?config.betLevels:[config.defaultBetLevel||config.minBet||MONEY]).filter(l=>l>=(config.minBet??0)&&l<=(config.maxBet??Infinity));
   bets.splice(0,bets.length,...levels.map(hundredths));
   const wanted=data.round?.amount||config.defaultBetLevel||levels[0];
   betIndex=levels.reduce((best,l,i)=>Math.abs(l-wanted)<Math.abs(levels[best]-wanted)?i:best,0);
   if(data.round?.active&&data.round.state?.length)resume=data.round;
   return data;
  },
  // A round the player left unfinished, replayed and settled like a new one.
  takeResume(){
   const round=resume;resume=null;if(!round)return null;
   const mode=STAKE_MODES.find(m=>m.name===String(round.mode).toLowerCase())||STAKE_MODES[0];
   const bet=hundredths(round.amount)||bets[betIndex];
   active={result:replayStakeRound(mode.kind,round),bet,cost:Math.round(bet*mode.cost),kind:mode.kind,preview:false,stake:round,resumed:true};
   started=now();return active;
  },
  // A past round shown read-only (Engine's replay link), fetched once.
  async replay(link){
   replayData??=await rgs.replay(link);
   const data=replayData,round=data.round||data;
   const mode=STAKE_MODES.find(m=>m.name===String(link.mode).toLowerCase())||STAKE_MODES[0];
   const bet=hundredths(link.amount);bets.splice(0,bets.length,bet);betIndex=0;
   active={result:replayStakeRound(mode.kind,{...round,state:round.state||data.state}),bet,cost:Math.round(bet*mode.cost),kind:mode.kind,preview:true,stake:{...round,active:false},replay:true};
   return active;
  },
  read(){const bet=bets[betIndex]??0,cost=bet*(spinMode===FEATURE_SPIN.kind?FEATURE_SPIN.cost:SPIN_MODES[spinMode]?.cost??1);return {credits:hundredths(balance),bet,betIndex,lastWin,busy:!!active,spinMode,spinCost:Math.round(cost)};},
  setSpinMode(mode){
   if(!Object.hasOwn(SPIN_MODES,mode)&&mode!==FEATURE_SPIN.kind)throw Error('Unknown spin mode.');
   if(active)return false;spinMode=mode;return true;
  },
  changeBet(direction){if(active)return false;betIndex=Math.max(0,Math.min(bets.length-1,betIndex+direction));return true;},
  reset(){throw Error('Not available here.');},
  async begin(kind=spinMode){
   if(active)throw Error('A round is already playing.');
   if(PREVIEW_MODES.includes(kind))throw Error('Previews are not available here.');
   const mode=stakeMode(kind);if(!mode)throw Error('Unknown round type.');
   const bet=bets[betIndex],cost=Math.round(bet*mode.cost);
   if(hundredths(balance)<cost)throw new StakeError('ERR_IPB');
   const data=await rgs.play(micro(bet),mode.name);
   if(!data?.round?.state?.length)throw new StakeError('ERR_GEN');
   if(data.balance?.amount!==undefined)balance=data.balance.amount;
   active={result:replayStakeRound(kind,data.round),bet,cost,kind,preview:false,stake:data.round};
   lastWin=0;started=now();return active;
  },
  // Pays the round: end-round settles any win (a losing round is already closed).
  async finish(round){
   if(!active||active!==round)throw Error('This round has already finished.');
   active=null;lastWin=round.result.total*round.bet/100;
   if(round.replay)return this.read();
   const minimum=config.jurisdiction?.minimumRoundDuration||0;
   if(minimum>0&&now()-started<minimum)await wait(minimum-(now()-started));
   if(round.stake.active??round.result.total>0){const data=await rgs.endRound();if(data?.balance?.amount!==undefined)balance=data.balance.amount;}
   return this.read();
  },
  // The display failed: the round still stands, so settle it rather than refund.
  cancel(round){
   if(active!==round)return;active=null;
   if(!round.replay&&(round.stake.active??round.result.total>0))rgs.endRound().then(d=>{if(d?.balance?.amount!==undefined)balance=d.balance.amount;}).catch(()=>{});
  },
  async refresh(){const data=await rgs.balance();if(data?.balance?.amount!==undefined)balance=data.balance.amount;return this.read();}
 };
}
