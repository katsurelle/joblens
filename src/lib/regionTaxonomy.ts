import { EU_MEMBER_CODES, WEU_CODES, normalizeHomeCountry } from './homeCountry';

/** US state name → code (shared with preflight residency parsing). */
export const US_STATE_ALIASES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

export const US_STATE_CODES = new Set(Object.values(US_STATE_ALIASES));

export const CA_PROVINCE_ALIASES: Record<string, string> = {
  alberta: 'AB',
  'british columbia': 'BC',
  manitoba: 'MB',
  'new brunswick': 'NB',
  newfoundland: 'NL',
  'newfoundland and labrador': 'NL',
  'northwest territories': 'NT',
  'nova scotia': 'NS',
  nunavut: 'NU',
  ontario: 'ON',
  'prince edward island': 'PE',
  quebec: 'QC',
  saskatchewan: 'SK',
  yukon: 'YT',
};

export const CA_PROVINCE_CODES = new Set(Object.values(CA_PROVINCE_ALIASES));

export const AU_STATE_ALIASES: Record<string, string> = {
  'new south wales': 'NSW',
  victoria: 'VIC',
  queensland: 'QLD',
  'western australia': 'WA',
  'south australia': 'SA',
  tasmania: 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
};

export const AU_STATE_CODES = new Set(Object.values(AU_STATE_ALIASES));

const UK_NATION_ALIASES: Record<string, string> = {
  england: 'ENG',
  scotland: 'SCT',
  wales: 'WLS',
  'northern ireland': 'NIR',
  britain: 'GB',
  'great britain': 'GB',
  'united kingdom': 'GB',
  uk: 'GB',
};

const UK_NATION_CODES = new Set(['ENG', 'SCT', 'WLS', 'NIR', 'GB', 'UK']);

/** Country-level allow tokens used in multi-country residency lists. */
export type AllowedCountry = 'US' | 'CA' | 'UK' | 'WEU' | 'EU' | 'AU' | 'IE';

export function isUsStateCode(code: string): boolean {
  const c = code.toUpperCase();
  if (c.startsWith('US-')) return US_STATE_CODES.has(c.slice(3));
  return US_STATE_CODES.has(c);
}

export function bareUsStateCode(code: string): string | null {
  const c = code.toUpperCase();
  if (c.startsWith('US-') && US_STATE_CODES.has(c.slice(3))) return c.slice(3);
  if (US_STATE_CODES.has(c)) return c;
  return null;
}

const COUNTRY_NAME_TOKENS: Record<string, string> = {
  'united states': 'US',
  usa: 'US',
  'u s a': 'US',
  'u s': 'US',
  canada: 'CANADA',
  ireland: 'IE',
  'republic of ireland': 'IE',
  eire: 'IE',
  australia: 'AU',
  'new zealand': 'NZ',
  'european union': 'EU',
  eu: 'EU',
  weu: 'WEU',
  'western europe': 'WEU',
  'western european': 'WEU',
};

function normalizeTwoLetter(upper: string, home: string): string {
  if (upper === 'UK') return 'GB';
  if (upper === home) return upper;
  if (CA_PROVINCE_CODES.has(upper)) return upper;
  const isoLike =
    EU_MEMBER_CODES.has(upper) ||
    WEU_CODES.has(upper) ||
    ['US', 'CA', 'GB', 'AU', 'NZ', 'IE'].includes(upper);
  if (home !== 'US' && isoLike) return upper;
  if (US_STATE_CODES.has(upper) && home === 'US') return upper;
  if (US_STATE_CODES.has(upper) && home !== 'US') {
    if (EU_MEMBER_CODES.has(upper) || WEU_CODES.has(upper)) return upper;
    return `US-${upper}`;
  }
  return upper;
}

/**
 * Normalize a candidate work-eligible region token.
 * Bare US state codes stay as TX/PA when homeCountry is US (compat with include/exclude lists).
 * Country names and non-US subdivisions normalize to ISO / province codes.
 */
export function normalizeRegionToken(
  raw: string,
  homeCountry: string | null | undefined = 'US'
): string {
  const home = normalizeHomeCountry(homeCountry);
  const original = raw.trim();
  if (!original) return '';
  const t = original.toLowerCase().replaceAll('.', '');

  if (/^[a-z]{2}-[a-z0-9]+$/i.test(original)) return original.toUpperCase();

  const fromName = COUNTRY_NAME_TOKENS[t] || UK_NATION_ALIASES[t];
  if (fromName) return fromName;

  if (CA_PROVINCE_ALIASES[t]) return CA_PROVINCE_ALIASES[t];
  if (AU_STATE_ALIASES[t]) return AU_STATE_ALIASES[t];
  if (US_STATE_ALIASES[t]) {
    const code = US_STATE_ALIASES[t];
    return home === 'US' ? code : `US-${code}`;
  }

  if (/^[a-z]{2}$/i.test(t)) return normalizeTwoLetter(t.toUpperCase(), home);

  if (/^[a-z]{3}$/i.test(t)) {
    const upper = t.toUpperCase();
    if (AU_STATE_CODES.has(upper) || UK_NATION_CODES.has(upper)) return upper;
    return upper;
  }

  return original.toUpperCase();
}

