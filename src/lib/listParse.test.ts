import { describe, expect, it } from 'vitest';
import { parseCommaList, parseNewlineList } from './listParse';

describe('listParse', () => {
  it('parseCommaList keeps draft tokens until commas are complete (residency input)', () => {
    // Typing "TX, P" must not lose the trailing draft letter when Save parses.
    expect(parseCommaList('TX, PA')).toEqual(['TX', 'PA']);
    expect(parseCommaList('TX, P')).toEqual(['TX', 'P']);
    expect(parseCommaList('TX,')).toEqual(['TX']);
    expect(parseCommaList(' TX , PA ')).toEqual(['TX', 'PA']);
    expect(parseCommaList('')).toEqual([]);
    expect(parseCommaList('  ,  , ')).toEqual([]);
  });

  it('parseNewlineList trims blank lines', () => {
    expect(parseNewlineList('a\n\nb\n')).toEqual(['a', 'b']);
  });
});
