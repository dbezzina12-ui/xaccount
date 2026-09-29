import { describe, expect, it } from 'vitest';
import { weightedLength } from '../../src/utils/textCount';

describe('weightedLength', () => {
  it('counts latin characters as 1', () => {
    expect(weightedLength('hello world')).toBe(11);
  });
  it('counts URLs as 23', () => {
    expect(weightedLength('see https://example.com/a/very/long/path/that/goes/on')).toBe(4 + 23);
  });
  it('counts emoji (incl. sequences) as 2', () => {
    expect(weightedLength('👍')).toBe(2);
    expect(weightedLength('👍🏽')).toBe(2);
    expect(weightedLength('👨‍👩‍👧')).toBe(2);
  });
  it('counts CJK as 2', () => {
    expect(weightedLength('日本')).toBe(4);
  });
});
