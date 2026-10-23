import {CAP} from './math.js';

// Awards use hundredths of the base bet. Presentation never changes settlement.
export const WIN_TIERS=Object.freeze({
 nice:{label:'NICE WIN',threshold:1000,duration:2.8,hold:.7,cue:'celebrate-nice',pose:.42},
 big:{label:'BIG WIN',threshold:2500,duration:3.5,hold:.9,cue:'celebrate-big',pose:.56},
 epic:{label:'EPIC WIN',threshold:10000,duration:4.5,hold:1.1,cue:'celebrate-epic',pose:.4},
 max:{label:'MAX WIN',threshold:CAP,duration:5.8,hold:1.8,cue:'celebrate-max',pose:.74},
});
export function winTier(units){
 if(!Number.isFinite(units)||units<1000)return null;
 return units>=CAP?'max':units>=10000?'epic':units>=2500?'big':'nice';
}
export function celebrationFor(event){
 if(event.type==='lineWin'){
  // The cap is a round award, shown once at roundEnd in base or bonus play.
  if(event.total>=CAP)return null;
  const tier=winTier(event.win);return tier?{tier,units:event.win,scope:'SPIN WIN'}:null;
 }
 if(event.type==='roundEnd'&&(event.bonus||event.total>=CAP)){
  const tier=winTier(event.total);
  return tier?{tier,units:event.total,scope:event.total>=CAP?'25,000× ROUND LIMIT': 'FREE SPINS TOTAL'}:null;
 }
 return null;
}
export function createWinCountup({tier,amount,speed='normal',reduced=false}){
 const config=WIN_TIERS[tier];if(!config)throw Error('Unknown win tier');
 const total=Math.max(0,Math.round(Number(amount)||0));
 const rate=speed==='turbo'?.65:speed==='quick'?.82:1;
 const duration=reduced?0:config.duration*rate,hold=reduced?1.35:config.hold;
 let elapsed=0,completed=duration===0,finished=false,holdElapsed=0;
 return {
  advance(seconds){
   if(finished)return this.read();
   const delta=Math.max(0,Math.min(.2,seconds||0));
   if(completed){holdElapsed+=delta;if(holdElapsed>=hold)finished=true;}
   else{elapsed=Math.min(duration,elapsed+delta);if(elapsed>=duration)completed=true;}
   return this.read();
  },
  skip(){if(completed)finished=true;else{elapsed=duration;completed=true;holdElapsed=Math.max(0,hold-.75);}return this.read();},
  read(){const progress=duration?Math.min(1,elapsed/duration):1;return {amount:completed?total:Math.floor(total*(1-(1-progress)**2)),progress,completed,finished,total};}
 };
}
