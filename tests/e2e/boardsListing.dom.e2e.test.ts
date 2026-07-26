/**
 * Board extract + listing-identity e2e (jsdom fixtures).
 * Guards Indeed vjk split-pane and scroll-stable preflight identity.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractPageTextForBoard,
  getBoardById,
  resolveBoard,
  shouldShowLauncher,
} from '../../src/lib/boards';
import {
  listingIdentityChanged,
  listingIdentityFingerprint,
  listingKeyFromHref,
  preflightCacheKey,
  preflightCacheStillValid,
  runLocalPreflight,
} from '../../src/lib/preflight';
import { DEFAULT_PREFERENCES } from '../../src/types/domain';
import { makeConfig } from '../helpers/config';

function loadHtml(name: string): Document {
  const html = readFileSync(resolve(import.meta.dirname, `../fixtures/pages/${name}`), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('boards + listing identity e2e', () => {
  it('Indeed vjk SERP shows launcher and uses vjk as cache key', () => {
    const href =
      'https://www.indeed.com/jobs?q=software+engineer&l=Austin%2C+TX&vjk=d75084593b7d8230';
    const board = resolveBoard(href);
    expect(board?.id).toBe('indeed');
    expect(shouldShowLauncher(board, href)).toBe(true);
    expect(listingKeyFromHref(href)).toBe('d75084593b7d8230');
    expect(
      preflightCacheKey({
        href,
        canonicalUrl: 'https://www.indeed.com/viewjob?jk=other',
      })
    ).toBe('lk:d75084593b7d8230');
  });

  it('Indeed fixture text feeds local preflight without hard_skip for remote TX/PA', () => {
    const doc = loadHtml('indeed-job.html');
    const board = getBoardById('indeed');
    const text = extractPageTextForBoard(board, doc);
    expect(text.length).toBeGreaterThan(40);

    // Enrich with remote+US so residency clears for TX/PA (fixture alone is generic)
    const pageText = `${text}\nFully remote. Role Location: Remote-US\n`;
    const local = runLocalPreflight({
      cfg: makeConfig({
        workEligibleRegions: ['TX', 'PA'],
        preferences: { ...DEFAULT_PREFERENCES, remoteOnly: true },
      }),
      pageText,
      pageTitle: 'Software Engineer',
    });
    expect(local.verdict).not.toBe('hard_skip');
  });

  it('ZipRecruiter fixture extracts Matrix-shaped JD', () => {
    const doc = loadHtml('ziprecruiter-detail.html');
    const text = extractPageTextForBoard(getBoardById('ziprecruiter'), doc);
    expect(text).toMatch(/Matrix Retail/);
    expect(text).toMatch(/Javascript/i);
  });

  it('SPA identity: same vjk+title keeps fingerprint across growing JD text', () => {
    const href = 'https://www.indeed.com/jobs?q=x&vjk=abc';
    const canonicalUrl = 'https://www.indeed.com/viewjob?jk=abc';
    const title = 'Web Developer - IT-BSTAR';
    const a = listingIdentityFingerprint({ href, canonicalUrl, paneTitle: title });
    const b = listingIdentityFingerprint({ href, canonicalUrl, paneTitle: title });
    expect(a).toBe(b);
    expect(listingIdentityChanged(a, b)).toBe(false);
    // Cache ignores textSig growth (content.tsx contract)
    expect(preflightCacheStillValid({ title }, title)).toBe(true);
    expect(
      listingIdentityChanged(
        a,
        listingIdentityFingerprint({
          href: 'https://www.indeed.com/jobs?q=x&vjk=zzz',
          canonicalUrl,
          paneTitle: title,
        })
      )
    ).toBe(true);
  });
});
