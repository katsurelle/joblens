/**
 * Integration: language-market board coverage + resolve/launcher across regions.
 */
import { describe, expect, it } from 'vitest';
import {
  BOARD_COVERAGE_LANGUAGES,
  BOARDS,
  MATCH_PATTERNS,
  MIN_BOARDS_PER_LANGUAGE,
  boardsForLanguage,
  resolveBoard,
  shouldShowLauncher,
} from '../../src/lib/boards';
import { REGIONAL_BOARDS } from '../../src/lib/boards/regionalBoards';
import { REGIONAL_POSTING_CASES } from '../../src/lib/boards/regionalPostingCases';
import { CLAUDE_SUPPORTED_LANGUAGE_CODES } from '../../src/i18n/claudeLanguages';

describe('regional board coverage integration', () => {
  it('keeps all core boards and adds a substantial regional set', () => {
    expect(BOARDS.some((b) => b.id === 'indeed')).toBe(true);
    expect(BOARDS.some((b) => b.id === 'linkedin')).toBe(true);
    expect(BOARDS.some((b) => b.id === 'greenhouse')).toBe(true);
    expect(REGIONAL_BOARDS.length).toBeGreaterThanOrEqual(50);
    expect(BOARDS.length).toBe(25 + REGIONAL_BOARDS.length);
  });

  it('aligns coverage languages with Claude-supported UI languages', () => {
    expect([...BOARD_COVERAGE_LANGUAGES]).toEqual([...CLAUDE_SUPPORTED_LANGUAGE_CODES]);
  });

  it('meets top-ten-per-language board coverage', () => {
    const report: Record<string, number> = {};
    for (const lang of BOARD_COVERAGE_LANGUAGES) {
      report[lang] = boardsForLanguage(lang).length;
      expect(report[lang]).toBeGreaterThanOrEqual(MIN_BOARDS_PER_LANGUAGE);
    }
    // Sanity: English market is largest
    expect(report.en).toBeGreaterThanOrEqual(report.es!);
  });

  it('resolves posting URLs for a sample of each regional board', () => {
    const positives = REGIONAL_POSTING_CASES.filter(([, , ok]) => ok);
    const seen = new Set<string>();
    for (const [id, url] of positives) {
      if (seen.has(id)) continue;
      seen.add(id);
      const host = new URL(url).hostname;
      const board = resolveBoard(url, host);
      expect(board?.id, `resolve ${id} @ ${url}`).toBe(id);
      expect(shouldShowLauncher(board, url)).toBe(true);
    }
    expect(seen.size).toBe(REGIONAL_BOARDS.length);
  });

  it('includes every board match pattern in MATCH_PATTERNS for the manifest', () => {
    for (const b of BOARDS) {
      for (const p of b.matchPatterns) {
        expect(MATCH_PATTERNS).toContain(p);
      }
    }
  });
});
