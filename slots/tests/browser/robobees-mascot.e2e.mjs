// RoboBees' hive-and-bee mascot in #mascot-stage. It must draw on desktop and phone, let the bonus award transition
// finish, and never touch an outcome: the same seeded spins land the same boards and balances with the mascot as with
// a stand-in that does nothing.
//
//   npm run test:studio-browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, chromium } from '../../tools/lib/browser.mjs';

const GAME = 'games/robobees/dist/';
const KEY = 'robobees-playtest-controller-v1';
// A repeatable Math.random, and a Swarm Protocol bonus with ten spins to go, so Wilds bank and workers land on the
// hive (the mascot's busiest path); turbo on. The bonus spins advance by themselves.
const SEEDED = (key) => {
  let i = 0;
  const s = [0.1, 0.6, 0.2, 0.9, 0.3, 0.45, 0.7, 0.15, 0.83, 0.37, 0.58, 0.11, 0.94, 0.26, 0.5, 0.31];
  Math.random = () => s[i++ % s.length];
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    const base = { mode: 'base', spots: Array(20).fill(0), left: 0, bank: 0, total: 0 };
    localStorage.setItem(key, JSON.stringify({ state: { ...base, mode: 'super', spots: Array(20).fill(2), left: 10 }, previous: base, balance: 1000000, bet: 100, win: 0, turbo: true, mute: true }));
  }
};
const STAND_IN = 'export function mountMascot(){const n=()=>{};return {depart:()=>Promise.resolve(),arrive:n,setBank:n,setTurbo:n}}';

let srv;
let browser;
before(async () => {
  srv = await serve();
  browser = await chromium();
});
after(async () => {
  await browser?.close();
  srv?.close();
});

async function open(viewport, { query = '', standIn = false, seeded = false } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (standIn) await page.route('**/mascot/mascot.mjs*', (r) => r.fulfill({ contentType: 'text/javascript', body: STAND_IN }));
  if (seeded) await page.addInitScript(SEEDED, KEY);
  await page.goto(`${srv.url}${GAME}${query}`);
  return { page, errors };
}

// Opaque pixels the mascot's canvas has drawn inside the stage's own box.
const drawn = (page) =>
  page.waitForFunction(() => {
    const stage = document.getElementById('mascot-stage');
    const canvas = stage.querySelector('canvas');
    if (!canvas || !canvas.width) return 0;
    const k = canvas.width / canvas.clientWidth;
    const x = Math.round(stage.clientWidth * 0.5 * k), y = Math.round(stage.clientHeight * 0.7 * k);
    const d = canvas.getContext('2d').getImageData(x, y, Math.round(stage.clientWidth * k), Math.round(stage.clientHeight * k)).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++;
    return n > 500 && n;
  }, null, { timeout: 15000 });

for (const [name, viewport] of [['desktop', { width: 1920, height: 1080 }], ['phone', { width: 390, height: 844 }]]) {
  test(`the hive and bee draw in the mascot stage (${name})`, async () => {
    const { page, errors } = await open(viewport);
    assert.ok(await (await drawn(page)).jsonValue());
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('the bonus award transition finishes with the bee diving and bursting first', async () => {
  const { page, errors } = await open({ width: 1920, height: 1080 }, { query: '?preview=stinger' });
  await drawn(page);
  await page.click('#preview-stinger');
  await page.waitForFunction(() => document.body.classList.contains('present-award') && !document.getElementById('bonus-intro').inert, null, { timeout: 20000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('seeded bonus spins land the same with the mascot as with a stand-in that does nothing', async () => {
  const play = async (standIn) => {
    const { page, errors } = await open({ width: 1280, height: 900 }, { standIn, seeded: true });
    await page.waitForFunction(() => document.getElementById('board').children.length === 20);
    const after = [];
    for (let left = 9; left >= 6; left--) {
      await page.waitForFunction(([k, l]) => JSON.parse(localStorage.getItem(k)).state.left === l, [KEY, left], { timeout: 30000 });
      const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY));
      after.push({ face: s.face, balance: s.balance, bank: s.state.bank, spots: s.state.spots });
    }
    await page.close();
    return { after, errors };
  };
  const real = await play(false);
  const bare = await play(true);
  assert.deepEqual(real.errors, []);
  // four real spins with new boards, and Wilds banked, so workers flew in on the way
  assert.equal(new Set(real.after.map((a) => a.face.join())).size, 4);
  assert.ok(real.after.at(-1).bank > 0);
  assert.deepEqual(real.after, bare.after);
});
