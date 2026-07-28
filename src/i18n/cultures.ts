/**
 * Cultures = nation × written language, filtered to Claude-supported languages.
 *
 * Method:
 * 1. Start from the 30 most populous nations (UN WPP 2024-style ranking).
 * 2. Take up to three widely used *written* languages per nation.
 * 3. Drop any language Claude does not document for multilingual responses.
 * 4. Do not add substitute languages to fill gaps.
 */
import {
  CLAUDE_LANGUAGE_PROMPT_NAMES,
  isClaudeSupportedLanguage,
  type ClaudeSupportedLanguage,
} from './claudeLanguages';

export type CultureDefinition = {
  /** BCP 47 tag used as i18n language + config value */
  id: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  countryNameEn: string;
  language: ClaudeSupportedLanguage;
  /** Display name of the language in English (for searchable picker) */
  languageNameEn: string;
  /** Native / endonym label for the culture row */
  nativeLabel: string;
  /** English label: "Spanish (Mexico)" */
  labelEn: string;
  dir: 'ltr' | 'rtl';
  /** i18next resource language keys to try (most specific first) */
  fallbackLng: string[];
};

/** Top 30 nations → candidate written languages before Claude filter. */
const NATION_WRITTEN_LANGUAGES: Array<{
  countryCode: string;
  countryNameEn: string;
  languages: Array<{ code: string; nameEn: string; native: string }>;
}> = [
  {
    countryCode: 'IN',
    countryNameEn: 'India',
    languages: [
      { code: 'hi', nameEn: 'Hindi', native: 'हिन्दी' },
      { code: 'en', nameEn: 'English', native: 'English' },
      { code: 'bn', nameEn: 'Bengali', native: 'বাংলা' },
    ],
  },
  {
    countryCode: 'CN',
    countryNameEn: 'China',
    languages: [
      { code: 'zh-Hans', nameEn: 'Chinese (Simplified)', native: '简体中文' },
      { code: 'en', nameEn: 'English', native: 'English' },
      // Cantonese / minority langs not Claude-documented as response langs
    ],
  },
  {
    countryCode: 'US',
    countryNameEn: 'United States',
    languages: [
      { code: 'en', nameEn: 'English', native: 'English' },
      { code: 'es', nameEn: 'Spanish', native: 'Español' },
      { code: 'zh-Hans', nameEn: 'Chinese (Simplified)', native: '简体中文' },
    ],
  },
  {
    countryCode: 'ID',
    countryNameEn: 'Indonesia',
    languages: [
      { code: 'id', nameEn: 'Indonesian', native: 'Bahasa Indonesia' },
      { code: 'en', nameEn: 'English', native: 'English' },
      // Javanese / Sundanese dropped (not Claude-documented)
    ],
  },
  {
    countryCode: 'PK',
    countryNameEn: 'Pakistan',
    languages: [
      { code: 'en', nameEn: 'English', native: 'English' },
      // Urdu, Punjabi dropped
    ],
  },
  {
    countryCode: 'NG',
    countryNameEn: 'Nigeria',
    languages: [
      { code: 'en', nameEn: 'English', native: 'English' },
      { code: 'yo', nameEn: 'Yoruba', native: 'Yorùbá' },
      // Hausa / Igbo dropped
    ],
  },
  {
    countryCode: 'BR',
    countryNameEn: 'Brazil',
    languages: [{ code: 'pt', nameEn: 'Portuguese', native: 'Português' }],
  },
  {
    countryCode: 'BD',
    countryNameEn: 'Bangladesh',
    languages: [
      { code: 'bn', nameEn: 'Bengali', native: 'বাংলা' },
      { code: 'en', nameEn: 'English', native: 'English' },
    ],
  },
  {
    countryCode: 'RU',
    countryNameEn: 'Russia',
    languages: [
      // Russian not on Anthropic multilingual benchmark table → omit nation languages
    ],
  },
  {
    countryCode: 'MX',
    countryNameEn: 'Mexico',
    languages: [{ code: 'es', nameEn: 'Spanish', native: 'Español' }],
  },
  {
    countryCode: 'JP',
    countryNameEn: 'Japan',
    languages: [{ code: 'ja', nameEn: 'Japanese', native: '日本語' }],
  },
  {
    countryCode: 'ET',
    countryNameEn: 'Ethiopia',
    languages: [
      { code: 'en', nameEn: 'English', native: 'English' },
      // Amharic / Oromo dropped
    ],
  },
  {
    countryCode: 'PH',
    countryNameEn: 'Philippines',
    languages: [
      { code: 'en', nameEn: 'English', native: 'English' },
      // Filipino / Tagalog dropped
    ],
  },
  {
    countryCode: 'EG',
    countryNameEn: 'Egypt',
    languages: [{ code: 'ar', nameEn: 'Arabic', native: 'العربية' }],
  },
  {
    countryCode: 'VN',
    countryNameEn: 'Vietnam',
    languages: [
      // Vietnamese dropped
    ],
  },
  {
    countryCode: 'CD',
    countryNameEn: 'DR Congo',
    languages: [
      { code: 'fr', nameEn: 'French', native: 'Français' },
      { code: 'sw', nameEn: 'Swahili', native: 'Kiswahili' },
    ],
  },
  {
    countryCode: 'TR',
    countryNameEn: 'Türkiye',
    languages: [
      // Turkish dropped
    ],
  },
  {
    countryCode: 'IR',
    countryNameEn: 'Iran',
    languages: [
      // Persian dropped
    ],
  },
  {
    countryCode: 'DE',
    countryNameEn: 'Germany',
    languages: [{ code: 'de', nameEn: 'German', native: 'Deutsch' }],
  },
  {
    countryCode: 'TH',
    countryNameEn: 'Thailand',
    languages: [
      // Thai dropped
    ],
  },
  {
    countryCode: 'GB',
    countryNameEn: 'United Kingdom',
    languages: [{ code: 'en', nameEn: 'English', native: 'English' }],
  },
  {
    countryCode: 'FR',
    countryNameEn: 'France',
    languages: [{ code: 'fr', nameEn: 'French', native: 'Français' }],
  },
  {
    countryCode: 'IT',
    countryNameEn: 'Italy',
    languages: [{ code: 'it', nameEn: 'Italian', native: 'Italiano' }],
  },
  {
    countryCode: 'TZ',
    countryNameEn: 'Tanzania',
    languages: [
      { code: 'sw', nameEn: 'Swahili', native: 'Kiswahili' },
      { code: 'en', nameEn: 'English', native: 'English' },
    ],
  },
  {
    countryCode: 'ZA',
    countryNameEn: 'South Africa',
    languages: [
      { code: 'en', nameEn: 'English', native: 'English' },
      // Zulu / Xhosa / Afrikaans dropped
    ],
  },
  {
    countryCode: 'MM',
    countryNameEn: 'Myanmar',
    languages: [
      // Burmese dropped
    ],
  },
  {
    countryCode: 'KE',
    countryNameEn: 'Kenya',
    languages: [
      { code: 'sw', nameEn: 'Swahili', native: 'Kiswahili' },
      { code: 'en', nameEn: 'English', native: 'English' },
    ],
  },
  {
    countryCode: 'KR',
    countryNameEn: 'South Korea',
    languages: [{ code: 'ko', nameEn: 'Korean', native: '한국어' }],
  },
  {
    countryCode: 'CO',
    countryNameEn: 'Colombia',
    languages: [{ code: 'es', nameEn: 'Spanish', native: 'Español' }],
  },
  {
    countryCode: 'ES',
    countryNameEn: 'Spain',
    languages: [
      { code: 'es', nameEn: 'Spanish', native: 'Español' },
      // Catalan / Galician dropped
    ],
  },
];

