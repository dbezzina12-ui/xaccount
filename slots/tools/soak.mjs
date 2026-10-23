#!/usr/bin/env node
// Plays the real browser client for many rounds on a virtual clock (fast),
// with random taps, bet changes, turbo and bonus buys. Fails on any page
// error, a round that never finishes, or a wallet that doesn't add up.
//
//   node tools/soak.mjs [game-001] [--rounds 300] [--seed 11]

import { serve, chromium, VIRTUAL_CLOCK } from './lib/browser.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const game = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? 'game-001';
const rounds = Number(opt('rounds', 300));
const seed = Number(opt('seed', 11));

const srv = await serve();
const browser = await chromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(VIRTUAL_CLOCK);
await page.goto(`${srv.url}?game=${game}&seed=${seed}`);
await page.waitForFunction(() => window.__slot?.ready, null, { timeout: 30000 });

const result = await page.evaluate(
  async ({ rounds }) => {
    window.__startVirtual();
    const c = __slot.ctrl;
    let r = 0;
    let features = 0;
    let buys = 0;
    let taps = 0;
    let maxSteps = 0;
    const problems = [];
    let x = 12345;
    const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    while (r < rounds && problems.length < 5) {
      if (rand() < 0.08) c.changeBet(rand() < 0.5 ? 1 : -1);
      if (rand() < 0.03) c.hud.on.turbo();
      if (c.balance < 200) c.balance = 1000;
      const before = c.balance;
      const bet = c.bet;
      const buy = r % 40 === 39 && c.balance >= bet * c.json.bonusBuy.priceX;
      if (buy) {
        c.round({ buy: true });
        buys++;
      } else c.spinPressed();
      let steps = 0;
      while (c.busy) {
        await window.__step(50);
        if (rand() < 0.04) {
          c.tap();
          taps++;
        }
        if (++steps > 20000) {
          problems.push(`round ${r} never finished`);
          break;
        }
      }
      maxSteps = Math.max(maxSteps, steps);
      const cost = buy ? bet * c.json.bonusBuy.priceX : bet;
      const expect = before - cost + c.last.totalWinX * bet;
      if (Math.abs(c.balance - expect) > 1e-6) problems.push(`round ${r}: balance ${c.balance} != ${expect}`);
      if (c.last.triggered) features++;
      if (__slot.stage.mode !== 'base') problems.push(`round ${r}: left in ${__slot.stage.mode} mode`);
      r++;
      for (let i = 0; i < 3; i++) await window.__step(50);
    }
    return { rounds: r, features, buys, taps, longestRoundSec: (maxSteps * 50) / 1000, problems };
  },
  { rounds },
);
await browser.close();
srv.close();
console.log(`soak: ${result.rounds} rounds, ${result.features} features (${result.buys} bought), ${result.taps} taps, longest round ${result.longestRoundSec}s of game time`);
const all = [...result.problems, ...errors];
if (all.length) {
  console.error('problems:\n  ' + all.join('\n  '));
  process.exitCode = 1;
} else console.log('ok: no errors, wallet consistent every round');
