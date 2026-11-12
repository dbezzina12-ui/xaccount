// Offline calibration only. A player's balance, history and stake are never inputs.
// Partition existing feature groups; cap outcomes keep their real boards and
// feature flags. Reuse the bounded allocation used for zero-return constraints.
export function splitCapGroups(groups,tickets,cap){
 const originals=new Map(groups.flatMap(g=>g.items.map(e=>[e.i,e])));
 const tagged=groups.map(g=>({...g,items:g.items.map(e=>({...e,payout:e.payout===cap?0:1}))}));
 return splitZeroGroups(tagged,tickets).map(g=>({...g,items:g.items.map(e=>originals.get(e.i))}));
}
export function splitZeroGroups(groups,zeroTickets){
 const parts=groups.map(group=>{
  const zero=group.items.filter(e=>e.payout===0),positive=group.items.filter(e=>e.payout>0);
  const lower=positive.length?zero.length:group.tickets,upper=zero.length?group.tickets-positive.length:0;
  return {group,zero,positive,lower,upper,amount:lower};
 });
 let remaining=zeroTickets-parts.reduce((n,g)=>n+g.lower,0);
 if(remaining<0||zeroTickets>parts.reduce((n,g)=>n+g.upper,0))throw Error('Zero-return target is outside available feature groups');
 let active=parts.filter(g=>g.upper>g.lower);
 while(remaining>1e-6&&active.length){
  const sum=active.reduce((n,g)=>n+g.group.tickets,0);
  const capped=active.filter(g=>remaining*g.group.tickets/sum>=g.upper-g.amount);
  if(!capped.length){for(const g of active)g.amount+=remaining*g.group.tickets/sum;remaining=0;break;}
  for(const g of capped){remaining-=g.upper-g.amount;g.amount=g.upper;}
  active=active.filter(g=>!capped.includes(g));
 }
 const residual=zeroTickets-parts.reduce((n,g)=>n+Math.floor(g.amount),0);
 const ordered=[...parts].sort((a,b)=>(b.amount%1)-(a.amount%1));
 parts.forEach(g=>{g.tickets=Math.floor(g.amount);});
 ordered.slice(0,residual).forEach(g=>g.tickets++);
 return parts.flatMap(g=>[
  ...(g.zero.length?[{items:g.zero,tickets:g.tickets}]:[]),
  ...(g.positive.length?[{items:g.positive,tickets:g.group.tickets-g.tickets}]:[])
 ]);
}

export function mediumWeights(entries,groups,{target,sigma=.65,maximum,cost=target,targetCover=null,largerTilt=0,connectionTilt=0}){
 const prepared=groups.map(group=>({...group,items:group.items.map(e=>({
  ...e,score:targetCover===null?Math.log1p(e.payout/target):e.payout/target,covers:e.payout>=cost,
  // Prefer a broad neighbourhood of the target return instead of favouring
  // zero outcomes to subsidise an extreme tail. Every seed retains a ticket.
  // A bounded preference for 2–5x paid returns preserves the recent Duel
  // improvement when Crossfire changes candidate payouts. The mean, zero
  // returns, cost recovery and protected feature groups are still fitted.
  prior:(e.payout?-.5*(Math.log(e.payout/target)/sigma)**2:0)+(e.payout>=cost*2&&e.payout<cost*5?largerTilt:0)+connectionTilt*(e.connectionScore||0)
 }))}));
 function weights(lambda,coverTilt=0){
  const result=Array(entries.length).fill(0);
  for(const group of prepared){
   if(group.tickets<group.items.length)throw Error('Too few tickets to keep every candidate reachable');
   const logs=group.items.map(e=>e.prior-lambda*e.score+(e.covers?coverTilt:0));
   let remaining=group.tickets-group.items.length,active=group.items.map((_,i)=>i);
   while(active.length){
    // Re-anchor after each capped outcome is removed, so rare huge awards
    // cannot underflow all the remaining ordinary outcomes to zero.
    const anchor=active.reduce((best,i)=>Math.max(best,logs[i]),-Infinity);
    const raw=[];for(const i of active)raw[i]=Math.exp(logs[i]-anchor);
    const denominator=active.reduce((sum,i)=>sum+raw[i],0);
    if(!denominator)throw Error('Calibration exhausted positive weight');
    const scale=remaining/denominator,capped=active.filter(i=>1+scale*raw[i]>maximum);
    if(!capped.length){for(const i of active)result[group.items[i].i]=1+scale*raw[i];break;}
    for(const i of capped){result[group.items[i].i]=maximum;remaining-=maximum-1;}
    const excluded=new Set(capped);active=active.filter(i=>!excluded.has(i));
   }
   if(remaining>0&&!active.length)throw Error('Not enough candidate variety within a protected group');
  }
  return result;
 }
 const total=groups.reduce((sum,g)=>sum+g.tickets,0),mean=w=>entries.reduce((sum,e,i)=>sum+e.payout*w[i],0)/total;
 function fit(coverTilt=0){
  let low=-1,high=1;
  while(mean(weights(low,coverTilt))<target&&low>-256)low*=2;
  while(mean(weights(high,coverTilt))>target&&high<256)high*=2;
  if(mean(weights(low,coverTilt))<target||mean(weights(high,coverTilt))>target)throw Error('Medium distribution cannot fit the target return and protected features');
  for(let i=0;i<45;i++){const middle=(low+high)/2;if(mean(weights(middle,coverTilt))>target)low=middle;else high=middle;}
  return weights((low+high)/2,coverTilt);
 }
 if(targetCover===null)return fit();
 const cover=w=>entries.reduce((sum,e,i)=>sum+(e.payout>=cost?w[i]:0),0)/total;
 let low=-1,high=1;
 while(cover(fit(low))>targetCover&&low>-64)low*=2;
 while(cover(fit(high))<targetCover&&high<64)high*=2;
 if(cover(fit(low))>targetCover||cover(fit(high))<targetCover)throw Error('Cost-recovery target cannot fit the protected features');
 for(let i=0;i<32;i++){const mid=(low+high)/2;if(cover(fit(mid))<targetCover)low=mid;else high=mid;}
 return fit((low+high)/2);
}
