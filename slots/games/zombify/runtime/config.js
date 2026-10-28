export const BONUS_FEATURES=Object.freeze({
  regular:Object.freeze({title:'OUTBREAK',tier:'regular',scatters:3,spins:8,description:'Eight free spins. Eat each human type three times to unlock it. Future bites of that type add 2× to 10× for the rest of the bonus.'}),
  super:Object.freeze({title:'SUPER OUTBREAK',tier:'super',scatters:4,spins:10,description:'Ten free spins. Infected humans add 2× to 10×. Zombies return to the same starting row or upgrade lower, then climb again. Multipliers reset each spin.'}),
  hidden:Object.freeze({title:'HIDDEN OUTBREAK',tier:'hidden',scatters:5,spins:10,description:'All the Super features, with growing multipliers. Each reel keeps its collected multiplier for the next free spin, then adds fresh bites on top. Values reset after the bonus.'})
});
export const bonusTierForScatters=count=>count>=5?'hidden':count===4?'super':count===3?'regular':null;
export const BONUS_BUYS=Object.freeze({
  buy_outbreak:Object.freeze({...BONUS_FEATURES.regular,cost:100}),
  buy_super:Object.freeze({...BONUS_FEATURES.super,cost:250}),
  buy_mystery:Object.freeze({title:'MYSTERY OUTBREAK',cost:400,spins:8,description:'Reveal one bonus: 40% Outbreak, 50% Super Outbreak or 10% Hidden Outbreak. 8 regular or 10 Super/Hidden free spins at your base bet.'})
});
export const FEATURE_SPIN=Object.freeze({kind:'buy_feature',title:'SECOND LIFE',cost:10,startZombies:Object.freeze([[2,.75],[3,.2],[4,.05]]),maxZombies:6,description:'Two to four guaranteed zombies choose a new direction each spin. Collect a heart in their path for a respin. Zombies return to their starting spots with their multipliers; the other symbols refresh. Each collected heart adds one respin, and every heart after the first brings in another zombie, up to one per reel.'});
export const PREVIEW_MODES=Object.freeze(['single','showcase','triple','down','carriers','horizontal','horizontal_left','reel','outbreak','preview_super','preview_hidden','preview_feature']);
export const SPIN_MODES=Object.freeze({
  base:Object.freeze({cost:1,scatterChance:.023}),
  enhanced:Object.freeze({cost:3.3,scatterChance:.04})
});
export const roundCostMultiplier=kind=>PREVIEW_MODES.includes(kind)?0:kind===FEATURE_SPIN.kind?FEATURE_SPIN.cost:BONUS_BUYS[kind]?.cost??SPIN_MODES[kind]?.cost??1;
export function chooseMysteryTier(rng=Math.random){const roll=rng();return roll<.4?'regular':roll<.9?'super':'hidden';}
