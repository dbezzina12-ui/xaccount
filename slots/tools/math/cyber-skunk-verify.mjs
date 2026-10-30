#!/usr/bin/env node
// Replays every Cyber Skunk catalog entry through the engine and checks it pays
// exactly the catalog's value; then draws rounds the way the game does
// (runtime/catalog.js) and checks those too. Exits non-zero on any mismatch.
//
//   node tools/math/cyber-skunk-verify.mjs [--draws 200000]
const RT = new URL('../../games/cyber-skunk/runtime/', import.meta.url);
const { default: data } = await import(new URL('catalog-data.js', RT));
const { playRound, seeded } = await import(new URL('engine.js', RT));
const { drawRound } = await import(new URL('catalog.js', RT));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

let checked = 0, bad = 0;
const fail = (msg) => { bad++; if (bad < 20) console.error(msg); };
for (const [name, rows] of Object.entries(data.pools)) {
  const [kind, mode, tier] = name.split('-'), t0 = Date.now();
  for (const [seed, weight, value] of rows) {
    if (!(Number.isInteger(weight) && weight >= 1)) fail(`${name} ${seed}: weight ${weight}`);
    let paid;
    if (kind === 'bonus') paid = playRound({ rng: seeded(seed), forceBonus: mode }).total;
    else if (kind === 'spin') { const r = playRound({ mode, rng: seeded(seed) }); if (r.tier) fail(`${name} ${seed}: a no-bonus spin triggers ${r.tier}`); paid = r.total; }
    else paid = playRound({ mode, rng: seeded(seed), bonusRng: seeded(1), triggerScatters: data.scatters[tier] }).events.find((e) => e.type === 'wins').paid;
    if (paid !== value) fail(`${name} seed ${seed}: engine pays ${paid}, catalog says ${value}`);
    if (value % 10) fail(`${name} seed ${seed}: ${value} is not a whole 0.1x`);
    checked++;
  }
  const total = rows.reduce((a, r) => a + r[1], 0);
  if (total !== data.total) fail(`${name}: weights sum to ${total}, not ${data.total}`);
  console.log(`${name.padEnd(24)} ${rows.length.toString().padStart(6)} entries replayed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
for (const [mode, m] of Object.entries(data.modes)) if (m.tiers && Object.values(m.tiers).reduce((a, b) => a + b, 0) !== data.total) fail(`${mode}: tier weights do not sum to ${data.total}`);
// Rounds drawn as the game draws them (drawRound throws on a mismatch).
const draws = Number(arg('--draws', 2e5));
let rnd = 7; const ticket = () => { rnd = (rnd * 48271) % 2147483647; return Math.floor((rnd / 2147483647) * data.total); };
for (const mode of Object.keys(data.modes)) {
  const n = mode === 'ventbreak' || mode === 'overpressure' ? draws / 20 : draws;
  for (let k = 0; k < n; k++) { try { drawRound(mode, ticket); } catch (e) { fail(e.message); } }
  console.log(`${mode.padEnd(13)} ${n.toLocaleString('en-US')} drawn rounds replayed`);
}
console.log(bad ? `FAILED: ${bad} mismatches` : `OK: ${checked.toLocaleString('en-US')} catalog entries and every drawn round replay exactly`);
process.exit(bad ? 1 : 0);
