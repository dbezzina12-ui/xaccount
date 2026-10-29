// Zombify on Stake Engine (Dylan, 2026-10-29): launch parameters, money and
// words, the book recipes the RGS returns (outcome-model.js roundFromBook) and
// the RGS-backed session, against a stand-in RGS. The browser side is
// tests/browser/stake.e2e.mjs; the published math is checked by
// tools/stake/zombify-export.mjs itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const runtime = (f) => new URL(`../games/zombify/runtime/${f}`, import.meta.url);
const skip = existsSync(runtime('outcomes.js')) && existsSync(runtime('feature-outcomes.js')) ? false : 'needs the Zombify catalogs';
const { stakeLaunch, moneyFormatter, socialText, STAKE_MODES, MONEY } = await import(runtime('stake.js'));
const { roundCostMultiplier } = await import(runtime('config.js'));

test('Engine launch parameters, with and without a replay', () => {
  assert.equal(stakeLaunch('?lang=en'), null, 'no rgs_url: the free-play build');
  assert.deepEqual({ ...stakeLaunch('?sessionID=s1&lang=de&device=mobile&rgs_url=https://rgs.example.com/&social=true') }, { rgsUrl: 'rgs.example.com', sessionID: 's1', lang: 'de', device: 'mobile', social: true, replay: null });
  assert.deepEqual(stakeLaunch('?rgs_url=rgs.example.com&replay=true&game=zombify&version=3&mode=super&event=9&amount=2000000&currency=EUR').replay, { game: 'zombify', version: '3', mode: 'super', event: '9', amount: 2 * MONEY, currency: 'EUR' });
});

test('the bet modes Engine publishes cost what the game charges', () => {
  assert.deepEqual(STAKE_MODES.map((m) => m.name), ['base', 'enhanced', 'outbreak', 'super', 'mystery', 'secondlife']);
  for (const m of STAKE_MODES) assert.equal(m.cost, roundCostMultiplier(m.kind), m.name);
  assert.deepEqual(STAKE_MODES.map((m) => m.cost), [1, 3.3, 100, 250, 460, 10]);
});

test('money in Engine currencies, and Stake.us words', () => {
  assert.equal(moneyFormatter('USD')(123456), '$1,234.56');
  assert.equal(moneyFormatter('JPY')(123456), '¥1,235');
  assert.equal(moneyFormatter('PLN')(1000), '10.00 zł');
  assert.equal(moneyFormatter('XSC')(250), 'SC2.50');
  assert.equal(moneyFormatter('ZZZ')(250), '2.50 ZZZ');
  const texts = ['BUY BONUS', 'BUY FREE SPINS', 'CONFIRM BUY', 'Buy Outbreak for 100× base bet', '460× BASE BET · ONE BONUS', 'BET', 'Change base bet', 'BONUS BOUGHT'];
  for (const t of texts) { const s = socialText(t); assert.doesNotMatch(s, /\bbuy|\bbet\b|bought/i, t); assert.equal(socialText(s), s, `${t}: idempotent`); }
  assert.equal(socialText('BUY BONUS'), 'PLAY BONUS');
});

test('every kind of book replays to its payout, and a wrong payout is refused', { skip }, async () => {
  const { roundFromBook } = await import(runtime('outcome-model.js'));
  const { CAP } = await import(runtime('math.js'));
  const data = (await import(runtime('outcomes.js'))).default, feature = (await import(runtime('feature-outcomes.js'))).default;
  const b = data.pools.base.entries[5], t = data.pools.entry_super.entries[3], s = data.pools.super.entries[7], f = feature.pool.entries[11];
  const cases = [
    ['base', { events: [{ type: 'spin', seed: b[0], scatters: b[3] }], payoutMultiplier: b[2] }],
    ['enhanced', { events: [{ type: 'spin', tier: 'super', trigger: t[0], bonus: s[0], clustered: s[4] }], payoutMultiplier: Math.min(CAP, s[2] + t[2]) }],
    ['buy_mystery', { events: [{ type: 'bonus', tier: 'super', seed: s[0], clustered: s[4] }], payoutMultiplier: s[2] }],
    ['buy_feature', { events: [{ type: 'secondLife', seed: f[0], hearts: f[3], spins: f[4] }], payoutMultiplier: f[2] }],
  ];
  for (const [kind, book] of cases) {
    assert.equal(roundFromBook(kind, book).total, book.payoutMultiplier, kind);
    assert.throws(() => roundFromBook(kind, { ...book, payoutMultiplier: book.payoutMultiplier + 10 }), /Outcome validation failed/, kind);
  }
  assert.throws(() => roundFromBook('base', { events: [{ type: 'nope' }], payoutMultiplier: 0 }), /Unknown round/);
});

