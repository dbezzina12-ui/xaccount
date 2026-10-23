// Presentation copy only. Spin counts, multipliers and awards come from the round.
export const FEATURE_PRESENTATION=Object.freeze({
 regular:{color:'#c4ed79',description:'Eat a human type three times to infect it. Every bite of that infected type then adds +2× to +10×. Unlocked infections stay with you for the entire bonus.'},
 super:{color:'#ffbf7c',description:'All human types start infected. Zombies return at the same starting row or lower, then climb again. Infected bites add +2× to +10×. Each spin builds fresh multipliers.'},
 hidden:{color:'#d8aeff',description:'All human types start infected. Zombies return at the same starting row or lower and climb again. Each reel keeps its multiplier between spins, with every fresh bite adding to the total.'}
});
export function mobileControllerState({state,maxBetIndex,busy,pending,auto,playback,awaitingFeature,tier,sound,win}){
 return {ready:true,busy:busy||!!pending,holding:!!pending||(busy&&playback.spin===null&&!awaitingFeature),continuing:awaitingFeature,
  autoActive:auto.active,remaining:auto.remaining,canDecrease:state.betIndex>0,canIncrease:state.betIndex<maxBetIndex,
  turbo:playback.speed!=='normal',muted:!sound,buyActive:state.spinMode==='enhanced'||state.spinMode==='buy_feature',
  featureColor:FEATURE_PRESENTATION[tier]?.color||(state.spinMode==='buy_feature'?'#ff86ae':state.spinMode==='enhanced'?'#c4ed79':null),
  balance:state.credits,bet:state.spinCost,win};
}
