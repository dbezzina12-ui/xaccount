// Shared by the studio browser suites.

// Captures the studio's agent tools so tests can read/edit the project
// through the same validated API an agent uses.
export const AGENT_TOOLS = () => {
  const tools = {};
  window.__tools = tools;
  document.modelContext = { registerTool: (spec) => { tools[spec.name] = spec; } };
};
export const runtime = (page) => page.frames().find((f) => f.url().includes('/games/zombify/runtime/'));
export const project = (page) => page.evaluate(() => window.__tools.read_slot_studio.execute({}));
export const agentEdit = (page, operations) => page.evaluate((ops) => window.__tools.edit_slot_studio.execute({ operations: ops }), operations);
export const isBusy = (page) => page.evaluate(() => document.body.classList.contains('busy'));
export async function whenReady(page, timeout = 15000) {
  await page.waitForFunction(() => window.__tools?.read_slot_studio && document.getElementById('canvas-loading').hidden, null, { timeout });
  await page.waitForFunction(() => !document.getElementById('spin').disabled, null, { timeout });
}
export async function until(fn, timeout = 10000) {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - t0 > timeout) throw Error('timed out');
    await new Promise((r) => setTimeout(r, 40));
  }
}
