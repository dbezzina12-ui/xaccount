/**
 * Background service worker. Deliberately minimal: the dashboard tab is the
 * orchestrator (so nothing depends on the service worker staying alive).
 *
 *  - Toolbar icon click → open (or focus) the dashboard tab.
 */

const DASHBOARD = chrome.runtime.getURL('dashboard.html');

async function openDashboard(): Promise<void> {
  try {
    // getContexts finds our own tabs without needing the "tabs" permission.
    const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB], documentUrls: [DASHBOARD, `${DASHBOARD}#settings`] });
    const existing = contexts.find((c) => c.tabId !== -1);
    if (existing) {
      await chrome.tabs.update(existing.tabId, { active: true });
      if (existing.windowId !== -1) await chrome.windows.update(existing.windowId, { focused: true });
      return;
    }
  } catch {
    /* fall through to creating a tab */
  }
  await chrome.tabs.create({ url: DASHBOARD });
}

chrome.action.onClicked.addListener(() => {
  void openDashboard();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') void openDashboard();
});
