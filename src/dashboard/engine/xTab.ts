/**
 * Controls the dedicated X tab used for automation and talks to the content
 * script running in it.
 *
 * A separate, visible window is used so that (a) X is never a background tab
 * (Chrome throttles those heavily) and (b) the dashboard stays visible next
 * to it for progress.
 */
import { X_URLS } from '../../content/xSelectors';
import type { PingResponse, PortInbound, PortOutbound, ScheduleJob, ScheduleResult, ScheduledListResponse, LogLevel } from '../../types';
import { RUN_PORT_NAME } from '../../types';
import { getMedia } from '../../storage/media';

const CHUNK_BYTES = 4 * 1024 * 1024;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class TabGoneError extends Error {}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export class XTabController {
  tabId: number | null = null;
  windowId: number | null = null;
  private createdWindow = false;

  async isAlive(): Promise<boolean> {
    if (this.tabId === null) return false;
    try {
      await chrome.tabs.get(this.tabId);
      return true;
    } catch {
      return false;
    }
  }

  /** Open (or reuse) the automation window and load `url`. */
  async open(url: string = X_URLS.home): Promise<void> {
    if (await this.isAlive()) {
      await this.navigate(url);
      return;
    }
    const win = await chrome.windows.create({ url, focused: true, type: 'normal', width: 1200, height: 950 });
    const tab = win?.tabs?.[0];
    if (!win || !tab?.id) throw new Error('Could not open an X window.');
    this.windowId = win.id ?? null;
    this.tabId = tab.id;
    this.createdWindow = true;
    await this.waitForComplete(this.tabId, 45_000, true);
    try {
      await this.waitForContent(10_000);
    } catch (e) {
      if (e instanceof TabGoneError) throw e;
      // First load of a fresh window occasionally fails (network hiccup, X
      // interstitial). One reload is cheap and usually fixes it.
      const done = this.waitForComplete(this.tabId, 45_000);
      await chrome.tabs.reload(this.tabId);
      await done;
      await this.waitForContent();
    }
  }

  async close(): Promise<void> {
    try {
      if (this.createdWindow && this.windowId !== null) await chrome.windows.remove(this.windowId);
      else if (this.tabId !== null) await chrome.tabs.remove(this.tabId);
    } catch {
      /* already closed */
    }
    this.tabId = null;
    this.windowId = null;
    this.createdWindow = false;
  }

  async focus(): Promise<void> {
    if (this.windowId !== null) await chrome.windows.update(this.windowId, { focused: true }).catch(() => {});
  }

  /** Full page load of `url` in the automation tab, then wait for the content script. */
  async navigate(url: string): Promise<void> {
    if (!(await this.isAlive())) throw new TabGoneError('The X automation tab was closed.');
    const id = this.tabId!;
    const tab = await chrome.tabs.get(id);
    const done = this.waitForComplete(id, 45_000);
    if (tab.url === url) await chrome.tabs.reload(id);
    else await chrome.tabs.update(id, { url });
    await done;
    await this.waitForContent();
  }

  private waitForComplete(tabId: number, timeout: number, alreadyNavigating = false): Promise<void> {
    return new Promise((resolve, reject) => {
      let sawLoading = alreadyNavigating;
      const timer = setTimeout(() => {
        cleanup();
        // Some SPA navigations never report "loading"; accept if complete now.
        chrome.tabs.get(tabId).then((t) => (t.status === 'complete' ? resolve() : reject(new Error('X page did not finish loading.'))), () => reject(new TabGoneError('The X automation tab was closed.')));
      }, timeout);
      const onUpdated = (id: number, info: { status?: string }) => {
        if (id !== tabId) return;
        if (info.status === 'loading') sawLoading = true;
        if (info.status === 'complete' && sawLoading) {
          cleanup();
          resolve();
        }
      };
      const onRemoved = (id: number) => {
        if (id !== tabId) return;
        cleanup();
        reject(new TabGoneError('The X automation tab was closed.'));
      };
      const cleanup = () => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
      if (alreadyNavigating) {
        chrome.tabs.get(tabId).then(
          (t) => {
            if (t.status === 'complete') {
              cleanup();
              resolve();
            }
          },
          () => {},
        );
      }
    });
  }

  async ping(): Promise<PingResponse | null> {
    if (this.tabId === null) return null;
    try {
      const r = (await chrome.tabs.sendMessage(this.tabId, { type: 'xbs:ping' })) as PingResponse | undefined;
      return r?.ok ? r : null;
    } catch {
      return null;
    }
  }

  /** Wait until the content script answers; inject it once if needed. */
  async waitForContent(timeout = 20_000): Promise<PingResponse> {
    const start = Date.now();
    let injected = false;
    while (Date.now() - start < timeout) {
      const p = await this.ping();
      if (p) return p;
      if (!injected && Date.now() - start > 6000 && this.tabId !== null) {
        injected = true;
        await chrome.scripting.executeScript({ target: { tabId: this.tabId }, files: ['content.js'] }).catch(() => {});
      }
      await sleep(300);
    }
    if (!(await this.isAlive())) throw new TabGoneError('The X automation tab was closed.');
    throw new Error('The extension could not connect to the X tab. Make sure x.com loads normally, then retry.');
  }

  async getAccount(): Promise<{ handle: string | null; displayName: string | null; loggedIn: boolean }> {
    if (this.tabId === null) throw new TabGoneError('No X tab.');
    // The side nav can render a moment after load.
    const start = Date.now();
    let last = { handle: null as string | null, displayName: null as string | null, loggedIn: false };
    while (Date.now() - start < 12_000) {
      try {
        last = await chrome.tabs.sendMessage(this.tabId, { type: 'xbs:getAccount' });
        if (last?.handle) return last;
      } catch {
        /* not ready */
      }
      await sleep(500);
    }
    return last;
  }

  async readScheduledList(): Promise<ScheduledListResponse> {
    if (this.tabId === null) throw new TabGoneError('No X tab.');
    return chrome.tabs.sendMessage(this.tabId, { type: 'xbs:readScheduledList' });
  }

  /**
   * Transfer the post's media (chunked base64 over a Port, with acks for
   * back-pressure), then run the schedule job in the content script.
   */
  runJob(
    job: ScheduleJob,
    onLog: (level: LogLevel, message: string) => void,
    onStep: (step: string) => void,
  ): Promise<ScheduleResult> {
    if (this.tabId === null) return Promise.reject(new TabGoneError('No X tab.'));
    const port = chrome.tabs.connect(this.tabId, { name: RUN_PORT_NAME });
    let lastStep = 'transfer-media';
    let settled = false;
    const acks = new Map<string, () => void>();

    return new Promise<ScheduleResult>((resolve) => {
      const finish = (r: ScheduleResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        try {
          port.disconnect();
        } catch {
          /* ignore */
        }
        resolve(r);
      };
      const clickedPhase = () => lastStep === 'schedule' || lastStep === 'verify-scheduled';
      // Overall guard (the content script has its own finer timeouts).
      const guard = setTimeout(
        () => finish({ ok: false, dryRun: job.dryRun, step: lastStep, uncertain: clickedPhase(), error: 'Timed out waiting for the X tab to finish this post.' }),
        30 * 60_000,
      );

      port.onDisconnect.addListener(() => {
        finish({
          ok: false,
          dryRun: job.dryRun,
          step: lastStep,
          uncertain: clickedPhase(),
          error: clickedPhase()
            ? "The X tab navigated or closed right after Schedule was clicked. Check X's scheduled posts before retrying."
            : 'The X tab navigated or closed while this post was being prepared.',
        });
      });

      port.onMessage.addListener((m: PortOutbound) => {
        if (m.type === 'mediaAck') acks.get(`${m.id}:${m.index}`)?.();
        else if (m.type === 'log') onLog(m.level, m.message);
        else if (m.type === 'step') {
          lastStep = m.step;
          onStep(m.step);
        } else if (m.type === 'result') finish(m.result);
      });

      const post = (m: PortInbound) => port.postMessage(m);
      const waitAck = (id: string, index: number) =>
        new Promise<void>((res, rej) => {
          const t = setTimeout(() => rej(new Error('The X tab stopped responding during media transfer.')), 60_000);
          acks.set(`${id}:${index}`, () => {
            clearTimeout(t);
            acks.delete(`${id}:${index}`);
            res();
          });
        });

      (async () => {
        for (const ref of job.media) {
          const stored = await getMedia(ref.id);
          if (!stored) throw new Error(`Media file ${ref.name} is missing from local storage. Re-attach it.`);
          const chunks = Math.max(1, Math.ceil(stored.blob.size / CHUNK_BYTES));
          const begin = waitAck(ref.id, -1);
          post({ type: 'mediaBegin', id: ref.id, name: ref.name, mimeType: ref.mimeType, size: ref.size, chunks });
          await begin;
          for (let i = 0; i < chunks; i++) {
            const data = await blobToBase64(stored.blob.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
            const ack = waitAck(ref.id, i);
            post({ type: 'mediaChunk', id: ref.id, index: i, data });
            await ack;
          }
        }
        lastStep = 'preflight';
        post({ type: 'schedule', job });
      })().catch((e: Error) => finish({ ok: false, dryRun: job.dryRun, step: 'transfer-media', error: e.message }));
    });
  }
}
