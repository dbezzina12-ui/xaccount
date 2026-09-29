import type { MediaRef } from '../types';
import { putMedia } from '../storage/media';
import { guessMime, mediaKindOf, probeMedia } from '../utils/media';
import { nowIso, uid } from '../utils/id';

export interface AddMediaResult {
  added: MediaRef[];
  rejected: string[];
}

/** Store picked files in IndexedDB (local only) and return references. */
export async function storeMediaFiles(files: File[]): Promise<AddMediaResult> {
  const added: MediaRef[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    const mimeType = guessMime(f.name, f.type);
    const kind = mediaKindOf(mimeType, f.name);
    if (!kind) {
      rejected.push(`${f.name}: unsupported type (use JPG, PNG, WEBP, GIF, MP4 or MOV)`);
      continue;
    }
    const id = uid('m_');
    await putMedia({ id, blob: f, name: f.name, mimeType, size: f.size, createdAt: nowIso() });
    const probe = await probeMedia(f, kind).catch(() => ({}));
    added.push({ id, name: f.name, mimeType, size: f.size, kind, ...probe });
  }
  return { added, rejected };
}
