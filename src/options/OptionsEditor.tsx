import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { setConfig } from '../lib/storage';
import { extractSkills, proposeConfigFromDocs } from '../lib/messaging';
import { extractTextsFromFiles, type ConfigProposal, type ConfigProposalChange } from '../lib/docImport';
import type {
  Config,
  EmploymentPriority,
  Location,
  Preferences,
  SkillClaim,
  WorkHistoryEntry,
} from '../types/domain';
import { DEFAULT_PREFERENCES } from '../types/domain';
import { applyTheme } from '../lib/theme';
import { ImportDocsSection } from './ImportDocsSection';
import { OptionsTabBody, isEducationKnown, resolveModelIds } from './OptionsTabBody';
import {
  TAB_IDS,
  TAB_LABEL_KEYS,
  applySelectedProposalChanges,
  buildConfigForSave,
  buildProposalResult,
  mergeExtractSkillsForConfig,
  moveEmploymentInList,
  resolveModelValue,
  syncProficienciesFromClaims,
  textsFromConfig,
  toggleEmploymentPriorityList,
  toggleSetMembership,
  ensureLocationIds,
  ensureSkillClaimIds,
  ensureWorkHistoryIds,
  newEmptyLocation,
  newEmptySkillClaim,
  newEmptyWorkHistoryEntry,
  unknownErrorMessage,
  type OptionsTab,
} from './optionsHelpers';

export interface OptionsEditorProps {
  initialCfg: Config;
}