function languageBase(code: string): ClaudeSupportedLanguage | null {
  const lower = code.toLowerCase();
  if (lower.startsWith('zh')) return isClaudeSupportedLanguage('zh') ? 'zh' : null;
  const base = lower.split('-')[0] || '';
  return isClaudeSupportedLanguage(base) ? base : null;
}

function cultureId(langCode: string, countryCode: string): string {
  if (langCode.toLowerCase().startsWith('zh')) {
    return `zh-Hans-${countryCode}`;
  }
  const base = langCode.split('-')[0] || langCode;
  return `${base}-${countryCode}`;
}

function buildCultures(): CultureDefinition[] {
  const out: CultureDefinition[] = [];
  for (const nation of NATION_WRITTEN_LANGUAGES) {
    for (const lang of nation.languages) {
      const claudeLang = languageBase(lang.code);
      if (!claudeLang) continue;
      const id = cultureId(lang.code, nation.countryCode);
      const dir: 'ltr' | 'rtl' = claudeLang === 'ar' ? 'rtl' : 'ltr';
      const fallbackLng =
        claudeLang === 'zh'
          ? [id, 'zh-Hans', 'en-US']
          : [id, claudeLang, 'en-US'];
      out.push({
        id,
        countryCode: nation.countryCode,
        countryNameEn: nation.countryNameEn,
        language: claudeLang,
        languageNameEn: CLAUDE_LANGUAGE_PROMPT_NAMES[claudeLang],
        nativeLabel: lang.native,
        labelEn: `${lang.nameEn} (${nation.countryNameEn})`,
        dir,
        fallbackLng,
      });
    }
  }
  // Stable sort: English label
  return out.sort((a, b) => a.labelEn.localeCompare(b.labelEn, 'en'));
}

