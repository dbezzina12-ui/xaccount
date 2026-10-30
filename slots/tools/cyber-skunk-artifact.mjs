#!/usr/bin/env node
// Cyber Skunk as a claude.ai artifact (the playable link for Dylan,
// https://claude.ai/artifact/Qcrirm5ru2hScWfRqADBQc, private to him).
// Writes the page (runtime/index.html without the doctype, head and body
// wrappers, which the artifact skeleton supplies) and files.json, the map of
// every runtime file to publish beside it at the same relative path, art
// included as it arrives. Publish with the Artifact tool: file_path = the page,
// root = games/cyber-skunk/runtime, files = files.json; pass url = the link above
// from another session so the same link updates.
//
//   node tools/cyber-skunk-artifact.mjs OUT_DIR
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RT = fileURLToPath(new URL('../games/cyber-skunk/runtime/', import.meta.url)), out = process.argv[2];
if (!out) throw Error('usage: node tools/cyber-skunk-artifact.mjs OUT_DIR');
mkdirSync(out, { recursive: true });

const html = readFileSync(join(RT, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<meta charset[^>]*>\n?/, '').replace(/<meta name="viewport"[^>]*>\n?/, '')
  .replace(/<title>[^<]*<\/title>/, '<title>Cyber Skunk</title>').replace(/\?v=\d+/g, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/\?v=\d+/g, '');
writeFileSync(join(out, 'cyber-skunk.html'), `<!-- Cyber Skunk, published from games/cyber-skunk/runtime/index.html (wrapper tags left to the artifact skeleton). -->\n${head.trim()}\n<style>:root{color-scheme:dark}html,body{background:#101820}</style>\n${body.trim()}\n`);

// Everything the game loads: code, styles, data, fonts and art (not docs or licences).
const SHIP = new Set(['.js', '.css', '.json', '.html', '.png', '.webp', '.jpg', '.ttf']), TYPES = { '.ttf': 'font/ttf' };
const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name), rel = relative(RT, path).split('\\').join('/');
    if (statSync(path).isDirectory()) walk(path);
    else if (SHIP.has(extname(name)) && rel !== 'index.html') files[rel] = TYPES[extname(name)] ? { from: rel, contentType: TYPES[extname(name)] } : rel;
  }
})(RT);
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 1) + '\n');
console.log(`page: ${join(out, 'cyber-skunk.html')}\nfiles: ${Object.keys(files).length} (${join(out, 'files.json')})`);
