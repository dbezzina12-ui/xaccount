export function distribution(pool,costX){
 let previous=0,totalReturn=0;const values=[];
 const tickets={zero:0,belowHalfCost:0,halfToUnderCost:0,breakEven:0,profitToDoubleCost:0,doubleToFiveCost:0,fiveCostOrMore:0};
 let mediumReturn=0,largeReturn=0,positive=0,covers=0;
 for(const [seed,cumulative,payout] of pool.entries){
  const weight=cumulative-previous;previous=cumulative;const ratio=payout/(costX*100);values.push({payout,weight});totalReturn+=weight*payout;
  const band=ratio===0?'zero':ratio<.5?'belowHalfCost':ratio<1?'halfToUnderCost':ratio===1?'breakEven':ratio<2?'profitToDoubleCost':ratio<5?'doubleToFiveCost':'fiveCostOrMore';
  tickets[band]+=weight;if(ratio>0)positive+=weight;if(ratio>=1)covers+=weight;
  if(ratio>=.5&&ratio<2)mediumReturn+=weight*payout;if(ratio>=5)largeReturn+=weight*payout;
 }
 values.sort((a,b)=>a.payout-b.payout);
 function quantile(fraction){let n=0;for(const v of values){n+=v.weight;if(n>=pool.total*fraction)return v.payout/100;}return values.at(-1).payout/100;}
 return {costX,anyPayout:positive/pool.total,coversCost:covers/pool.total,profit:(covers-tickets.breakEven)/pool.total,
  mediumProbability:(tickets.halfToUnderCost+tickets.breakEven+tickets.profitToDoubleCost)/pool.total,
  medianWinX:quantile(.5),p75WinX:quantile(.75),p90WinX:quantile(.9),
  mediumShareOfReturn:totalReturn?mediumReturn/totalReturn:0,largeShareOfReturn:totalReturn?largeReturn/totalReturn:0,
  bands:Object.fromEntries(Object.entries(tickets).map(([key,n])=>[key,n/pool.total]))};
}
export function mixtureDistribution(data,mix,costX){
 let cumulative=0;const entries=[];
 for(const [name,probability] of Object.entries(mix)){
  const pool=data.pools[name];let previous=0;
  for(const [seed,stop,payout] of pool.entries){cumulative+=probability*(stop-previous)/pool.total;previous=stop;entries.push([seed,cumulative,payout]);}
 }
 return distribution({total:cumulative,entries},costX);
}