function regionMatchesCanada(r: string, homeCountry: string): boolean {
  const u = r.toUpperCase();
  if (u === 'CANADA') return true;
  if (u.startsWith('CA-')) return true;
  if (CA_PROVINCE_CODES.has(u)) return true;
  // Bare CA means Canada only when operator home is Canada (else California).
  if (u === 'CA' && homeCountry === 'CA') return true;
  return false;
}

function regionMatchesUk(r: string): boolean {
  const u = r.toUpperCase();
  return u === 'GB' || u === 'UK' || UK_NATION_CODES.has(u) || u.startsWith('GB-');
}

function regionMatchesUs(r: string): boolean {
  return isUsStateCode(r) || r.toUpperCase() === 'US' || r.toUpperCase().startsWith('US-');
}

function regionMatchesEu(r: string): boolean {
  const u = r.toUpperCase();
  if (u === 'EU' || u === 'EEA') return true;
  if (EU_MEMBER_CODES.has(u)) return true;
  return false;
}

function regionMatchesWeu(r: string): boolean {
  const u = r.toUpperCase();
  if (u === 'WEU') return true;
  if (regionMatchesUk(u)) return true;
  return WEU_CODES.has(u);
}

function regionMatchesAu(r: string, homeCountry: string): boolean {
  const u = r.toUpperCase();
  if (u === 'AU' || u === 'AUSTRALIA' || u.startsWith('AU-')) return true;
  // Unambiguous AU state codes
  if (['NSW', 'VIC', 'QLD', 'TAS', 'ACT'].includes(u)) return true;
  // WA / SA / NT collide with US/CA meanings — only when home is Australia
  if (['WA', 'SA', 'NT'].includes(u) && homeCountry === 'AU') return true;
  return false;
}

function regionMatchesIe(r: string): boolean {
  const u = r.toUpperCase();
  return u === 'IE' || u.startsWith('IE-');
}

/** True when any candidate region is covered by a country in the allow-list (OR semantics). */
export function regionsMatchCountryAllowList(
  regions: readonly string[],
  countries: readonly AllowedCountry[],
  homeCountry: string | null | undefined = 'US'
): boolean {
  if (!countries.length || !regions.length) return false;
  const home = normalizeHomeCountry(homeCountry);
  const normalized = regions.map((r) => normalizeRegionToken(r, home)).filter(Boolean);

  for (const country of countries) {
    const hit = normalized.some((r) => {
      if (country === 'US') return regionMatchesUs(r);
      if (country === 'CA') return regionMatchesCanada(r, home);
      if (country === 'UK') return regionMatchesUk(r);
      if (country === 'EU') return regionMatchesEu(r);
      if (country === 'WEU') return regionMatchesWeu(r);
      if (country === 'AU') return regionMatchesAu(r, home);
      if (country === 'IE') return regionMatchesIe(r);
      return false;
    });
    if (hit) return true;
  }
  return false;
}

/**
 * Parse country allow-list chunks like "US, Canada or WEU countries (UK, …)".
 * Does not treat bare "CA" as Canada (that's California as a US state).
 */
export function extractAllowedCountries(chunk: string): AllowedCountry[] {
  const out: AllowedCountry[] = [];
  const seen = new Set<AllowedCountry>();
  const push = (c: AllowedCountry): void => {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  };
  if (/\b(?:United\s+States|U\.?\s*S\.?\s*A?\.?)\b/i.test(chunk) || /\bUS\b/.test(chunk)) {
    push('US');
  }
  if (/\bCanada\b/i.test(chunk)) push('CA');
  if (/\b(?:United\s+Kingdom|U\.?\s*K\.?|Britain|England)\b/i.test(chunk) || /\bUK\b/.test(chunk)) {
    push('UK');
  }
  if (/\bIreland\b/i.test(chunk) || /\bIE\b/.test(chunk)) push('IE');
  if (/\bAustralia\b/i.test(chunk) || /\bAU\b/.test(chunk)) push('AU');
  if (/\bWEU\b|\bWestern\s+Europe(?:an)?\b/i.test(chunk)) push('WEU');
  if (/\b(?:\bEU\b|European\s+Union)\b/i.test(chunk)) push('EU');
  return out;
}

/** For include/exclude US state lists — compare against bare state codes. */
export function regionsAsUsStateCodes(
  regions: readonly string[],
  homeCountry?: string | null
): string[] {
  const home = normalizeHomeCountry(homeCountry);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of regions) {
    const n = normalizeRegionToken(raw, home);
    const bare = bareUsStateCode(n);
    if (bare && !seen.has(bare)) {
      seen.add(bare);
      out.push(bare);
    }
  }
  return out;
}

export function allRegionsAreUsStates(
  regions: readonly string[],
  homeCountry?: string | null
): boolean {
  if (!regions.length) return false;
  const home = normalizeHomeCountry(homeCountry);
  return regions.every((r) => {
    const n = normalizeRegionToken(r, home);
    return isUsStateCode(n) || n === 'US';
  });
}

export function allRegionsInCountry(
  regions: readonly string[],
  country: AllowedCountry,
  homeCountry?: string | null
): boolean {
  if (!regions.length) return false;
  const home = normalizeHomeCountry(homeCountry);
  return regions.every((r) =>
    regionsMatchCountryAllowList([r], [country], home)
  );
}
