/** Whitespace-normalise (handles NBSP / narrow NBSP that Intl and X emit). */
// Built from a string so the bundle stays pure ASCII (Chrome is picky about content script encoding).
const SPECIAL_SPACES = new RegExp('[\\u00a0\\u202f\\u2009\\u2007]', 'g');

export function normalizeSpaces(s: string): string {
  return s.replace(SPECIAL_SPACES, ' ').replace(/\s+/g, ' ').trim();
}

/** Letters and digits only, lower-cased: used for loose text comparisons. */
export function alnumKey(s: string): string {
  return (s.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]/gu) ?? []).join('');
}
