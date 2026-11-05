#!/usr/bin/env node
// Dead Letter Depot (reels): the fixture set for the screen. Searches seeds
// for each scenario, then records the whole settled payload (board, winning
// cells, clears, survivor drops, refills, collections, jobs, the meter,
// mode, award) and the settlement at a $1 bet from a $1,000 balance.
//   node tools/math/dead-letter-depot-fixtures.mjs
// tests/fixtures.test.mjs replays every fixture through the engine.
import { writeFileSync, mkdirSync } from 'node:fs';
import { playRound, seeded, ENGINE_VERSION } from '../../games/dead-letter-depot/engine/engine.js';
import { settle } from '../../games/dead-letter-depot/engine/settle.js';

const BET = 100, BALANCE = 100000;
const anySpin = (r, f) => !!r.bonus && r.bonus.spins.some(f);
const firstActivePay = (r) => r.bonus.spins.findIndex((s) => s.meter.active && s.subtotal > 0);
const JOB_OF = { '10': 'sweep', J: 'convert', Q: 'copy', K: 'wild', A: 'filter', ENVELOPE: 'return', PARCEL: 'unpack', PHONE: 'deliver', KEY: 'vault' };
export const SCENARIOS = [
  ['base-no-win', 'base', 'a base spin that pays nothing', (r) => r.total === 0 && !r.bonus],
  ['base-one-tumble', 'base', 'one win, one clear and refill, meter 1x', (r) => r.spin.tumbles === 1 && r.spin.multiplier === 1 && !r.bonus],
  ['base-cascade', 'base', 'three or more tumbles in one spin', (r) => r.spin.tumbles >= 3 && !r.bonus],
  ['base-stamp-meter', 'base', 'a stamp lifts the spin-local meter', (r) => r.spin.subtotal > 0 && r.spin.stampSum > 0 && !r.bonus],
  ['base-collection-clear', 'base', 'a collection clears inside one base spin', (r) => r.spin.clears.length > 0 && !r.bonus],
  ['base-night-shift', 'base', 'a natural Night Shift (4 FS)', (r) => r.bonus?.tier === 'regular'],
  ['priority-double-post', 'priority', 'a natural Double Post (5 FS)', (r) => r.bonus?.tier === 'super'],
  ['priority-lost-and-found', 'priority', 'a natural Lost & Found (6+ FS)', (r) => r.bonus?.tier === 'hidden'],
  ['special-delivery-pays', 'special', 'one opening stamp on a paying spin', (r) => r.spin.subtotal > 0 && !r.bonus],
  ['double-exposure-pays', 'exposure', 'two opening stamps on a paying spin', (r) => r.spin.subtotal > 0 && !r.bonus],
  ['regular-inactive', 'nightshift', 'Night Shift: a paying spin with no event pays face value while the meter waits', (r) => anySpin(r, (s) => !s.meter.event && s.subtotal > 0 && s.meter.start > 1)],
  ['regular-late', 'nightshift', 'Night Shift: the meter first applies on spin 7 or later', (r) => firstActivePay(r) >= 6],
  ['super-no-event', 'doublepost', 'Double Post: a spin with no clear or stamp still takes the meter', (r) => anySpin(r, (s) => !s.meter.event && s.subtotal > 0)],
  ['hidden-clear-and-stamp', 'mystery', 'Lost & Found: a stamp and a clear in one spin (stamps first, then doubling)', (r) => r.bonus.tier === 'hidden' && anySpin(r, (s) => s.stampSum > 0 && s.clears.length > 0 && s.subtotal > 0)],
  ...Object.entries(JOB_OF).map(([sym, job]) => [`job-${job}`, 'nightshift', `${sym} collection clears and its ${job} job runs`, (r) => anySpin(r, (s) => s.clears.includes(sym))]),
  ['retrigger', 'nightshift', '3+ FS in a free spin add 5 spins', (r) => r.bonus.retriggers >= 1],
  ['mystery-night-shift', 'mystery', 'Mystery reveals Night Shift', (r) => r.bonus.tier === 'regular'],
  ['mystery-double-post', 'mystery', 'Mystery reveals Double Post', (r) => r.bonus.tier === 'super'],
  ['mystery-lost-and-found', 'mystery', 'Mystery reveals Lost & Found', (r) => r.bonus.tier === 'hidden'],
  ['cap', 'mystery', 'a round that reaches the 25,000x cap', (r) => r.capped],
];

export function find(mode, test, limit) {
  for (let seed = 1; seed <= limit; seed++) if (test(playRound({ mode, rng: seeded(seed), record: false }))) return seed;
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixtures = [], missing = [];
  for (const [name, mode, what, test] of SCENARIOS) {
    const seed = find(mode, test, name === 'cap' ? 3e6 : 2e5);
    if (seed === null) { missing.push(name); console.log(`${name}: not found`); continue; }
    const round = playRound({ mode, rng: seeded(seed) });
    fixtures.push({ name, what, mode, seed, bet: BET, balance: BALANCE, settlement: settle(round, BET, BALANCE), round });
    console.log(`${name.padEnd(28)} ${mode.padEnd(11)} seed ${String(seed).padStart(7)} total ${(round.total / 100).toLocaleString('en-US')}x`);
  }
  mkdirSync(new URL('../../games/dead-letter-depot/fixtures/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../../games/dead-letter-depot/fixtures/rounds.json', import.meta.url), JSON.stringify({ engine: ENGINE_VERSION, units: 'round amounts in hundredths of the base bet; settlement in cents', missing, fixtures }) + '\n');
  console.log(`wrote fixtures/rounds.json (${fixtures.length} fixtures${missing.length ? `, missing ${missing.join(', ')}` : ''})`);
}
