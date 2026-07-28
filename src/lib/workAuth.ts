import { normalizeHomeCountry } from './homeCountry';

function anyRe(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export type WorkAuthRuleSet = {
  readonly id: string;
  postingRequires(pageText: string): boolean;
  candidateSatisfies(note: string): boolean;
  /** Soft label for demoted hard_skips. */
  satisfiedReason: string;
};

const US_CITIZEN_NOTE_PATTERNS: readonly RegExp[] = [
  /\bcitizen\b/i,
  /\bcitizenship\b/i,
  /\bU\.?\s*S\.?\.?\s*citizen\b/i,
  /\bU\.?\s*S\.?\.?\s*citizenship\b/i,
  /\bUnited\s+States\s+citizen\b/i,
  /\bUnited\s+States\s+citizenship\b/i,
  /\bAmerican\s+citizen\b/i,
  /\bAmerican\s+citizenship\b/i,
  /\bUS\s+citizen\b/i,
];

const NEEDS_SPONSORSHIP_NOTE_PATTERNS: readonly RegExp[] = [
  /\bneeds?\s+sponsorship\b/i,
  /\bneeds?\s+visa\s+sponsorship\b/i,
  /\bneeded\s+sponsorship\b/i,
  /\bneeded\s+visa\s+sponsorship\b/i,
  /\brequires?\s+sponsorship\b/i,
  /\brequires?\s+visa\s+sponsorship\b/i,
  /\brequired\s+sponsorship\b/i,
  /\brequired\s+visa\s+sponsorship\b/i,
  /\bseeking\s+sponsorship\b/i,
  /\bseeking\s+visa\s+sponsorship\b/i,
  /\bnot\s+a\s+citizen\b/i,
  /\bnot\s+a\s+U\.?\s*S\.?\.?\s*citizen\b/i,
  /\bH-?1B\b/i,
  /\bEAD\b/i,
  /\bgreen\s+card\s+pending\b/i,
];

const POSTING_US_CITIZEN_REQUIRED_PATTERNS: readonly RegExp[] = [
  /\bmust\s+be\s+a\s+U\.?\s*S\.?\.?\s*citizen\b/i,
  /\bmust\s+be\s+U\.?\s*S\.?\.?\s*citizen\b/i,
  /\bU\.?\s*S\.?\.?\s*citizenship\s+required\b/i,
  /\bU\.?\s*S\.?\.?\s*citizenship\s+mandatory\b/i,
  /\bU\.?\s*S\.?\.?\s*citizenship\s+needed\b/i,
  /\bonly\s+U\.?\s*S\.?\.?\s*citizens?\s+may\b/i,
  /\bonly\s+U\.?\s*S\.?\.?\s*citizens?\s+can\b/i,
  /\bonly\s+U\.?\s*S\.?\.?\s*citizens?\s+will\b/i,
  /\brequires?\s+U\.?\s*S\.?\.?\s*citizenship\b/i,
];

export const UsWorkAuthRuleSet: WorkAuthRuleSet = {
  id: 'US',
  postingRequires: (pageText) => anyRe(pageText, POSTING_US_CITIZEN_REQUIRED_PATTERNS),
  candidateSatisfies: (note) => {
    const n = note.trim();
    if (!n) return false;
    const claimsCitizen = anyRe(n, US_CITIZEN_NOTE_PATTERNS);
    if (anyRe(n, NEEDS_SPONSORSHIP_NOTE_PATTERNS) && !claimsCitizen) return false;
    return claimsCitizen;
  },
  satisfiedReason: 'Work authorization note indicates US citizenship',
};

const CA_CITIZEN_NOTE_PATTERNS: readonly RegExp[] = [
  /\bCanadian\s+citizen\b/i,
  /\bCanadian\s+citizenship\b/i,
  /\bcitizen\s+of\s+Canada\b/i,
  /\bpermanent\s+resident\b/i,
  /\bPR\b/,
  /\bCanada\s+PR\b/i,
];

const POSTING_CA_CITIZEN_REQUIRED_PATTERNS: readonly RegExp[] = [
  /\bmust\s+be\s+(?:a\s+)?Canadian\s+citizen\b/i,
  /\bCanadian\s+citizenship\s+required\b/i,
  /\bCanadian\s+citizens?\s+(?:or|and)\s+permanent\s+residents?\s+only\b/i,
  /\bonly\s+Canadian\s+citizens?\b/i,
];

export const CaWorkAuthRuleSet: WorkAuthRuleSet = {
  id: 'CA',
  postingRequires: (pageText) => anyRe(pageText, POSTING_CA_CITIZEN_REQUIRED_PATTERNS),
  candidateSatisfies: (note) => anyRe(note.trim(), CA_CITIZEN_NOTE_PATTERNS),
  satisfiedReason: 'Work authorization note indicates Canadian citizenship or PR',
};

const UK_RTW_NOTE_PATTERNS: readonly RegExp[] = [
  /\bright\s+to\s+work\s+in\s+the\s+UK\b/i,
  /\bBritish\s+citizen\b/i,
  /\bUK\s+citizen\b/i,
  /\bsettled\s+status\b/i,
  /\bpre-?settled\s+status\b/i,
  /\bindefinite\s+leave\s+to\s+remain\b/i,
  /\bILR\b/,
];

const POSTING_UK_RTW_REQUIRED_PATTERNS: readonly RegExp[] = [
  /\bmust\s+have\s+(?:the\s+)?right\s+to\s+work\s+in\s+the\s+UK\b/i,
  /\bright\s+to\s+work\s+in\s+the\s+UK\s+required\b/i,
  /\bno\s+sponsorship\b/i,
  /\bunable\s+to\s+sponsor\b/i,
  /\bBritish\s+citizens?\s+only\b/i,
];

export const UkWorkAuthRuleSet: WorkAuthRuleSet = {
  id: 'GB',
  postingRequires: (pageText) => anyRe(pageText, POSTING_UK_RTW_REQUIRED_PATTERNS),
  candidateSatisfies: (note) => anyRe(note.trim(), UK_RTW_NOTE_PATTERNS),
  satisfiedReason: 'Work authorization note indicates UK right to work',
};

const RULE_SETS: WorkAuthRuleSet[] = [UsWorkAuthRuleSet, CaWorkAuthRuleSet, UkWorkAuthRuleSet];

export function workAuthRuleSetFor(homeCountry: string | null | undefined): WorkAuthRuleSet {
  const c = normalizeHomeCountry(homeCountry);
  if (c === 'CA') return CaWorkAuthRuleSet;
  if (c === 'GB' || c === 'IE') return UkWorkAuthRuleSet;
  return UsWorkAuthRuleSet;
}

/** All packs that might apply (posting country unknown) — try US first for compat. */
export function allWorkAuthRuleSets(): readonly WorkAuthRuleSet[] {
  return RULE_SETS;
}

export function candidateClaimsUsCitizenship(note: string): boolean {
  return UsWorkAuthRuleSet.candidateSatisfies(note);
}

export function postingRequiresUsCitizenship(pageText: string): boolean {
  return UsWorkAuthRuleSet.postingRequires(pageText);
}

/**
 * True when any rule pack says the posting requires auth and the note satisfies it,
 * or when US pack matches (legacy path used by sanitizer).
 */
export function candidateSatisfiesPostingAuth(
  pageText: string,
  note: string,
  homeCountry?: string | null
): { ok: boolean; reason: string } | null {
  const preferred = workAuthRuleSetFor(homeCountry);
  const ordered = [preferred, ...RULE_SETS.filter((r) => r.id !== preferred.id)];
  for (const pack of ordered) {
    if (!pack.postingRequires(pageText)) continue;
    if (pack.candidateSatisfies(note)) {
      return { ok: true, reason: pack.satisfiedReason };
    }
    return { ok: false, reason: '' };
  }
  return null;
}
