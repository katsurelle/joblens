/**
 * Background message pipeline (testable; no chrome listener side effects).
 */

import { z } from 'zod';
import { getConfig, hasGeoIntent } from './storage';
import { callClaude, parseJsonResponse } from './anthropic';
import {
  EXTRACTION_SYSTEM,
  buildExtractionUser,
  ANALYSIS_SYSTEM,
  buildAnalysisUser,
  CONFIG_PROPOSE_SYSTEM,
  buildConfigProposeUser,
  PREFLIGHT_SYSTEM,
  buildPreflightUser,
  buildPreflightHardGates,
} from './prompts';
import { applyDeterministicGeo, computeDeterministicGeo } from './geo';
import { applyRatingFloors } from './ratings';
import { boardCountryHint } from './boards';
import {
  mergePreflightResults,
  runLocalPreflight,
  shouldSkipHaiku,
  truncateForPreflight,
  sanitizeHaikuResidencySkip,
  sanitizeHaikuCitizenshipSkip,
  enforceClearancePolicy,
  humanizePreflightReasons,
} from './preflight';
import { PREFLIGHT_CLAUDE_MODEL } from './settingsOptions';
import { parseConfigProposal, sanitizeConfigForPropose } from './docImport';
import {
  AnalyzeJdRequestSchema,
  ExtractSkillsRequestSchema,
  ProposeConfigFromDocsRequestSchema,
  PreflightJdRequestSchema,
  parseAnalysisPayload,
  parseExtractedSkills,
  parsePreflightPayload,
  type AnalyzeJdSuccessData,
  type ExtractSkillsSuccessData,
  type PreflightJdSuccessData,
  type ProposeConfigFromDocsSuccessData,
} from '../types/messages';

const BackgroundRequestSchema = z.discriminatedUnion('type', [
  ExtractSkillsRequestSchema,
  AnalyzeJdRequestSchema,
  ProposeConfigFromDocsRequestSchema,
  PreflightJdRequestSchema,
]);

export type BackgroundHandleResult =
  | ExtractSkillsSuccessData
  | AnalyzeJdSuccessData
  | ProposeConfigFromDocsSuccessData
  | PreflightJdSuccessData;

async function handleExtractSkills(
  cfg: Awaited<ReturnType<typeof getConfig>>,
  msg: z.infer<typeof ExtractSkillsRequestSchema>
): Promise<ExtractSkillsSuccessData> {
  const text = await callClaude({
    apiKey: cfg.apiKey,
    model: cfg.model,
    system: EXTRACTION_SYSTEM,
    user: buildExtractionUser(msg.workHistory ?? cfg.workHistory),
    maxTokens: 8192,
    thinking: 'disabled',
  });
  return { skills: parseExtractedSkills(parseJsonResponse(text)) };
}

async function handleProposeConfig(
  cfg: Awaited<ReturnType<typeof getConfig>>,
  msg: z.infer<typeof ProposeConfigFromDocsRequestSchema>
): Promise<ProposeConfigFromDocsSuccessData> {
  const text = await callClaude({
    apiKey: cfg.apiKey,
    model: cfg.model,
    system: CONFIG_PROPOSE_SYSTEM,
    user: buildConfigProposeUser({
      documentText: msg.documentText,
      truncated: Boolean(msg.truncated),
      currentConfigJson: JSON.stringify(sanitizeConfigForPropose(cfg), null, 2),
    }),
    maxTokens: 12288,
    thinking: 'disabled',
  });
  return parseConfigProposal(parseJsonResponse(text));
}

