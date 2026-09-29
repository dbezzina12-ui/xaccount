/**
 * Content script entry (runs on x.com / twitter.com).
 *
 * Responsibilities:
 *  - report the logged-in handle (read from the page UI, never cookies)
 *  - answer pings from the dashboard
 *  - receive media (chunked, over a Port) and run one schedule job at a time
 *
 * The dashboard is the orchestrator; this script is stateless between posts.
 */
import type { ContentRequest, PingResponse, PortInbound, PortOutbound, ScheduledListResponse } from '../types';
import { RUN_PORT_NAME } from '../types';
import { ACCOUNT_KEY } from '../storage/batches';
import { base64ChunksToFile, type Logger } from './dom';
import { runScheduleJob } from './scheduleFlow';
import { detectAccount, readScheduledList } from './xAutomation';

declare global {
  interface Window {
    __xbsContentLoaded?: boolean;
  }
}

if (!window.__xbsContentLoaded) {
  window.__xbsContentLoaded = true;
  init();
}

function init() {
  let busy = false;

  /* ---------- account detection (stored for the dashboard header) ---------- */
  let lastStored: string | null = null;
  const storeAccount = () => {
    const acct = detectAccount();
    if (acct.handle && acct.handle !== lastStored) {
      lastStored = acct.handle;
      chrome.storage.local
        .set({ [ACCOUNT_KEY]: { handle: acct.handle, displayName: acct.displayName, detectedAt: new Date().toISOString(), url: location.origin } })
        .catch(() => {});
    }
    return acct;
  };
  let tries = 0;
  const poll = setInterval(() => {
    if (storeAccount().handle || ++tries > 30) clearInterval(poll);
  }, 1000);

  /* ---------- one-shot requests ---------- */
  chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'xbs:ping') {
      const acct = detectAccount();
      const res: PingResponse = { ok: true, url: location.href, lang: document.documentElement.lang || '', loggedIn: acct.loggedIn };
      sendResponse(res);
      return;
    }
    if (msg.type === 'xbs:getAccount') {
      sendResponse({ ...storeAccount(), detectedAt: new Date().toISOString() });
      return;
    }
    if (msg.type === 'xbs:readScheduledList') {
      readScheduledList(() => {})
        .then((r) => sendResponse({ ok: true, ...r } satisfies ScheduledListResponse))
        .catch((e: Error) => sendResponse({ ok: false, error: e.message, texts: [], itemCount: 0 } satisfies ScheduledListResponse));
      return true; // async response
    }
  });

  /* ---------- run port: media transfer + schedule job ---------- */
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== RUN_PORT_NAME) return;
    const media = new Map<string, { name: string; mimeType: string; chunks: string[]; expected: number }>();
    let debug = false;
    const send = (m: PortOutbound) => {
      try {
        port.postMessage(m);
      } catch {
        /* port closed */
      }
    };
    const log: Logger = (level, message) => {
      if (level === 'debug' && !debug) return;
      if (debug) console.debug('[X Bulk Scheduler]', level, message);
      send({ type: 'log', level, message });
    };

    port.onMessage.addListener(async (msg: PortInbound) => {
      switch (msg.type) {
        case 'mediaBegin':
          media.set(msg.id, { name: msg.name, mimeType: msg.mimeType, chunks: new Array(msg.chunks), expected: msg.chunks });
          send({ type: 'mediaAck', id: msg.id, index: -1 });
          break;
        case 'mediaChunk': {
          const m = media.get(msg.id);
          if (m) m.chunks[msg.index] = msg.data;
          send({ type: 'mediaAck', id: msg.id, index: msg.index });
          break;
        }
        case 'schedule': {
          debug = msg.job.debug;
          if (busy) {
            send({ type: 'result', result: { ok: false, dryRun: msg.job.dryRun, error: 'Another post is already being processed in this tab.', step: 'preflight' } });
            return;
          }
          busy = true;
          try {
            const files: File[] = [];
            for (const ref of msg.job.media) {
              const m = media.get(ref.id);
              if (!m || m.chunks.length !== m.expected || m.chunks.some((c) => typeof c !== 'string')) {
                send({ type: 'result', result: { ok: false, dryRun: msg.job.dryRun, error: `Media ${ref.name} was not received completely by the X tab.`, step: 'upload-media' } });
                return;
              }
              files.push(base64ChunksToFile(m.chunks, m.name, m.mimeType));
            }
            media.clear();
            const result = await runScheduleJob(msg.job, files, log, (s) => send({ type: 'step', step: s }));
            send({ type: 'result', result });
          } finally {
            busy = false;
          }
          break;
        }
      }
    });
  });
}
