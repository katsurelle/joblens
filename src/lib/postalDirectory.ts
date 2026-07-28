import type { LatLng, Location, ZipCentroids } from '../types/domain';
import zipCentroidsJson from '../data/zipCentroids.json';
import postalPacksJson from '../data/postalPacks.json';
import { normalizeHomeCountry } from './homeCountry';

const usZipCentroids = zipCentroidsJson as unknown as ZipCentroids;

export type PostalHit = {
  country: string;
  code: string;
  coord: LatLng;
  label: string;
};

export type CityHit = {
  country: string;
  label: string;
  coord: LatLng;
  index: number;
};

export interface PostalDirectory {
  readonly country: string;
  normalizeCode(raw: string): string | null;
  lookup(code: string): PostalHit | null;
  extractFromText(text: string): string[];
  extractCities(text: string): CityHit[];
}

type PackCity = { id: string; label: string; lat: number; lng: number };
type CountryPack = {
  codes: Record<string, [number, number]>;
  cities: PackCity[];
};

const packs = postalPacksJson as unknown as Record<string, CountryPack>;

const CITY_PATTERNS: Record<string, ReadonlyArray<{ re: RegExp; id: string }>> = {
  CA: [
    { re: /\btoronto\b/i, id: 'toronto' },
    { re: /\bvancouver\b/i, id: 'vancouver' },
    { re: /\bmontr[eé]al\b/i, id: 'montreal' },
    { re: /\bcalgary\b/i, id: 'calgary' },
    { re: /\bottawa\b/i, id: 'ottawa' },
    { re: /\bedmonton\b/i, id: 'edmonton' },
  ],
  GB: [
    { re: /\blondon\b/i, id: 'london' },
    { re: /\bmanchester\b/i, id: 'manchester' },
    { re: /\bbirmingham\b/i, id: 'birmingham' },
    { re: /\bedinburgh\b/i, id: 'edinburgh' },
    { re: /\bglasgow\b/i, id: 'glasgow' },
    { re: /\bcardiff\b/i, id: 'cardiff' },
    { re: /\bbelfast\b/i, id: 'belfast' },
  ],
  IE: [
    { re: /\bdublin\b/i, id: 'dublin' },
    { re: /\bcork\b/i, id: 'cork' },
    { re: /\bgalway\b/i, id: 'galway' },
  ],
  AU: [
    { re: /\bsydney\b/i, id: 'sydney' },
    { re: /\bmelbourne\b/i, id: 'melbourne' },
    { re: /\bbrisbane\b/i, id: 'brisbane' },
    { re: /\bperth\b/i, id: 'perth' },
    { re: /\badelaide\b/i, id: 'adelaide' },
    { re: /\bcanberra\b/i, id: 'canberra' },
  ],
};

function cityHitsForPack(country: string, text: string): CityHit[] {
  const pack = packs[country];
  const patterns = CITY_PATTERNS[country];
  if (!pack || !patterns || !text) return [];
  const byId = new Map(pack.cities.map((c) => [c.id, c]));
  const out: CityHit[] = [];
  for (const { re, id } of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const city = byId.get(id);
    if (!city) continue;
    out.push({
      country,
      label: city.label,
      coord: [city.lat, city.lng],
      index: m.index,
    });
  }
  return out;
}

/** US ZIP5 directory (full centroids map). */
export class UsPostalDirectory implements PostalDirectory {
  readonly country = 'US';

  normalizeCode(raw: string): string | null {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return null;
    const z = digits.length < 5 ? digits.padStart(5, '0') : digits.slice(0, 5);
    return usZipCentroids[z] ? z : null;
  }

  lookup(code: string): PostalHit | null {
    const z = this.normalizeCode(code);
    if (!z) return null;
    const coord = usZipCentroids[z];
    if (!coord) return null;
    return { country: 'US', code: z, coord, label: `ZIP ${z}` };
  }

  extractFromText(text: string): string[] {
    if (!text) return [];
    const re = /\b(\d{5})(?:-\d{4})?\b/g;
    const out: string[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const z = m[1];
      if (z && usZipCentroids[z] && !seen.has(z)) {
        seen.add(z);
        out.push(z);
      }
    }
    return out;
  }

  extractCities(_text: string): CityHit[] {
    // US cities remain in geo.ts CITY_COORDS for richer coverage.
    return [];
  }
}

class PackPostalDirectory implements PostalDirectory {
  constructor(readonly country: string) {}

  private pack(): CountryPack | undefined {
    return packs[this.country];
  }

  private makeHit(code: string, coord: LatLng): PostalHit {
    return {
      country: this.country,
      code,
      coord,
      label: `${this.country} ${code}`,
    };
  }

  normalizeCode(raw: string): string | null {
    const pack = this.pack();
    if (!pack) return null;
    const s = String(raw ?? '').trim().toUpperCase();
    if (!s) return null;
    const strategy = PACK_NORMALIZE[this.country];
    return strategy ? strategy(s, pack) : null;
  }

  lookup(code: string): PostalHit | null {
    const pack = this.pack();
    if (!pack) return null;
    const n = this.normalizeCode(code);
    const key = n ?? String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const coord = pack.codes[key];
    if (!coord) return null;
    return this.makeHit(key, coord);
  }

