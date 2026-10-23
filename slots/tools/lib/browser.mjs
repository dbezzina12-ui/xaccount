// Shared by the screenshot and soak tools: a tiny static server for the
// repo root and a Playwright Chromium (local install or global fallback).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/plain' };

export async function serve() {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

export async function chromium() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    pw = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
  }
  return pw.chromium.launch();
}

// Replaces the page's clock (performance.now, requestAnimationFrame,
// setTimeout) with a virtual one advanced by window.__step(ms), so tests can
// fast-forward or capture exact frames. Call window.__startVirtual() first.
export const VIRTUAL_CLOCK = () => {
  let vt = 0;
  let rafs = [];
  let timers = [];
  let id = 1;
  const realNow = performance.now.bind(performance);
  const origRaf = window.requestAnimationFrame.bind(window);
  const origCaf = window.cancelAnimationFrame.bind(window);
  const pendingReal = new Map(); // frames queued before the switch move over
  const origST = window.setTimeout.bind(window);
  const origCT = window.clearTimeout.bind(window);
  window.__virtual = false;
  window.__startVirtual = () => {
    vt = realNow();
    window.__virtual = true;
    for (const [h, cb] of pendingReal) {
      origCaf(h);
      rafs.push(cb);
    }
    pendingReal.clear();
  };
  performance.now = () => (window.__virtual ? vt : realNow());
  window.requestAnimationFrame = (cb) => {
    if (window.__virtual) return rafs.push(cb), 0;
    const h = origRaf((ts) => {
      pendingReal.delete(h);
      cb(ts);
    });
    pendingReal.set(h, cb);
    return h;
  };
  window.setTimeout = (cb, ms = 0) => {
    if (!window.__virtual) return origST(cb, ms);
    const t = { id: id++, at: vt + ms, cb };
    timers.push(t);
    return t.id;
  };
  window.clearTimeout = (i) => {
    timers = timers.filter((t) => t.id !== i);
    origCT(i);
  };
  const flush = () => new Promise((r) => queueMicrotask(r));
  window.__step = async (ms) => {
    vt += ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= vt).sort((a, b) => a.at - b.at);
      if (!due.length) break;
      timers = timers.filter((t) => !due.includes(t));
      for (const t of due) t.cb();
      for (let i = 0; i < 4; i++) await flush();
    }
    const list = rafs;
    rafs = [];
    list.forEach((cb) => cb(vt));
    for (let i = 0; i < 4; i++) await flush();
  };
};
