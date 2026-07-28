import type {
  Bookmark,
  Config,
  Preferences,
  SkillClaim,
} from '../types/domain';
import {
  ConfigSchema,
  DEFAULT_PREFERENCES,
  DEFAULT_ROLE_SKIP_CATEGORIES,
  PreferencesSchema,
  SKIP_CATEGORY_IDS,
  SkillClaimSchema,
} from '../types/domain';
import {
  DEFAULT_CLAUDE_MODEL,
  isPermSkipTrigger,
  PERM_SKIP_TRIGGER,
  SHELL_EMPLOYER_SKIP_TRIGGER,
  SKIP_CATEGORY_TRIGGERS,
} from './settingsOptions';
import { defaultRadiusUnit, geoLabelsForCountry, normalizeHomeCountry } from './homeCountry';
import { locationPostalCode } from './postalDirectory';

export type { Config, Bookmark, Location, WorkHistoryEntry, ExtractedSkill } from '../types/domain';
export const DEFAULT_CONFIG: Config = {
  apiKey: '',
  model: DEFAULT_CLAUDE_MODEL,
  preflightMode: 'auto',
  education: '',
  workAuthorizationNote: '',
  homeCountry: 'US',
  locations: [],
  workEligibleRegions: [],
  proficiencies: [],
  deficiencies: [],
  skillClaims: [],
  workHistory: [],
  extractedSkills: [],
  skipTriggers: [],
  flagPermNotices: true,
  preferences: DEFAULT_PREFERENCES,
  theme: 'default',
  uiCulture: 'auto',
  bookmarks: [],
};

function parseStoredSkillClaims(raw: unknown): SkillClaim[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw
    .map((row) => SkillClaimSchema.safeParse(row))
    .flatMap((r) => (r.success ? [r.data] : []));
}

function skillClaimConfidence(value: unknown): SkillClaim['confidence'] | undefined {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return undefined;
}

function claimFromExtractedSkill(row: unknown): SkillClaim | null {
  if (!row || typeof row !== 'object') return null;
  const s = row as Record<string, unknown>;
  if (typeof s.skill !== 'string') return null;
  return {
    skill: s.skill.trim(),
    standing: 'held',
    years: typeof s.years === 'number' ? s.years : undefined,
    confidence: skillClaimConfidence(s.confidence),
    scopeNote: typeof s.source === 'string' ? s.source : undefined,
  };
}

function seedSkillClaims(raw: Record<string, unknown>): SkillClaim[] {
  const stored = parseStoredSkillClaims(raw.skillClaims);
  if (stored) return stored;

  const claims: SkillClaim[] = [];
  const seen = new Set<string>();

  const add = (skill: string, standing: SkillClaim['standing'], extra?: Partial<SkillClaim>): void => {
    const key = skill.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    claims.push({
      skill: skill.trim(),
      standing,
      ...extra,
    });
  };

  if (Array.isArray(raw.proficiencies)) {
    for (const p of raw.proficiencies) {
      if (typeof p === 'string') add(p, 'held');
    }
  }

  if (Array.isArray(raw.extractedSkills)) {
    for (const row of raw.extractedSkills) {
      const claim = claimFromExtractedSkill(row);
      if (!claim) continue;
      add(claim.skill, claim.standing, {
        years: claim.years,
        confidence: claim.confidence,
        scopeNote: claim.scopeNote,
      });
    }
  }

  // Deficiencies stay as gap list; do not auto-map to never_claim (user chooses standing).
  return claims;
}

function migratePreferences(raw: Record<string, unknown>): Preferences {
  const topFlag =
    typeof raw.flagPermNotices === 'boolean' ? raw.flagPermNotices : true;

  const incoming =
    typeof raw.preferences === 'object' && raw.preferences !== null
      ? (raw.preferences as Record<string, unknown>)
      : {};

  const roleSkipRaw =
    typeof incoming.roleSkipCategories === 'object' && incoming.roleSkipCategories !== null
      ? (incoming.roleSkipCategories as Record<string, unknown>)
      : {};
  const roleSkipCategories = { ...DEFAULT_ROLE_SKIP_CATEGORIES };
  for (const id of SKIP_CATEGORY_IDS) {
    if (typeof roleSkipRaw[id] === 'boolean') {
      roleSkipCategories[id] = roleSkipRaw[id];
    }
  }

  const parsed = PreferencesSchema.safeParse({
    ...DEFAULT_PREFERENCES,
    ...incoming,
    roleSkipCategories,
    flagPermNotices:
      typeof incoming.flagPermNotices === 'boolean' ? incoming.flagPermNotices : topFlag,
  });

  return parsed.success ? parsed.data : { ...DEFAULT_PREFERENCES, flagPermNotices: topFlag };
}

