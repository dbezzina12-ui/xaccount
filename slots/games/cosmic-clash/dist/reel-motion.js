// Presentation-only reel strips. They never generate or alter a game outcome.
const FILLER = ['HELMET', 'E', 'GUN', 'D', 'CHIP', 'L', 'BLADE', 'U'];

export function reelPlan(previous, result, reelIndex, {turbo = false, turn = 0} = {}) {
  const fillerCount = turbo ? 2 + Math.floor(reelIndex / 2) : 4 + reelIndex;
  // A downward-moving strip starts with the old board at its bottom and ends
  // with the exact result at its top. Whole viewport panels prevent gaps even
  // when the number of visible symbols changes between spins.
  const panels = [result];
  for (let panel = 0; panel < fillerCount; panel++) {
    const rows = previous.length;
    panels.push(Array.from({length: rows}, (_, row) => ({
      name: FILLER[(turn * 3 + reelIndex * 5 + panel * 3 + row) % FILLER.length],
    })));
  }
  panels.push(previous);
  const start = -100 * (panels.length - 1) / panels.length;
  const duration = turbo ? 360 + reelIndex * 85 : 820 + reelIndex * 195;
  const brake = turbo ? 85 : 140;
  const lastSymbol = -95 / (panels.length * result.length);
  return {
    panels,
    duration,
    frames: [
      {offset: 0, transform: `translate3d(0, ${start}%, 0)`, easing: 'linear'},
      {offset: 1 - brake / duration, transform: `translate3d(0, ${lastSymbol}%, 0)`, easing: 'cubic-bezier(.16,.72,.3,1)'},
      {offset: 1, transform: 'translate3d(0, 0%, 0)'},
    ],
  };
}

// Impact travels up the settled column. Only the illustration deforms; the
// selected cells and their positions remain fixed for payouts and duels.
export async function settleReel(column, {turbo=false, instant=()=>false, motions=new Set()}={}) {
  if (instant()) return;
  const cells = [...column.querySelectorAll('.symbol-cell')];
  await Promise.all(cells.map(async (cell, row) => {
    const art = cell.querySelector('.symbol-art');
    if (!art?.animate || instant()) return;
    const heavy = ['VS','SCATTER'].includes(cell.dataset.name);
    // Half the original displacement and deformation, preserving the timing.
    const tilt = (row % 2 ? 1 : -1) * (heavy ? 1.2 : .65);
    const animation = art.animate([
      {offset:0,transform:'translateY(0) scale(1,1) rotate(0deg)',easing:'cubic-bezier(.2,0,.7,1)'},
      {offset:.18,transform:`translateY(2%) scale(${heavy?1.075:1.05},${heavy?.905:.94}) rotate(${tilt}deg)`,easing:'cubic-bezier(.15,.65,.3,1)'},
      {offset:.5,transform:`translateY(${heavy?-4.5:-3}%) scale(.985,1.03) rotate(${-tilt*.45}deg)`,easing:'ease-in'},
      {offset:.76,transform:'translateY(.75%) scale(1.0125,.9875) rotate(0deg)',easing:'ease-out'},
      {offset:1,transform:'translateY(0) scale(1,1) rotate(0deg)'},
    ], {duration:turbo?160:300,delay:(cells.length-1-row)*(turbo?4:10),easing:'linear'});
    motions.add(animation);
    try { await animation.finished; } catch {} finally { motions.delete(animation); animation.cancel(); }
  }));
}

// React only to settled current-spin columns, never filler symbols or an
// unrevealed result. The selected board is untouched by all tease effects.
export function createScatterAnticipation({reelCount=5,turbo=false,instant=()=>false,slow=()=>{},change=()=>{}}={}){
 const settled=new Set(),slowed=new Set();let scatters=0,ended=false;
 return {
  landed(reel,count){
   if(ended||settled.has(reel))return;
   settled.add(reel);scatters+=count;
   if(scatters<2||instant())return;
   const pending=Array.from({length:reelCount},(_,i)=>i).filter(i=>!settled.has(i));
   for(const index of pending)if(!slowed.has(index)){slowed.add(index);slow(index,turbo?.38:.18);}
   change({active:pending.length>0,pending,next:pending[0]??null,scatters});
  },
  finish(){if(ended)return;ended=true;change({active:false,pending:[],next:null,scatters});}
 };
}
