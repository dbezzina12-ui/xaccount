// A single presentation clock follows real rounds, including auto and free spins.
const ease = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
export function createSpinIdle(){
  let busy=false, landing=null, from=0, takeoff=Infinity;
  function rest(time){
    if(landing===null) return 0;
    const landed=from+(1-from)*ease((time-landing)/.35);
    return landed*(1-ease((time-takeoff)/.65));
  }
  return {rest, setBusy(next,time){
    if(next===busy) return;
    if(next){from=rest(time);landing=time;takeoff=Infinity;}
    else takeoff=time+4.5;
    busy=next;
  }};
}
export const spinIdle=createSpinIdle();
