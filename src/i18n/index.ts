/**
 * i18next bootstrap for JobLens React surfaces.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_CULTURE_ID,
  getCultureById,
  resolveEffectiveCulture,
  type CultureDefinition,
} from './cultures';

import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import id from './locales/id.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhHans from './locales/zh-Hans.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import ar from './locales/ar.json';
import sw from './locales/sw.json';
import yo from './locales/yo.json';

export const i18nResources = {
  'en-US': { translation: enUS },
  'en-GB': { translation: enGB },
  en: { translation: enUS },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  pt: { translation: ptBR },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  id: { translation: id },
  ja: { translation: ja },
  ko: { translation: ko },
  'zh-Hans': { translation: zhHans },
  zh: { translation: zhHans },
  hi: { translation: hi },
  bn: { translation: bn },
  ar: { translation: ar },
  sw: { translation: sw },
  yo: { translation: yo },
} as const;

let initialized = false;

export function ensureI18n(): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources: i18nResources,
      lng: DEFAULT_CULTURE_ID,
      fallbackLng: {
        default: ['en-US'],
        'en-GB': ['en-US'],
        'en-IN': ['en-GB', 'en-US'],
        'en-ID': ['en-US'],
        'en-PK': ['en-GB', 'en-US'],
        'en-NG': ['en-GB', 'en-US'],
        'en-BD': ['en-GB', 'en-US'],
        'en-ET': ['en-US'],
        'en-PH': ['en-US'],
        'en-TZ': ['en-GB', 'en-US'],
        'en-ZA': ['en-GB', 'en-US'],
        'en-KE': ['en-GB', 'en-US'],
        'es-US': ['es', 'en-US'],
        'es-MX': ['es', 'en-US'],
        'es-CO': ['es', 'en-US'],
        'es-ES': ['es', 'en-US'],
        'zh-Hans-CN': ['zh-Hans', 'en-US'],
        'zh-Hans-US': ['zh-Hans', 'en-US'],
        'pt-BR': ['pt', 'en-US'],
        'fr-FR': ['fr', 'en-US'],
        'fr-CD': ['fr', 'en-US'],
        'de-DE': ['de', 'en-US'],
        'it-IT': ['it', 'en-US'],
        'id-ID': ['id', 'en-US'],
        'ja-JP': ['ja', 'en-US'],
        'ko-KR': ['ko', 'en-US'],
        'hi-IN': ['hi', 'en-US'],
        'bn-IN': ['bn', 'en-US'],
        'bn-BD': ['bn', 'en-US'],
        'ar-EG': ['ar', 'en-US'],
        'sw-TZ': ['sw', 'en-US'],
        'sw-KE': ['sw', 'en-US'],
        'sw-CD': ['sw', 'en-US'],
        'yo-NG': ['yo', 'en-US'],
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    initialized = true;
  }
  return i18n;
}

export function applyDocumentDirection(cultureId: string, root: HTMLElement = document.documentElement): void {
  const culture = getCultureById(cultureId) || getCultureById(DEFAULT_CULTURE_ID)!;
  root.setAttribute('lang', cultureId);
  root.setAttribute('dir', culture.dir);
}

export async function applyUiCulture(uiCulturePref: string | undefined | null): Promise<CultureDefinition> {
  const i18next = ensureI18n();
  const effective = resolveEffectiveCulture(uiCulturePref);
  const culture = getCultureById(effective) || getCultureById(DEFAULT_CULTURE_ID)!;
  await i18next.changeLanguage(culture.id);
  applyDocumentDirection(culture.id);
  return culture;
}

export { i18n };
