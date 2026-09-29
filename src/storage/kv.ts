/**
 * Tiny key/value wrapper over chrome.storage.local, with a localStorage
 * fallback so the dashboard can also be previewed with `npm run dev`.
 */
const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (hasChrome) {
    const r = await chrome.storage.local.get(key);
    return r[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : undefined;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function kvWatch<T>(key: string, cb: (value: T | undefined) => void): () => void {
  if (!hasChrome) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && key in changes) cb(changes[key].newValue as T | undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
