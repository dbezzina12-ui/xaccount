// Translate recorded engine events into the shapes used by the reel presenter.
import {playSixRound, ladderState, VARIANTS} from '../reel-engine/six.js';

export function sixView(options) {
  const round = playSixRound(options);
  if(round.spin?.rack)for(const step of round.spin.steps){
    step.rackHits=step.rack.hits;step.meterAfter=step.rack.after;
  }
  if (round.bonus) {
    const bonus = round.bonus;
    bonus.selected = bonus.rack;
    let nextAward = VARIANTS[options.variant ?? 'flat'].spec[bonus.tier].ladder ? ladderState(bonus.rack) : null;
    for (const spin of bonus.spins) {
      spin.ladderBefore = nextAward;
      for (const step of spin.steps) {
        const event = step.rack;
        step.rackHits = event.hits;
        step.meterAfter = event.after;
        if (event.next) {
          nextAward = {next:event.next, nextKey:event.nextKey};
          step.ladder = nextAward;
        }
      }
    }
  }
  return round;
}
