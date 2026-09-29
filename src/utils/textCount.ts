/**
 * Approximation of X's weighted character counting (twitter-text v3 rules):
 *  - Most Latin / common punctuation characters count as 1.
 *  - Other characters (CJK etc.) count as 2.
 *  - Each emoji (grapheme cluster, incl. ZWJ sequences / skin tones) counts as 2.
 *  - Every URL counts as 23 regardless of length.
 *
 * This is only used for pre-flight warnings in the dashboard. X's composer is
 * the source of truth: during automation, if X disables its Post/Schedule
 * button after the text is entered, the post fails with a clear message.
 */

const URL_RE = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s]*)?/gi;
const URL_WEIGHT = 23;

const LIGHT_RANGES: Array<[number, number]> = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

function cpWeight(cp: number): number {
  for (const [a, b] of LIGHT_RANGES) if (cp >= a && cp <= b) return 1;
  return 2;
}

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

type SegmenterCtor = new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> };

function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s);
}

export function weightedLength(text: string): number {
  const normalized = text.normalize('NFC');
  let total = 0;
  let rest = normalized;
  const urls = normalized.match(URL_RE) ?? [];
  // Only treat as URL if it has a scheme or a dot-TLD shape; strip them out.
  for (const u of urls) {
    total += URL_WEIGHT;
    rest = rest.replace(u, '');
  }
  for (const g of graphemes(rest)) {
    if (EMOJI_RE.test(g)) {
      total += 2;
      continue;
    }
    for (const ch of g) total += cpWeight(ch.codePointAt(0) ?? 0);
  }
  return total;
}