async function handlePreflightJd(
  cfg: Awaited<ReturnType<typeof getConfig>>,
  msg: z.infer<typeof PreflightJdRequestSchema>
): Promise<PreflightJdSuccessData> {
  if (!cfg.apiKey.trim()) {
    throw new Error('Add an Anthropic API key in Options before preflight.');
  }
  if (!hasGeoIntent(cfg)) {
    throw new Error(
      'Set geography intent in Options (postal code, region, or remote-only) before preflight.'
    );
  }

  const countryHint = boardCountryHint(msg.url || '');
  const pageText = msg.pageText || '';
  const local = runLocalPreflight({
    cfg,
    pageText,
    pageTitle: msg.pageTitle || '',
    countryHint,
  });

  const forceHaiku = Boolean(msg.forceHaiku);
  const localResponse = (): PreflightJdSuccessData => ({
    preflight: { ...local, reasons: humanizePreflightReasons(local.reasons) },
  });
  // Local hard_skip is decisive; hybrid stays local until Quick check forces Haiku.
  if (local.verdict === 'hard_skip') return localResponse();
  if (!forceHaiku && cfg.preflightMode === 'hybrid') return localResponse();
  if (!forceHaiku && shouldSkipHaiku(local, cfg)) return localResponse();

  const truncated = truncateForPreflight(pageText);
  const text = await callClaude({
    apiKey: cfg.apiKey,
    model: PREFLIGHT_CLAUDE_MODEL,
    system: PREFLIGHT_SYSTEM,
    user: buildPreflightUser({
      hardGatesJson: JSON.stringify(buildPreflightHardGates(cfg), null, 2),
      url: msg.url,
      pageText: truncated,
      localHintJson: JSON.stringify(local),
      uiCulture: cfg.uiCulture,
    }),
    maxTokens: 1024,
    thinking: 'disabled',
  });
  const haiku = parsePreflightPayload(parseJsonResponse(text));
  const merged = mergePreflightResults(local, haiku);
  const sanitized = sanitizeHaikuResidencySkip(merged, pageText, {
    local,
    workEligibleRegions: cfg.workEligibleRegions,
    homeCountry: cfg.homeCountry,
  });
  const citizenshipOk = sanitizeHaikuCitizenshipSkip(
    sanitized,
    pageText,
    cfg.workAuthorizationNote || '',
    cfg.homeCountry
  );
  const enforced = enforceClearancePolicy(citizenshipOk, cfg, pageText);
  return {
    preflight: {
      ...enforced,
      reasons: humanizePreflightReasons(enforced.reasons),
    },
  };
}

async function handleAnalyzeJd(
  cfg: Awaited<ReturnType<typeof getConfig>>,
  msg: z.infer<typeof AnalyzeJdRequestSchema>
): Promise<AnalyzeJdSuccessData> {
  const countryHint = boardCountryHint(msg.url || '');
  const geoHint = computeDeterministicGeo({
    locations: cfg.locations,
    pageText: msg.pageText || '',
    homeCountry: cfg.homeCountry,
    countryHint,
  });
  const text = await callClaude({
    apiKey: cfg.apiKey,
    model: cfg.model,
    system: ANALYSIS_SYSTEM,
    user: buildAnalysisUser({
      profile: cfg,
      url: msg.url,
      pageText: msg.pageText,
      geoHint,
    }),
    maxTokens: 16384,
    thinking: 'adaptive',
    effort: 'medium',
  });
  let analysis = parseAnalysisPayload(parseJsonResponse(text));
  analysis = applyDeterministicGeo(analysis, {
    locations: cfg.locations,
    pageText: msg.pageText || '',
    homeCountry: cfg.homeCountry,
    countryHint,
  });
  analysis = applyRatingFloors(analysis, cfg);
  return { analysis };
}

export async function handleBackgroundRequest(raw: unknown): Promise<BackgroundHandleResult> {
  const parsed = BackgroundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Unknown or invalid message: ${parsed.error.message}`);
  }
  const msg = parsed.data;
  const cfg = await getConfig();

  if (msg.type === 'EXTRACT_SKILLS') return handleExtractSkills(cfg, msg);
  if (msg.type === 'PROPOSE_CONFIG_FROM_DOCS') return handleProposeConfig(cfg, msg);
  if (msg.type === 'PREFLIGHT_JD') return handlePreflightJd(cfg, msg);
  return handleAnalyzeJd(cfg, msg);
}
