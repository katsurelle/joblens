import { describe, expect, it } from 'vitest';
import {
  normalizeRegionToken,
  regionsMatchCountryAllowList,
} from './regionTaxonomy';

describe('regionTaxonomy', () => {
  it('keeps bare US states for US homeCountry', () => {
    expect(normalizeRegionToken('TX', 'US')).toBe('TX');
    expect(normalizeRegionToken('California', 'US')).toBe('CA');
  });

  it('maps Canada name distinctly from California CA', () => {
    expect(normalizeRegionToken('Canada', 'US')).toBe('CANADA');
    expect(normalizeRegionToken('ON', 'CA')).toBe('ON');
    expect(regionsMatchCountryAllowList(['ON'], ['CA'], 'CA')).toBe(true);
    expect(regionsMatchCountryAllowList(['Canada'], ['CA'], 'US')).toBe(true);
    // Bare CA with US home is California — matches US, not Canada
    expect(regionsMatchCountryAllowList(['CA'], ['US'], 'US')).toBe(true);
    expect(regionsMatchCountryAllowList(['CA'], ['CA'], 'US')).toBe(false);
  });

  it('matches UK / EU / WEU country tokens', () => {
    expect(regionsMatchCountryAllowList(['GB'], ['UK'], 'GB')).toBe(true);
    expect(regionsMatchCountryAllowList(['ENG'], ['UK'], 'GB')).toBe(true);
    expect(regionsMatchCountryAllowList(['DE'], ['EU'], 'DE')).toBe(true);
    expect(regionsMatchCountryAllowList(['NL'], ['WEU'], 'NL')).toBe(true);
  });
});
