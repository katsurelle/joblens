/**
 * Analyze pipeline e2e: scam negation must not force Poor/Apply no (transcript 1.5.1).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeConfig } from '../helpers/config';
import { DEFAULT_PREFERENCES } from '../../src/types/domain';

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

function fixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, `../fixtures/claude/${name}`), 'utf8');
}

describe('analyze pipeline e2e', () => {
  beforeEach(() => {
    callClaude.mockReset();
    getConfig.mockReset();
  });

  it('Matrix Poor + strong skills → floors lift Fit/Apply (offline Claude fixture)', async () => {
    getConfig.mockResolvedValue(
      makeConfig({
        apiKey: 'sk',
        locations: [{ zip: '78758', radiusMiles: 25 }],
        preferences: { ...DEFAULT_PREFERENCES, remoteOnly: true },
      })
    );
    callClaude.mockResolvedValue(fixture('analyze-matrix-poor.json'));

    const out = await handleBackgroundRequest({
      type: 'ANALYZE_JD',
      url: 'https://www.ziprecruiter.com/jobs/matrix',
      pageText: 'Remote Full Stack Developer Javascript React Python',
    });
    expect('analysis' in out).toBe(true);
    if (!('analysis' in out)) return;
    expect(out.analysis.fit.score).toBeGreaterThanOrEqual(85);
    expect(out.analysis.apply.verdict).toBe('yes');
  });

  it('negated no scam/shell postingSmell does not force Poor', async () => {
    getConfig.mockResolvedValue(
      makeConfig({
        apiKey: 'sk',
        preferences: { ...DEFAULT_PREFERENCES, remoteOnly: true },
      })
    );
    callClaude.mockResolvedValue(
      JSON.stringify({
        masthead: {
          organization: 'Dimensional',
          title: 'Engineer',
          workModel: 'remote',
          travel: 'None',
          employmentTerms: 'Full-time',
          healthInsurance: 'Unknown',
          payRange: 'n/a',
          seniority: 'Mid',
          workAuthorization: 'US',
          location: 'Remote',
        },
        geo: { verdict: 'eligible', reason: 'remote', method: 'model' },
        skillMatches: [
          {
            requirement: 'TypeScript',
            evidence: 'TS',
            reason: 'match',
            status: 'match',
            confidence: 'high',
          },
        ],
        dealbreakers: [],
        skipFlags: [],
        postingSmell:
          'Legitimate employer; no scam/shell or PERM/H-1B indicators.',
        declutteredJD: 'Remote engineer role.',
        fit: { label: 'Good fit', score: 85, rationale: 'skills ok' },
        apply: { verdict: 'yes', rationale: 'ok' },
      })
    );

    const out = await handleBackgroundRequest({
      type: 'ANALYZE_JD',
      url: 'https://example.com/legit',
      pageText: 'Fully remote TypeScript role. '.padEnd(400, 'x'),
    });
    expect('analysis' in out).toBe(true);
    if (!('analysis' in out)) return;
    expect(out.analysis.fit.score).toBeGreaterThan(0);
    expect(out.analysis.apply.verdict).not.toBe('no');
  });
});