export const SUPPORTED_CULTURES: readonly CultureDefinition[] = buildCultures();

export const DEFAULT_CULTURE_ID = 'en-US';

export const AUTO_CULTURE_VALUE = 'auto';

export function getCultureById(id: string): CultureDefinition | undefined {
  return SUPPORTED_CULTURES.find((c) => c.id === id);
}

export function cultureLanguagePromptName(cultureId: string): string {
  const c = getCultureById(cultureId) || getCultureById(DEFAULT_CULTURE_ID)!;
  return CLAUDE_LANGUAGE_PROMPT_NAMES[c.language];
}

/**
 * Match browser locale tags to the closest supported culture.
 * Prefers exact BCP 47, then language+region, then language-only defaults.
 */
export function resolveCultureFromBrowser(
  browserTags: readonly string[],
  supported: readonly CultureDefinition[] = SUPPORTED_CULTURES
): string {
  const normalized = browserTags
    .map((t) => t.trim().replace(/_/g, '-'))
    .filter(Boolean);
  if (!normalized.length) return DEFAULT_CULTURE_ID;

  const byId = new Map(supported.map((c) => [c.id.toLowerCase(), c.id]));

  for (const tag of normalized) {
    const lower = tag.toLowerCase();
    if (byId.has(lower)) return byId.get(lower)!;
    // zh-CN → zh-Hans-CN
    if (lower.startsWith('zh')) {
      const region = lower.split('-')[1]?.toUpperCase();
      const hans = region ? `zh-Hans-${region}` : 'zh-Hans-CN';
      if (byId.has(hans.toLowerCase())) return byId.get(hans.toLowerCase())!;
      const anyZh = supported.find((c) => c.language === 'zh');
      if (anyZh) return anyZh.id;
    }
  }

  for (const tag of normalized) {
    const parts = tag.toLowerCase().split('-');
    const lang = parts[0] || '';
    const region = parts[1]?.toUpperCase();
    if (lang && region) {
      const candidate = `${lang}-${region}`.toLowerCase();
      if (byId.has(candidate)) return byId.get(candidate)!;
    }
  }

  // Language-only: prefer a canonical region per language
  const languageDefaults: Record<string, string> = {
    en: 'en-US',
    es: 'es-MX',
    pt: 'pt-BR',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    id: 'id-ID',
    ja: 'ja-JP',
    ko: 'ko-KR',
    hi: 'hi-IN',
    bn: 'bn-IN',
    ar: 'ar-EG',
    sw: 'sw-KE',
    yo: 'yo-NG',
    zh: 'zh-Hans-CN',
  };

  for (const tag of normalized) {
    const lang = tag.toLowerCase().split('-')[0] || '';
    const preferred = languageDefaults[lang];
    if (preferred && byId.has(preferred.toLowerCase())) {
      return byId.get(preferred.toLowerCase())!;
    }
    const any = supported.find((c) => c.language === lang || (lang === 'zh' && c.language === 'zh'));
    if (any) return any.id;
  }

  return DEFAULT_CULTURE_ID;
}

export function readBrowserLanguageTags(
  nav: { language?: string; languages?: readonly string[] } = typeof navigator !== 'undefined'
    ? navigator
    : {}
): string[] {
  if (nav.languages?.length) return [...nav.languages];
  if (nav.language) return [nav.language];
  return [];
}

/** Resolve effective culture from config preference + browser. */
export function resolveEffectiveCulture(uiCulture: string | undefined | null): string {
  const raw = (uiCulture || AUTO_CULTURE_VALUE).trim();
  if (!raw || raw === AUTO_CULTURE_VALUE) {
    return resolveCultureFromBrowser(readBrowserLanguageTags());
  }
  if (getCultureById(raw)) return raw;
  return resolveCultureFromBrowser([raw, ...readBrowserLanguageTags()]);
}

export function filterCultures(query: string): CultureDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SUPPORTED_CULTURES];
  return SUPPORTED_CULTURES.filter((c) => {
    const hay = `${c.labelEn} ${c.nativeLabel} ${c.countryNameEn} ${c.languageNameEn} ${c.id}`.toLowerCase();
    return hay.includes(q);
  });
}
