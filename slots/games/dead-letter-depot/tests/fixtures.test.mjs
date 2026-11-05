// The fixture set for the screen (fixtures/rounds.json) replays exactly
// through the engine, settlement included. Regenerate it with
// node tools/math/dead-letter-depot-fixtures.mjs after any outcome change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playRound, seeded, ENGINE_VERSION } from '../engine/engine.js';
import { settle } from '../engine/settle.js';
import { SCENARIOS } from '../../../tools/math/dead-letter-depot-fixtures.mjs';

const file = JSON.parse(readFileSync(new URL('../fixtures/rounds.json', import.meta.url), 'utf8'));

test('fixtures were recorded by this engine and cover every scenario (the cap may be missing)', () => {
  assert.equal(file.engine, ENGINE_VERSION);
  const names = new Set(file.fixtures.map((f) => f.name));
  for (const [name] of SCENARIOS) assert.ok(names.has(name) || (name === 'cap' && file.missing.includes('cap')), name);
});

test('every fixture replays to the same payload and settlement', () => {
  for (const f of file.fixtures) {
    const round = playRound({ mode: f.mode, rng: seeded(f.seed) });
    assert.deepEqual(round, f.round, f.name);
    assert.deepEqual(settle(round, f.bet, f.balance), f.settlement, f.name);
  }
});
