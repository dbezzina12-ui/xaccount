import { describe, expect, it } from 'vitest';
import { normalizeDate, normalizeTime, parseCsv, parseCsvRecords, parsePlainText } from '../../src/utils/importers';

describe('parsePlainText', () => {
  it('splits posts on blank lines and keeps inner line breaks', () => {
    const rows = parsePlainText('Post number one.\n\nPost number two.\nSecond line\n\n\n  \nPost number three.\n');
    expect(rows.map((r) => r.text)).toEqual(['Post number one.', 'Post number two.\nSecond line', 'Post number three.']);
  });
  it('handles CRLF', () => {
    expect(parsePlainText('a\r\n\r\nb').map((r) => r.text)).toEqual(['a', 'b']);
  });
});

describe('CSV', () => {
  it('parses quoted fields, commas and newlines', () => {
    const recs = parseCsvRecords('text,date\n"Hello, world","2026-10-01"\n"Line1\nLine2 ""quoted""",\n');
    expect(recs).toEqual([
      ['text', 'date'],
      ['Hello, world', '2026-10-01'],
      ['Line1\nLine2 "quoted"', ''],
    ]);
  });

  it('maps columns and normalises dates/times/media', () => {
    const r = parseCsv('Text,Date,Time,Media\n"New game coming...",2026-10-01,10:30 AM,C:\\clips\\preview.mp4\n"Which bonus...",10/01/2026,13:15,image.png;b.jpg\n', 'MDY');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ text: 'New game coming...', date: '2026-10-01', time: '10:30', mediaNames: ['preview.mp4'] });
    expect(r.rows[1]).toMatchObject({ date: '2026-10-01', time: '13:15', mediaNames: ['image.png', 'b.jpg'] });
  });

  it('requires a text column', () => {
    expect(parseCsv('foo,bar\n1,2').errors.length).toBe(1);
  });

  it('flags bad dates as warnings but still imports', () => {
    const r = parseCsv('text,date,time\nhi,notadate,25:99');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].date).toBeNull();
    expect(r.rows[0].warnings).toHaveLength(2);
  });
});

describe('normalizers', () => {
  it('dates', () => {
    expect(normalizeDate('2026-10-01')).toBe('2026-10-01');
    expect(normalizeDate('03/04/2026', 'MDY')).toBe('2026-03-04');
    expect(normalizeDate('03/04/2026', 'DMY')).toBe('2026-04-03');
    expect(normalizeDate('Oct 1, 2026')).toBe('2026-10-01');
    expect(normalizeDate('1 October 2026')).toBe('2026-10-01');
    expect(normalizeDate('2026-02-30')).toBeNull();
  });
  it('times', () => {
    expect(normalizeTime('10:30')).toBe('10:30');
    expect(normalizeTime('1:15 PM')).toBe('13:15');
    expect(normalizeTime('12:05am')).toBe('00:05');
    expect(normalizeTime('12pm')).toBe('12:00');
    expect(normalizeTime('10')).toBeNull();
    expect(normalizeTime('24:00')).toBeNull();
  });
});
