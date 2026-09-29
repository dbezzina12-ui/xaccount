/**
 * Batches (and their posts' metadata) live in chrome.storage.local.
 * Media blobs are stored separately in IndexedDB (see media.ts).
 */
import type { Batch, DetectedAccount } from '../types';
import { nowIso, uid } from '../utils/id';
import { kvGet, kvSet } from './kv';

const BATCHES_KEY = 'xbs.batches';
const ACTIVE_KEY = 'xbs.activeBatchId';
export const ACCOUNT_KEY = 'xbs.lastDetectedAccount';

export function newBatch(name: string, timezone: string, accountHandle = ''): Batch {
  const now = nowIso();
  return { id: uid('b_'), name, accountHandle, timezone, posts: [], createdAt: now, updatedAt: now };
}

export async function loadBatches(): Promise<Batch[]> {
  return (await kvGet<Batch[]>(BATCHES_KEY)) ?? [];
}

export async function saveBatches(batches: Batch[]): Promise<void> {
  await kvSet(BATCHES_KEY, batches);
}

export async function loadActiveBatchId(): Promise<string | undefined> {
  return kvGet<string>(ACTIVE_KEY);
}

export async function saveActiveBatchId(id: string): Promise<void> {
  await kvSet(ACTIVE_KEY, id);
}

export async function loadLastAccount(): Promise<DetectedAccount | undefined> {
  return kvGet<DetectedAccount>(ACCOUNT_KEY);
}
