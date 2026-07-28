import {
  cultureLanguagePromptName,
  getCultureById,
  resolveEffectiveCulture,
  DEFAULT_CULTURE_ID,
} from './cultures';

export type ResponseLocaleContext = {
  cultureId: string;
  languageName: string;
  dir: 'ltr' | 'rtl';
};

export function responseLocaleFromConfig(uiCulture: string | undefined | null): ResponseLocaleContext {
  const cultureId = resolveEffectiveCulture(uiCulture);
  const culture = getCultureById(cultureId) || getCultureById(DEFAULT_CULTURE_ID)!;
  return {
    cultureId: culture.id,
    languageName: cultureLanguagePromptName(culture.id),
    dir: culture.dir,
  };
}

/** Stable instruction block for Claude system/user prompts. */
export function buildResponseLocaleInstruction(ctx: ResponseLocaleContext): string {
  return [
    `UI_CULTURE: ${ctx.cultureId} (${ctx.dir})`,
    `RESPONSE_LANGUAGE: ${ctx.languageName}`,
    `Write all human-readable strings in ${ctx.languageName} (skill evidence, reasons, rationales, declutteredJD, postingSmell, geo.reason, skip evidence).`,
    `Keep JSON keys and enumerated machine values exactly in English as specified by the schema (e.g. fit.label, apply.verdict, workModel, skillMatches.status, geo.verdict).`,
  ].join('\n');
}
