#!/usr/bin/env node
// RoboBees as a private claude.ai artifact (Dylan's playable link). Writes the page (dist/index.html without the
// doctype, head and body wrappers, which the artifact skeleton supplies) and files.json, every other dist file at
// its own relative path, with content types the service can't infer from the extension (.mjs modules must be
// served as JavaScript). Publish with the Artifact tool: file_path = the page, root = games/robobees/dist,
// files = files.json.
//
//   node tools/robobees-artifact.mjs OUT_DIR
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../games/robobees/dist/', import.meta.url)), out = process.argv[2];
if (!out) throw Error('usage: node tools/robobees-artifact.mjs OUT_DIR');
mkdirSync(out, { recursive: true });

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const headStart = html.indexOf('<head>') + 6, headEnd = html.indexOf('</head>');
const head = html.slice(headStart, headEnd).replace(/<meta charset[^>]*>/, '').replace(/<meta name="viewport"[^>]*>/, '');
const bodyOpen = html.indexOf('<body', headEnd), body = html.slice(html.indexOf('>', bodyOpen) + 1, html.lastIndexOf('</body>'));
writeFileSync(join(out, 'robobees.html'), `<!-- RoboBees, published from games/robobees/dist/index.html (wrapper tags left to the artifact skeleton). -->\n${head.trim()}\n<style>:root{color-scheme:dark}html,body{background:#181a1b}</style>\n${body.trim()}\n`);

const TYPES = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const SHIP = new Set(['.mjs', '.js', '.css', '.json', '.svg', '.png', '.webp', '.jpg', '.mp3', '.ttf', '.txt']);
const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name), rel = relative(DIST, path).split('\\').join('/');
    if (statSync(path).isDirectory()) walk(path);
    else if (SHIP.has(extname(name)) && rel !== 'index.html') files[rel] = TYPES[extname(name)] ? { from: rel, contentType: TYPES[extname(name)] } : rel;
  }
})(DIST);
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 1) + '\n');
console.log(`page: ${join(out, 'robobees.html')}\nfiles: ${Object.keys(files).length} (${join(out, 'files.json')})`);
