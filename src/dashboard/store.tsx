/**
 * Dashboard state (React context + reducer) with persistence:
 *  - batches/posts + active batch → chrome.storage.local (debounced)
 *  - settings → chrome.storage.local
 *  - media blobs → IndexedDB (handled in mediaActions.ts)
 */
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { Batch, DetectedAccount, LogLevel, Post, Settings } from '../types';
import { defaultSettings, loadSettings, saveSettings } from '../storage/settings';
import { ACCOUNT_KEY, loadActiveBatchId, loadBatches, loadLastAccount, newBatch, saveActiveBatchId, saveBatches } from '../storage/batches';
import { kvWatch } from '../storage/kv';
import { collectGarbage } from '../storage/media';
import { derivedStatus } from '../utils/validation';
import { nowIso, uid } from '../utils/id';
import { IDLE_STATE, type RunState } from './engine/runner';

export interface LogEntry {
  id: number;
  at: Date;
  level: LogLevel;
  message: string;
}

export interface AppState {
  loaded: boolean;
  settings: Settings;
  batches: Batch[];
  activeBatchId: string;
  account: DetectedAccount | null;
  logs: LogEntry[];
  run: RunState;
}

type Action =
  | { type: 'init'; settings: Settings; batches: Batch[]; activeBatchId: string; account: DetectedAccount | null }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'setActiveBatch'; id: string }
  | { type: 'addBatch'; batch: Batch }
  | { type: 'updateBatch'; id: string; patch: Partial<Omit<Batch, 'id' | 'posts'>> }
  | { type: 'deleteBatch'; id: string }
  | { type: 'addPosts'; batchId: string; posts: Post[]; replace?: boolean; afterId?: string }
  | { type: 'updatePost'; batchId: string; postId: string; patch: Partial<Post> }
  | { type: 'deletePosts'; batchId: string; ids: string[] }
  | { type: 'movePost'; batchId: string; from: number; to: number }
  | { type: 'setPosts'; batchId: string; posts: Post[] }
  | { type: 'setAccount'; account: DetectedAccount | null }
  | { type: 'log'; level: LogLevel; message: string }
  | { type: 'clearLogs' }
  | { type: 'setRun'; run: RunState };

const CONTENT_FIELDS: Array<keyof Post> = ['text', 'media', 'date', 'time'];
let logSeq = 0;

function touchBatch(state: AppState, batchId: string, fn: (b: Batch) => Batch): AppState {
  return { ...state, batches: state.batches.map((b) => (b.id === batchId ? { ...fn(b), updatedAt: nowIso() } : b)) };
}

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case 'init':
      return { ...state, loaded: true, settings: a.settings, batches: a.batches, activeBatchId: a.activeBatchId, account: a.account };
    case 'setSettings': {
      // Character limit may change draft/ready for every post.
      const batches = state.batches.map((b) => ({ ...b, posts: b.posts.map((p) => ({ ...p, status: derivedStatus(p, b.timezone, a.settings) })) }));
      return { ...state, settings: a.settings, batches };
    }
    case 'setActiveBatch':
      return { ...state, activeBatchId: a.id };
    case 'addBatch':
      return { ...state, batches: [...state.batches, a.batch], activeBatchId: a.batch.id };
    case 'updateBatch':
      return touchBatch(state, a.id, (b) => {
        const nb = { ...b, ...a.patch };
        if (a.patch.timezone && a.patch.timezone !== b.timezone) nb.posts = nb.posts.map((p) => ({ ...p, status: derivedStatus(p, nb.timezone, state.settings) }));
        return nb;
      });
    case 'deleteBatch': {
      const batches = state.batches.filter((b) => b.id !== a.id);
      return { ...state, batches, activeBatchId: state.activeBatchId === a.id ? (batches[0]?.id ?? '') : state.activeBatchId };
    }
    case 'addPosts':
      return touchBatch(state, a.batchId, (b) => {
        const incoming = a.posts.map((p) => ({ ...p, status: derivedStatus(p, b.timezone, state.settings) }));
        if (a.replace) return { ...b, posts: incoming };
        if (a.afterId) {
          const i = b.posts.findIndex((p) => p.id === a.afterId);
          if (i >= 0) return { ...b, posts: [...b.posts.slice(0, i + 1), ...incoming, ...b.posts.slice(i + 1)] };
        }
        return { ...b, posts: [...b.posts, ...incoming] };
      });
    case 'updatePost':
      return touchBatch(state, a.batchId, (b) => ({
        ...b,
        posts: b.posts.map((p) => {
          if (p.id !== a.postId) return p;
          const next: Post = { ...p, ...a.patch };
          const contentEdit = CONTENT_FIELDS.some((f) => f in a.patch);
          if (contentEdit && !('status' in a.patch) && p.status !== 'scheduled' && p.status !== 'scheduling') {
            // Editing a failed/draft post re-derives Draft/Ready and clears old errors.
            next.status = derivedStatus({ ...next, status: 'draft' }, b.timezone, state.settings);
            next.error = undefined;
            next.failedStep = undefined;
            next.uncertain = undefined;
            next.dryRun = undefined;
          }
          if (!('updatedAt' in a.patch)) next.updatedAt = nowIso();
          return next;
        }),
      }));
    case 'deletePosts':
      return touchBatch(state, a.batchId, (b) => ({ ...b, posts: b.posts.filter((p) => !a.ids.includes(p.id)) }));
    case 'movePost':
      return touchBatch(state, a.batchId, (b) => {
        const posts = [...b.posts];
        const [m] = posts.splice(a.from, 1);
        if (!m) return b;
        posts.splice(a.to, 0, m);
        return { ...b, posts };
      });
    case 'setPosts':
      return touchBatch(state, a.batchId, (b) => ({ ...b, posts: a.posts.map((p) => ({ ...p, status: derivedStatus(p, b.timezone, state.settings) })) }));
    case 'setAccount':
      return { ...state, account: a.account };
    case 'log': {
      const entry: LogEntry = { id: ++logSeq, at: new Date(), level: a.level, message: a.message };
      const logs = state.logs.length > 800 ? [...state.logs.slice(-600), entry] : [...state.logs, entry];
      return { ...state, logs };
    }
    case 'clearLogs':
      return { ...state, logs: [] };
    case 'setRun':
      return { ...state, run: a.run };
  }
}

