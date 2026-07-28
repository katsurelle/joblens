/**
 * Integration: analysis/preflight prompts include UI culture for Claude.
 */
import { describe, expect, it } from 'vitest';
import { buildAnalysisUser, buildPreflightHardGates, buildPreflightUser } from '../../src/lib/prompts';
import { makeConfig } from '../helpers/config';

describe('prompt locale integration', () => {
  it('embeds RESPONSE_LANGUAGE from uiCulture in analysis user prompt', () => {
    const user = buildAnalysisUser({
      profile: makeConfig({
        uiCulture: 'es-MX',
        preferences: { ...makeConfig().preferences, remoteOnly: true },
      }),
      url: 'https://example.com/job',
      pageText: 'Remote engineer role',
    });
    expect(user).toMatch(/UI_CULTURE: es-MX/);
    expect(user).toMatch(/RESPONSE_LANGUAGE: Spanish/);
    expect(user).toMatch(/human-readable strings in Spanish/i);
  });

  it('embeds locale in preflight user + hard gates', () => {
    const cfg = makeConfig({
      uiCulture: 'ar-EG',
      locations: [{ zip: '78758', radiusMiles: 25 }],
    });
    const gates = buildPreflightHardGates(cfg);
    expect(gates.uiCulture).toMatchObject({
      cultureId: 'ar-EG',
      dir: 'rtl',
    });
    const user = buildPreflightUser({
      hardGatesJson: '{}',
      url: 'https://example.com',
      pageText: 'JD',
      uiCulture: cfg.uiCulture,
    });
    expect(user).toMatch(/UI_CULTURE: ar-EG \(rtl\)/);
    expect(user).toMatch(/RESPONSE_LANGUAGE: Arabic/);
  });
});
