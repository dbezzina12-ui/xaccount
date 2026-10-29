#!/usr/bin/env node
// Builds Zombify's Stake Engine upload (Dylan, 2026-10-29):
//
//   dist/stake/zombify/frontend/   the static game (index.html at its root), for
//                                  Engine's Files page -> Front End
//   dist/stake/zombify/math/       index.json, lookup tables and books, for
//                                  Engine's Files page -> Math
//   dist/stake/zombify/*.zip       the same two folders zipped, to hand over
//
// The front end is the game's runtime with only the assets its code, styles
// and pages refer to (by file or by folder); review pages and source archives
// stay out. The math comes from tools/stake/zombify-export.mjs.
//
//   npm run studio:prepare      (once: the art)
//   node tools/stake/build-zombify.mjs [--skip-math]

import { readdirSync, readFileSync, statSync, mkdirSync, rmSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const RUNTIME = join(ROOT, 'games/zombify/runtime'), OUT = join(ROOT, 'dist/stake/zombify'), FRONT = join(OUT, 'frontend');
const SKIP = [/\.zip$/i, /^rig-review\.html$/, /(^|\/)\.gitignore$/, /(^|\/)\.DS_Store$/];

const manifest = JSON.parse(readFileSync(join(ROOT, 'games/zombify/import-manifest.json'), 'utf8'));
const missing = manifest.files.filter((f) => !f.path.endsWith('.html') && !existsSync(join(RUNTIME, f.path)));
if (missing.length) { console.error(`${missing.length} art files are missing (${missing[0].path} …): run npm run studio:prepare first.`); process.exit(1); }

const walk = (dir) => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [relative(RUNTIME, path).split('\\').join('/')]; });
const all = walk(RUNTIME).filter((f) => !SKIP.some((re) => re.test(f)));
const isAsset = (f) => /(^|\/)assets\//.test(f);
const code = all.filter((f) => !isAsset(f));

// Everything the code, styles, pages and data files mention: a file by its
// path from any folder level, or a whole folder (dynamic file names).
const text = code.filter((f) => /\.(js|mjs|css|html|json)$/.test(f)).map((f) => readFileSync(join(RUNTIME, f), 'utf8')).join('\n')
  + all.filter((f) => isAsset(f) && /\.(json|atlas|css)$/.test(f)).map((f) => readFileSync(join(RUNTIME, f), 'utf8')).join('\n');
const mentioned = (asset) => {
  const parts = asset.split('/'), name = parts.at(-1);
  // The file by its path from any folder level, or its folder (names built in code).
  for (let i = 0; i < parts.length - 1; i++) if (text.includes(parts.slice(i).join('/'))) return true;
  for (let i = 1; i < parts.length - 1; i++) { const folder = parts.slice(i, -1).join('/') + '/'; if (folder.length > 8 && text.includes(folder)) return true; }
  // Its name, alone or beside one of its folder names (paths joined from parts). When in doubt, ship it.
  return text.includes(name) && (name.length >= 8 || parts.slice(1, -1).some((dir) => dir.length > 3 && text.includes(dir)));
};
const picked = all.filter((f) => isAsset(f) && mentioned(f));
// A shipped data file (a rig, an atlas) loads files named inside it: its folder ships whole.
const dataFolders = picked.filter((f) => /\.(json|atlas)$/.test(f) && f.split('/').length > 2).map((f) => f.slice(0, f.lastIndexOf('/') + 1));
const assets = all.filter((f) => isAsset(f) && (picked.includes(f) || dataFolders.some((d) => f.startsWith(d))));
const files = [...code, ...assets];

rmSync(FRONT, { recursive: true, force: true });
for (const f of files) { mkdirSync(dirname(join(FRONT, f)), { recursive: true }); copyFileSync(join(RUNTIME, f), join(FRONT, f)); }
const size = (list) => list.reduce((n, f) => n + statSync(join(RUNTIME, f)).size, 0) / 1048576;
console.log(`front end: ${files.length} files, ${size(files).toFixed(1)} MB (left out ${all.length - files.length} unreferenced assets, ${size(all.filter((f) => !files.includes(f))).toFixed(1)} MB)`);
writeFileSync(join(OUT, 'frontend-files.txt'), files.join('\n') + '\n');

if (!process.argv.includes('--skip-math')) execFileSync(process.execPath, [join(ROOT, 'tools/stake/zombify-export.mjs'), '--out', join(OUT, 'math')], { stdio: 'inherit' });

// Zips to hand over (Python's zipfile: no extra tools needed).
for (const name of ['frontend', 'math']) {
  rmSync(join(OUT, `zombify-${name}.zip`), { force: true });
  execFileSync('python3', ['-c', 'import shutil,sys; shutil.make_archive(sys.argv[1], "zip", sys.argv[2])', join(OUT, `zombify-${name}`), join(OUT, name)]);
}
console.log(`wrote ${relative(ROOT, OUT)}/{frontend,math} and zombify-frontend.zip, zombify-math.zip`);