const initial: AppState = {
  loaded: false,
  settings: defaultSettings(),
  batches: [],
  activeBatchId: '',
  account: null,
  logs: [],
  run: IDLE_STATE,
};

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** Always-current state for async code (the runner). */
  stateRef: React.MutableRefObject<AppState>;
  activeBatch: Batch | undefined;
  log: (level: LogLevel, message: string) => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function referencedMediaIds(batches: Batch[]): Set<string> {
  return new Set(batches.flatMap((b) => b.posts.flatMap((p) => p.media.map((m) => m.id))));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load persisted state once.
  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      let batches = await loadBatches();
      if (!batches.length) batches = [newBatch('My first batch', settings.defaultTimezone)];
      // A post left "scheduling" means the dashboard closed mid-run: outcome unknown.
      batches = batches.map((b) => ({
        ...b,
        posts: b.posts.map((p) =>
          p.status === 'scheduling'
            ? { ...p, status: 'failed' as const, uncertain: true, error: "Interrupted — the dashboard closed while this post was being scheduled. Check X's scheduled posts before retrying." }
            : p,
        ),
      }));
      let activeBatchId = (await loadActiveBatchId()) ?? '';
      if (!batches.some((b) => b.id === activeBatchId)) activeBatchId = batches[0].id;
      const account = (await loadLastAccount()) ?? null;
      dispatch({ type: 'init', settings, batches, activeBatchId, account });
      collectGarbage(referencedMediaIds(batches)).catch(() => {});
    })();
    return kvWatch<DetectedAccount>(ACCOUNT_KEY, (a) => a && dispatch({ type: 'setAccount', account: a }));
  }, []);

  // Persist batches (debounced) and the active batch id.
  const saveTimer = useRef<number>();
  useEffect(() => {
    if (!state.loaded) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveBatches(state.batches), 250);
  }, [state.batches, state.loaded]);
  useEffect(() => {
    if (state.loaded && state.activeBatchId) void saveActiveBatchId(state.activeBatchId);
  }, [state.activeBatchId, state.loaded]);
  useEffect(() => {
    if (state.loaded) void saveSettings(state.settings);
  }, [state.settings, state.loaded]);
  // Flush immediately when the page is closing.
  useEffect(() => {
    const flush = () => void saveBatches(stateRef.current.batches);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const log = (level: LogLevel, message: string) => {
    if (level === 'debug' && !stateRef.current.settings.debug) return;
    dispatch({ type: 'log', level, message });
  };

  const activeBatch = state.batches.find((b) => b.id === state.activeBatchId);
  return <StoreContext.Provider value={{ state, dispatch, stateRef, activeBatch, log }}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

export function makePost(partial: Partial<Post> = {}): Post {
  const now = nowIso();
  return { id: uid('p_'), text: '', media: [], date: null, time: null, status: 'draft', createdAt: now, updatedAt: now, ...partial };
}
