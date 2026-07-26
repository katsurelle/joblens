/**
 * End-to-end preflight pipeline through handleBackgroundRequest (Claude mocked).
 * Covers transcript defect shapes: residency, clearance, citizenship, hybrid mode.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../../src/types/domain';
import { makeConfig } from '../helpers/config';
import {
  CLEARANCE_REQUIRED_JD,
  CLEARANCE_UI_NOISE_JD,
  CORMAC_US_CITIZEN,
  ITBSTAR_US_BASED_DEV,
  TURING_US_CANADA_WEU,
  UST_REMOTE_US,
} from '../fixtures/postings';
import { PREFLIGHT_CLAUDE_MODEL } from '../../src/lib/settingsOptions';

const callClaude = vi.hoisted(() => vi.fn());
const getConfig = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/anthropic')>();
  return { ...actual, callClaude };
});

vi.mock('../../src/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/storage')>();
  return { ...actual, getConfig };
});

import { handleBackgroundRequest } from '../../src/lib/backgroundHandle';

function haikuJson(partial: Record<string, unknown>): string {
  return JSON.stringify({
    verdict: 'clear',
    reasons: [],
    workModel: 'remote',
    organization: '',
    geoNote: '',
    flags: [],
    ...partial,
  });
}

const geoCfg = () =>
  makeConfig({
    apiKey: 'sk-test',
    workEligibleRegions: ['TX', 'PA'],
    workAuthorizationNote: 'US citizen, no sponsorship needed',
    preferences: {
      ...DEFAULT_PREFERENCES,
      remoteOnly: true,
      clearancePolicy: 'skip',
      flagPermNotices: false,
      flagShellEmployers: false,
    },
    flagPermNotices: false,
  });

describe('preflight pipeline e2e', () => {
  beforeEach(() => {
    callClaude.mockReset();
    getConfig.mockReset();
  });

  it('Turing US/Canada/WEU: Haiku false hard_skip is sanitized to clear', async () => {
    getConfig.mockResolvedValue(geoCfg());
    callClaude.mockResolvedValue(
      haikuJson({
        verdict: 'hard_skip',
        reasons: [
          'Residency restricted to US, Canada, or WEU countries; candidate regions limited to TX, PA (both US states, which are allowed under US scope)',
        ],
        flags: ['residency_excluded'],
        organization: 'Turing',
      })
    );

    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://www.indeed.com/viewjob?jk=turing1',
      pageText: TURING_US_CANADA_WEU,
      pageTitle: 'Software Engineer - Turing',
      forceHaiku: true,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    expect(out.preflight.verdict).toBe('clear');
    expect(out.preflight.flags).toContain('residency_ok');
    expect(callClaude).toHaveBeenCalledWith(
      expect.objectContaining({ model: PREFLIGHT_CLAUDE_MODEL, thinking: 'disabled' })
    );
  });

  it('UST Remote-US: local residency_ok; Haiku country-scope false skip cleared', async () => {
    getConfig.mockResolvedValue(geoCfg());
    callClaude.mockResolvedValue(
      haikuJson({
        verdict: 'hard_skip',
        reasons: [
          "Role location states 'Remote-US' without explicit permission for all US states",
        ],
        flags: ['residency_excluded'],
      })
    );

    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://example.com/ust',
      pageText: UST_REMOTE_US,
      forceHaiku: true,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    expect(out.preflight.verdict).not.toBe('hard_skip');
    expect(out.preflight.flags).toContain('residency_ok');
  });

  it('IT-BSTAR: no phantom clearance; U.S.-based developer residency OK', async () => {
    getConfig.mockResolvedValue(geoCfg());
    callClaude.mockResolvedValue(
      haikuJson({
        verdict: 'hard_skip',
        reasons: [
          'Clearance required (clearance) — skip policy',
          "Remote role with no explicit residency restrictions; 'U.S.-based' refers to client base",
        ],
        flags: ['clearance'],
      })
    );

    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://www.linkedin.com/jobs/view/itbstar',
      pageText: ITBSTAR_US_BASED_DEV,
      forceHaiku: true,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    expect(out.preflight.verdict).not.toBe('hard_skip');
    expect(out.preflight.flags).not.toContain('clearance');
    expect(out.preflight.reasons.join(' ')).not.toMatch(/clearance required/i);
  });

  it('Cormac U.S. citizen + matching work-auth note → clear citizenship gate', async () => {
    getConfig.mockResolvedValue(geoCfg());
    callClaude.mockResolvedValue(
      haikuJson({
        verdict: 'hard_skip',
        reasons: [
          'U.S. Citizen requirement is a residency/eligibility gate that may exclude candidate',
        ],
        flags: [],
      })
    );

    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://example.com/cormac',
      pageText: CORMAC_US_CITIZEN,
      forceHaiku: true,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    expect(out.preflight.verdict).toBe('clear');
    expect(out.preflight.flags).toContain('citizenship_ok');
    expect(out.preflight.reasons.join(' ')).not.toMatch(/eligibility gate/i);
  });

  it('real clearance required + skip policy → local hard_skip without Claude', async () => {
    getConfig.mockResolvedValue(
      makeConfig({
        apiKey: 'sk-test',
        locations: [{ zip: '78758', radiusMiles: 25 }],
        preferences: {
          ...DEFAULT_PREFERENCES,
          remoteOnly: false,
          clearancePolicy: 'skip',
          flagPermNotices: false,
          flagShellEmployers: false,
        },
        flagPermNotices: false,
      })
    );
    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://example.com/clearance',
      pageText: CLEARANCE_REQUIRED_JD,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    expect(out.preflight.verdict).toBe('hard_skip');
    expect(out.preflight.flags).toContain('clearance');
    expect(callClaude).not.toHaveBeenCalled();
  });

  it('bare Security clearance UI chrome does not local hard_skip', async () => {
    getConfig.mockResolvedValue(geoCfg());
    callClaude.mockResolvedValue(haikuJson({ verdict: 'clear', reasons: ['No hard gates'] }));

    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://example.com/noise',
      pageText: CLEARANCE_UI_NOISE_JD,
      forceHaiku: true,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    expect(out.preflight.verdict).not.toBe('hard_skip');
    expect(out.preflight.flags).not.toContain('clearance');
  });

  it('humanizes machine field names in returned reasons', async () => {
    getConfig.mockResolvedValue(geoCfg());
    callClaude.mockResolvedValue(
      haikuJson({
        verdict: 'soft',
        reasons: ['workEligibleRegions limited; remoteOnly noted'],
      })
    );

    const out = await handleBackgroundRequest({
      type: 'PREFLIGHT_JD',
      url: 'https://example.com/humanize',
      pageText: 'Fully remote. Nationwide. '.padEnd(400, 'x'),
      forceHaiku: true,
    });
    expect('preflight' in out).toBe(true);
    if (!('preflight' in out)) return;
    const blob = out.preflight.reasons.join(' ');
    expect(blob).not.toMatch(/workEligibleRegions|remoteOnly/);
  });
});