  extractFromText(text: string): string[] {
    if (!text) return [];
    const extract = PACK_EXTRACT[this.country];
    if (!extract) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string): void => {
      const n = this.normalizeCode(raw) || this.lookup(raw)?.code;
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    };
    extract(text, push, packs);
    return out;
  }

  extractCities(text: string): CityHit[] {
    return cityHitsForPack(this.country, text);
  }
}

type NormalizeFn = (s: string, pack: CountryPack) => string | null;
type ExtractFn = (
  text: string,
  push: (raw: string) => void,
  allPacks: Record<string, CountryPack>
) => void;

const PACK_NORMALIZE: Record<string, NormalizeFn> = {
  CA: (s, pack) => {
    const compact = s.replace(/\s+/g, '');
    if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return null;
    return pack.codes[compact] ? compact : null;
  },
  GB: (s, pack) => {
    const compact = s.replace(/\s+/g, '');
    if (pack.codes[compact]) return compact;
    const outward = /^([A-Z]{1,2}\d[A-Z\d]?)/.exec(compact)?.[1];
    if (outward && pack.codes[outward]) return outward;
    return null;
  },
  IE: (s, pack) => {
    const compact = s.replace(/\s+/g, '');
    if (pack.codes[compact]) return compact;
    const routing = compact.slice(0, 3);
    return pack.codes[routing] ? routing : null;
  },
  AU: (s, pack) => {
    const digits = s.replace(/\D/g, '');
    if (digits.length !== 4) return null;
    return pack.codes[digits] ? digits : null;
  },
};

const PACK_EXTRACT: Record<string, ExtractFn> = {
  CA: (text, push) => {
    for (const m of text.matchAll(/\b([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\b/g)) {
      push(`${m[1]}${m[2]}`);
    }
  },
  GB: (text, push, allPacks) => {
    for (const m of text.matchAll(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi)) {
      push(m[1] || '');
    }
    for (const m of text.matchAll(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/gi)) {
      const key = (m[1] || '').toUpperCase();
      if (allPacks.GB?.codes[key]) push(key);
    }
  },
  IE: (text, push) => {
    for (const m of text.matchAll(/\b([A-Z]\d{2})\s?[A-Z0-9]{4}\b/gi)) {
      push(m[1] || '');
    }
    for (const m of text.matchAll(/\b([A-Z]\d{2})\b/gi)) {
      push(m[1] || '');
    }
  },
  AU: (text, push) => {
    for (const m of text.matchAll(/\b(\d{4})\b/g)) {
      push(m[1] || '');
    }
  },
};

const DIRECTORY_CACHE = new Map<string, PostalDirectory>();

export function getPostalDirectory(country: string | null | undefined): PostalDirectory | null {
  const c = normalizeHomeCountry(country);
  const cached = DIRECTORY_CACHE.get(c);
  if (cached) return cached;
  let dir: PostalDirectory | null = null;
  if (c === 'US') dir = new UsPostalDirectory();
  else if (packs[c]) dir = new PackPostalDirectory(c);
  if (dir) DIRECTORY_CACHE.set(c, dir);
  return dir;
}

/** Countries with a commute postal pack (US full; others curated). */
export function hasPostalPack(country: string | null | undefined): boolean {
  return getPostalDirectory(country) != null;
}

/**
 * Directories to use when resolving a posting.
 * Prefer countryHint (board / posting), then homeCountry. Never fall back to US ZIP
 * extraction when the active country is non-US (avoids colliding numeric codes).
 */
export function directoriesForResolve(args: {
  homeCountry?: string | null;
  countryHint?: string | null;
}): PostalDirectory[] {
  const home = normalizeHomeCountry(args.homeCountry);
  const hint = args.countryHint ? normalizeHomeCountry(args.countryHint) : '';
  const ordered: string[] = [];
  const push = (c: string): void => {
    if (c && !ordered.includes(c)) ordered.push(c);
  };
  if (hint) push(hint);
  push(home);
  return ordered.map((c) => getPostalDirectory(c)).filter((d): d is PostalDirectory => Boolean(d));
}

/** Operator location code (postalCode preferred; legacy `zip` via record read). */
export function locationPostalCode(loc: Pick<Location, 'postalCode'> | Location): string {
  const preferred = loc.postalCode;
  if (preferred != null && String(preferred).trim()) return String(preferred).trim();
  // Read legacy field without touching Location.zip (deprecated for callers).
  const legacy = (loc as Record<string, unknown>).zip;
  return typeof legacy === 'string' ? legacy.trim() : '';
}

export function locationCountry(
  loc: Pick<Location, 'country'>,
  homeCountry?: string | null
): string {
  return normalizeHomeCountry(loc.country || homeCountry || 'US');
}

export function locationRadiusMiles(loc: Location): number {
  const raw = Number(loc.radiusMiles) || 0;
  const unit = loc.radiusUnit || 'mi';
  if (unit === 'km') return raw / 1.609344;
  return raw;
}

export function milesToDisplay(miles: number, unit: 'mi' | 'km'): number {
  if (unit === 'km') return Math.round(miles * 1.609344 * 10) / 10;
  return Math.round(miles * 10) / 10;
}
