/**
 * Generic DOM helpers for the automation layer. Nothing X-specific lives
 * here - selectors come from xSelectors.ts.
 */
import type { SelectorSpec } from './xSelectors';
import { normalizeSpaces } from '../utils/text';

export { alnumKey, normalizeSpaces } from '../utils/text';

export type Logger = (level: 'debug' | 'info' | 'warn' | 'error' | 'success', message: string) => void;

/** Error carrying the automation step and whether the post may already exist in X. */
export class AutomationError extends Error {
  constructor(
    message: string,
    public step: string,
    public uncertain = false,
  ) {
    super(message);
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function isVisible(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (!el.isConnected) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

/** Disabled via attribute, aria-disabled, or pointer-events. */
export function isDisabled(el: Element): boolean {
  if ((el as HTMLButtonElement).disabled) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  return false;
}

/**
 * Query a SelectorSpec inside `root`. Tries each selector in order and returns
 * all matches of the first selector that matches anything. Every attempt is
 * logged in debug mode so selector breakage is easy to diagnose.
 */
export function queryAll(spec: SelectorSpec, root: ParentNode = document, log?: Logger, opts: { visibleOnly?: boolean; quiet?: boolean } = {}): HTMLElement[] {
  for (const sel of spec.selectors) {
    let found = Array.from(root.querySelectorAll<HTMLElement>(sel));
    if (opts.visibleOnly) found = found.filter((e) => e instanceof HTMLInputElement || isVisible(e));
    if (found.length) {
      if (!opts.quiet) log?.('debug', `Selector ✓ ${spec.name}: "${sel}" (${found.length} match${found.length > 1 ? 'es' : ''})`);
      return found;
    }
    if (!opts.quiet) log?.('debug', `Selector ✗ ${spec.name}: "${sel}"`);
  }
  return [];
}

export function queryOne(spec: SelectorSpec, root: ParentNode = document, log?: Logger, opts: { visibleOnly?: boolean; quiet?: boolean } = {}): HTMLElement | null {
  return queryAll(spec, root, log, opts)[0] ?? null;
}

/**
 * Poll until `fn` returns a truthy value or the timeout elapses. Polling (vs
 * MutationObserver only) keeps this robust to attribute changes in shadowed
 * or re-rendered React trees; 100-200ms is plenty responsive.
 */
export async function waitFor<T>(
  fn: () => T | null | undefined | false,
  opts: { timeout: number; interval?: number; step: string; error: string; uncertain?: boolean; isAborted?: () => boolean },
): Promise<T> {
  const start = Date.now();
  const interval = opts.interval ?? 150;
  for (;;) {
    if (opts.isAborted?.()) throw new AutomationError('Aborted.', opts.step, opts.uncertain);
    let v: T | null | undefined | false;
    try {
      v = fn();
    } catch (e) {
      if (e instanceof AutomationError) throw e;
      v = null;
    }
    if (v) return v;
    if (Date.now() - start > opts.timeout) throw new AutomationError(opts.error, opts.step, opts.uncertain);
    await sleep(interval);
  }
}

/** Click like a user would (pointer + mouse events, then click). */
export function realClick(el: HTMLElement): void {
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const opts = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.click();
}

/**
 * Set a <select> value so React notices: use the native value setter, then
 * fire input + change events.
 */
export function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  select.focus();
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Visible text of an element, whitespace-normalised (handles NBSP / narrow NBSP). */
export function textOf(el: Element | null): string {
  if (!el) return '';
  const raw = (el as HTMLElement).innerText ?? el.textContent ?? '';
  return normalizeSpaces(raw);
}

/** Accessible label text of a form control. */
export function labelOf(el: HTMLElement): string {
  const parts: string[] = [];
  const aria = el.getAttribute('aria-label');
  if (aria) parts.push(aria);
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const l = document.getElementById(id);
      if (l) parts.push(l.textContent ?? '');
    }
  }
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l) parts.push(l.textContent ?? '');
  }
  const wrapping = el.closest('label');
  if (wrapping) parts.push(wrapping.textContent ?? '');
  // The same label is often referenced twice (aria-labelledby + label[for]).
  return Array.from(new Set(parts.map(normalizeSpaces).filter(Boolean))).join(' ');
}

/** Build a File from base64 chunks. */
export function base64ChunksToFile(chunks: string[], name: string, mimeType: string): File {
  const parts = chunks.map((c) => {
    const bin = atob(c);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  });
  return new File(parts, name, { type: mimeType });
}