// A stand-in RGS for the session: records calls, debits and pays like Engine.
function fakeRgs({ balance = 100 * MONEY, book, round = null, jurisdiction = {} }) {
  const calls = [];
  let active = round;
  return {
    calls,
    authenticate: async () => { calls.push(['authenticate']); return { balance: { amount: balance, currency: 'EUR' }, config: { minBet: 100000, maxBet: 50 * MONEY, defaultBetLevel: 2 * MONEY, betLevels: [100000, MONEY, 2 * MONEY, 5 * MONEY, 100 * MONEY], jurisdiction }, round: active }; },
    play: async (amount, mode) => { calls.push(['play', amount, mode]); const cost = STAKE_MODES.find((m) => m.name === mode).cost; balance -= amount * cost; active = { amount, mode, payoutMultiplier: book.payoutMultiplier / 100, payout: (amount * book.payoutMultiplier) / 100, active: book.payoutMultiplier > 0, state: book.events }; return { balance: { amount: balance }, round: active }; },
    endRound: async () => { calls.push(['endRound']); if (active?.active) balance += active.payout; active = null; return { balance: { amount: balance } }; },
    balance: async () => ({ balance: { amount: balance } }),
    replay: async () => ({ payoutMultiplier: book.payoutMultiplier / 100, state: book.events }),
  };
}

test('the RGS session: bet levels, debits, payouts, refusals and the jurisdiction minimum round time', { skip }, async () => {
  const { createStakeSession } = await import(runtime('stake-session.js'));
  const data = (await import(runtime('outcomes.js'))).default;
  const win = data.pools.base.entries.find((e) => e[2] > 0), loss = data.pools.base.entries.find((e) => e[2] === 0);
  const book = (e) => ({ events: [{ type: 'spin', seed: e[0], scatters: e[3] }], payoutMultiplier: e[2] });

  let clock = 0, waited = 0;
  const rgs = fakeRgs({ book: book(win), jurisdiction: { minimumRoundDuration: 2500 } });
  const s = createStakeSession(rgs, { now: () => clock, wait: async (ms) => { waited += ms; clock += ms; } });
  await s.connect();
  assert.deepEqual(s.bets, [10, 100, 200, 500], 'levels within min/max (100.00 is over), in hundredths');
  assert.equal(s.read().bet, 200, 'Engine default level');
  assert.equal(s.currency, 'EUR');
  const round = await s.begin('base');
  assert.deepEqual(rgs.calls.at(-1), ['play', 2 * MONEY, 'base']);
  assert.equal(s.read().credits, 9800);
  clock += 1000;
  await s.finish(round);
  assert.equal(waited, 1500, 'held to the minimum round time');
  assert.deepEqual(rgs.calls.at(-1), ['endRound']);
  assert.equal(s.read().credits, 9800 + (win[2] * 200) / 100);
  assert.equal(s.read().lastWin, (win[2] * 200) / 100);

  // A losing round is closed by Engine already: no end-round.
  const lose = fakeRgs({ book: book(loss) }), t = createStakeSession(lose, { now: () => 0 });
  await t.connect(); await t.finish(await t.begin('base'));
  assert.equal(lose.calls.filter((c) => c[0] === 'endRound').length, 0);

  // Refused before any request: previews, too little balance.
  const poor = fakeRgs({ balance: MONEY, book: book(win) }), u = createStakeSession(poor);
  await u.connect();
  await assert.rejects(u.begin('preview_super'), /not available/);
  await assert.rejects(u.begin('buy_super'), /Insufficient balance/);
  assert.deepEqual(poor.calls.map((c) => c[0]), ['authenticate']);
});

test('an unfinished round from authenticate is resumed, then settled', { skip }, async () => {
  const { createStakeSession } = await import(runtime('stake-session.js'));
  const feature = (await import(runtime('feature-outcomes.js'))).default, f = feature.pool.entries.find((e) => e[2] > 0);
  const events = [{ type: 'secondLife', seed: f[0], hearts: f[3], spins: f[4] }];
  const rgs = fakeRgs({ book: { events, payoutMultiplier: f[2] }, round: { amount: 5 * MONEY, mode: 'SECONDLIFE', payoutMultiplier: f[2] / 100, payout: (5 * MONEY * f[2]) / 100, active: true, state: events } });
  const s = createStakeSession(rgs, { now: () => 0 });
  await s.connect();
  assert.equal(s.read().bet, 500, 'the bet of the unfinished round');
  const round = s.takeResume();
  assert.equal(round.kind, 'buy_feature'); assert.equal(round.result.total, f[2]);
  assert.equal(s.takeResume(), null, 'only once');
  await s.finish(round);
  assert.deepEqual(rgs.calls.map((c) => c[0]), ['authenticate', 'endRound']);
});
