// Studio chat in Chromium against the real server code: /api/studio/* is routed
// into server/service.js in this process (SQLite D1, in-memory R2), with stub
// providers in place of the OpenAI and Anthropic APIs.
//
//   npm run test:studio-browser            (STUDIO_SHOTS=1 also saves studio/shots/chat-*.jpg)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, chromium, ROOT } from '../../tools/lib/browser.mjs';
import { handleStudio, providers } from '../../server/service.js';
import { environment } from '../lib/studio-env.mjs';

let srv;
let browser;
const FAKE = await readFile(join(ROOT, 'tests/browser/fake-runtime.html'), 'utf8');
before(async () => {
  srv = await serve();
  browser = await chromium();
});
after(async () => {
  await browser?.close();
  srv?.close();
});

async function openChat(env, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(() => {
    const tools = {};
    window.__tools = tools;
    document.modelContext = { registerTool: (spec) => { tools[spec.name] = spec; } };
  });
  await page.route('**/games/zombify/runtime/index.html', (route) => route.fulfill({ body: FAKE, contentType: 'text/html' }));
  // The Sites proxy adds the signed-in user; everything else is the browser's real request.
  await page.route('**/api/studio/**', async (route) => {
    const r = route.request();
    const headers = { ...r.headers(), 'oai-authenticated-user-id': 'dylan', origin: new URL(r.url()).origin };
    const res = await handleStudio(new Request(r.url(), { method: r.method(), headers, body: r.postData() ?? undefined }), env);
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.goto(`${srv.url}studio/index.html`);
  await page.waitForFunction(() => window.__tools?.read_slot_studio && document.getElementById('canvas-loading').hidden, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('spin').disabled, null, { timeout: 15000 });
  await page.click('#chat-open');
  await page.waitForFunction(() => !document.getElementById('chat-claude').textContent.includes('checking'));
  page.ctx = ctx;
  return page;
}
const transcript = (page) => page.$$eval('#chat-messages .chat-message', (els) => els.map((e) => [e.querySelector('b').textContent, e.querySelector('p').textContent]));
const spoken = async (page) => (await transcript(page)).filter((l) => l[0] !== 'Studio');
const background = (page) => page.evaluate(async () => (await window.__tools.read_slot_studio.execute({})).project.scenes.desktop.background);
async function send(page, text) {
  await page.fill('#chat-input', text);
  await page.click('#chat-send');
  await page.waitForFunction(() => !document.getElementById('chat-send').disabled && !document.querySelector('#chat-messages .chat-message.assistant:last-child p')?.textContent.match(/^$/));
}
async function shot(page, name) {
  if (!process.env.STUDIO_SHOTS) return;
  await mkdir(join(ROOT, 'studio/shots'), { recursive: true });
  await page.screenshot({ path: join(ROOT, `studio/shots/${name}.jpg`), quality: 82 });
}

test('Dylan picks Claude or OpenAI, and an OpenAI handoff starts Claude automatically', async (t) => {
  const saved = { openai: { ...providers.openai }, claude: { ...providers.claude } };
  t.after(() => { Object.assign(providers.openai, saved.openai); Object.assign(providers.claude, saved.claude); });
  const seen = [];
  providers.openai.run = async (env, input) => {
    seen.push(['openai', input.history]);
    return { text: 'Brightened the desktop background. Claude should check the reel lock next.', operations: [{ type: 'background', scene: 'desktop', values: { brightness: 125 } }], handoff: { to: 'claude', summary: 'Brightened desktop.', nextTask: 'Check the spin lock with the brighter scene.' } };
  };
  providers.claude.run = async (env, input, { progress }) => {
    seen.push(['claude', input.history, input.message]);
    progress({ type: 'text', text: 'Raising contrast…' });
    return { text: seen.length === 1 ? 'Raised desktop contrast to 115.' : 'Checked the lock: it holds through the bonus. Contrast stays at 115.', operations: [{ type: 'background', scene: 'desktop', values: { contrast: 115 } }], handoff: null };
  };
  const env = environment({ ANTHROPIC_API_KEY: 'test-only' });
  const page = await openChat(env);

  // Choosing Claude labels the reply as Claude and applies its edit as one Undo step.
  await page.click('#chat-claude');
  assert.equal(await page.getAttribute('#chat-claude', 'aria-checked'), 'true');
  assert.equal(await page.textContent('#chat-handoff-prompt'), 'Hand off to OpenAI');
  await send(page, 'Bump the desktop contrast a little.');
  await page.waitForFunction(() => document.querySelector('#chat-messages .chat-message.claude'));
  assert.deepEqual((await transcript(page)).slice(-3), [['You', 'Bump the desktop contrast a little.'], ['Claude', 'Raised desktop contrast to 115.'], ['Studio', 'Scene updated · Undo is available.']]);
  assert.equal((await background(page)).contrast, 115);
  await shot(page, 'chat-claude-desktop');

  // OpenAI replies, hands off, and Claude continues without another click.
  await page.click('#chat-connection');
  await send(page, 'Make the desktop background brighter.');
  await page.waitForFunction(() => document.querySelectorAll('#chat-messages .chat-message.claude').length === 2, null, { timeout: 10000 });
  assert.deepEqual((await spoken(page)).slice(-3).map((l) => l[0]), ['You', 'OpenAI', 'Claude']);
  assert.equal((await background(page)).brightness, 125);
  await page.click('.chat-handoff-panel summary');
  await page.waitForFunction(() => document.getElementById('chat-handoffs').textContent.includes('To Claude · completed'));

  // Each model receives the other's replies labelled as the other's, never as its own.
  const [, openaiHistory] = seen.find((s) => s[0] === 'openai');
  assert.deepEqual(openaiHistory.filter((m) => m.role === 'assistant').map((m) => m.speaker), ['claude']);
  const [, claudeHistory, claudeTask] = seen.at(-1);
  assert.deepEqual(claudeHistory.filter((m) => m.role === 'assistant').map((m) => m.speaker), ['claude', 'openai']);
  assert.match(claudeTask, /^Completed handoff from the OpenAI assistant:\nBrightened desktop\.\nNext task:\nCheck the spin lock/);
  await shot(page, 'chat-handoff-desktop');

  // The choice survives a reload; the transcript keeps who said what.
  await page.reload();
  await page.click('#chat-open');
  await page.waitForFunction(() => !document.getElementById('chat-claude').textContent.includes('checking'));
  assert.equal(await page.getAttribute('#chat-connection', 'aria-checked'), 'true');
  assert.equal((await spoken(page)).at(-1)[0], 'Claude');
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});

test('an unconnected assistant is selectable but never sent to, and its queue item waits', async (t) => {
  const saved = { openai: { ...providers.openai } };
  t.after(() => Object.assign(providers.openai, saved.openai));
  providers.openai.run = async () => ({ text: 'Done. Handing the engine check to Claude.', operations: [], handoff: { to: 'claude', summary: 'Reviewed layout.', nextTask: 'Check the spin lock.' } });
  const env = environment();
  const page = await openChat(env, { width: 390, height: 844 });
  assert.match(await page.textContent('#chat-claude'), /Claude · setup needed/);
  await page.click('#chat-claude');
  await page.fill('#chat-input', 'Hello Claude');
  await page.click('#chat-send');
  assert.match(await page.textContent('#chat-status'), /Claude is not connected yet/);
  assert.equal(await page.inputValue('#chat-input'), 'Hello Claude', 'the message stays in the box');
  await page.click('#chat-connection');
  await send(page, 'Review the layout.');
  await page.waitForFunction(() => document.getElementById('chat-status').textContent.includes('Waiting for Claude to connect'));
  await page.click('.chat-handoff-panel summary');
  await page.waitForFunction(() => document.getElementById('chat-handoffs').textContent.includes('waiting connection'));
  const buttons = await page.$$eval('#chat-handoffs article button', (b) => b.map((x) => x.textContent));
  assert.deepEqual(buttons, ['Stop', 'Copy handoff'], 'no Start until Claude is connected');
  await shot(page, 'chat-waiting-mobile');
  await page.click('#chat-handoffs article button:text("Stop")');
  await page.waitForFunction(() => document.getElementById('chat-handoffs').textContent.includes('To Claude · stopped'));
  assert.deepEqual(page.errors, []);
  await page.ctx.close();
});
