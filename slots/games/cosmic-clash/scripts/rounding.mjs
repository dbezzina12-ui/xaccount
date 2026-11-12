// Correct the small mean drift from integer ticket rounding without changing
// any feature group's ticket total or making a candidate unreachable.
export function correctBaseRounding(entries,weights,groups,targetTotal){
 let difference=Math.round(targetTotal)-entries.reduce((sum,e,i)=>sum+e.payout*weights[i],0);
 for(const group of groups){
  const sorted=[...group.items].sort((a,b)=>a.payout-b.payout||weights[b.i]-weights[a.i]);
  const low=sorted[0];
  for(const high of sorted.slice(1).reverse()){
   const gap=high.payout-low.payout;if(!gap)continue;
   const donor=difference>0?low:high,receiver=difference>0?high:low;
   const tickets=Math.min(weights[donor.i]-1,Math.floor(Math.abs(difference)/gap));
   weights[donor.i]-=tickets;weights[receiver.i]+=tickets;
   difference-=tickets*(receiver.payout-donor.payout);
  }
 }
 return difference;
}
