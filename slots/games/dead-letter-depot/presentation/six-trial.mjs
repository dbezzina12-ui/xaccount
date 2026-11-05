// Private producer trial. Use the shared tumble generator and paytable;
// Claude owns the eventual calibrated rules and replay version.
import {compileLands, spinBoard, tierOf} from '../engine/engine.js';
import {LAND, LOWS, PREMIUMS, PAYING, CAP, MODES, BONUSES, MYSTERY, RETRIGGER, MAX_FREE_SPINS, bonusFor} from '../engine/rules.js';

const lands = compileLands(Object.fromEntries(Object.entries(LAND).map(([id, land]) =>
  [id, {...land, stamp:0}])));
const targets = Object.fromEntries(PAYING.map(id => [id, Infinity]));
const version = 'six-trial-1';

function sample(pool, count, rng) {
  const bag = [...pool];
  return Array.from({length:count}, () => bag.splice(Math.floor(rng()*bag.length),1)[0]);
}
export function selectSix(tier, rng) {
  const premiums = tier === 'hidden'
    ? [...sample(PREMIUMS.filter(id => id !== 'KEY'), 2, rng), 'KEY']
    : sample(PREMIUMS, 3, rng);
  return [...sample(LOWS, 3, rng), ...premiums];
}
export function applyMatches(start, wins, selected) {
  const hits = wins.map(w => w.s).filter(s => selected.includes(s));
  const additions = hits.reduce((sum,s) => sum + (s === 'KEY' ? 0 : LOWS.includes(s) ? 1 : 3), 0);
  return {after:(start + additions) * (hits.includes('KEY') ? 2 : 1), hits};
}
function trialSpin(land, rng, selected, start, always, budget) {
  const result = spinBoard(land,rng,{lands,targets,record:true});
  let value = start, activated = false;
  for (const step of result.steps) {
    const change = applyMatches(value,step.wins,selected);
    step.rackHits = change.hits;
    step.meterAfter = value = Math.min(change.after,CAP/100);
    activated ||= change.hits.length > 0;
  }
  const active = activated || always;
  const multiplier = active ? value : 1;
  const paid = Math.min(budget,result.subtotal * multiplier);
  return {...result,targets,meter:{start,after:value,active},multiplier,paid,win:paid,retrigger:0};
}
export function trialRound({mode,rng}) {
  const config = MODES[mode];
  const spin = config.kind === 'buy' ? null : trialSpin(config.land,rng,[],1,false,CAP);
  let tier = spin ? bonusFor(spin.fs) : config.bonus;
  if(mode === 'mystery') {
    const draw = rng();
    tier = draw < MYSTERY.regular ? 'regular' : draw < MYSTERY.regular+MYSTERY.super ? 'super' : 'hidden';
  }
  let total = spin?.paid || 0, bonus = null;
  if(tier && total < CAP) {
    const spec = BONUSES[tier], selected = selectSix(tier,rng), spins = [];
    let meter = spec.meter, awarded = spec.spins;
    while(spins.length < awarded && total < CAP) {
      const s = trialSpin(tier,rng,selected,meter,tier !== 'regular',CAP-total);
      meter = s.meter.after;
      if(s.fs >= RETRIGGER.fs) s.retrigger = Math.min(RETRIGGER.spins,MAX_FREE_SPINS-awarded);
      awarded += s.retrigger;
      total += s.paid;
      spins.push(s);
    }
    bonus = {tier,title:spec.title,selected,targets,spins,meter,awarded};
  }
  return {mode,version,spin,bonus,total,capped:total===CAP,tier:tierOf(total,mode,total===CAP)};
}
