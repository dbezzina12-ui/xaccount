import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frames } from '../presentation/frames.mjs';

const { fixtures } = JSON.parse(readFileSync(new URL('../fixtures/rounds.json', import.meta.url), 'utf8'));

test('presented drops, refills and job changes reach every settled board', () => {
  for (const fixture of fixtures) {
    const { spin, bonus } = fixture.round;
    for (const result of [spin, ...(bonus?.spins ?? [])].filter(Boolean)) {
      let board = result.board;
      for (const step of result.steps) {
        for (const frame of frames(board, step)) board = frame.board;
        assert.deepEqual(board, step.after, fixture.name);
      }
    }
  }
});