export function OptionsEditor({ initialCfg }: Readonly<OptionsEditorProps>): JSX.Element {
  const { t, i18n } = useTranslation();
  const initialTexts = textsFromConfig(initialCfg);

  const [cfg, setCfg] = useState(() => ({
    ...initialCfg,
    locations: ensureLocationIds(initialCfg.locations),
    skillClaims: ensureSkillClaimIds(initialCfg.skillClaims),
    workHistory: ensureWorkHistoryIds(initialCfg.workHistory),
  }));
  const [status, setStatus] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deficienciesText, setDeficienciesText] = useState(initialTexts.deficienciesText);
  const [skipTriggersText, setSkipTriggersText] = useState(initialTexts.skipTriggersText);
  const [blockedEmployersText, setBlockedEmployersText] = useState(
    initialTexts.blockedEmployersText
  );
  const [workEligibleRegionsText, setWorkEligibleRegionsText] = useState(
    initialTexts.workEligibleRegionsText
  );
  const [activeTab, setActiveTab] = useState<OptionsTab>('basics');
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<ConfigProposal | null>(null);
  const [selectedChangeIds, setSelectedChangeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const prefs: Preferences = cfg.preferences ?? DEFAULT_PREFERENCES;
  const markDirty = (): void => setDirty(true);

  const patch = (p: Partial<Config>): void => {
    setCfg({ ...cfg, ...p });
    if (p.theme) applyTheme(p.theme);
    markDirty();
  };

  const patchPrefs = (p: Partial<Preferences>): void => {
    const nextPrefs = { ...prefs, ...p };
    patch({
      preferences: nextPrefs,
      ...(typeof p.flagPermNotices === 'boolean' ? { flagPermNotices: p.flagPermNotices } : {}),
    });
  };

  const modelIds = resolveModelIds();
  const modelValue = resolveModelValue(cfg.model);
  const educationKnown = isEducationKnown(cfg.education);

  const addJob = (): void =>
    patch({
      workHistory: [...cfg.workHistory, newEmptyWorkHistoryEntry()],
    });

  const setJob = <K extends keyof WorkHistoryEntry>(
    i: number,
    k: K,
    v: WorkHistoryEntry[K]
  ): void => {
    const wh = cfg.workHistory.slice();
    const current = wh[i];
    if (!current) return;
    wh[i] = { ...current, [k]: v };
    patch({ workHistory: wh });
  };

  const rmJob = (i: number): void =>
    patch({ workHistory: cfg.workHistory.filter((_, j) => j !== i) });

  const addLoc = (): void =>
    patch({ locations: [...cfg.locations, newEmptyLocation(cfg.homeCountry || 'US')] });

  const setLoc = <K extends keyof Location>(i: number, k: K, v: Location[K]): void => {
    const l = cfg.locations.slice();
    const current = l[i];
    if (!current) return;
    l[i] = { ...current, [k]: v };
    patch({ locations: l });
  };

  const rmLoc = (i: number): void =>
    patch({ locations: cfg.locations.filter((_, j) => j !== i) });

  const setClaim = <K extends keyof SkillClaim>(i: number, k: K, v: SkillClaim[K]): void => {
    const rows = cfg.skillClaims.slice();
    const current = rows[i];
    if (!current) return;
    rows[i] = { ...current, [k]: v };
    patch({ skillClaims: rows, proficiencies: syncProficienciesFromClaims(rows) });
  };

  const rmClaim = (i: number): void => {
    const rows = cfg.skillClaims.filter((_, j) => j !== i);
    patch({ skillClaims: rows, proficiencies: syncProficienciesFromClaims(rows) });
  };

  const addClaim = (): void => {
    patch({ skillClaims: [...cfg.skillClaims, newEmptySkillClaim()] });
  };

  const toggleEmploymentPriority = (id: EmploymentPriority): void => {
    patchPrefs({ employmentPriority: toggleEmploymentPriorityList(prefs.employmentPriority, id) });
  };

  const moveEmployment = (id: EmploymentPriority, dir: -1 | 1): void => {
    const next = moveEmploymentInList(prefs.employmentPriority, id, dir);
    if (next) patchPrefs({ employmentPriority: next });
  };

  const runExtract = async (): Promise<void> => {
    setExtracting(true);
    setStatus(t('options.statusExtractingSkills'));
    const res = await extractSkills({ workHistory: cfg.workHistory });
    setExtracting(false);
    if (!res.ok) {
      setStatus(t('options.statusExtractFailed', { error: res.error }));
      return;
    }

    const { skillClaims, claimAdds, found } = mergeExtractSkillsForConfig(cfg, res.data.skills);
    patch({
      skillClaims,
      proficiencies: syncProficienciesFromClaims(skillClaims),
    });
    setStatus(
      t('options.statusMergedSkills', {
        added: claimAdds.length,
        found,
      })
    );
  };

  const syncTextsFromConfig = (c: Config): void => {
    const texts = textsFromConfig(c);
    setDeficienciesText(texts.deficienciesText);
    setSkipTriggersText(texts.skipTriggersText);
    setBlockedEmployersText(texts.blockedEmployersText);
    setWorkEligibleRegionsText(texts.workEligibleRegionsText);
  };

  const runProposeFromDocs = async (): Promise<void> => {
    if (!docFiles.length) {
      setStatus(t('options.statusChooseFiles'));
      return;
    }
    setProposing(true);
    setStatus(t('options.statusExtractingText'));
    try {
      const bundle = await extractTextsFromFiles(docFiles);
      setStatus(
        bundle.truncated ? t('options.statusTruncatedPropose') : t('options.statusProposing')
      );
      const res = await proposeConfigFromDocs({
        documentText: bundle.text,
        truncated: bundle.truncated,
      });
      if (!res.ok) {
        setStatus(t('options.statusProposeFailed', { error: res.error }));
        setProposing(false);
        return;
      }
      const result = buildProposalResult(res.data as { summary?: string; changes: ConfigProposalChange[] });
      setProposal(result.proposal);
      setSelectedChangeIds(result.selectedChangeIds);
      setStatus(t(result.statusKey, result.statusParams));
    } catch (err: unknown) {
      setStatus(t('options.statusImportFailed', { error: unknownErrorMessage(err) }));
    }
    setProposing(false);
  };

  const toggleChangeSelected = (id: string): void => {
    setSelectedChangeIds((prev) => toggleSetMembership(prev, id));
  };

  const applySelectedProposal = (): void => {
    if (!proposal) return;
    const next = applySelectedProposalChanges(cfg, proposal, selectedChangeIds);
    if (!next) {
      setStatus(t('options.statusSelectChange'));
      return;
    }
    const selectedCount = proposal.changes.filter((c) => selectedChangeIds.has(c.id)).length;
    setCfg({
      ...next,
      locations: ensureLocationIds(next.locations),
      skillClaims: ensureSkillClaimIds(next.skillClaims),
      workHistory: ensureWorkHistoryIds(next.workHistory),
    });
    syncTextsFromConfig(next);
    markDirty();
    setProposal(null);
    setSelectedChangeIds(new Set());
    setStatus(t('options.statusApplied', { count: selectedCount }));
  };

  const discardProposal = (): void => {
    setProposal(null);
    setSelectedChangeIds(new Set());
    setStatus(t('options.statusDiscarded'));
  };

  const save = async (): Promise<void> => {
    const toSave = buildConfigForSave(cfg, {
      deficienciesText,
      skipTriggersText,
      blockedEmployersText,
      workEligibleRegionsText,
    });
    await setConfig(toSave);
    setCfg(toSave);
    syncTextsFromConfig(toSave);
    setDirty(false);
    setStatus(t('options.saved'));
    setTimeout(() => setStatus(''), 2000);
  };

  const onTextChange =
    (setter: (v: string) => void) =>
    (value: string): void => {
      setter(value);
      markDirty();
    };

  return (
    <div className="wrap" dir={i18n.dir()}>
      <h1 className="page-title">
        <img className="brand-mark" src="/icons/icon48.png" width={28} height={28} alt="" />
        {t('options.pageTitle')}
      </h1>

      <ImportDocsSection
        t={t}
        docFiles={docFiles}
        onDocFilesChange={setDocFiles}
        proposing={proposing}
        onPropose={() => void runProposeFromDocs()}
        proposal={proposal}
        selectedChangeIds={selectedChangeIds}
        onToggleChangeSelected={toggleChangeSelected}
        onApplySelected={applySelectedProposal}
        onDiscard={discardProposal}
      />

      <div className="tabs" role="tablist" aria-label={t('options.tabsAria')}>
        {TAB_IDS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={activeTab === tabId}
            className={`tab${activeTab === tabId ? ' active' : ''}`}
            onClick={() => setActiveTab(tabId)}
          >
            {t(TAB_LABEL_KEYS[tabId])}
          </button>
        ))}
      </div>

      <OptionsTabBody
        activeTab={activeTab}
        t={t}
        cfg={cfg}
        prefs={prefs}
        modelValue={modelValue}
        modelIds={modelIds}
        educationKnown={educationKnown}
        patch={patch}
        patchPrefs={patchPrefs}
        workEligibleRegionsText={workEligibleRegionsText}
        onWorkEligibleRegionsChange={onTextChange(setWorkEligibleRegionsText)}
        setLoc={setLoc}
        rmLoc={rmLoc}
        addLoc={addLoc}
        deficienciesText={deficienciesText}
        onDeficienciesChange={onTextChange(setDeficienciesText)}
        setClaim={setClaim}
        rmClaim={rmClaim}
        addClaim={addClaim}
        setJob={setJob}
        rmJob={rmJob}
        addJob={addJob}
        onExtract={() => void runExtract()}
        extracting={extracting}
        blockedEmployersText={blockedEmployersText}
        onBlockedEmployersChange={onTextChange(setBlockedEmployersText)}
        skipTriggersText={skipTriggersText}
        onSkipTriggersChange={onTextChange(setSkipTriggersText)}
        toggleEmploymentPriority={toggleEmploymentPriority}
        moveEmployment={moveEmployment}
      />

      <div className="savebar">
        <button className="save" type="button" onClick={() => void save()} disabled={!dirty}>
          {t('options.saveSettings')}
        </button>
        <span className={`status${dirty ? ' dirty' : ''}`}>
          {dirty ? t('options.unsaved') : status}
        </span>
      </div>
    </div>
  );
}
