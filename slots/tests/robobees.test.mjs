// RoboBees: the rules and win-show suites, and a check that the math sheet was generated from the shipped MATH block.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MATH, buys, features} from '../games/robobees/dist/rules.mjs';

const GAME = fileURLToPath(new URL('../games/robobees/', import.meta.url));
const run = (file) => execFileSync(process.execPath, [file], {cwd: GAME, encoding: 'utf8'});

test('RoboBees rules: tumbles, banks, the cap and cents', () => {
  assert.match(run('tests/bonus-rules.mjs'), /\d[\d,]* spins verified/);
});

test('RoboBees win celebrations', () => {
  assert.match(run('tests/win-show.mjs'), /verified/);
});

test('RoboBees MATH.md matches the shipped MATH and prices, and every mode returns 96%', () => {
  const sheet = JSON.parse(fs.readFileSync(GAME + 'math/summary.json', 'utf8'));
  // a changed MATH block or price needs a rerun of tools/math/robobees-report.mjs
  assert.deepEqual(sheet.math, MATH);
  const prices = Object.fromEntries([...Object.entries(features), ...Object.entries(buys)].map(([k, v]) => [k, v.price]));
  assert.deepEqual(sheet.prices, prices);
  assert.equal(MATH.cap, 25000);
  // every price is whole cents at every stake (stakes are multiples of 10 cents)
  for (const v of Object.values(prices)) assert.ok(Number.isInteger(Math.round(v * 10 * 1e9) / 1e9), `price ${v}x`);
  for (const m of [...Object.values(sheet.modes), ...Object.values(sheet.buys)]) {
    // within the 99.9% interval (ci is the 95% one, 1.96 standard errors). The fit and the sheet use independent
    // seeds, so each mode is a few tenths of a point off 96% by sampling alone.
    assert.ok(Math.abs(m.rtp - 0.96) <= (m.ci * 3.29) / 1.96, `${m.label}: ${(100 * m.rtp).toFixed(2)}% ± ${(100 * m.ci).toFixed(2)}%`);
  }
});
