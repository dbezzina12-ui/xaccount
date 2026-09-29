import type { DetectedAccount } from '../../types';

/** Ask any already-open x.com tab which account is logged in (no new windows). */
export async function detectFromOpenTabs(): Promise<DetectedAccount | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
  for (const t of tabs) {
    if (!t.id) continue;
    try {
      const r = (await chrome.tabs.sendMessage(t.id, { type: 'xbs:getAccount' })) as { handle: string | null; displayName: string | null } | undefined;
      if (r?.handle) return { handle: r.handle, displayName: r.displayName, detectedAt: new Date().toISOString() };
    } catch {
      /* tab without our content script (e.g. opened before install) */
    }
  }
  return null;
}
