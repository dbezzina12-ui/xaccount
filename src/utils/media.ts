/**
 * Media type detection and X's published media limits.
 * Limits are used for warnings only (X's web client may resize images and
 * Premium accounts get longer videos); X itself is the final judge during
 * automation.
 */
import type { MediaKind, MediaRef } from '../types';

export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime';

export const LIMITS = {
  maxImages: 4,
  imageBytes: 5 * 1024 * 1024,
  gifBytes: 15 * 1024 * 1024,
  videoBytes: 512 * 1024 * 1024,
  videoSeconds: 140,
};

export function mediaKindOf(mimeType: string, name = ''): MediaKind | null {
  const t = mimeType.toLowerCase();
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (t === 'image/gif' || ext === 'gif') return 'gif';
  if (/^image\/(jpeg|jpg|png|webp)$/.test(t) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
  if (/^video\/(mp4|quicktime)$/.test(t) || ['mp4', 'mov', 'm4v'].includes(ext)) return 'video';
  return null;
}

export function guessMime(name: string, fallback: string): string {
  if (fallback) return fallback;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return (
    { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime' } as Record<string, string>
  )[ext] ?? 'application/octet-stream';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export interface MediaCheck {
  errors: string[];
  warnings: string[];
}

export function checkMediaSet(media: MediaRef[]): MediaCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const images = media.filter((m) => m.kind === 'image');
  const gifs = media.filter((m) => m.kind === 'gif');
  const videos = media.filter((m) => m.kind === 'video');
  if (videos.length + gifs.length > 1) errors.push('Only one video or GIF can be attached to a post.');
  if ((videos.length || gifs.length) && images.length) errors.push("Videos/GIFs can't be combined with images in one post.");
  if (images.length > LIMITS.maxImages) errors.push(`At most ${LIMITS.maxImages} images per post.`);
  for (const m of images) if (m.size > LIMITS.imageBytes) warnings.push(`${m.name} is over 5 MB; X may resize or reject it.`);
  for (const m of gifs) if (m.size > LIMITS.gifBytes) warnings.push(`${m.name} is over 15 MB; X may reject it.`);
  for (const m of videos) {
    if (m.size > LIMITS.videoBytes) warnings.push(`${m.name} is over 512 MB; X will likely reject it.`);
    if (m.durationSec && m.durationSec > LIMITS.videoSeconds)
      warnings.push(`${m.name} is ${Math.round(m.durationSec)}s long; non-Premium accounts are limited to 2:20.`);
  }
  return { errors, warnings };
}

/** Read width/height/duration locally (nothing leaves the machine). */
export async function probeMedia(file: Blob, kind: MediaKind): Promise<Partial<MediaRef>> {
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'video') {
      return await new Promise((resolve) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => resolve({ durationSec: v.duration, width: v.videoWidth, height: v.videoHeight });
        v.onerror = () => resolve({});
        setTimeout(() => resolve({}), 5000);
        v.src = url;
      });
    }
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 6000);
  }
}
