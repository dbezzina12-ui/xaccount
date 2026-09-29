import { useEffect, useState } from 'react';
import type { MediaRef } from '../../types';
import { getMedia } from '../../storage/media';
import { formatBytes } from '../../utils/media';

/** Small local preview of an attached media file (object URL from IndexedDB). */
export function MediaThumb({ media, size = 36 }: { media: MediaRef; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let revoked = false;
    let u: string | null = null;
    getMedia(media.id)
      .then((m) => {
        if (!m) return setMissing(true);
        if (revoked) return;
        u = URL.createObjectURL(m.blob);
        setUrl(u);
      })
      .catch(() => setMissing(true));
    return () => {
      revoked = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [media.id]);

  const title = `${media.name} · ${formatBytes(media.size)}${media.durationSec ? ` · ${Math.round(media.durationSec)}s` : ''}`;
  if (missing) return <span className="thumb thumb-missing" style={{ width: size, height: size }} title={`${media.name} is missing from local storage — re-attach it`}>!</span>;
  if (!url) return <span className="thumb" style={{ width: size, height: size }} />;
  if (media.kind === 'video')
    return (
      <span className="thumb thumb-video" style={{ width: size, height: size }} title={title}>
        <video src={url} muted preload="metadata" />
        <span className="thumb-badge">▶</span>
      </span>
    );
  return (
    <span className="thumb" style={{ width: size, height: size }} title={title}>
      <img src={url} alt={media.name} />
      {media.kind === 'gif' && <span className="thumb-badge">GIF</span>}
    </span>
  );
}
