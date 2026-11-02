#!/usr/bin/env node
// Static release-package check for the Cyber Skunk opening-art batch.
// It runs the real artifact packager, resolves local HTML/CSS/JS references,
// and records deterministic hashes without claiming browser or hosted parity.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLOTS = resolve(HERE, '../../../../..');
const RUNTIME = join(SLOTS, 'games/cyber-skunk/runtime');
const OUT = mkdtempSync(join(tmpdir(), 'cyber-skunk-package-'));
const slash = (value) => value.split('\\').join('/');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function walk(dir, list = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, list);
    else list.push(path);
  }
  return list;
}

function cleanRef(raw) {
  const value = raw.trim().replace(/^['"]|['"]$/g, '').split(/[?#]/, 1)[0];
  if (!value || /^(?:data:|blob:|https?:|#|\/\/)/.test(value)) return null;
  return value;
}

function refsFrom(path, text) {
  const refs = [];
  const add = (raw) => { const ref = cleanRef(raw); if (ref) refs.push(ref); };
  if (extname(path) === '.html') {
    for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) add(match[1]);
  }
  if (extname(path) === '.css') {
    for (const match of text.matchAll(/url\(([^)]+)\)/g)) add(match[1]);
  }
  if (extname(path) === '.js') {
    for (const match of text.matchAll(/\bimport\s*(?:\(\s*)?["']([^"']+)["']/g)) add(match[1]);
    for (const match of text.matchAll(/["']((?:\.\.?\/)?assets\/[^"']+\.[a-z0-9]+)["']/gi)) add(match[1]);
  }
  return refs;
}

try {
  execFileSync(process.execPath, ['tools/cyber-skunk-artifact.mjs', OUT], { cwd: SLOTS, stdio: 'pipe' });
  const packaged = JSON.parse(readFileSync(join(OUT, 'files.json'), 'utf8'));
  const packagedNames = new Set(Object.keys(packaged));
  const sources = walk(RUNTIME).filter((path) => ['.html', '.css', '.js'].includes(extname(path)));
  const checks = [];

  for (const source of sources) {
    const sourceRel = slash(relative(RUNTIME, source));
    for (const ref of refsFrom(source, readFileSync(source, 'utf8'))) {
      const target = normalize(join(dirname(sourceRel), ref));
      const targetPath = join(RUNTIME, target);
      checks.push({ source: sourceRel, ref, target: slash(target) });
      if (!existsSync(targetPath)) throw new Error(`${sourceRel}: missing local reference ${ref}`);
      if (slash(target) !== 'index.html' && !packagedNames.has(slash(target))) {
        throw new Error(`${sourceRel}: ${ref} exists but is absent from files.json`);
      }
    }
  }

  const required = [
    'assets/ui/splash-desktop.webp',
    'assets/ui/splash-mobile.webp',
    'styles.css',
    'entry-shop.css',
    'launch.js',
    'app.js',
  ];
  for (const name of required) if (!packagedNames.has(name)) throw new Error(`artifact package omits ${name}`);

  const index = readFileSync(join(RUNTIME, 'index.html'), 'utf8');
  const css = readFileSync(join(RUNTIME, 'styles.css'), 'utf8');
  if (!index.includes('styles.css?v=20')) throw new Error('index.html does not select styles.css?v=20');
  if (!index.includes('splash-desktop.webp') || !index.includes('splash-mobile.webp')) throw new Error('responsive splash preloads are missing');
  if (!css.includes('url(assets/ui/splash-desktop.webp)') || !css.includes('url(assets/ui/splash-mobile.webp)')) throw new Error('intro does not select both splash assets');
  if (!/\.intro-mark\{[^}]*opacity:0/.test(css)) throw new Error('the duplicate live intro logo is not suppressed');

  const report = {
    status: 'pass',
    scope: 'static local package only; not browser QA or hosted served-file parity',
    artifact_file_count: packagedNames.size,
    static_reference_count: checks.length,
    missing_references: [],
    required_files: Object.fromEntries(required.map((name) => [name, hash(join(RUNTIME, name))])),
    package_page_sha256: hash(join(OUT, 'cyber-skunk.html')),
    package_files_json_sha256: hash(join(OUT, 'files.json')),
  };
  writeFileSync(join(HERE, 'package-manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PASS: ${packagedNames.size} packaged files, ${checks.length} static references, 0 missing`);
} finally {
  rmSync(OUT, { recursive: true, force: true });
}
