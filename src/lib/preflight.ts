import type {
  Config,
  OccasionalTravelAllowance,
  PreflightResult,
  PreflightVerdict,
} from '../types/domain';
import { computeDeterministicGeo } from './geo';
import { findBlockedEmployerHit } from './ratings';
import {
  US_STATE_ALIASES,
  allRegionsAreUsStates,
  allRegionsInCountry,
  extractAllowedCountries,
  normalizeRegionToken,
  regionsAsUsStateCodes,
  regionsMatchCountryAllowList,
  type AllowedCountry,
} from './regionTaxonomy';
import {
  candidateClaimsUsCitizenship,
  candidateSatisfiesPostingAuth,
  postingRequiresUsCitizenship,
} from './workAuth';
import { normalizeHomeCountry } from './homeCountry';

export type { AllowedCountry } from './regionTaxonomy';
export {
  extractAllowedCountries,
  normalizeRegionToken,
  regionsMatchCountryAllowList,
} from './regionTaxonomy';
export {
  candidateClaimsUsCitizenship,
  postingRequiresUsCitizenship,
} from './workAuth';

/** Bound Haiku input size (adjustable). Prefer head of JD for location/title/apply gates. */
export const PREFLIGHT_TEXT_CAP = 10_000;

const ONSITE_RE =
  /\b(?:on[\s-]?site|in[\s-]?office|in[\s-]?person|must\s+relocate|relocation\s+required)\b/i;
const HYBRID_RE = /\bhybrid\b/i;

