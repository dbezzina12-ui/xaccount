#!/usr/bin/env node
// Regenerates the reel strips in a game's model.json from its
// math/reel-design.json (symbol counts + shuffle seed per reel).
//
//   node tools/math/build-reels.mjs games/game-001

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStrip } from './strips.js';
import { compileModel } from '../../engine/core/model.js';
import { formatModel } from './format.js';

const dir = process.argv[2] ?? 'games/game-001';
const modelPath = join(dir, 'model.json');
const design = JSON.parse(readFileSync(join(dir, 'math/reel-design.json'), 'utf8'));
const model = JSON.parse(readFileSync(modelPath, 'utf8'));
const scatter = Object.keys(model.symbols).find((s) => model.symbols[s].kind === 'scatter');
for (const set of ['base', 'free']) {
  model.reels[set] = design[set].map((r) => buildStrip(r.counts, { scatter, seed: r.seed, rows: model.grid.rows }));
}
compileModel(model); // throws if the result breaks a model rule
writeFileSync(modelPath, formatModel(model));
console.log(`rebuilt ${modelPath}: base ${model.reels.base.map((s) => s.split(' ').length).join('/')}, free ${model.reels.free.map((s) => s.split(' ').length).join('/')}`);
