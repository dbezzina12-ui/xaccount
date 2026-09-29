/**
 * Bulk import parsers: plain text (blank-line separated) and CSV
 * (columns: text,date,time,media - only `text` is required).
 */
import { formatDateISO, parseDate, pad2 } from './time';

export interface ImportRow {
  text: string;
  date: string | null;
  time: string | null;
  /** Media file names referenced by the row (basename only). */
  mediaNames: string[];
  warnings: string[];
}

export type SlashDateOrder = 'MDY' | 'DMY';

/** One post per block; blocks are separated by one or more blank lines. */
export function parsePlainText(input: string): ImportRow[] {
  return input
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.replace(/^\n+|\n+$/g, '').replace(/[ \t]+$/gm, ''))
    .filter((block) => block.trim().length > 0)
    .map((text) => ({ text: text.trim(), date: null, time: null, mediaNames: [], warnings: [] }));
}

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, newlines in quotes. */
export function parseCsvRecords(input: string): string[][] {
  const s = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface CsvParseResult {
  rows: ImportRow[];
  errors: string[];
}

export function parseCsv(input: string, slashOrder: SlashDateOrder = 'MDY'): CsvParseResult {
  const records = parseCsvRecords(input);
  if (!records.length) return { rows: [], errors: ['The CSV is empty.'] };
  const header = records[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iText = col('text');
  if (iText === -1) {
    return { rows: [], errors: ['CSV must have a header row with at least a "text" column (text,date,time,media).'] };
  }
  const iDate = col('date');
  const iTime = col('time');
  const iMedia = col('media');
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  records.slice(1).forEach((rec, idx) => {
    const line = idx + 2;
    const text = (rec[iText] ?? '').replace(/\r\n?/g, '\n').trim();
    const rawDate = iDate >= 0 ? (rec[iDate] ?? '').trim() : '';
    const rawTime = iTime >= 0 ? (rec[iTime] ?? '').trim() : '';
    const rawMedia = iMedia >= 0 ? (rec[iMedia] ?? '').trim() : '';
    const warnings: string[] = [];
    const mediaNames = rawMedia ? splitMedia(rawMedia) : [];
    if (!text && !mediaNames.length) {
      errors.push(`Row ${line}: skipped (no text or media).`);
      return;
    }
    let date: string | null = null;
    if (rawDate) {
      date = normalizeDate(rawDate, slashOrder);
      if (!date) warnings.push(`Unrecognised date "${rawDate}"`);
    }
    let time: string | null = null;
    if (rawTime) {
      time = normalizeTime(rawTime);
      if (!time) warnings.push(`Unrecognised time "${rawTime}"`);
    }
    rows.push({ text, date, time, mediaNames, warnings });
  });
  return { rows, errors };
}

export function splitMedia(raw: string): string[] {
  return raw
    .split(/[;|]/)
    .map((p) => p.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .map(basename);
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function normalizeDate(raw: string, slashOrder: SlashDateOrder = 'MDY', refYear = new Date().getFullYear()): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const [a, b] = [+m[1], +m[2]];
    return slashOrder === 'MDY' ? valid(y, a, b) : valid(y, b, a);
  }
  // "Oct 1", "October 1, 2026", "1 Oct 2026"
  m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?$/i.exec(s);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return valid(m[3] ? +m[3] : refYear, mi + 1, +m[2]);
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?(?:\s+(\d{4}))?$/i.exec(s);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return valid(m[3] ? +m[3] : refYear, mi + 1, +m[1]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const iso = formatDateISO(y, mo, d);
  return parseDate(iso) ? iso : null;
}

export function normalizeTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(a|p|am|pm|a\.m\.|p\.m\.)?$/.exec(s);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ap = m[3]?.[0];
  if (!m[2] && !ap) return null; // bare "10" is ambiguous
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'a') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) return null;
  return `${pad2(h)}:${pad2(min)}`;
}
