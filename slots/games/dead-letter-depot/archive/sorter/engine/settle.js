// Dead Letter Depot: settlement. Turns a settled round into credits. The
// screen debits the cost, plays the presentation, then credits exactly this
// win once; nothing in the presentation can change either amount.
import { BETS, CAP, MODES } from './rules.js';

export function costOf(mode, bet) {
  const m = MODES[mode];
  if (!m) throw Error(`Unknown mode ${mode}`);
  if (!BETS.includes(bet)) throw Error(`Bet ${bet} is not on the bet ladder`);
  const cost = bet * m.cost;
  if (!Number.isInteger(cost)) throw Error(`${m.title} at ${bet} cents is not whole cents`);
  return cost;
}

// total is in hundredths of the base bet (engine units), bet in cents.
export function winOf(total, bet) {
  if (!Number.isInteger(total) || total < 0 || total > CAP) throw Error(`Round total ${total} is outside 0..${CAP}`);
  if (!BETS.includes(bet)) throw Error(`Bet ${bet} is not on the bet ladder`);
  const cents = (total * bet) / 100;
  if (!Number.isInteger(cents)) throw Error(`Win of ${total} hundredths at ${bet} cents is not whole cents`);
  return cents;
}

// The whole round's balance change: debit the cost, credit the win, once.
export function settle(round, bet, balance) {
  const cost = costOf(round.mode, bet), win = winOf(round.total, bet);
  if (!Number.isInteger(balance) || balance < cost) throw Error(`Balance ${balance} cannot cover ${cost}`);
  return { cost, win, balance: balance - cost + win };
}