function migrateLocations(
  raw: unknown,
  homeCountry: string
): unknown {
  if (!Array.isArray(raw)) return raw;
  const unit = defaultRadiusUnit(homeCountry);
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const loc = row as Record<string, unknown>;
    const zip = typeof loc['zip'] === 'string' ? loc['zip'] : '';
    const postalCode =
      typeof loc.postalCode === 'string' && loc.postalCode.trim()
        ? loc.postalCode
        : zip;
    return {
      ...loc,
      zip: postalCode || zip,
      postalCode: postalCode || zip,
      country:
        typeof loc.country === 'string' && loc.country.trim()
          ? normalizeHomeCountry(String(loc.country))
          : homeCountry,
      radiusUnit:
        loc.radiusUnit === 'km' || loc.radiusUnit === 'mi'
          ? loc.radiusUnit
          : unit,
    };
  });
}

function migrateConfigShape(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw };

  // Lift legacy PERM skip-trigger text into the dedicated checkbox flag.
  if (Array.isArray(next.skipTriggers)) {
    const triggers = (next.skipTriggers as unknown[]).filter(
      (t): t is string => typeof t === 'string'
    );
    const hadPerm = triggers.some(isPermSkipTrigger);
    next.skipTriggers = triggers.filter((t) => !isPermSkipTrigger(t));
    // Legacy PERM trigger text → dedicated flag; also default unset → true.
    if (hadPerm || typeof next.flagPermNotices !== 'boolean') {
      next.flagPermNotices = true;
    }
  } else if (typeof next.flagPermNotices !== 'boolean') {
    next.flagPermNotices = true;
  }

  if (typeof next.workAuthorizationNote !== 'string') {
    next.workAuthorizationNote = '';
  }

  const homeCountry = normalizeHomeCountry(
    typeof next.homeCountry === 'string' ? next.homeCountry : 'US'
  );
  next.homeCountry = homeCountry;
  next.locations = migrateLocations(next.locations, homeCountry);

  next.preferences = migratePreferences(next);
  next.flagPermNotices = (next.preferences as Preferences).flagPermNotices;
  next.skillClaims = seedSkillClaims(next);

  return next;
}

function normalizeStored(raw: unknown): Config {
  const merged = migrateConfigShape({
    ...DEFAULT_CONFIG,
    ...(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}),
  });
  const parsed = ConfigSchema.safeParse(merged);
  if (parsed.success) {
    // Keep legacy top-level flag mirrored.
    return {
      ...parsed.data,
      flagPermNotices: parsed.data.preferences.flagPermNotices,
    };
  }
  console.warn('[JobLens] Config failed validation; merging conservatively', parsed.error.message);
  return {
    ...DEFAULT_CONFIG,
    apiKey: typeof merged.apiKey === 'string' ? merged.apiKey : '',
    model:
      typeof merged.model === 'string' && merged.model
        ? merged.model
        : DEFAULT_CONFIG.model,
    flagPermNotices:
      typeof merged.flagPermNotices === 'boolean'
        ? merged.flagPermNotices
        : DEFAULT_CONFIG.flagPermNotices,
  };
}

export async function getConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get('config');
  return normalizeStored(stored.config);
}

export async function setConfig(patch: Partial<Config>): Promise<Config> {
  const current = await getConfig();
  const merged: Config = { ...current, ...patch };
  // Keep legacy flag and preferences.flagPermNotices in sync.
  if (patch.preferences && typeof patch.preferences.flagPermNotices === 'boolean') {
    merged.flagPermNotices = patch.preferences.flagPermNotices;
  } else if (typeof patch.flagPermNotices === 'boolean') {
    merged.preferences = {
      ...merged.preferences,
      flagPermNotices: patch.flagPermNotices,
    };
  }
  const next = ConfigSchema.parse(merged);
  const synced: Config = {
    ...next,
    flagPermNotices: next.preferences.flagPermNotices,
  };
  await chrome.storage.local.set({ config: synced });
  return synced;
}