/** Prefer several simple patterns over one high-complexity alternation (Sonar). */
function anyRe(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

const REMOTE_STRONG_PATTERNS: readonly RegExp[] = [
  /\bfully\s+remote\b/i,
  /\b100%\s+remote\b/i,
  /\bremote[\s-]?first\b/i,
  /\bwork\s+from\s+home\b/i,
  /\bwfh\b/i,
  /\bremote\s+ok\b/i,
  /\bremote\s+position\b/i,
  /\bprimarily\s+remote\b/i,
];

/** Header / work-location remote ("City, ST · Remote", "Work Location: Remote but …"). */
const REMOTE_PRIMARY_RE =
  /(?:^|[·•|,]\s*|\bwork\s*location\s*:\s*|\blocation\s*:\s*)remote\b/i;

/** Short onsite training/onboarding — travel cadence, not hybrid primary. */
const SHORT_ONSITE_TRAINING_PATTERNS: readonly RegExp[] = [
  /\b\d+\s*(?:weeks?|days?)\s+(?:of\s+)?(?:mandatory\s+)?on[\s-]?site\b/i,
  /\b\d+\s*(?:weeks?|days?)\s+(?:of\s+)?(?:mandatory\s+)?(?:training|onboarding|orientation)\s+on[\s-]?site\b/i,
  /\bon[\s-]?site\s+(?:training|onboarding|orientation)\b/i,
  /\b(?:mandatory|initial)\s+(?:training|onboarding|orientation)\s+on[\s-]?site\b/i,
  /\b(?:initial\s+)?onboarding\s+on[\s-]?site\b/i,
  /\borientation\s+on[\s-]?site\b/i,
];

export function hasShortOnsiteTraining(pageText: string): boolean {
  return anyRe(pageText, SHORT_ONSITE_TRAINING_PATTERNS);
}

export function hasRemotePrimarySignal(pageText: string): boolean {
  return (
    anyRe(pageText, REMOTE_STRONG_PATTERNS) ||
    REMOTE_PRIMARY_RE.test(pageText) ||
    /\bremote\s+but\b/i.test(pageText)
  );
}

/** Detected onsite travel cadence (most frequent signal wins). */
export type OnsiteTravelCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'unknown';

/** Higher = more frequent onsite expectation. */
const CADENCE_RANK: Record<Exclude<OnsiteTravelCadence, 'unknown'>, number> = {
  daily: 5,
  weekly: 4,
  monthly: 3,
  quarterly: 2,
  yearly: 1,
};

const ALLOWANCE_RANK: Record<Exclude<OccasionalTravelAllowance, 'none'>, number> = {
  weekly: 4,
  monthly: 3,
  quarterly: 2,
  yearly: 1,
};

/**
 * Infer how often the posting requires onsite presence.
 * When several signals appear, returns the most frequent (strictest).
 */
export function detectOnsiteTravelCadence(pageText: string): OnsiteTravelCadence {
  const t = pageText;
  let worst: OnsiteTravelCadence = 'unknown';
  const bump = (c: Exclude<OnsiteTravelCadence, 'unknown'>): void => {
    if (
      worst === 'unknown' ||
      CADENCE_RANK[c] > CADENCE_RANK[worst as Exclude<OnsiteTravelCadence, 'unknown'>]
    ) {
      worst = c;
    }
  };

  // One-shot / short training stays rare even if "onsite" appears.
  if (hasShortOnsiteTraining(t)) {
    bump('yearly');
  }

  if (
    /\bdaily\b/i.test(t) ||
    /\b\d+\s*(?:[-–]|to)\s*\d+\s*days?\s+(?:a|per)\s+week\b/i.test(t) ||
    /\b[345]\s*days?\s+(?:a|per)\s+week\b/i.test(t) ||
    /\bdays?\s+per\s+week\b/i.test(t) ||
    /\bin[\s-]?office\s+(?:most|every)\s+day/i.test(t)
  ) {
    bump('daily');
  }
  if (
    /\bweekly\b/i.test(t) ||
    /\bonce\s+(?:a|per)\s+week\b/i.test(t) ||
    /\bevery\s+week\b/i.test(t) ||
    /\b\d+\s*times?\s+(?:a|per)\s+week\b/i.test(t)
  ) {
    bump('weekly');
  }
  if (
    /\bmonthly\b/i.test(t) ||
    /\bonce\s+(?:a|per)\s+month\b/i.test(t) ||
    /\bevery\s+month\b/i.test(t) ||
    /\b\d+\s*times?\s+(?:a|per)\s+month\b/i.test(t)
  ) {
    bump('monthly');
  }
  if (
    /\bquarterly\b/i.test(t) ||
    /\bonce\s+(?:a|per)\s+quarter\b/i.test(t) ||
    /\bevery\s+quarter\b/i.test(t)
  ) {
    bump('quarterly');
  }
  const timesPerYear = /\b(\d+)\s*times?\s+(?:a|per)\s+year\b/i.exec(t);
  if (timesPerYear?.[1]) {
    const n = Number(timesPerYear[1]);
    if (n <= 1) bump('yearly');
    else if (n <= 4) bump('quarterly');
    else if (n <= 12) bump('monthly');
    else bump('weekly');
  }
  if (
    /\b(?:annually|yearly|once\s+(?:a|per)\s+year|once\s+annually)\b/i.test(t) ||
    /\b1\s*times?\s+(?:a|per)\s+year\b/i.test(t)
  ) {
    bump('yearly');
  }
  if (worst === 'unknown' && /\boccasional(?:ly)?\b/i.test(t) && ONSITE_RE.test(t)) {
    bump('yearly');
  }
  return worst;
}

/**
 * True when outside-radius hybrid/light travel should Soft-warn instead of Hard skip.
 */
export function allowsOccasionalTravelOutsideRadius(
  allowance: OccasionalTravelAllowance | undefined,
  cadence: OnsiteTravelCadence
): boolean {
  if (!allowance || allowance === 'none') return false;
  if (cadence === 'unknown') return true;
  if (cadence === 'daily') return false;
  return CADENCE_RANK[cadence] <= ALLOWANCE_RANK[allowance];
}

export function truncateForPreflight(pageText: string, cap = PREFLIGHT_TEXT_CAP): string {
  const t = pageText.trim();
  if (t.length <= cap) return t;
  const head = Math.floor(cap * 0.7);
  const tail = cap - head - 20;
  return `${t.slice(0, head)}\n…\n${t.slice(-Math.max(0, tail))}`;
}

export function inferWorkModelHint(pageText: string): 'onsite' | 'hybrid' | 'remote' | 'unclear' {
  const remotePrimary = hasRemotePrimarySignal(pageText);
  const hasHybrid = HYBRID_RE.test(pageText);
  const hasOnsite = ONSITE_RE.test(pageText);
  const shortTraining = hasShortOnsiteTraining(pageText);

  // Remote-primary + short onsite training → still remote (travel soft, not commute hybrid).
  if (remotePrimary && shortTraining && !hasHybrid) return 'remote';
  if (hasHybrid) return 'hybrid';
  if (hasOnsite && !remotePrimary) return 'onsite';
  if (remotePrimary && !hasOnsite) return 'remote';
  if (hasOnsite && remotePrimary) return 'hybrid';
  return 'unclear';
}

/**
 * Find an explicit multi-country / country residency allow clause on the page.
 * Examples: "based out of US, Canada or WEU", "must be located in the US or Canada".
 */
export function findCountryAllowClause(pageText: string): {
  clause: string;
  countries: AllowedCountry[];
} | null {
  // Split prefixes / prepositions so each pattern stays under Sonar complexity.
  const patterns = [
    /\bcandidates?\s+must\s+be\s+(?:based|located|reside)\s+out\s+of\s+([^.!\n]{8,200})/gi,
    /\bcandidates?\s+must\s+be\s+(?:based|located|reside)\s+in\s+([^.!\n]{8,200})/gi,
    /\bmust\s+be\s+(?:based|located|reside)\s+out\s+of\s+([^.!\n]{8,200})/gi,
    /\bmust\s+be\s+(?:based|located|reside)\s+in\s+([^.!\n]{8,200})/gi,
    /\bshould\s+be\s+(?:based|located|reside)\s+out\s+of\s+([^.!\n]{8,200})/gi,
    /\bshould\s+be\s+(?:based|located|reside)\s+in\s+([^.!\n]{8,200})/gi,
    /\b(?:based|located|reside)\s+out\s+of\s+([^.!\n]{8,200})/gi,
    /\b(?:based|located|reside)\s+in\s+([^.!\n]{8,200})/gi,
    /\blocation\s*:\s*([^.!\n]{8,180})/gi,
    /\bresidency\s*:\s*([^.!\n]{8,180})/gi,
    /\bwork\s+location\s*:\s*([^.!\n]{8,180})/gi,
  ];
  for (const re of patterns) {
    for (const m of pageText.matchAll(re)) {
      const clause = (m[1] || m[0] || '').trim();
      if (!clause) continue;
      const countries = extractAllowedCountries(clause);
      // Need at least one country token; prefer multi-country OR US-with-peers
      if (countries.length >= 1) {
        // Skip pure US-state include lists without country wording
        if (
          countries.length === 1 &&
          countries[0] === 'US' &&
          !/\b(?:US|U\.S\.|United\s+States|Canada|WEU|UK|country|countries)\b/i.test(clause)
        ) {
          continue;
        }
        return { clause, countries };
      }
    }
  }
  return null;
}

/**
 * Country-level US remote scope (not a state subset).
 * "Remote-US", "Role Location: Remote-US", "Remote (US)", "U.S.-based developer" —
 * candidate US states are in-scope.
 */
export function looksUsCountryRemoteScope(pageText: string): boolean {
  const t = pageText;
  if (/\brole\s+location\s*:\s*remote[\s\-–—]*U\.?S\.?A?\b/i.test(t)) return true;
  if (/\bremote[\s\-–—]*U\.?S\.?A?\b/i.test(t)) return true;
  if (/\bU\.?S\.?A?[\s\-–—]*remote\b/i.test(t)) return true;
  if (/\bremote\s*\(\s*U\.?S\.?A?\s*\)/i.test(t)) return true;
  if (looksUsBasedWorkerRequirement(t)) return true;
  if (/\b(?:must|should)\s+(?:reside|be\s+(?:based|located))\s+in\s+the\s+(?:US|U\.S\.|United\s+States)\b/i.test(t)) {
    // Country-only when the same clause doesn't name a US state
    const clause = /(?:must|should)\s+(?:reside|be\s+(?:based|located))\s+in\s+the\s+(?:US|U\.?S\.|United\s+States)[^.!\n]{0,80}/i.exec(
      t
    )?.[0];
    if (clause && extractStateTokens(clause).length === 0) return true;
  }
  const allow = findCountryAllowClause(t);
  if (allow && allow.countries.includes('US') && allow.countries.length >= 1) {
    // Multi-country OR-list that includes US, or US-only country clause
    return true;
  }
  return false;
}

/**
 * "U.S.-based [role/candidate]" means the worker must live in the US.
 * "U.S.-based clients" alone does not.
 */
export function looksUsBasedWorkerRequirement(pageText: string): boolean {
  const t = pageText;
  // Strip client-only phrases so they don't confuse nearby worker matches
  const withoutClients = t.replace(
    /\bU\.?\s*S\.?-?\s*based\s+clients?\b/gi,
    ' '
  );
  if (
    anyRe(withoutClients, [
      /\blooking\s+for\s+(?:an?\s+)?U\.?\s*S\.?-?\s*based\b/i,
      /\bseeking\s+(?:an?\s+)?U\.?\s*S\.?-?\s*based\b/i,
      /\bhiring\s+(?:an?\s+)?U\.?\s*S\.?-?\s*based\b/i,
      /\bneeds?\s+(?:an?\s+)?U\.?\s*S\.?-?\s*based\b/i,
      /\bneeded\s+(?:an?\s+)?U\.?\s*S\.?-?\s*based\b/i,
    ])
  ) {
    return true;
  }
  const usBasedRoleTokens = new Set([
    'developer',
    'engineer',
    'programmer',
    'designer',
    'analyst',
    'architect',
    'candidate',
    'applicant',
    'contractor',
    'employee',
    'worker',
    'specialist',
    'consultant',
  ]);
  for (const m of withoutClients.matchAll(/\bU\.?\s*S\.?-?\s*based\b/gi)) {
    const start = m.index + m[0].length;
    const after = withoutClients.slice(start, start + 80).toLowerCase();
    const tokens = after.split(/[^a-z]+/).filter(Boolean).slice(0, 6);
    if (tokens.some((tok) => usBasedRoleTokens.has(tok))) return true;
  }
  if (
    /\b(?:must|should)\s+be\s+U\.?\s*S\.?-?\s*based\b/i.test(withoutClients) ||
    /\bU\.?\s*S\.?-?\s*based\s+(?:candidates?|applicants?|only)\b/i.test(withoutClients)
  ) {
    return true;
  }
  return false;
}

function extractStateTokens(chunk: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Full state names (longest first)
  const names = Object.keys(US_STATE_ALIASES).sort((a, b) => b.length - a.length);
  let rest = chunk;
  for (const name of names) {
    const namePat = name.replace(/\s+/g, String.raw`\s+`);
    const re = new RegExp(String.raw`\b${namePat}\b`, 'i');
    if (re.test(rest)) {
      const code = US_STATE_ALIASES[name];
      if (code && !seen.has(code)) {
        seen.add(code);
        out.push(code);
      }
      rest = rest.replace(re, ' ');
    }
  }
  for (const m of rest.matchAll(/\b([A-Z]{2})\b/g)) {
    const code = (m[1] || '').toUpperCase();
    if (Object.values(US_STATE_ALIASES).includes(code) && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

export type ResidencyEval = {
  verdict: 'clear' | 'hard_skip' | 'unknown';
  reason: string;
  mode: 'exclude' | 'include' | 'none';
  states: string[];
};

const EXCLUDE_RESIDENCY_PATTERNS: readonly RegExp[] = [
  /\bnot\s+accepting[^.!\n]{0,200}/i,
  /\bare\s+not\s+accepting[^.!\n]{0,200}/i,
  /\bwill\s+not\s+hire[^.!\n]{0,200}/i,
  /\bwill\s+not\s+accept[^.!\n]{0,200}/i,
  /\bwill\s+not\s+consider[^.!\n]{0,200}/i,
  /\bdo\s+not\s+hire[^.!\n]{0,200}/i,
  /\bdo\s+not\s+accept[^.!\n]{0,200}/i,
  /\bdo\s+not\s+consider[^.!\n]{0,200}/i,
  /\bexcluding[^.!\n]{0,200}/i,
  /\bcannot\s+be\s+considered[^.!\n]{0,200}/i,
  /\bcan\s+not\s+be\s+considered[^.!\n]{0,200}/i,
];

const INCLUDE_RESIDENCY_PATTERNS: readonly RegExp[] = [
  /\bmust\s+reside\s+in[^.!\n]{0,200}/i,
  /\bcandidates?\s+must\s+be\s+(?:based|located)\s+out\s+of[^.!\n]{0,200}/i,
  /\bcandidates?\s+must\s+be\s+(?:based|located)\s+in[^.!\n]{0,200}/i,
  /\bcandidates?\s+(?:based|located)\s+out\s+of[^.!\n]{0,200}/i,
  /\bcandidates?\s+(?:based|located)\s+in[^.!\n]{0,200}/i,
  /\bonly\s+hiring\s+from[^.!\n]{0,200}/i,
  /\bonly\s+hiring\s+in[^.!\n]{0,200}/i,
  /\bonly\s+accepting\s+from[^.!\n]{0,200}/i,
  /\bonly\s+accepting\s+in[^.!\n]{0,200}/i,
  /\bopen\s+only\s+to\s+candidates\s+in[^.!\n]{0,200}/i,
  /\bopen\s+only\s+to\s+residents\s+of[^.!\n]{0,200}/i,
  /\bopen\s+to\s+candidates\s+in[^.!\n]{0,200}/i,
  /\bopen\s+to\s+residents\s+of[^.!\n]{0,200}/i,
  /\blocation\s*:\s*candidates?\s+must\s+be\s+(?:based|located)\s+out\s+of[^.!\n]{0,200}/i,
  /\blocation\s*:\s*candidates?\s+must\s+be\s+(?:based|located)\s+in[^.!\n]{0,200}/i,
  /\blocation\s*:\s*(?:based|located)\s+out\s+of[^.!\n]{0,200}/i,
  /\blocation\s*:\s*(?:based|located)\s+in[^.!\n]{0,200}/i,
  /\bresidency\s*:\s*candidates?\s+must\s+be\s+(?:based|located)\s+out\s+of[^.!\n]{0,200}/i,
  /\bresidency\s*:\s*candidates?\s+must\s+be\s+(?:based|located)\s+in[^.!\n]{0,200}/i,
  /\bresidency\s*:\s*(?:based|located)\s+out\s+of[^.!\n]{0,200}/i,
  /\bresidency\s*:\s*(?:based|located)\s+in[^.!\n]{0,200}/i,
];

const INCLUDE_CLAUSE_COUNTRY_WORDING_PATTERNS: readonly RegExp[] = [
  /\bunited\s+states\b/i,
  /\bU\.?S\.?\b/i,
  /\bnationwide\b/i,
  /\bcanada\b/i,
  /\bWEU\b/i,
  /\bUK\b/i,
  /\bireland\b/i,
  /\baustralia\b/i,
  /\bEU\b/i,
];

function firstPatternHit(text: string, patterns: readonly RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[0]) return m[0];
  }
  return null;
}

function evalExcludeResidency(
  regions: string[],
  pageText: string,
  homeCountry: string
): ResidencyEval | null {
  const hit = firstPatternHit(pageText, EXCLUDE_RESIDENCY_PATTERNS);
  if (!hit) return null;
  const states = extractStateTokens(hit);
  if (!states.length) return null;
  const usRegions = regionsAsUsStateCodes(regions, homeCountry);
  const compare = usRegions.length ? usRegions : regions;
  if (regions.length === 0) {
    return {
      verdict: 'unknown',
      reason: `Posting excludes remote workers in ${states.join(', ')}; no candidate residency regions configured`,
      mode: 'exclude',
      states,
    };
  }
  if (compare.every((r) => states.includes(r))) {
    return {
      verdict: 'hard_skip',
      reason: `Posting excludes remote workers in ${states.join(', ')}; your regions (${regions.join(', ')}) are all excluded`,
      mode: 'exclude',
      states,
    };
  }
  return {
    verdict: 'clear',
    reason: `Posting excludes ${states.join(', ')}; your regions (${regions.join(', ')}) are permitted`,
    mode: 'exclude',
    states,
  };
}

function evalCountryAllowResidency(
  regions: string[],
  pageText: string,
  homeCountry: string
): ResidencyEval | null {
  const countryAllow = findCountryAllowClause(pageText);
  if (!countryAllow) return null;
  if (regionsMatchCountryAllowList(regions, countryAllow.countries, homeCountry)) {
    const labels = countryAllow.countries.join('/');
    return {
      verdict: 'clear',
      reason: `Posting allows residency in ${labels}; your regions (${regions.join(', ')}) are covered`,
      mode: 'include',
      states: [],
    };
  }
  if (countryAllow.countries.length >= 1 && regions.length === 0) {
    return {
      verdict: 'unknown',
      reason: `Posting limits residency to ${countryAllow.countries.join('/')}; no candidate regions configured`,
      mode: 'include',
      states: [],
    };
  }
  return null;
}

function evalIncludeResidency(
  regions: string[],
  pageText: string,
  homeCountry: string
): ResidencyEval | null {
  const hit = firstPatternHit(pageText, INCLUDE_RESIDENCY_PATTERNS);
  if (!hit || anyRe(hit, INCLUDE_CLAUSE_COUNTRY_WORDING_PATTERNS)) return null;
  const states = extractStateTokens(hit);
  if (!states.length) return null;
  const usRegions = regionsAsUsStateCodes(regions, homeCountry);
  const compare = usRegions.length ? usRegions : regions;
  if (regions.length === 0) {
    return {
      verdict: 'unknown',
      reason: `Posting limits residency to ${states.join(', ')}; no candidate regions configured`,
      mode: 'include',
      states,
    };
  }
  if (!compare.some((r) => states.includes(r))) {
    return {
      verdict: 'hard_skip',
      reason: `Posting requires residency in ${states.join(', ')}; your regions (${regions.join(', ')}) do not overlap`,
      mode: 'include',
      states,
    };
  }
  return {
    verdict: 'clear',
    reason: `Posting allows residency in ${states.join(', ')}; overlaps your regions (${regions.join(', ')})`,
    mode: 'include',
    states,
  };
}

function looksNamedCountryRemoteScope(
  pageText: string,
  namePattern: RegExp,
  opts?: { articleThe?: boolean; extraReside?: RegExp }
): boolean {
  const t = pageText;
  const nameSrc = namePattern.source;
  if (new RegExp(String.raw`\bremote[\s\-–—]*(?:${nameSrc})\b`, 'i').test(t)) return true;
  if (new RegExp(String.raw`\b(?:${nameSrc})[\s\-–—]*remote\b`, 'i').test(t)) return true;
  if (new RegExp(String.raw`\bremote\s*\(\s*(?:${nameSrc})\s*\)`, 'i').test(t)) return true;
  const the = opts?.articleThe ? String.raw`(?:the\s+)?` : '';
  if (
    new RegExp(
      String.raw`\b(?:must|should)\s+(?:reside|be\s+(?:based|located))\s+in\s+${the}(?:${nameSrc})\b`,
      'i'
    ).test(t)
  ) {
    return true;
  }
  if (opts?.extraReside?.test(t)) return true;
  return false;
}

export function looksCanadaRemoteScope(pageText: string): boolean {
  return looksNamedCountryRemoteScope(pageText, /Canada/);
}

export function looksUkRemoteScope(pageText: string): boolean {
  return looksNamedCountryRemoteScope(pageText, /UK|U\.K\.|United\s+Kingdom/, {
    articleThe: true,
    extraReside:
      /\b(?:must|should)\s+(?:have\s+right\s+to\s+work)\s+in\s+the\s+(?:UK|United\s+Kingdom)\b/i,
  });
}

export function looksAustraliaRemoteScope(pageText: string): boolean {
  return looksNamedCountryRemoteScope(pageText, /Australia/);
}

export function looksIrelandRemoteScope(pageText: string): boolean {
  return looksNamedCountryRemoteScope(pageText, /Ireland/);
}

function clearCountryWide(
  reason: string
): ResidencyEval {
  return { verdict: 'clear', reason, mode: 'none', states: [] };
}

function evalCountryWideResidency(
  regions: string[],
  pageText: string,
  homeCountry: string
): ResidencyEval | null {
  if (!regions.length) return null;

  if (looksUsCountryRemoteScope(pageText) || looksUnrestrictedRemoteResidency(pageText)) {
    if (allRegionsAreUsStates(regions, homeCountry)) {
      return clearCountryWide(
        looksUsCountryRemoteScope(pageText)
          ? 'Remote role scoped to the US; your state residency is within the US'
          : 'Remote / nationwide — no state residency subset that excludes you'
      );
    }
  }

  const scoped: Array<{
    hit: boolean;
    country: 'CA' | 'UK' | 'AU' | 'IE';
    label: string;
  }> = [
    { hit: looksCanadaRemoteScope(pageText), country: 'CA', label: 'Canada' },
    { hit: looksUkRemoteScope(pageText), country: 'UK', label: 'the UK' },
    { hit: looksAustraliaRemoteScope(pageText), country: 'AU', label: 'Australia' },
    { hit: looksIrelandRemoteScope(pageText), country: 'IE', label: 'Ireland' },
  ];
  for (const row of scoped) {
    if (row.hit && allRegionsInCountry(regions, row.country, homeCountry)) {
      return clearCountryWide(
        `Remote role scoped to ${row.label}; your regions are within ${row.label}`
      );
    }
  }
  return null;
}

/**
 * Local remote-residency gate.
 *
 * Principle: parse include/exclude state sets from the JD; hard_skip only when
 * candidate regions are non-empty and their intersection with allowed residency
 * is empty (exclude: every candidate state is forbidden; include: none overlap).
 * HQ / "City · Remote" alone is not a residency restriction.
 */
export function evaluateRemoteResidency(
  pageText: string,
  workEligibleRegions: readonly string[],
  homeCountry: string | null | undefined = 'US'
): ResidencyEval {
  const home = homeCountry || 'US';
  const regions = workEligibleRegions.map((r) => normalizeRegionToken(r, home)).filter(Boolean);
  return (
    evalExcludeResidency(regions, pageText, home) ??
    evalCountryAllowResidency(regions, pageText, home) ??
    evalIncludeResidency(regions, pageText, home) ??
    evalCountryWideResidency(regions, pageText, home) ?? {
      verdict: 'unknown',
      reason: '',
      mode: 'none',
      states: [],
    }
  );
}


function extractOrgCandidates(pageText: string, title: string, docTitle?: string): string[] {
  const out: string[] = [];
  if (docTitle) out.push(docTitle);
  if (title) out.push(title);
  // Early header region often carries company name
  out.push(pageText.slice(0, 1200));
  return out;
}

function findBlockedInHaystacks(
  haystacks: readonly string[],
  blocked: readonly string[]
): string | null {
  for (const hay of haystacks) {
    const hit = findBlockedEmployerHit(hay, blocked);
    if (hit) return hit;
  }
  // Also match blocked name as substring of early page text (broader than org-field match)
  const early = haystacks.join('\n').toLowerCase();
  for (const raw of blocked) {
    const needle = raw.trim().toLowerCase();
    if (needle.length >= 2 && early.includes(needle)) return raw.trim();
  }
  return null;
}

export function needsSemanticPreflight(cfg: Config): boolean {
  const p = cfg.preferences;
  if (p.blockedEmployers.some((e) => e.trim().length >= 2)) return true;
  if (p.clearancePolicy !== 'ignore') return true;
  if (Object.values(p.roleSkipCategories).some(Boolean)) return true;
  if (p.flagShellEmployers) return true;
  if (p.flagPermNotices || cfg.flagPermNotices) return true;
  if (p.remoteOnly) return true;
  return false;
}

const CLEARANCE_REQUIRED_PATTERNS: readonly RegExp[] = [
  /\bclearance\s+required\b/i,
  /\bclearance\s+needed\b/i,
  /\bclearance\s+mandatory\b/i,
  /\bsecurity\s+clearance\s+required\b/i,
  /\bsecurity\s+clearance\s+needed\b/i,
  /\bsecurity\s+clearance\s+mandatory\b/i,
  /\bactive\s+clearance\s+required\b/i,
  /\bactive\s+clearance\s+needed\b/i,
  /\bactive\s+clearance\s+mandatory\b/i,
  /\bcurrent\s+clearance\s+required\b/i,
  /\bcurrent\s+clearance\s+needed\b/i,
  /\bcurrent\s+clearance\s+mandatory\b/i,
  /\bexisting\s+clearance\s+required\b/i,
  /\bexisting\s+clearance\s+needed\b/i,
  /\bexisting\s+clearance\s+mandatory\b/i,
  /\bactive\s+security\s+clearance\s+required\b/i,
  /\bactive\s+security\s+clearance\s+needed\b/i,
  /\bactive\s+security\s+clearance\s+mandatory\b/i,
  /\bcurrent\s+security\s+clearance\s+required\b/i,
  /\bcurrent\s+security\s+clearance\s+needed\b/i,
  /\bcurrent\s+security\s+clearance\s+mandatory\b/i,
  /\bexisting\s+security\s+clearance\s+required\b/i,
  /\bexisting\s+security\s+clearance\s+needed\b/i,
  /\bexisting\s+security\s+clearance\s+mandatory\b/i,
  /\bmust\s+clearance\b/i,
  /\bmust\s+an?\s+clearance\b/i,
  /\bmust\s+active\s+clearance\b/i,
  /\bmust\s+an?\s+active\s+clearance\b/i,
  /\bmust\s+security\s+clearance\b/i,
  /\bmust\s+an?\s+security\s+clearance\b/i,
  /\bmust\s+active\s+security\s+clearance\b/i,
  /\bmust\s+an?\s+active\s+security\s+clearance\b/i,
  /\brequires?\s+clearance\b/i,
  /\brequires?\s+an?\s+clearance\b/i,
  /\brequires?\s+active\s+clearance\b/i,
  /\brequires?\s+an?\s+active\s+clearance\b/i,
  /\brequires?\s+security\s+clearance\b/i,
  /\brequires?\s+an?\s+security\s+clearance\b/i,
  /\brequires?\s+active\s+security\s+clearance\b/i,
  /\brequires?\s+an?\s+active\s+security\s+clearance\b/i,
  /\bneeds?\s+clearance\b/i,
  /\bneeds?\s+an?\s+clearance\b/i,
  /\bneeds?\s+active\s+clearance\b/i,
  /\bneeds?\s+an?\s+active\s+clearance\b/i,
  /\bneeds?\s+security\s+clearance\b/i,
  /\bneeds?\s+an?\s+security\s+clearance\b/i,
  /\bneeds?\s+active\s+security\s+clearance\b/i,
  /\bneeds?\s+an?\s+active\s+security\s+clearance\b/i,
  /\bneeded\s+clearance\b/i,
  /\bneeded\s+an?\s+clearance\b/i,
  /\bneeded\s+active\s+clearance\b/i,
  /\bneeded\s+an?\s+active\s+clearance\b/i,
  /\bneeded\s+security\s+clearance\b/i,
  /\bneeded\s+an?\s+security\s+clearance\b/i,
  /\bneeded\s+active\s+security\s+clearance\b/i,
  /\bneeded\s+an?\s+active\s+security\s+clearance\b/i,
  /\brequires?\s+secret\b/i,
  /\brequires?\s+an?\s+secret\b/i,
  /\brequires?\s+active\s+secret\b/i,
  /\brequires?\s+an?\s+active\s+secret\b/i,
  /\brequires?\s+top\s+secret\b/i,
  /\brequires?\s+an?\s+top\s+secret\b/i,
  /\brequires?\s+active\s+top\s+secret\b/i,
  /\brequires?\s+an?\s+active\s+top\s+secret\b/i,
  /\brequires?\s+ts\/?sci\b/i,
  /\brequires?\s+an?\s+ts\/?sci\b/i,
  /\brequires?\s+active\s+ts\/?sci\b/i,
  /\brequires?\s+an?\s+active\s+ts\/?sci\b/i,
  /\brequires?\s+public\s+trust\b/i,
  /\brequires?\s+an?\s+public\s+trust\b/i,
  /\brequires?\s+active\s+public\s+trust\b/i,
  /\brequires?\s+an?\s+active\s+public\s+trust\b/i,
  /\btop\s+secret\s+clearance\b/i,
  /\bsecret\s+clearance\b/i,
  /\bts\/?sci\s+clearance\b/i,
  /\bpublic\s+trust\s+clearance\b/i,
  /\bactive\s+top\s+secret\s+clearance\b/i,
  /\bactive\s+secret\s+clearance\b/i,
  /\bactive\s+ts\/?sci\s+clearance\b/i,
  /\bcurrent\s+top\s+secret\s+clearance\b/i,
  /\bcurrent\s+secret\s+clearance\b/i,
  /\bcurrent\s+ts\/?sci\s+clearance\b/i,
  /\bactive\s+top\s+secret\b/i,
  /\bactive\s+secret\b/i,
  /\bactive\s+ts\/?sci\b/i,
  /\bcurrent\s+top\s+secret\b/i,
  /\bcurrent\s+secret\b/i,
  /\bcurrent\s+ts\/?sci\b/i,
  /\bdod\s+clearance\b/i,
  /\bdod\s+security\s+clearance\b/i,
  /\bdoe\s+clearance\b/i,
  /\bdoe\s+security\s+clearance\b/i,
];

const CLEARANCE_PREFERRED_PATTERNS: readonly RegExp[] = [
  /\bclearance\s+preferred\b/i,
  /\bclearance\s+desired\b/i,
  /\bclearance\s+a\s+plus\b/i,
  /\bclearance\s+nice\s+to\s+have\b/i,
  /\bsecurity\s+clearance\s+preferred\b/i,
  /\bsecurity\s+clearance\s+desired\b/i,
  /\bsecurity\s+clearance\s+a\s+plus\b/i,
  /\bsecurity\s+clearance\s+nice\s+to\s+have\b/i,
  /\bpreferred\s+clearance\b/i,
  /\bpreferred\s+security\s+clearance\b/i,
  /\bdesired\s+clearance\b/i,
  /\bdesired\s+security\s+clearance\b/i,
  /\bable\s+to\s+obtain\s+clearance\b/i,
  /\bable\s+to\s+obtain\s+a\s+clearance\b/i,
  /\bable\s+to\s+obtain\s+security\s+clearance\b/i,
  /\bable\s+to\s+obtain\s+a\s+security\s+clearance\b/i,
  /\bable\s+to\s+get\s+clearance\b/i,
  /\bable\s+to\s+get\s+a\s+clearance\b/i,
  /\bable\s+to\s+get\s+security\s+clearance\b/i,
  /\bable\s+to\s+get\s+a\s+security\s+clearance\b/i,
  /\bable\s+to\s+acquire\s+clearance\b/i,
  /\bable\s+to\s+acquire\s+a\s+clearance\b/i,
  /\bable\s+to\s+acquire\s+security\s+clearance\b/i,
  /\bable\s+to\s+acquire\s+a\s+security\s+clearance\b/i,
  /\bwillingness\s+to\s+obtain\s+clearance\b/i,
  /\bwillingness\s+to\s+obtain\s+a\s+clearance\b/i,
  /\bwillingness\s+to\s+obtain\s+security\s+clearance\b/i,
  /\bwillingness\s+to\s+obtain\s+a\s+security\s+clearance\b/i,
  /\bwillingness\s+to\s+get\s+clearance\b/i,
  /\bwillingness\s+to\s+get\s+a\s+clearance\b/i,
  /\bwillingness\s+to\s+get\s+security\s+clearance\b/i,
  /\bwillingness\s+to\s+get\s+a\s+security\s+clearance\b/i,
  /\bwillingness\s+to\s+acquire\s+clearance\b/i,
  /\bwillingness\s+to\s+acquire\s+a\s+clearance\b/i,
  /\bwillingness\s+to\s+acquire\s+security\s+clearance\b/i,
  /\bwillingness\s+to\s+acquire\s+a\s+security\s+clearance\b/i,
  /\bwilling\s+to\s+obtain\s+clearance\b/i,
  /\bwilling\s+to\s+obtain\s+a\s+clearance\b/i,
  /\bwilling\s+to\s+obtain\s+security\s+clearance\b/i,
  /\bwilling\s+to\s+obtain\s+a\s+security\s+clearance\b/i,
  /\bwilling\s+to\s+get\s+clearance\b/i,
  /\bwilling\s+to\s+get\s+a\s+clearance\b/i,
  /\bwilling\s+to\s+get\s+security\s+clearance\b/i,
  /\bwilling\s+to\s+get\s+a\s+security\s+clearance\b/i,
  /\bwilling\s+to\s+acquire\s+clearance\b/i,
  /\bwilling\s+to\s+acquire\s+a\s+clearance\b/i,
  /\bwilling\s+to\s+acquire\s+security\s+clearance\b/i,
  /\bwilling\s+to\s+acquire\s+a\s+security\s+clearance\b/i,
  /\bclearance\s+eligible\b/i,
  /\bclearance\s+eligibility\b/i,
];

/**
 * Detect clearance language for local preflight + policy enforcement.
 * Bare "clearance" / board UI chrome is NOT enough — require required/preferred phrasing.
 */
export function detectClearanceLanguage(
  pageText: string,
  opts?: { includePreferred?: boolean }
): { hit: boolean; preferredOnly: boolean; snippet: string } {
  const t = pageText;
  const requiredHit = firstPatternHit(t, CLEARANCE_REQUIRED_PATTERNS);
  if (requiredHit) {
    return { hit: true, preferredOnly: false, snippet: requiredHit.trim() };
  }
  const preferredHit = firstPatternHit(t, CLEARANCE_PREFERRED_PATTERNS);
  if (preferredHit) {
    const snippet = preferredHit.trim();
    if (opts?.includePreferred) {
      return { hit: true, preferredOnly: true, snippet };
    }
    return { hit: false, preferredOnly: true, snippet };
  }
  return { hit: false, preferredOnly: false, snippet: '' };
}

/**
 * Local clearance gate. skip → hard_skip; flag → soft.
 * Respects clearanceSkipUntil for "able to obtain" when date is in the future.
 */
export function evaluateClearanceGate(cfg: Config, pageText: string): PreflightResult | null {
  const policy = cfg.preferences.clearancePolicy;
  if (policy === 'ignore') return null;

  const includePreferred = cfg.preferences.clearanceIncludePreferred;
  const detected = detectClearanceLanguage(pageText, { includePreferred });
  if (!detected.hit) return null;

  const skipUntil = (cfg.preferences.clearanceSkipUntil || '').trim();
  if (skipUntil && detected.preferredOnly) {
    const today = new Date().toISOString().slice(0, 10);
    if (today >= skipUntil && !includePreferred) return null;
  }

  if (policy === 'skip') {
    return emptyResult(
      'hard_skip',
      [
        detected.preferredOnly
          ? `Clearance preferred / obtainable (${detected.snippet}) — skip policy`
          : `Clearance required (${detected.snippet}) — skip policy`,
      ],
      { flags: ['clearance'] }
    );
  }

  return emptyResult(
    'soft',
    [
      detected.preferredOnly
        ? `Clearance preferred / obtainable noted (${detected.snippet})`
        : `Clearance language noted (${detected.snippet})`,
    ],
    { flags: ['clearance'] }
  );
}

/**
 * Promote soft clearance to hard_skip only when local text confirms clearance
 * and policy is skip. Never promote Haiku-invented clearance with no JD evidence.
 * Strip unverified Haiku clearance flags/reasons.
 */
export function enforceClearancePolicy(
  result: PreflightResult,
  cfg: Config,
  pageText: string
): PreflightResult {
  const policy = cfg.preferences.clearancePolicy;
  const detected = detectClearanceLanguage(pageText, {
    includePreferred: cfg.preferences.clearanceIncludePreferred,
  });

  if (!detected.hit) {
    const claimedClearance =
      result.flags.some((f) => /clearance/i.test(f)) ||
      result.reasons.some((r) => /\bclearance\b/i.test(r));
    if (!claimedClearance) return result;

    const cleanedReasons = result.reasons.filter((r) => !/\bclearance\b/i.test(r));
    const cleanedFlags = result.flags.filter((f) => !/clearance/i.test(f));
    const otherHard = cleanedFlags.some((f) =>
      /blocked|remote_only|geo_excluded|residency_excluded|skip_category|perm|shell/i.test(f)
    );
    // Drop invented clearance; demote hard_skip when clearance was the only gate
    if (result.verdict === 'hard_skip' && !otherHard) {
      return {
        ...result,
        verdict: cleanedReasons.length ? 'soft' : 'clear',
        reasons: cleanedReasons.length
          ? cleanedReasons
          : ['No clearance requirement found on posting'],
        flags: cleanedFlags,
        sources: Array.from(new Set([...result.sources, 'local'])),
      };
    }
    return { ...result, reasons: cleanedReasons, flags: cleanedFlags };
  }

  if (policy !== 'skip') return result;
  if (result.verdict === 'hard_skip' && result.flags.includes('clearance')) return result;

  return {
    ...result,
    verdict: 'hard_skip',
    reasons: [
      `Clearance required (${detected.snippet}) — skip policy`,
      ...result.reasons.filter((r) => !/\bclearance\b/i.test(r)),
    ].slice(0, 3),
    flags: Array.from(new Set([...result.flags, 'clearance'])),
    sources: Array.from(new Set([...result.sources, 'local'])),
  };
}

function emptyResult(
  verdict: PreflightVerdict,
  reasons: string[],
  extra?: Partial<PreflightResult>
): PreflightResult {
  return {
    verdict,
    reasons,
    sources: ['local'],
    flags: [],
    ...extra,
  };
}

type WorkModelHint = 'onsite' | 'hybrid' | 'remote' | 'unclear';

function tryBlockedOrRemoteOnlyGate(args: {
  cfg: Config;
  pageText: string;
  pageTitle: string;
  workModelHint: WorkModelHint;
}): PreflightResult | null {
  const blockedHit = findBlockedInHaystacks(
    extractOrgCandidates(args.pageText, args.pageTitle, args.pageTitle),
    args.cfg.preferences.blockedEmployers
  );
  if (blockedHit) {
    return emptyResult('hard_skip', [`Blocked employer match: ${blockedHit}`], {
      workModelHint: args.workModelHint,
      orgHint: blockedHit,
      flags: ['blocked_employer'],
    });
  }
  if (
    args.cfg.preferences.remoteOnly &&
    (args.workModelHint === 'onsite' || args.workModelHint === 'hybrid')
  ) {
    return emptyResult(
      'hard_skip',
      [`Remote-only preference: posting looks ${args.workModelHint}`],
      { workModelHint: args.workModelHint, flags: ['remote_only'] }
    );
  }
  return null;
}

function residencyHardSkipResult(
  residency: ResidencyEval,
  workModelHint: WorkModelHint
): PreflightResult | null {
  if (residency.verdict !== 'hard_skip') return null;
  return emptyResult('hard_skip', [residency.reason], {
    workModelHint,
    flags: ['residency_excluded'],
  });
}

function pushClearResidencyReason(reasons: string[], residency: ResidencyEval): void {
  if (residency.verdict === 'clear' && residency.reason) {
    reasons.push(residency.reason);
  }
}

function noteRemotePrimaryExcludedGeo(args: {
  geoReason: string;
  pageText: string;
  allowance: OccasionalTravelAllowance | undefined;
  cadence: OnsiteTravelCadence;
  reasons: string[];
}): void {
  const { geoReason, pageText, allowance, cadence, reasons } = args;
  if (allowsOccasionalTravelOutsideRadius(allowance, cadence) || hasShortOnsiteTraining(pageText)) {
    const cadenceLabel = cadence === 'unknown' ? 'training/occasional' : cadence;
    reasons.push(`Remote-primary with light onsite travel (${cadenceLabel}): ${geoReason}`);
    return;
  }
  reasons.push(`Geo distance noted but remote: ${geoReason}`);
}

function resolveCommutableExcludedGeo(args: {
  geo: { reason: string };
  workModelHint: WorkModelHint;
  allowance: OccasionalTravelAllowance | undefined;
  cadence: OnsiteTravelCadence;
  reasons: string[];
  residencyClear: boolean;
}): PreflightResult {
  const { geo, workModelHint, allowance, cadence, reasons } = args;
  if (allowsOccasionalTravelOutsideRadius(allowance, cadence)) {
    const cadenceLabel = cadence === 'unknown' ? 'unspecified light travel' : cadence;
    return emptyResult(
      'soft',
      [
        ...reasons,
        `Travel outside radius (${cadenceLabel}) allowed by your setting (up to ${allowance}): ${geo.reason}`,
      ],
      {
        workModelHint,
        geoNote: geo.reason,
        flags: [
          'geo_excluded_travel_allowed',
          ...(args.residencyClear ? ['residency_ok'] : []),
        ],
      }
    );
  }
  return emptyResult('hard_skip', [...reasons, geo.reason], {
    workModelHint,
    geoNote: geo.reason,
    flags: ['geo_excluded'],
  });
}

function resolveExcludedGeoGate(args: {
  geo: { reason: string };
  workModelHint: WorkModelHint;
  remotePrimary: boolean;
  pageText: string;
  allowance: OccasionalTravelAllowance | undefined;
  cadence: OnsiteTravelCadence;
  reasons: string[];
  residencyClear: boolean;
}): PreflightResult | null {
  const { geo, workModelHint, remotePrimary, pageText, allowance, cadence, reasons } = args;
  if (remotePrimary) {
    noteRemotePrimaryExcludedGeo({
      geoReason: geo.reason,
      pageText,
      allowance,
      cadence,
      reasons,
    });
    return null;
  }
  if (workModelHint === 'onsite' || workModelHint === 'hybrid') {
    return resolveCommutableExcludedGeo({
      geo,
      workModelHint,
      allowance,
      cadence,
      reasons,
      residencyClear: args.residencyClear,
    });
  }
  return emptyResult('soft', [...reasons, `Possible geo miss (work model unclear): ${geo.reason}`], {
    workModelHint,
    geoNote: geo.reason,
    flags: ['geo_excluded_unclear_model'],
  });
}

function softIfTravelish(reasons: string[], includeGeo = false): PreflightVerdict {
  const re = includeGeo ? /travel|training|distance|geo/i : /travel|training|distance/i;
  return reasons.some((r) => re.test(r)) ? 'soft' : 'clear';
}

function finalizeLocalPreflight(args: {
  cfg: Config;
  workModelHint: WorkModelHint;
  residency: ResidencyEval;
  reasons: string[];
}): PreflightResult {
  const { cfg, workModelHint, residency, reasons } = args;
  const flags =
    residency.verdict === 'clear' ? (['residency_ok'] as string[]) : ([] as string[]);

  if (!needsSemanticPreflight(cfg) && workModelHint !== 'unclear' && residency.verdict !== 'unknown') {
    return emptyResult(
      softIfTravelish(reasons),
      reasons.length ? reasons : ['No local hard gates hit'],
      { workModelHint, flags }
    );
  }
  if (reasons.length) {
    return emptyResult(softIfTravelish(reasons, true), reasons, { workModelHint, flags });
  }
  return emptyResult('unknown', [], { workModelHint, flags });
}

/**
 * Free local hard-gate preflight. Biased toward false negatives (unknown over hard_skip)
 * when work model or location is ambiguous.
 */
export function runLocalPreflight(args: {
  cfg: Config;
  pageText: string;
  pageTitle?: string;
  countryHint?: string | null;
}): PreflightResult {
  const { cfg, pageText, pageTitle = '', countryHint = null } = args;
  const reasons: string[] = [];
  const workModelHint = inferWorkModelHint(pageText);
  const homeCountry = normalizeHomeCountry(cfg.homeCountry);

  const early = tryBlockedOrRemoteOnlyGate({ cfg, pageText, pageTitle, workModelHint });
  if (early) return early;

  // US-market clearance / PERM stay available for all homes but are most relevant for US.
  const clearance = evaluateClearanceGate(cfg, pageText);
  if (clearance) return clearance;

  const residency = evaluateRemoteResidency(pageText, cfg.workEligibleRegions, homeCountry);
  const residencySkip = residencyHardSkipResult(residency, workModelHint);
  if (residencySkip) return residencySkip;
  pushClearResidencyReason(reasons, residency);

  const geo = computeDeterministicGeo({
    locations: cfg.locations,
    pageText,
    homeCountry,
    countryHint,
  });

  const cadence = detectOnsiteTravelCadence(pageText);
  const allowance = cfg.preferences.occasionalTravelAllowance;
  const remotePrimary =
    workModelHint === 'remote' || (hasRemotePrimarySignal(pageText) && hasShortOnsiteTraining(pageText));

  if (geo?.verdict === 'excluded') {
    const geoResult = resolveExcludedGeoGate({
      geo,
      workModelHint,
      remotePrimary,
      pageText,
      allowance,
      cadence,
      reasons,
      residencyClear: residency.verdict === 'clear',
    });
    if (geoResult) return geoResult;
  }

  if (geo?.verdict === 'eligible' && (workModelHint === 'onsite' || workModelHint === 'hybrid')) {
    reasons.push(geo.reason);
  }

  return finalizeLocalPreflight({ cfg, workModelHint, residency, reasons });
}

const VERDICT_RANK: Record<PreflightVerdict, number> = {
  clear: 0,
  unknown: 1,
  soft: 2,
  hard_skip: 3,
};

/** Merge local + Haiku results. Local hard_skip is sticky. */
export function mergePreflightResults(
  local: PreflightResult,
  haiku: PreflightResult | null
): PreflightResult {
  if (!haiku) return local;
  if (local.verdict === 'hard_skip') {
    return {
      ...local,
      sources: Array.from(new Set([...local.sources, ...haiku.sources])),
      reasons: [...local.reasons, ...haiku.reasons.filter((r) => !local.reasons.includes(r))],
      flags: Array.from(new Set([...local.flags, ...haiku.flags])),
      workModelHint: local.workModelHint || haiku.workModelHint,
      orgHint: local.orgHint || haiku.orgHint,
      geoNote: local.geoNote || haiku.geoNote,
    };
  }

  const verdict =
    VERDICT_RANK[haiku.verdict] >= VERDICT_RANK[local.verdict] ? haiku.verdict : local.verdict;

  return {
    verdict,
    reasons: [...local.reasons, ...haiku.reasons.filter((r) => !local.reasons.includes(r))],
    sources: Array.from(new Set([...local.sources, ...haiku.sources])),
    workModelHint: haiku.workModelHint || local.workModelHint,
    orgHint: haiku.orgHint || local.orgHint,
    geoNote: haiku.geoNote || local.geoNote,
    flags: Array.from(new Set([...local.flags, ...haiku.flags])),
  };
}

/** True when auto mode should skip the Haiku call. */
export function shouldSkipHaiku(local: PreflightResult, cfg: Config): boolean {
  if (local.verdict === 'hard_skip') return true;
  if (local.verdict === 'clear' && !needsSemanticPreflight(cfg)) return true;
  return false;
}

/** Cheap stable signature for cache validation (not cryptographic). */
export function pageTextSignature(pageText: string, cap = 800): string {
  const s = pageText.replace(/\s+/g, ' ').trim().slice(0, cap);
  let h = 2166136261;
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i) ?? 0;
    h ^= cp;
    h = Math.imul(h, 16777619);
    i += cp > 0xffff ? 2 : 1;
  }
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/** Extract Zip/Indeed-style listing key from the SERP URL when present. */
export function listingKeyFromHref(href: string): string {
  try {
    const u = new URL(href);
    return (
      u.searchParams.get('lk') ||
      u.searchParams.get('jk') ||
      u.searchParams.get('vjk') ||
      ''
    );
  } catch {
    return '';
  }
}

/**
 * Cache key for preflight. Prefer listing keys (lk/jk/vjk) so SPA card flips
 * do not collide on a sticky canonical /c/.../Job URL from JSON-LD.
 */
export function preflightCacheKey(args: {
  href: string;
  canonicalUrl: string;
}): string {
  const listingKey = listingKeyFromHref(args.href);
  if (listingKey) return `lk:${listingKey}`;
  return `u:${args.canonicalUrl || args.href}`;
}

/** Fingerprint of the visible listing (used to detect SPA card changes). */
export function listingFingerprint(args: {
  href: string;
  canonicalUrl: string;
  paneTitle: string;
  pageText: string;
}): string {
  // Include text signature for cache/debug; SPA change detection should use identity only.
  return `${listingIdentityFingerprint(args)}|${pageTextSignature(args.pageText)}`;
}

/**
 * Identity-only fingerprint for SPA change detection (Indeed/Zip card flips).
 * Excludes page-text signature so lazy-loaded JD growth / scroll mutations do not re-run preflight.
 */
export function listingIdentityFingerprint(args: {
  href: string;
  canonicalUrl: string;
  paneTitle: string;
}): string {
  const key = preflightCacheKey(args);
  const title = args.paneTitle.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
  return `${key}|${title}`;
}

/** True when content-script cache entry still matches the visible listing (ignore text growth). */
export function preflightCacheStillValid(
  entry: { title: string },
  title: string
): boolean {
  return entry.title === title;
}

/** Whether SPA watch should re-run preflight (identity changed). */
export function listingIdentityChanged(prevFp: string, nextFp: string): boolean {
  return Boolean(nextFp) && prevFp !== nextFp;
}

/** Remote with no worker-residency restriction (nationwide / US-wide / no state residency). */
export function looksUnrestrictedRemoteResidency(pageText: string): boolean {
  if (looksUsCountryRemoteScope(pageText)) return true;
  const t = pageText;
  const unrestricted =
    /\bnationwide\b/i.test(t) ||
    /\bno\s+[A-Z]{2}\s+residency\s+required\b/i.test(t) ||
    /\bno\s+[A-Z]+\s+residency\s+required\b/i.test(t) ||
    /\bopen\s+to\s+(?:all\s+)?(?:nationwide|US|U\.S\.|united\s+states)\b/i.test(t) ||
    /\bopen\s+to\s+nationwide\s+candidates\b/i.test(t) ||
    /\bany\s+(?:US|U\.S\.)\s+(?:state|location)\b/i.test(t) ||
    /\bwork\s+from\s+anywhere\b/i.test(t);
  if (!unrestricted) return false;
  // Prefer remote signal, but LinkedIn often shows "City · Remote" without "fully remote"
  const remoteish =
    /\bremote\b/i.test(t) ||
    anyRe(t, REMOTE_STRONG_PATTERNS) ||
    /\bwork\s+from\s+home\b/i.test(t);
  return remoteish;
}

function looksResidencyHardSkip(result: PreflightResult): boolean {
  if (result.flags.some((f) => /residency|region/i.test(f))) return true;
  return result.reasons.some((r) =>
    /workEligibleRegions|residency|eligible regions|regions? limited|Remote-US|intersection|nationwide exception|WEU|Canada/i.test(
      r
    )
  );
}

/** Haiku admitted the candidate regions are allowed — do not keep hard_skip. */
function haikuAdmitsResidencyAllowed(result: PreflightResult): boolean {
  return result.reasons.some((r) =>
    /\bare allowed\b|\bunder US scope\b|\bwithin the US\b|\bwithin US\b|\bare permitted\b|\bare covered\b|\bincludes? (?:all )?US states\b/i.test(
      r
    )
  );
}

function shouldSanitizeHaikuResidencySkip(result: PreflightResult): boolean {
  if (result.verdict !== 'hard_skip') return false;
  if (!result.sources.includes('haiku')) return false;
  if (result.sources.length === 1 && result.sources[0] === 'local') return false;
  return looksResidencyHardSkip(result);
}

function residencyOkFlags(
  result: PreflightResult,
  local?: PreflightResult | null
): string[] {
  return Array.from(
    new Set([
      'residency_ok',
      ...(local?.flags ?? []),
      ...result.flags.filter((f) => !/residency_excluded|region/i.test(f)),
    ])
  );
}

function demoteHaikuResidencyToClear(args: {
  result: PreflightResult;
  reasons: string[];
  local?: PreflightResult | null;
  verdict?: PreflightVerdict;
  addLocalSource?: boolean;
}): PreflightResult {
  const { result, reasons, local, addLocalSource } = args;
  return {
    ...result,
    verdict: args.verdict ?? (local?.verdict === 'soft' ? 'soft' : 'clear'),
    reasons: reasons.slice(0, 3),
    flags: residencyOkFlags(result, local),
    ...(addLocalSource
      ? { sources: Array.from(new Set([...result.sources, 'local'])) }
      : {}),
  };
}

function reasonsWhenLocalResidencyOk(
  result: PreflightResult,
  local?: PreflightResult | null
): string[] {
  if (local?.reasons.length) return local.reasons;
  if (haikuAdmitsResidencyAllowed(result)) {
    return ['Your regions are allowed under the posting residency rules'];
  }
  return ['Residency permitted for your regions'];
}

/**
 * Prefer decisive local residency parse over Haiku: demote model hard_skips when
 * local says residency_ok / clear intersection, or the JD is unrestricted remote.
 * Does not clear local-only hard_skips.
 */
export function sanitizeHaikuResidencySkip(
  result: PreflightResult,
  pageText: string,
  opts?: {
    local?: PreflightResult | null;
    workEligibleRegions?: readonly string[];
    homeCountry?: string | null;
  }
): PreflightResult {
  if (!shouldSanitizeHaikuResidencySkip(result)) return result;

  const local = opts?.local;
  if (local?.flags.includes('residency_ok') || haikuAdmitsResidencyAllowed(result)) {
    return demoteHaikuResidencyToClear({
      result,
      local,
      reasons: reasonsWhenLocalResidencyOk(result, local),
      addLocalSource: true,
    });
  }

  const regions = opts?.workEligibleRegions ?? [];
  const home = opts?.homeCountry ?? 'US';
  if (regions.length) {
    const residency = evaluateRemoteResidency(pageText, regions, home);
    if (residency.verdict === 'clear') {
      return demoteHaikuResidencyToClear({
        result,
        local,
        reasons: [residency.reason, ...result.reasons.map(humanizePreflightReason)],
      });
    }
  }

  if (!looksUnrestrictedRemoteResidency(pageText)) return result;

  return demoteHaikuResidencyToClear({
    result,
    verdict: 'clear',
    reasons: [
      looksUsCountryRemoteScope(pageText)
        ? 'Remote role scoped to the US; your state residency is within the US'
        : 'Remote / nationwide — employer city is not a residency limit',
      ...result.reasons.map(humanizePreflightReason),
    ],
  });
}

function looksCitizenshipHardSkip(result: PreflightResult): boolean {
  if (result.flags.some((f) => /citizen|work_?auth|authorization/i.test(f))) return true;
  return result.reasons.some((r) =>
    /\bcitizen|\bcitizenship\b|work\s+auth|eligibility\s+gate|may exclude candidate/i.test(r)
  );
}

function demoteCitizenshipClear(
  result: PreflightResult,
  reason: string
): PreflightResult {
  return {
    ...result,
    verdict: 'clear',
    reasons: [reason],
    flags: Array.from(
      new Set([
        'citizenship_ok',
        ...result.flags.filter((f) => !/citizen|work_?auth|eligibility/i.test(f)),
      ])
    ),
    sources: Array.from(new Set([...result.sources, 'local'])),
  };
}

function demoteCitizenshipSoft(
  result: PreflightResult,
  requiresCitizen: boolean,
  noteEmpty: boolean
): PreflightResult {
  let softReason = 'U.S. citizenship is required — confirm against your work authorization note';
  if (requiresCitizen && noteEmpty) {
    softReason =
      'Posting requires U.S. citizenship; add a work authorization note to confirm fit';
  }
  return {
    ...result,
    verdict: 'soft',
    reasons: [
      softReason,
      ...result.reasons
        .filter((r) => !/\bmay exclude\b|\beligibility gate\b/i.test(r))
        .map(humanizePreflightReason),
    ].slice(0, 3),
    flags: Array.from(
      new Set([
        ...result.flags.filter((f) => !/citizen|eligibility/i.test(f)),
        'citizenship_unverified',
      ])
    ),
    sources: Array.from(new Set([...result.sources, 'local'])),
  };
}

/**
 * Demote Haiku hard_skips on citizenship / right-to-work when the candidate note
 * satisfies a work-auth pack, or when the model hedges without a clear conflict.
 * Citizenship ≠ residency — do not treat citizen requirements as region gates.
 */
export function sanitizeHaikuCitizenshipSkip(
  result: PreflightResult,
  pageText: string,
  workAuthorizationNote: string,
  homeCountry: string | null | undefined = 'US'
): PreflightResult {
  if (result.verdict !== 'hard_skip') return result;
  if (!result.sources.includes('haiku')) return result;
  if (!looksCitizenshipHardSkip(result)) return result;

  // Sticky local hard gates (blocked employer, etc.) — leave alone if not citizenship-shaped
  if (
    result.sources.includes('local') &&
    result.flags.some((f) =>
      /blocked|remote_only|geo_excluded|residency_excluded|clearance|perm|shell|skip_category/i.test(f)
    ) &&
    !result.reasons.some((r) => /\bcitizen|\bcitizenship\b|right\s+to\s+work/i.test(r))
  ) {
    return result;
  }

  const packMatch = candidateSatisfiesPostingAuth(
    pageText,
    workAuthorizationNote,
    homeCountry
  );
  if (packMatch?.ok) return demoteCitizenshipClear(result, packMatch.reason);

  const requiresCitizen = postingRequiresUsCitizenship(pageText);
  const noteEmpty = !workAuthorizationNote.trim();
  const isCitizen = candidateClaimsUsCitizenship(workAuthorizationNote);

  if (requiresCitizen && isCitizen) {
    return demoteCitizenshipClear(
      result,
      'Posting requires U.S. citizenship; your work authorization note matches'
    );
  }

  const hedges =
    result.reasons.some((r) => /\bmay exclude\b|\bmight exclude\b|\bcould exclude\b/i.test(r)) ||
    (noteEmpty && requiresCitizen);

  if (hedges) return demoteCitizenshipSoft(result, requiresCitizen, noteEmpty);

  return result;
}

const FIELD_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bworkEligibleRegions\b/g, 'your remote residency regions'],
  [/\bcandidateRemoteResidency\b/g, 'your remote residency regions'],
  [/\bremoteOnly\b/g, 'remote-only preference'],
  [/\bblockedEmployers\b/g, 'blocked employers'],
  [/\bflagPermNotices\b/g, 'PERM notices'],
  [/\bflagShellEmployers\b/g, 'shell employers'],
  [/\bclearancePolicy\b/g, 'clearance policy'],
  [/\bclearanceIncludePreferred\b/g, 'preferred-clearance setting'],
  [/\bclearanceSkipUntil\b/g, 'clearance skip-until date'],
  [/\boccasionalTravelAllowance\b/g, 'occasional travel allowance'],
  [/\broleSkipCategories\b/g, 'role skip categories'],
  [/\bcompensationMinUsd\b/g, 'minimum pay'],
  [/\bcompensationMaxUsd\b/g, 'maximum pay'],
  [/\bminContractMonths\b/g, 'minimum contract length'],
  [/\bLOCAL_PREFLIGHT\b/g, 'local check'],
  [/\bHARD_GATES\b/g, 'hard gates'],
  [/\bresidency_excluded\b/g, 'residency not matching your regions'],
  [/\bresidency_ok\b/g, 'residency OK'],
  [/\bgeo_excluded\b/g, 'outside your commute radius'],
  [/\bblocked_employer\b/g, 'blocked employer'],
  [/\bremote_only\b/g, 'remote-only'],
  [/\bskip_category\b/g, 'skip category'],
  [/\bworkAuthorizationNote\b/g, 'work authorization note'],
  [/\beligibility(?:\s+|\s*\/\s*)gate\b/gi, 'eligibility check'],
  [/\bresidency\/eligibility gate\b/gi, 'eligibility check'],
];

/** Make preflight reasons readable in the launcher badge. */
export function humanizePreflightReason(reason: string): string {
  let out = reason
    .replace(/\bresidency\/eligibility gate\b/gi, 'eligibility check')
    .replace(/\beligibility gate\b/gi, 'eligibility check')
    .replace(/\bmay exclude candidate\b/gi, 'might not match your profile');
  for (const [re, label] of FIELD_NAME_REPLACEMENTS) {
    out = out.replace(re, label);
  }
  // Strip leftover camelCase identifiers that leaked from model output
  out = out.replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, (m) => {
    if (m.length < 4) return m;
    return m
      .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll('_', ' ')
      .toLowerCase();
  });
  // snake_case machine ids
  out = out.replace(/\b([a-z]+_[a-z0-9_]+)\b/g, (m) => m.replaceAll('_', ' '));
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function humanizePreflightReasons(reasons: readonly string[]): string[] {
  return reasons.map(humanizePreflightReason);
}

