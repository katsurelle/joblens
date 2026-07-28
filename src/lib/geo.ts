import type { Analysis, DeterministicGeo, Location } from '../types/domain';
import { ONSITE_COMMUTE_DEALBREAKER } from './ratings';
import { normalizeHomeCountry } from './homeCountry';
import {
  directoriesForResolve,
  getPostalDirectory,
  locationCountry,
  locationPostalCode,
  locationRadiusMiles,
  milesToDisplay,
  type PostalDirectory,
} from './postalDirectory';

const EARTH_MI = 3958.8;

/** Major US cities → approximate centroid (for postings that name a city without a ZIP). */
const CITY_COORDS: ReadonlyArray<{ pattern: RegExp; label: string; coord: readonly [number, number] }> = [
  { pattern: /\bnew\s*york\b|\bnyc\b|\bbrooklyn\b|\bmanhattan\b|\bqueens\b/i, label: 'New York, NY', coord: [40.7128, -74.006] },
  { pattern: /\bsan\s*francisco\b/i, label: 'San Francisco, CA', coord: [37.7749, -122.4194] },
  { pattern: /\blos\s*angeles\b/i, label: 'Los Angeles, CA', coord: [34.0522, -118.2437] },
  { pattern: /\bseattle\b/i, label: 'Seattle, WA', coord: [47.6062, -122.3321] },
  { pattern: /\bchicago\b/i, label: 'Chicago, IL', coord: [41.8781, -87.6298] },
  { pattern: /\bboston\b/i, label: 'Boston, MA', coord: [42.3601, -71.0589] },
  { pattern: /\bdenver\b/i, label: 'Denver, CO', coord: [39.7392, -104.9903] },
  { pattern: /\baustin\b/i, label: 'Austin, TX', coord: [30.2672, -97.7431] },
  { pattern: /\bsan\s*antonio\b/i, label: 'San Antonio, TX', coord: [29.4241, -98.4936] },
  { pattern: /\bdallas\b/i, label: 'Dallas, TX', coord: [32.7767, -96.797] },
  { pattern: /\bhouston\b/i, label: 'Houston, TX', coord: [29.7604, -95.3698] },
  { pattern: /\bphiladelphia\b|\bphilly\b/i, label: 'Philadelphia, PA', coord: [39.9526, -75.1652] },
  { pattern: /\batlanta\b/i, label: 'Atlanta, GA', coord: [33.749, -84.388] },
  { pattern: /\bmiami\b/i, label: 'Miami, FL', coord: [25.7617, -80.1918] },
  { pattern: /\bwashington(?:\s+d\.?c\.?|\s*,\s*d\.?c\.?)\b/i, label: 'Washington, DC', coord: [38.9072, -77.0369] },
  { pattern: /\bdc\b/i, label: 'Washington, DC', coord: [38.9072, -77.0369] },
];

const LOCATION_CONTEXT_RE =
  /(?:location|located|based|office|onsite|on-site|hybrid|headquarters|hq|workplace|work\s*from)\b[^.\n]{0,120}/gi;

/** Approximate state centroids when a City, ST header is present but the city is unknown. */
const STATE_COORDS: ReadonlyArray<{ code: string; label: string; coord: readonly [number, number] }> = [
  { code: 'WA', label: 'Washington State', coord: [47.4009, -121.4905] },
  { code: 'OR', label: 'Oregon', coord: [43.8041, -120.5542] },
  { code: 'ID', label: 'Idaho', coord: [44.2405, -114.4788] },
  { code: 'CA', label: 'California', coord: [36.7783, -119.4179] },
  { code: 'TX', label: 'Texas', coord: [31.9686, -99.9018] },
  { code: 'NY', label: 'New York State', coord: [42.1657, -74.9481] },
  { code: 'IL', label: 'Illinois', coord: [40.3495, -88.9861] },
  { code: 'PA', label: 'Pennsylvania', coord: [40.5908, -77.2098] },
  { code: 'FL', label: 'Florida', coord: [27.7663, -81.6868] },
  { code: 'MA', label: 'Massachusetts', coord: [42.2302, -71.5301] },
  { code: 'CO', label: 'Colorado', coord: [39.0598, -105.3111] },
  { code: 'GA', label: 'Georgia', coord: [33.0406, -83.6431] },
  { code: 'AZ', label: 'Arizona', coord: [33.7298, -111.4312] },
  { code: 'NV', label: 'Nevada', coord: [38.3135, -117.0554] },
  { code: 'UT', label: 'Utah', coord: [40.1500, -111.8624] },
];

