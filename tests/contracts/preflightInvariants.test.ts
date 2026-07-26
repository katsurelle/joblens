/**
 * Transcript-driven preflight invariants (chat 1a26c02e).
 * These encode product truth when heuristics and model output disagree.
 */
import { describe, expect, it } from 'vitest';
import {
  candidateClaimsUsCitizenship,
  detectClearanceLanguage,
  enforceClearancePolicy,
  evaluateRemoteResidency,
  humanizePreflightReason,
  listingIdentityChanged,
  listingIdentityFingerprint,
  looksUsBasedWorkerRequirement,
  looksUsCountryRemoteScope,
  mergePreflightResults,
  postingRequiresUsCitizenship,
  preflightCacheStillValid,
  runLocalPreflight,
  sanitizeHaikuCitizenshipSkip,
  sanitizeHaikuResidencySkip,
} from '../../src/lib/preflight';
import { DEFAULT_PREFERENCES } from '../../src/types/domain';
import { makeConfig } from '../helpers/config';
import {
  CLEARANCE_REQUIRED_JD,
  CLEARANCE_UI_NOISE_JD,
  CORMAC_US_CITIZEN,
  ITBSTAR_US_BASED_DEV,
  TURING_US_CANADA_WEU,
  UST_REMOTE_US,
  CUTSFORTH_REMOTE_EXCLUDE,
} from '../fixtures/postings';

const txPa = makeConfig({
  workEligibleRegions: ['TX', 'PA'],
  preferences: {
    ...DEFAULT_PREFERENCES,
    remoteOnly: true,
    clearancePolicy: 'skip',
  },
  workAuthorizationNote: 'US citizen, no sponsorship needed',
});

