/**
 * Languages Anthropic documents for Claude multilingual response quality.
 * Source: https://platform.claude.com/docs/en/build-with-claude/multilingual-support
 * Cultures whose language is not in this set are omitted (do not invent fillers).
 */
export const CLAUDE_SUPPORTED_LANGUAGE_CODES = [
  'en',
  'es',
  'pt',
  'it',
  'fr',
  'id',
  'de',
  'ar',
  'zh', // Simplified Chinese (zh-Hans)
  'ko',
  'ja',
  'hi',
  'bn',
  'sw',
  'yo',
] as const;

export type ClaudeSupportedLanguage = (typeof CLAUDE_SUPPORTED_LANGUAGE_CODES)[number];

export function isClaudeSupportedLanguage(code: string): code is ClaudeSupportedLanguage {
  const base = code.toLowerCase().split('-')[0] || '';
  // zh-Hans → zh
  if (base === 'zh') return true;
  return (CLAUDE_SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(base);
}

/** Human label for prompt instructions (English meta-labels; response language is separate). */
export const CLAUDE_LANGUAGE_PROMPT_NAMES: Record<ClaudeSupportedLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese (Brazilian)',
  it: 'Italian',
  fr: 'French',
  id: 'Indonesian',
  de: 'German',
  ar: 'Arabic',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
  ja: 'Japanese',
  hi: 'Hindi',
  bn: 'Bengali',
  sw: 'Swahili',
  yo: 'Yoruba',
};
