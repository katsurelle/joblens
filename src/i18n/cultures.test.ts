import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CULTURE_ID,
  filterCultures,
  getCultureById,
  resolveCultureFromBrowser,
  resolveEffectiveCulture,
  SUPPORTED_CULTURES,
} from './cultures';
import { isClaudeSupportedLanguage } from './claudeLanguages';
import {
  buildResponseLocaleInstruction,
  responseLocaleFromConfig,
} from './responseLocale';

describe('cultures catalog', () => {
  it('only includes Claude-supported languages', () => {
    expect(SUPPORTED_CULTURES.length).toBeGreaterThan(10);
    for (const c of SUPPORTED_CULTURES) {
      expect(isClaudeSupportedLanguage(c.language)).toBe(true);
    }
    // Russian / Vietnamese / Turkish nations contribute nothing without Claude langs
    expect(SUPPORTED_CULTURES.some((c) => c.countryCode === 'RU')).toBe(false);
    expect(SUPPORTED_CULTURES.some((c) => c.countryCode === 'VN')).toBe(false);
    expect(SUPPORTED_CULTURES.some((c) => c.countryCode === 'TR')).toBe(false);
  });

  it('includes expected culture tags from top nations × written langs', () => {
    const ids = new Set(SUPPORTED_CULTURES.map((c) => c.id));
    expect(ids.has('en-US')).toBe(true);
    expect(ids.has('en-GB')).toBe(true);
    expect(ids.has('es-MX')).toBe(true);
    expect(ids.has('pt-BR')).toBe(true);
    expect(ids.has('zh-Hans-CN')).toBe(true);
    expect(ids.has('hi-IN')).toBe(true);
    expect(ids.has('ar-EG')).toBe(true);
    expect(ids.has('yo-NG')).toBe(true);
    expect(ids.has('sw-KE')).toBe(true);
  });

  it('marks Arabic as RTL', () => {
    expect(getCultureById('ar-EG')?.dir).toBe('rtl');
    expect(getCultureById('en-US')?.dir).toBe('ltr');
  });

  it('resolves browser tags with fallbacks to en-US', () => {
    expect(resolveCultureFromBrowser(['es-MX'])).toBe('es-MX');
    expect(resolveCultureFromBrowser(['es-AR'])).toBe('es-MX'); // language-only default
    expect(resolveCultureFromBrowser(['zh-CN'])).toBe('zh-Hans-CN');
    expect(resolveCultureFromBrowser(['xx-YY'])).toBe(DEFAULT_CULTURE_ID);
    expect(resolveCultureFromBrowser([])).toBe(DEFAULT_CULTURE_ID);
  });

  it('resolveEffectiveCulture honors auto vs explicit', () => {
    expect(resolveEffectiveCulture('ja-JP')).toBe('ja-JP');
    // Unknown explicit tag falls through browser match → still a supported culture
    expect(getCultureById(resolveEffectiveCulture('nope'))).toBeTruthy();
  });

  it('filterCultures searches label, native, and id', () => {
    expect(filterCultures('mexico').some((c) => c.id === 'es-MX')).toBe(true);
    expect(filterCultures('العربية').some((c) => c.id === 'ar-EG')).toBe(true);
    expect(filterCultures('zzzz-nope')).toEqual([]);
  });

  it('starts from thirty nations before Claude language filter', () => {
    const countries = new Set(SUPPORTED_CULTURES.map((c) => c.countryCode));
    expect(countries.has('IN')).toBe(true);
    expect(countries.has('CN')).toBe(true);
    expect(countries.has('US')).toBe(true);
    expect(countries.has('BR')).toBe(true);
    expect(countries.has('EG')).toBe(true);
    // Filtered out entirely when no Claude-supported written language remains
    expect(countries.has('RU')).toBe(false);
  });
});

describe('response locale for Claude', () => {
  it('builds explicit RESPONSE_LANGUAGE instructions', () => {
    const ctx = responseLocaleFromConfig('fr-FR');
    expect(ctx.cultureId).toBe('fr-FR');
    expect(ctx.languageName).toMatch(/French/i);
    const block = buildResponseLocaleInstruction(ctx);
    expect(block).toMatch(/UI_CULTURE: fr-FR/);
    expect(block).toMatch(/RESPONSE_LANGUAGE: French/);
    expect(block).toMatch(/Keep JSON keys/);
  });

  it('defaults auto to a supported culture', () => {
    const ctx = responseLocaleFromConfig('auto');
    expect(getCultureById(ctx.cultureId)).toBeTruthy();
  });
});