describe('preflight invariants (transcript)', () => {
  it('US/Canada/WEU OR-list clears TX/PA (Turing)', () => {
    expect(looksUsCountryRemoteScope(TURING_US_CANADA_WEU)).toBe(true);
    expect(evaluateRemoteResidency(TURING_US_CANADA_WEU, ['TX', 'PA']).verdict).toBe('clear');
    const local = runLocalPreflight({ cfg: txPa, pageText: TURING_US_CANADA_WEU });
    expect(local.verdict).not.toBe('hard_skip');
    expect(local.flags).toContain('residency_ok');

    const sanitized = sanitizeHaikuResidencySkip(
      {
        verdict: 'hard_skip',
        reasons: [
          'Residency restricted to US, Canada, or WEU; TX, PA are allowed under US scope',
        ],
        sources: ['haiku'],
        flags: ['residency_excluded'],
      },
      TURING_US_CANADA_WEU,
      { local, workEligibleRegions: ['TX', 'PA'] }
    );
    expect(sanitized.verdict).toBe('clear');
  });

  it('Remote-US is country scope, not a missing state token (UST)', () => {
    expect(evaluateRemoteResidency(UST_REMOTE_US, ['TX', 'PA']).verdict).toBe('clear');
    const local = runLocalPreflight({ cfg: txPa, pageText: UST_REMOTE_US });
    expect(local.flags).toContain('residency_ok');
  });

  it('U.S.-based developer is worker residency; U.S.-based clients is not enough alone', () => {
    expect(looksUsBasedWorkerRequirement(ITBSTAR_US_BASED_DEV)).toBe(true);
    expect(
      looksUsBasedWorkerRequirement(
        'Work with U.S.-based clients. Fully remote. No worker location stated.'
      )
    ).toBe(false);
    expect(evaluateRemoteResidency(ITBSTAR_US_BASED_DEV, ['TX', 'PA']).verdict).toBe('clear');
  });

  it('inverted state excludes permit other configured states (Cutsforth)', () => {
    expect(evaluateRemoteResidency(CUTSFORTH_REMOTE_EXCLUDE, ['TX', 'PA']).verdict).toBe(
      'clear'
    );
    expect(evaluateRemoteResidency(CUTSFORTH_REMOTE_EXCLUDE, ['NY', 'CA']).verdict).toBe(
      'hard_skip'
    );
  });

  it('clearance skip needs required phrasing; UI chrome and Haiku invention do not hard_skip', () => {
    expect(detectClearanceLanguage(CLEARANCE_UI_NOISE_JD).hit).toBe(false);
    expect(detectClearanceLanguage(ITBSTAR_US_BASED_DEV).hit).toBe(false);
    expect(detectClearanceLanguage(CLEARANCE_REQUIRED_JD).hit).toBe(true);

    const real = runLocalPreflight({
      cfg: makeConfig({ preferences: { ...DEFAULT_PREFERENCES, clearancePolicy: 'skip' } }),
      pageText: CLEARANCE_REQUIRED_JD,
    });
    expect(real.verdict).toBe('hard_skip');

    const phantom = enforceClearancePolicy(
      {
        verdict: 'hard_skip',
        reasons: ['Clearance required (clearance) — skip policy'],
        sources: ['haiku'],
        flags: ['clearance'],
      },
      makeConfig({ preferences: { ...DEFAULT_PREFERENCES, clearancePolicy: 'skip' } }),
      ITBSTAR_US_BASED_DEV
    );
    expect(phantom.verdict).not.toBe('hard_skip');
    expect(phantom.flags).not.toContain('clearance');
  });

  it('U.S. citizen requirement clears when work-auth note says citizen (Cormac)', () => {
    expect(postingRequiresUsCitizenship(CORMAC_US_CITIZEN)).toBe(true);
    expect(candidateClaimsUsCitizenship('US citizen, no sponsorship needed')).toBe(true);

    const cleared = sanitizeHaikuCitizenshipSkip(
      {
        verdict: 'hard_skip',
        reasons: [
          'U.S. Citizen requirement is a residency/eligibility gate that may exclude candidate',
        ],
        sources: ['haiku'],
        flags: [],
      },
      CORMAC_US_CITIZEN,
      'US citizen, no sponsorship needed'
    );
    expect(cleared.verdict).toBe('clear');
    expect(cleared.flags).toContain('citizenship_ok');

    const emptyNote = sanitizeHaikuCitizenshipSkip(
      {
        verdict: 'hard_skip',
        reasons: [
          'U.S. Citizen requirement is a residency/eligibility gate that may exclude candidate',
        ],
        sources: ['haiku'],
        flags: [],
      },
      CORMAC_US_CITIZEN,
      ''
    );
    expect(emptyNote.verdict).toBe('soft');
  });

  it('Indeed scroll / JD text growth does not change listing identity or invalidate cache', () => {
    const base = {
      href: 'https://www.indeed.com/jobs?q=x&vjk=abc123',
      canonicalUrl: 'https://www.indeed.com/viewjob?jk=abc123',
      paneTitle: 'Web Developer',
    };
    const fp1 = listingIdentityFingerprint(base);
    const fp2 = listingIdentityFingerprint(base);
    expect(fp1).toBe(fp2);
    expect(listingIdentityChanged(fp1, fp2)).toBe(false);
    expect(
      listingIdentityChanged(
        fp1,
        listingIdentityFingerprint({ ...base, paneTitle: 'Other Role' })
      )
    ).toBe(true);
    expect(preflightCacheStillValid({ title: 'Web Developer' }, 'Web Developer')).toBe(true);
    expect(preflightCacheStillValid({ title: 'Web Developer' }, 'Other')).toBe(false);
  });

  it('local hard_skip is sticky over Haiku clear', () => {
    const merged = mergePreflightResults(
      {
        verdict: 'hard_skip',
        reasons: ['Blocked employer'],
        sources: ['local'],
        flags: ['blocked_employer'],
      },
      { verdict: 'clear', reasons: ['ok'], sources: ['haiku'], flags: [] }
    );
    expect(merged.verdict).toBe('hard_skip');
  });

  it('reasons stay human-readable (no field / flag ids)', () => {
    const samples = [
      'workEligibleRegions limited to TX',
      'remoteOnly: posting looks onsite',
      'flag: residency_excluded',
      'clearancePolicy skip',
      'residency/eligibility gate that may exclude candidate',
    ];
    for (const s of samples) {
      const h = humanizePreflightReason(s);
      expect(h).not.toMatch(/workEligibleRegions|remoteOnly|residency_excluded|clearancePolicy/);
      expect(h).not.toMatch(/eligibility gate/i);
    }
  });
});
