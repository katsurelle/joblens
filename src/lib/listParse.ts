/**
 * Shared list parsers for Options fields.
 * Region lists must parse only on Save — live keystroke split drops commas/spaces.
 */

/** Newline-separated lists (deficiencies, skip triggers, blocked employers). */
export function parseNewlineList(raw: string): string[] {
  return raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Comma-separated lists (e.g. US states / work-eligible regions). */
export function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
