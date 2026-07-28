import {
  applyConfigProposalChanges,
  type ConfigProposal,
  type ConfigProposalChange,
} from '../lib/docImport';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from '../lib/settingsOptions';
import { parseCommaList, parseNewlineList } from '../lib/listParse';
import type { Config, EmploymentPriority, ExtractedSkill, Preferences, SkillClaim } from '../types/domain';
import { DEFAULT_PREFERENCES } from '../types/domain';

export type OptionsTab = 'basics' | 'geography' | 'skills' | 'preferences';

export const TAB_IDS: OptionsTab[] = ['basics', 'geography', 'skills', 'preferences'];

export const TAB_LABEL_KEYS: Record<OptionsTab, string> = {
  basics: 'options.basics',
  geography: 'options.geography',
  skills: 'options.skills',
  preferences: 'options.preferences',
};

export const parseLines = parseNewlineList;

export function syncProficienciesFromClaims(claims: SkillClaim[]): string[] {
  return claims.filter((c) => c.standing === 'held' && c.skill.trim()).map((c) => c.skill.trim());
}

/** Stable row ids for React keys (persisted when present; generated for legacy rows). */
export function ensureLocationIds(
  locations: Config['locations']
): Config['locations'] {
  return locations.map((l) => (l.id ? l : { ...l, id: crypto.randomUUID() }));
}

export function ensureSkillClaimIds(claims: SkillClaim[]): SkillClaim[] {
  return claims.map((c) => (c.id ? c : { ...c, id: crypto.randomUUID() }));
}

export function ensureWorkHistoryIds(
  entries: Config['workHistory']
): Config['workHistory'] {
  return entries.map((e) => (e.id ? e : { ...e, id: crypto.randomUUID() }));
}

export function newEmptyLocation(homeCountry = 'US'): Config['locations'][number] {
  const unit = homeCountry === 'US' ? 'mi' : 'km';
  return {
    id: crypto.randomUUID(),
    zip: '',
    postalCode: '',
    country: homeCountry,
    radiusMiles: unit === 'km' ? 40 : 25,
    radiusUnit: unit,
  };
}

export function newEmptySkillClaim(): SkillClaim {
  return {
    id: crypto.randomUUID(),
    skill: '',
    standing: 'held',
    years: undefined,
    lastUsed: '',
    scopeNote: '',
  };
}

export function newEmptyWorkHistoryEntry(): Config['workHistory'][number] {
  return {
    id: crypto.randomUUID(),
    org: '',
    title: '',
    start: '',
    end: '',
    description: '',
  };
}

/** Readable message from a caught unknown without `[object Object]`. */
export function unknownErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export function toggleSetMembership<T>(prev: Set<T>, id: T): Set<T> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleListMembership<T>(list: T[], id: T): T[] {
  const next = list.slice();
  const idx = next.indexOf(id);
  if (idx >= 0) next.splice(idx, 1);
  else next.push(id);
  return next;
}

export function moveInList<T>(list: T[], id: T, dir: -1 | 1): T[] | null {
  const next = list.slice();
  const idx = next.indexOf(id);
  if (idx < 0) return null;
  const target = idx + dir;
  if (target < 0 || target >= next.length) return null;
  const a = next[idx];
  const b = next[target];
  if (a === undefined || b === undefined) return null;
  next[idx] = b;
  next[target] = a;
  return next;
}

export interface ConfigTextFields {
  deficienciesText: string;
  skipTriggersText: string;
  blockedEmployersText: string;
  workEligibleRegionsText: string;
}

export function textsFromConfig(c: Config): ConfigTextFields {
  return {
    deficienciesText: c.deficiencies.join('\n'),
    skipTriggersText: c.skipTriggers.join('\n'),
    blockedEmployersText: (c.preferences?.blockedEmployers ?? []).join('\n'),
    workEligibleRegionsText: c.workEligibleRegions.join(', '),
  };
}

export function resolveModelValue(model: string): string {
  const modelIds = new Set(CLAUDE_MODELS.map((m) => m.id));
  return modelIds.has(model) ? model : DEFAULT_CLAUDE_MODEL;
}

export interface MergeExtractedSkillsResult {
  skillClaims: SkillClaim[];
  claimAdds: SkillClaim[];
  found: number;
}

export function mergeExtractedSkills(
  existingClaims: SkillClaim[],
  extracted: ExtractedSkill[]
): MergeExtractedSkillsResult {
  const claimKeys = new Set(existingClaims.map((c) => c.skill.toLowerCase()));
  const claimAdds: SkillClaim[] = extracted
    .filter((s) => s.skill && !claimKeys.has(s.skill.toLowerCase()))
    .map((s) => ({
      id: crypto.randomUUID(),
      skill: s.skill,
      standing: 'held' as const,
      years: s.years,
      confidence: s.confidence,
      scopeNote: s.source,
    }));
  return {
    skillClaims: [...existingClaims, ...claimAdds],
    claimAdds,
    found: extracted.length,
  };
}

export function mergeExtractSkillsForConfig(
  cfg: Config,
  extracted: ExtractedSkill[]
): MergeExtractedSkillsResult {
  return mergeExtractedSkills(cfg.skillClaims, extracted);
}

export interface ProposeFromDocsResult {
  proposal: ConfigProposal;
  selectedChangeIds: Set<string>;
  statusKey: 'options.statusProposed' | 'options.statusNoProposed';
  statusParams?: { count: number };
}

export function buildProposalResult(data: {
  summary?: string;
  changes: ConfigProposalChange[];
}): ProposeFromDocsResult {
  const proposal: ConfigProposal = {
    summary: data.summary || '',
    changes: data.changes,
  };
  return {
    proposal,
    selectedChangeIds: new Set(proposal.changes.map((c) => c.id)),
    statusKey: proposal.changes.length ? 'options.statusProposed' : 'options.statusNoProposed',
    statusParams: proposal.changes.length ? { count: proposal.changes.length } : undefined,
  };
}

export function applySelectedProposalChanges(
  cfg: Config,
  proposal: ConfigProposal,
  selectedChangeIds: Set<string>
): Config | null {
  const selected = proposal.changes.filter((c) => selectedChangeIds.has(c.id));
  if (!selected.length) return null;
  return applyConfigProposalChanges(cfg, selected);
}

export function buildConfigForSave(
  cfg: Config,
  texts: ConfigTextFields
): Config {
  const prefs: Preferences = cfg.preferences ?? DEFAULT_PREFERENCES;
  const skillClaims = cfg.skillClaims.filter((c) => c.skill.trim());
  const blockedEmployers = parseLines(texts.blockedEmployersText);
  const modelValue = resolveModelValue(cfg.model);
  return {
    ...cfg,
    model: modelValue,
    deficiencies: parseLines(texts.deficienciesText),
    skipTriggers: parseLines(texts.skipTriggersText),
    workEligibleRegions: parseCommaList(texts.workEligibleRegionsText),
    skillClaims,
    proficiencies: syncProficienciesFromClaims(skillClaims),
    preferences: {
      ...prefs,
      blockedEmployers,
    },
    flagPermNotices: prefs.flagPermNotices,
  };
}

export function toggleEmploymentPriorityList(
  list: EmploymentPriority[],
  id: EmploymentPriority
): EmploymentPriority[] {
  return toggleListMembership(list, id);
}

export function moveEmploymentInList(
  list: EmploymentPriority[],
  id: EmploymentPriority,
  dir: -1 | 1
): EmploymentPriority[] | null {
  return moveInList(list, id, dir);
}