const NEGATION_POLARITY_RE =
  /\b(?:not|cannot|can\s+not|never|no|excluding|except(?:ing)?|won't|will\s+not)\b/i;

const NEGATION_WINDOW_PATTERNS: readonly RegExp[] = [
  /\bnot\s+accepting\b/i,
  /\bcannot\s+be\s+considered\b/i,
  /\bcan\s+not\s+be\s+considered\b/i,
  /\bare\s+not\s+accepting\b/i,
  /\bwe\s+are\s+not\b/i,
  /\bexcluding\b/i,
  /\bexcept(?:ing)?\b/i,
  /\boutside\s+of\b/i,
  /\bother\s+than\b/i,
  /\bdo\s+not\s+(?:hire|accept|consider)\b/i,
  /\bwill\s+not\s+(?:hire|accept|consider)\b/i,
];

/**
 * True when a match at `index` sits in a residency exclusion / negation window
 * (cities named only inside "not accepting … STATE" are not the job site).
 */
export function isNegatedLocationMention(text: string, index: number): boolean {
  if (index < 0) return false;
  const start = Math.max(0, index - 160);
  const window = text.slice(start, index);
  if (NEGATION_WINDOW_PATTERNS.some((re) => re.test(window))) return true;
  // "applications from …" alone is too broad; require negation polarity in-window.
  return /\bapplications?\s+from\b/i.test(window) && NEGATION_POLARITY_RE.test(window);
}

/** Prefer a line that mentions the resolved posting place; else a location-ish line. */
export function pickLocationEvidenceLine(stated: string, postingLabel: string): string {
  const lines = stated
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const tokens = postingLabel
    .replaceAll(',', ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^ZIP$/i.test(t) && !/^\d+$/.test(t));
  for (const line of lines) {
    if (
      tokens.some((tok) => {
        const escaped = tok.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        return new RegExp(String.raw`\b${escaped}\b`, 'i').test(line);
      })
    ) {
      return line.slice(0, 160);
    }
  }
  const locish = lines.find((l) => /location|onsite|on-site|office|hybrid|\bremote\b/i.test(l));
  if (locish) return locish.slice(0, 160);
  return stated.slice(0, 160);
}

/** Normalize US ZIP5 digits for operator hub matching. Prefer PostalDirectory.normalizeCode. */
export function padZip(zip: string | number | null | undefined): string {
  const digits = String(zip ?? '').replaceAll(/\D/g, '');
  if (digits.length < 5) return digits.padStart(5, '0');
  return digits.slice(0, 5);
}

export function haversineMiles(
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

function extractCodesFromDirs(text: string, dirs: readonly PostalDirectory[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const code of dir.extractFromText(text)) {
      const key = `${dir.country}:${code}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(code);
      }
    }
  }
  return out;
}

function dirsOrUsDefault(dirs?: readonly PostalDirectory[]): PostalDirectory[] {
  if (dirs?.length) return [...dirs];
  const us = getPostalDirectory('US');
  return us ? [us] : [];
}

function cityToken(label: string): string {
  return (label.split(',')[0] ?? label).toLowerCase();
}

/** All valid postal codes in text for the given directories (US = ZIP5). */
export function extractAllZipsFromText(
  text: string | null | undefined,
  dirs?: readonly PostalDirectory[]
): string[] {
  if (!text) return [];
  return extractCodesFromDirs(text, dirsOrUsDefault(dirs));
}

/** First valid postal code (legacy helper). Prefer resolvePostingLocation for geo. */
export function extractZipFromText(
  text: string | null | undefined,
  dirs?: readonly PostalDirectory[]
): string | null {
  return extractAllZipsFromText(text, dirs)[0] ?? null;
}

function extractZipsInLocationContext(text: string, dirs: readonly PostalDirectory[]): string[] {
  const snippets: string[] = [];
  for (const m of text.matchAll(LOCATION_CONTEXT_RE)) {
    if (m[0]) snippets.push(m[0]);
  }
  snippets.push(text.slice(0, 800));
  const found: string[] = [];
  const seen = new Set<string>();
  for (const snip of snippets) {
    for (const z of extractAllZipsFromText(snip, dirs)) {
      if (!seen.has(z)) {
        seen.add(z);
        found.push(z);
      }
    }
  }
  return found;
}

type CityHit = { label: string; coord: readonly [number, number]; index: number };

function pickEarliestCity(
  candidates: readonly CityHit[]
): { label: string; coord: readonly [number, number] } | null {
  let best: CityHit | null = null;
  for (const hit of candidates) {
    if (!best || hit.index < best.index) best = hit;
  }
  return best ? { label: best.label, coord: best.coord } : null;
}

function extractUsCityCoord(text: string): CityHit | null {
  if (!text) return null;
  let best: CityHit | null = null;
  for (const city of CITY_COORDS) {
    const re = new RegExp(
      city.pattern.source,
      city.pattern.flags.includes('g') ? city.pattern.flags : `${city.pattern.flags}g`
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const index = m.index;
      if (isNegatedLocationMention(text, index)) continue;
      if (!best || index < best.index) {
        best = { label: city.label, coord: city.coord, index };
      }
      break;
    }
  }
  return best;
}

function extractPackCityHits(text: string, dirs: readonly PostalDirectory[]): CityHit[] {
  const out: CityHit[] = [];
  for (const dir of dirs) {
    for (const hit of dir.extractCities(text)) {
      if (isNegatedLocationMention(text, hit.index)) continue;
      out.push({ label: hit.label, coord: hit.coord, index: hit.index });
    }
  }
  return out;
}

/**
 * Earliest non-negated city mention wins.
 * Uses pack cities for non-US dirs; US city table when a US directory is active.
 */
export function extractCityCoord(
  text: string,
  dirs?: readonly PostalDirectory[]
): { label: string; coord: readonly [number, number] } | null {
  if (!text) return null;
  const use = dirsOrUsDefault(dirs);
  const allowUs = use.some((d) => d.country === 'US');
  const pack = pickEarliestCity(extractPackCityHits(text, use));
  const usHit = allowUs ? extractUsCityCoord(text) : null;
  const us = usHit ? { label: usHit.label, coord: usHit.coord } : null;
  if (pack && us) {
    const packIdx = text.toLowerCase().indexOf(cityToken(pack.label));
    const usIdx = text.toLowerCase().indexOf(cityToken(us.label));
    if (packIdx >= 0 && (usIdx < 0 || packIdx <= usIdx)) return pack;
    return us;
  }
  return pack || us;
}

/**
 * Prefer "City, ST" / "City, ST · Remote" header signals (US-shaped).
 * Only used when a US postal directory is in play.
 */
export function extractStateFromLocationHeader(
  text: string
): { label: string; coord: readonly [number, number] } | null {
  if (!text) return null;
  const header = text.slice(0, 1500);
  // Keep city/state capture simple (Sonar regex complexity); work-model suffix optional separately.
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/g;
  let m: RegExpExecArray | null;
  let best: { city: string; code: string; index: number } | null = null;
  while ((m = re.exec(header))) {
    const index = m.index;
    const city = (m[1] || '').trim();
    const code = (m[2] || '').toUpperCase();
    if (!city || !code || isNegatedLocationMention(header, index)) continue;
    if (!best || index < best.index) best = { city, code, index };
  }
  if (!best) return null;

  const { city, code } = best;
  const cityHit = extractUsCityCoord(`${city}, ${code}`);
  if (cityHit) return { label: cityHit.label, coord: cityHit.coord };

  const state = STATE_COORDS.find((s) => s.code === code);
  if (!state) return null;
  return { label: `${city}, ${code}`, coord: state.coord };
}

export type ResolvePostingLocationArgs = {
  pageText?: string;
  statedLocation?: string;
  operatorZips?: readonly string[];
  homeCountry?: string | null;
  countryHint?: string | null;
};

export type ResolvedPostingLocation =
  | { kind: 'zip'; zip: string; coord: readonly [number, number]; label: string }
  | { kind: 'city'; coord: readonly [number, number]; label: string };

function lookupCode(
  code: string,
  dirs: readonly PostalDirectory[]
): { code: string; coord: readonly [number, number]; label: string } | null {
  for (const dir of dirs) {
    const hit = dir.lookup(code);
    if (hit) return { code: hit.code, coord: hit.coord, label: hit.label };
  }
  return null;
}

function resolveFromStatedCodes(
  stated: string,
  dirs: readonly PostalDirectory[]
): ResolvedPostingLocation | null {
  for (const z of extractAllZipsFromText(stated, dirs)) {
    const hit = lookupCode(z, dirs);
    if (hit) return { kind: 'zip', zip: hit.code, coord: hit.coord, label: hit.label };
  }
  return null;
}

function resolveFromUsHeader(
  corpus: string,
  pageText: string,
  dirs: readonly PostalDirectory[]
): ResolvedPostingLocation | null {
  const stateFromHeader = extractStateFromLocationHeader(corpus);
  if (!stateFromHeader) return null;
  const cityEarly = extractCityCoord(pageText.slice(0, 1200), dirs);
  if (cityEarly) return { kind: 'city', ...cityEarly };
  return { kind: 'city', ...stateFromHeader };
}

function resolveFromContextCodes(
  corpus: string,
  dirs: readonly PostalDirectory[],
  operator: ReadonlySet<string>
): ResolvedPostingLocation | null {
  const pick = extractZipsInLocationContext(corpus, dirs).find((z) => !operator.has(z));
  if (!pick) return null;
  const hit = lookupCode(pick, dirs);
  if (!hit) return null;
  return { kind: 'zip', zip: hit.code, coord: hit.coord, label: hit.label };
}

/**
 * Resolve where the job is from masthead / header signals first.
 * Never treat a bare page postal code that only matches an operator hub as the job site.
 * When countryHint/homeCountry is non-US, US ZIP5 extraction is not used (no false US hits).
 */
export function resolvePostingLocation({
  pageText = '',
  statedLocation = '',
  operatorZips = [],
  homeCountry = 'US',
  countryHint = null,
}: ResolvePostingLocationArgs): ResolvedPostingLocation | null {
  const dirs = directoriesForResolve({ homeCountry, countryHint });
  if (!dirs.length) return null;

  const allowUs = dirs.some((d) => d.country === 'US');
  const operator = new Set(
    operatorZips.map((z) => {
      for (const dir of dirs) {
        const n = dir.normalizeCode(z) || dir.lookup(z)?.code;
        if (n) return n;
      }
      return padZip(z);
    })
  );
  const stated = statedLocation.trim();
  const corpus = `${stated}\n${pageText}`;

  const fromStatedCode = resolveFromStatedCodes(stated, dirs);
  if (fromStatedCode) return fromStatedCode;

  const cityFromStated = extractCityCoord(stated, dirs);
  if (cityFromStated) return { kind: 'city', ...cityFromStated };

  if (allowUs) {
    const fromHeader = resolveFromUsHeader(corpus, pageText, dirs);
    if (fromHeader) return fromHeader;
  }

  const locationSnippets = [...corpus.matchAll(LOCATION_CONTEXT_RE)].map((m) => m[0] || '');
  locationSnippets.unshift(pageText.slice(0, 1200));
  for (const snip of locationSnippets) {
    const city = extractCityCoord(snip, dirs);
    if (city) return { kind: 'city', ...city };
  }

  const fromContext = resolveFromContextCodes(corpus, dirs, operator);
  if (fromContext) return fromContext;

  const cityAnywhere = extractCityCoord(pageText.slice(0, 4000), dirs);
  if (cityAnywhere) return { kind: 'city', ...cityAnywhere };

  return null;
}

export type ComputeGeoArgs = {
  locations: readonly Location[];
  pageText?: string;
  statedLocation?: string;
  homeCountry?: string | null;
  countryHint?: string | null;
};

function verdictAgainstLocations(
  postingCoord: readonly [number, number],
  postingLabel: string,
  locations: readonly Location[],
  postingZip: string | null,
  homeCountry: string
): DeterministicGeo | null {
  let best: {
    miles: number;
    zip: string;
    radiusMiles: number;
    displayUnit: 'mi' | 'km';
  } | null = null;

  for (const loc of locations) {
    const code = locationPostalCode(loc);
    if (!code) continue;
    const country = locationCountry(loc, homeCountry);
    const dir = getPostalDirectory(country);
    if (!dir) continue;
    const normalized = dir.normalizeCode(code);
    const hit = dir.lookup(code) ?? (normalized ? dir.lookup(normalized) : null);
    if (!hit) continue;
    const miles = haversineMiles(postingCoord, hit.coord);
    const radiusMiles = locationRadiusMiles(loc);
    if (!best || miles < best.miles) {
      best = {
        miles,
        zip: hit.code,
        radiusMiles,
        displayUnit: loc.radiusUnit || 'mi',
      };
    }
  }
  if (!best) return null;

  const eligible = best.miles <= best.radiusMiles;
  const shown = milesToDisplay(best.miles, best.displayUnit);
  const radiusShown = milesToDisplay(best.radiusMiles, best.displayUnit);
  const unitLabel = best.displayUnit;
  return {
    verdict: eligible ? 'eligible' : 'excluded',
    reason: `Deterministic: ${postingLabel} is ${shown.toFixed(1)} ${unitLabel} from ${best.zip} (radius ${radiusShown.toFixed(0)} ${unitLabel}).`,
    method: 'zip-haversine',
    postingZip: postingZip,
    nearestOperatorZip: best.zip,
    distanceMiles: Math.round(best.miles * 10) / 10,
  };
}

/**
 * If we can resolve a posting location and at least one operator postal hub, return a
 * deterministic onsite/hybrid geo object. Otherwise null.
 * When the posting country has no postal pack, returns null (model/`unclear`) rather than
 * false-matching a US ZIP.
 */
export function computeDeterministicGeo({
  locations,
  pageText = '',
  statedLocation = '',
  homeCountry = 'US',
  countryHint = null,
}: ComputeGeoArgs): DeterministicGeo | null {
  const home = normalizeHomeCountry(homeCountry);
  const hint = countryHint ? normalizeHomeCountry(countryHint) : null;

  // If an explicit non-US posting hint has no pack, do not fall back to US ZIP matching.
  if (hint && hint !== 'US' && !getPostalDirectory(hint) && hint !== home) {
    return null;
  }

  const resolved = resolvePostingLocation({
    pageText,
    statedLocation,
    operatorZips: locations.map(locationPostalCode),
    homeCountry: home,
    countryHint: hint,
  });
  if (!resolved) return null;

  if (resolved.kind === 'zip') {
    return verdictAgainstLocations(
      resolved.coord,
      resolved.label,
      locations,
      resolved.zip,
      home
    );
  }

  return verdictAgainstLocations(resolved.coord, resolved.label, locations, null, home);
}

export type ApplyGeoContext = {
  locations: readonly Location[];
  pageText: string;
  homeCountry?: string | null;
  countryHint?: string | null;
};

export const NO_LOCATIONS_GEO_REASON = 'No commute locations configured';

/**
 * Prefer deterministic geo for onsite/hybrid when computable; leave remote to the model.
 * Never feed prior geo.reason back in (avoids reinforcing a bad GEO_HINT).
 * When locations are empty and work is onsite/hybrid, force geo unclear (no commute dealbreaker).
 */
export function applyDeterministicGeo(
  analysis: Analysis,
  { locations, pageText, homeCountry = 'US', countryHint = null }: ApplyGeoContext
): Analysis {
  const model = analysis.workModel ?? analysis.masthead.workModel;
  if (model === 'remote') return analysis;

  const hasLocations = locations.some((l) => locationPostalCode(l));
  if (!hasLocations && (model === 'onsite' || model === 'hybrid')) {
    return {
      ...analysis,
      geo: {
        verdict: 'unclear',
        reason: NO_LOCATIONS_GEO_REASON,
        method: 'model',
        postingZip: null,
        distanceMiles: null,
      },
    };
  }

  const stated = [
    analysis.masthead.location,
    analysis.declutteredJD.slice(0, 600),
    `${analysis.masthead.organization} ${analysis.masthead.title}`,
  ]
    .filter(Boolean)
    .join('\n');

  const computed = computeDeterministicGeo({
    locations,
    pageText,
    statedLocation: stated,
    homeCountry,
    countryHint,
  });
  if (!computed) return analysis;
  if (model !== 'onsite' && model !== 'hybrid' && model !== 'unclear' && model) {
    return analysis;
  }

  let dealbreakers = analysis.dealbreakers;
  const alreadyHasCommuteDb = dealbreakers.some((d) =>
    /onsite|location|commute/i.test(d.requirement)
  );
  if (computed.verdict === 'excluded' && model === 'onsite' && !alreadyHasCommuteDb) {
    const evidenceLabel =
      computed.postingZip != null ? `ZIP ${computed.postingZip}` : computed.reason;
    dealbreakers = [
      {
        requirement: ONSITE_COMMUTE_DEALBREAKER,
        reason: computed.reason,
        evidence: pickLocationEvidenceLine(stated, evidenceLabel),
      },
      ...dealbreakers,
    ];
  }

  return {
    ...analysis,
    dealbreakers,
    geo: {
      verdict: computed.verdict,
      reason: computed.reason,
      method: computed.method,
      postingZip: computed.postingZip,
      distanceMiles: computed.distanceMiles,
    },
  };
}
