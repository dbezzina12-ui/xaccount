// Translate recorded engine events into the shapes used by the reel presenter.
import {playSixRound, ladderState, ringState, VARIANTS} from '../reel-engine/six.js';

const ringView=e=>({next:e.next,notches:e.notches,vault:e.vault,...('inner' in e?{inner:e.inner}:{})});

export function sixView(options) {
  const round = playSixRound(options);
  if(round.spin?.rack)for(const step of round.spin.steps){
    step.rackHits=step.rack.hits;step.meterAfter=step.rack.after;
  }
  if (round.bonus) {
    const bonus = round.bonus;
    bonus.selected = bonus.rack;
    const t=VARIANTS[options.variant ?? 'flat'].spec[bonus.tier];
    let nextAward=t.ring?ringState(bonus.rack):t.ladder?ladderState(bonus.rack):null;
    for (const spin of bonus.spins) {
      spin.ladderBefore = nextAward;
      if(t.ring){spin.ringBefore=nextAward;nextAward=ringView(spin.land);}
      for (const step of spin.steps) {
        const event = step.rack;
        step.rackHits = event.hits;
        step.meterAfter = event.after;
        if (event.next) {
          nextAward = t.ring?ringView(event):{next:event.next,nextKey:event.nextKey};
          step.ladder = nextAward;
        }
      }
    }
  }
  return round;
}
