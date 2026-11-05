// Purchased entries only. The settled tier chooses the scatter count. Filler
// symbols are balanced so this presentation board can never show a payable match.
import { PAYING } from '../engine/rules.js';
export function boughtEntryBoard(tier, rng) {
  const count = {regular:4, super:5, hidden:6}[tier];
  const shuffled = values => {
    for (let i=values.length-1;i>0;i--) {
      const j=Math.floor(rng()*(i+1));
      [values[i],values[j]]=[values[j],values[i]];
    }
    return values;
  };
  const fillers=shuffled(Array.from({length:30},(_,i)=>PAYING[i%PAYING.length]));
  const grid=Array.from({length:6},(_,x)=>fillers.slice(x*5,x*5+5).map(s=>({s})));
  const reels=shuffled([0,1,2,3,4]).slice(0,count-1).concat(5);
  for(const reel of reels)grid[reel][Math.floor(rng()*5)]={s:'FS'};
  return grid;
}