export async function addBookmark(entry: Bookmark): Promise<Bookmark[]> {
  const cfg = await getConfig();
  const bookmarks = [entry, ...cfg.bookmarks.filter((b) => b.url !== entry.url)];
  await setConfig({ bookmarks });
  return bookmarks;
}

export async function removeBookmark(url: string): Promise<Bookmark[]> {
  const cfg = await getConfig();
  const bookmarks = cfg.bookmarks.filter((b) => b.url !== url);
  await setConfig({ bookmarks });
  return bookmarks;
}

export async function isBookmarked(url: string): Promise<boolean> {
  const cfg = await getConfig();
  return cfg.bookmarks.some((b) => b.url === url);
}

/** Skip triggers sent to the model, including optional preference-driven checks. */
export function effectiveSkipTriggers(cfg: Config): string[] {
  const prefs = cfg.preferences ?? DEFAULT_PREFERENCES;
  const flagPerm = prefs.flagPermNotices ?? cfg.flagPermNotices;
  const base = cfg.skipTriggers.filter((t) => !isPermSkipTrigger(t));
  const out = [...base];

  const pushUnique = (trigger: string): void => {
    if (!out.includes(trigger)) out.push(trigger);
  };

  if (flagPerm) pushUnique(PERM_SKIP_TRIGGER);
  if (prefs.flagShellEmployers) pushUnique(SHELL_EMPLOYER_SKIP_TRIGGER);

  for (const id of SKIP_CATEGORY_IDS) {
    if (prefs.roleSkipCategories[id]) {
      pushUnique(SKIP_CATEGORY_TRIGGERS[id]);
    }
  }

  return out;
}

export type ProfileCompleteness = {
  hasSkills: boolean;
  hasGeo: boolean;
  /** True when geo intent is missing (Scan should be blocked). */
  incomplete: boolean;
  /** Soft note when skills are empty but geo is set. Empty when none. */
  skillsWarning: string;
  /** Required-geo message when geo intent missing. Empty when geo is set. */
  geoRequiredMessage: string;
  /**
   * Banner text for the side panel: geo-required takes precedence over soft skills note.
   * Empty when both geo and skills are satisfactory for messaging purposes.
   */
  message: string;
};

/** Postal locations, remote regions, or explicit remote-only — any one unlocks Scan. */
export function hasGeoIntent(cfg: Config): boolean {
  const prefs = cfg.preferences ?? DEFAULT_PREFERENCES;
  if (prefs.remoteOnly) return true;
  if (cfg.workEligibleRegions.length > 0) return true;
  return cfg.locations.some((l) => Boolean(locationPostalCode(l)));
}

export function hasHeldSkills(cfg: Config): boolean {
  return (
    cfg.skillClaims.some((c) => c.standing === 'held' && c.skill.trim()) ||
    cfg.proficiencies.some((p) => p.trim()) ||
    cfg.extractedSkills.some((s) => s.skill.trim())
  );
}

const SKILLS_SOFT_MESSAGE =
  'No held skills yet — Fit will be generic. Add skills in Options when you can.';

/** Geo hard-required for Scan; skills soft-recommended only. */
export function assessProfileCompleteness(cfg: Config): ProfileCompleteness {
  const hasSkills = hasHeldSkills(cfg);
  const hasGeo = hasGeoIntent(cfg);
  const incomplete = !hasGeo;
  const geoRequiredMessage = incomplete
    ? geoLabelsForCountry(cfg.homeCountry).geoRequiredMessage
    : '';
  const skillsWarning = hasGeo && !hasSkills ? SKILLS_SOFT_MESSAGE : '';
  const message = geoRequiredMessage || skillsWarning;

  return {
    hasSkills,
    hasGeo,
    incomplete,
    skillsWarning,
    geoRequiredMessage,
    message,
  };
}
