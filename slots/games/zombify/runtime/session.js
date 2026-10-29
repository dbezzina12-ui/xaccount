import {makePaidRound} from './outcome-model.js';
import {SPIN_MODES,FEATURE_SPIN,PREVIEW_MODES,roundCostMultiplier} from './config.js';

export const BETS = [10,20,50,100,200,500,1000,2000,5000,10000,20000,30000,40000,50000];

// Keep integer ten-thousandths internally so low stakes don't bias the RTP by
// rounding each small award to cents. Public values remain in hundredths.
// Animation never owns a payout.
export function createSession() {
  let units=100000000, betIndex=3, active=null, lastWin=0, spinMode='base';
  return {
    bets:BETS,
    read() { return {credits:units/100, bet:BETS[betIndex], betIndex, lastWin, busy:!!active,spinMode,spinCost:Math.round(BETS[betIndex]*roundCostMultiplier(spinMode))}; },
    setSpinMode(mode) {
      if(!Object.hasOwn(SPIN_MODES,mode)&&mode!==FEATURE_SPIN.kind)throw Error('Unknown spin mode.');
      if(active)return false;
      spinMode=mode;return true;
    },
    changeBet(direction) {
      if(active) return false;
      betIndex=Math.max(0,Math.min(BETS.length-1,betIndex+direction));
      return true;
    },
    reset() {
      if(active) throw Error('Finish the current round first.');
      units=100000000; lastWin=0;
    },
    begin(kind=spinMode, rng) {
      if(active) throw Error('A round is already playing.');
      const bet=BETS[betIndex],preview=PREVIEW_MODES.includes(kind),cost=Math.round(bet*roundCostMultiplier(kind));
      if(units<cost*100) throw Error('Not enough free-play credits. Lower your bet or reset credits in the menu.');
      const result=makePaidRound({kind,rng});
      active={result,bet,preview,cost,kind};
      units-=cost*100;
      lastWin=0;
      return active;
    },
    finish(round) {
      if(!active || active!==round) throw Error('This round has already finished.');
      const winUnits=round.result.total*round.bet;
      lastWin=winUnits/100;
      if(!round.preview) units+=winUnits;
      active=null;
      return this.read();
    },
    cancel(round) {
      if(active!==round) return;
      units+=round.cost*100;
      active=null;
    }
  };
}
