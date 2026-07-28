import { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { getConfig, setConfig } from '../lib/storage';
import { extractSkills, proposeConfigFromDocs } from '../lib/messaging';
import {
  applyConfigProposalChanges,
  extractTextsFromFiles,
  type ConfigProposal,
  type ConfigProposalChange,
} from '../lib/docImport';
import {
  CLAUDE_MODELS,
  DEFAULT_CLAUDE_MODEL,
  EDUCATION_LEVELS,
  EMPLOYMENT_PRIORITY_OPTIONS,
  OCCASIONAL_TRAVEL_OPTIONS,
  PREFLIGHT_MODE_OPTIONS,
  SKIP_CATEGORY_OPTIONS,
} from '../lib/settingsOptions';
import type {
  ClearancePolicy,
  CompensationMode,
  Config,
  EmploymentPriority,
  Location,
  OccasionalTravelAllowance,
  PipelineLoad,
  Preferences,
  RemotePreference,
  SkillClaim,
  SkillStanding,
  ThemePreference,
  WorkHistoryEntry,
} from '../types/domain';
import { DEFAULT_PREFERENCES, DEFAULT_ROLE_SKIP_CATEGORIES } from '../types/domain';
import { watchThemeFromConfig, applyTheme } from '../lib/theme';
import { applyUiCulture, ensureI18n, i18n } from '../i18n';
import { CulturePicker } from '../i18n/CulturePicker';
import { AUTO_CULTURE_VALUE } from '../i18n/cultures';
import { parseCommaList, parseNewlineList } from '../lib/listParse';
import { I18nextProvider, useTranslation } from 'react-i18next';
import './options.css';

type OptionsTab = 'basics' | 'geography' | 'skills' | 'preferences';

const TAB_IDS: OptionsTab[] = ['basics', 'geography', 'skills', 'preferences'];

const TAB_LABEL_KEYS: Record<OptionsTab, string> = {
  basics: 'options.basics',
  geography: 'options.geography',
  skills: 'options.skills',
  preferences: 'options.preferences',
};

const THEME_OPTIONS: Array<{ id: ThemePreference; labelKey: string }> = [
  { id: 'default', labelKey: 'theme.default' },
  { id: 'light', labelKey: 'theme.light' },
  { id: 'dark', labelKey: 'theme.dark' },
];

const parseLines = parseNewlineList;

function syncProficienciesFromClaims(claims: SkillClaim[]): string[] {
  return claims.filter((c) => c.standing === 'held' && c.skill.trim()).map((c) => c.skill.trim());
}

function Options(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [status, setStatus] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deficienciesText, setDeficienciesText] = useState('');
  const [skipTriggersText, setSkipTriggersText] = useState('');
  const [blockedEmployersText, setBlockedEmployersText] = useState('');
  const [workEligibleRegionsText, setWorkEligibleRegionsText] = useState('');
  const [activeTab, setActiveTab] = useState<OptionsTab>('basics');
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<ConfigProposal | null>(null);
  const [selectedChangeIds, setSelectedChangeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getConfig().then(async (c) => {
      setCfg(c);
      setDeficienciesText(c.deficiencies.join('\n'));
      setSkipTriggersText(c.skipTriggers.join('\n'));
      setBlockedEmployersText((c.preferences?.blockedEmployers ?? []).join('\n'));
      setWorkEligibleRegionsText(c.workEligibleRegions.join(', '));
      await applyUiCulture(c.uiCulture);
      setDirty(false);
    });
  }, []);

  useEffect(() => watchThemeFromConfig(), []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (!cfg) return <div className="wrap">{t('options.loading')}</div>;

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
      ...(typeof p.flagPermNotices === 'boolean'
        ? { flagPermNotices: p.flagPermNotices }
        : {}),
    });
  };

  const modelIds = new Set(CLAUDE_MODELS.map((m) => m.id));
  const modelValue = modelIds.has(cfg.model) ? cfg.model : DEFAULT_CLAUDE_MODEL;
  const educationKnown = EDUCATION_LEVELS.includes(cfg.education);

  const addJob = (): void =>
    patch({
      workHistory: [
        ...cfg.workHistory,
        { org: '', title: '', start: '', end: '', description: '' },
      ],
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
    patch({ locations: [...cfg.locations, { zip: '', radiusMiles: 25 }] });

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
    const rows = [
      ...cfg.skillClaims,
      { skill: '', standing: 'held' as const, years: undefined, lastUsed: '', scopeNote: '' },
    ];
    patch({ skillClaims: rows });
  };

  const toggleEmploymentPriority = (id: EmploymentPriority): void => {
    const list = prefs.employmentPriority.slice();
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);
    patchPrefs({ employmentPriority: list });
  };

  const moveEmployment = (id: EmploymentPriority, dir: -1 | 1): void => {
    const list = prefs.employmentPriority.slice();
    const idx = list.indexOf(id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= list.length) return;
    const a = list[idx]!;
    const b = list[next]!;
    list[idx] = b;
    list[next] = a;
    patchPrefs({ employmentPriority: list });
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

    const claimKeys = new Set(cfg.skillClaims.map((c) => c.skill.toLowerCase()));
    const claimAdds: SkillClaim[] = res.data.skills
      .filter((s) => s.skill && !claimKeys.has(s.skill.toLowerCase()))
      .map((s) => ({
        skill: s.skill,
        standing: 'held' as const,
        years: s.years,
        confidence: s.confidence,
        scopeNote: s.source,
      }));
    const skillClaims = [...cfg.skillClaims, ...claimAdds];

    patch({
      skillClaims,
      proficiencies: syncProficienciesFromClaims(skillClaims),
    });
    setStatus(
      t('options.statusMergedSkills', {
        added: claimAdds.length,
        found: res.data.skills.length,
      })
    );
  };

  const syncTextsFromConfig = (c: Config): void => {
    setDeficienciesText(c.deficiencies.join('\n'));
    setSkipTriggersText(c.skipTriggers.join('\n'));
    setBlockedEmployersText((c.preferences?.blockedEmployers ?? []).join('\n'));
    setWorkEligibleRegionsText(c.workEligibleRegions.join(', '));
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
      const nextProposal: ConfigProposal = {
        summary: res.data.summary || '',
        changes: res.data.changes as ConfigProposalChange[],
      };
      setProposal(nextProposal);
      setSelectedChangeIds(new Set(nextProposal.changes.map((c) => c.id)));
      setStatus(
        nextProposal.changes.length
          ? t('options.statusProposed', { count: nextProposal.changes.length })
          : t('options.statusNoProposed')
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(t('options.statusImportFailed', { error: message }));
    }
    setProposing(false);
  };

  const toggleChangeSelected = (id: string): void => {
    setSelectedChangeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelectedProposal = (): void => {
    if (!proposal) return;
    const selected = proposal.changes.filter((c) => selectedChangeIds.has(c.id));
    if (!selected.length) {
      setStatus(t('options.statusSelectChange'));
      return;
    }
    const next = applyConfigProposalChanges(cfg, selected);
    setCfg(next);
    syncTextsFromConfig(next);
    markDirty();
    setProposal(null);
    setSelectedChangeIds(new Set());
    setStatus(t('options.statusApplied', { count: selected.length }));
  };

  const discardProposal = (): void => {
    setProposal(null);
    setSelectedChangeIds(new Set());
    setStatus(t('options.statusDiscarded'));
  };

  const save = async (): Promise<void> => {
    const skillClaims = cfg.skillClaims.filter((c) => c.skill.trim());
    const blockedEmployers = parseLines(blockedEmployersText);
    const toSave: Config = {
      ...cfg,
      model: modelValue,
      deficiencies: parseLines(deficienciesText),
      skipTriggers: parseLines(skipTriggersText),
      workEligibleRegions: parseCommaList(workEligibleRegionsText),
      skillClaims,
      proficiencies: syncProficienciesFromClaims(skillClaims),
      preferences: {
        ...prefs,
        blockedEmployers,
      },
      flagPermNotices: prefs.flagPermNotices,
    };
    await setConfig(toSave);
    setCfg(toSave);
    setDeficienciesText(toSave.deficiencies.join('\n'));
    setSkipTriggersText(toSave.skipTriggers.join('\n'));
    setBlockedEmployersText(toSave.preferences.blockedEmployers.join('\n'));
    setWorkEligibleRegionsText(toSave.workEligibleRegions.join(', '));
    setDirty(false);
    setStatus(t('options.saved'));
    setTimeout(() => setStatus(''), 2000);
  };

  return (
    <div className="wrap" dir={i18n.dir()}>
      <h1 className="page-title">
        <img className="brand-mark" src="/icons/icon48.png" width={28} height={28} alt="" />
        {t('options.pageTitle')}
      </h1>

      <section className="import-box">
        <h2>{t('options.importTitle')}</h2>
        <p className="note">{t('options.importHint')}</p>
        <label>
          {t('options.files')}
          <input
            type="file"
            multiple
            accept=".txt,.md,.pdf,.docx"
            onChange={(e) => setDocFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {docFiles.length ? (
          <p className="note">
            {t('options.selectedFiles', { names: docFiles.map((f) => f.name).join(', ') })}
          </p>
        ) : null}
        <button
          className="primary"
          type="button"
          onClick={() => void runProposeFromDocs()}
          disabled={proposing || !docFiles.length}
        >
          {proposing ? t('options.proposing') : t('options.proposeFromDocs')}
        </button>

        {proposal ? (
          <div className="proposal">
            {proposal.summary ? <p className="proposal-summary">{proposal.summary}</p> : null}
            {proposal.changes.length === 0 ? (
              <p className="note">{t('options.noProposalChanges')}</p>
            ) : (
              <ul className="proposal-list">
                {proposal.changes.map((change) => (
                  <li key={change.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={selectedChangeIds.has(change.id)}
                        onChange={() => toggleChangeSelected(change.id)}
                      />
                      <span>
                        <strong>{change.label}</strong>
                        {change.rationale ? (
                          <span className="hint"> — {change.rationale}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" type="button" onClick={applySelectedProposal}>
                {t('options.applySelected')}
              </button>
              <button className="rm" type="button" onClick={discardProposal}>
                {t('options.discard')}
              </button>
            </div>
          </div>
        ) : null}
      </section>

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

      {activeTab === 'basics' ? (
        <>
          <section>
            <h2>{t('options.basics')}</h2>
            <label>
              {t('options.apiKey')}
              <input
                type="password"
                value={cfg.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder="sk-ant-…"
              />
            </label>
            <p className="note">{t('options.apiKeyNoteLong')}</p>
            <label>
              {t('options.model')}
              <select value={modelValue} onChange={(e) => patch({ model: e.target.value })}>
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.id})
                  </option>
                ))}
              </select>
            </label>
            {!modelIds.has(cfg.model) && cfg.model ? (
              <p className="note">{t('options.modelStale', { model: cfg.model })}</p>
            ) : null}
            <label>
              {t('preflight.modeLabel')}
              <select
                value={cfg.preflightMode || 'auto'}
                onChange={(e) =>
                  patch({ preflightMode: e.target.value as 'auto' | 'hybrid' })
                }
              >
                {PREFLIGHT_MODE_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === 'auto' ? t('preflight.modeAuto') : t('preflight.modeHybrid')}
                  </option>
                ))}
              </select>
            </label>
            <p className="note">{t('preflight.modeHint')}</p>
            <label>
              {t('theme.label')}
              <select
                value={cfg.theme || 'default'}
                onChange={(e) => patch({ theme: e.target.value as ThemePreference })}
              >
                {THEME_OPTIONS.map((th) => (
                  <option key={th.id} value={th.id}>
                    {t(th.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <CulturePicker
              value={cfg.uiCulture || AUTO_CULTURE_VALUE}
              onChange={(next) => {
                patch({ uiCulture: next });
                void applyUiCulture(next);
              }}
            />
          </section>

          <section>
            <h2>{t('options.identity')}</h2>
            <p className="note">{t('options.identityNote')}</p>
            <label>
              {t('options.education')}
              <select
                value={educationKnown ? cfg.education : ''}
                onChange={(e) => patch({ education: e.target.value })}
              >
                <option value="">{t('common.notSet')}</option>
                {EDUCATION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            {!educationKnown && cfg.education ? (
              <p className="note">
                {t('options.educationCustom', { value: cfg.education })}
              </p>
            ) : null}
            <label>
              {t('options.workAuth')}
              <textarea
                rows={2}
                value={cfg.workAuthorizationNote || ''}
                onChange={(e) => patch({ workAuthorizationNote: e.target.value })}
                placeholder={t('options.workAuthPlaceholder')}
              />
            </label>
            <div className="row">
              <label style={{ flex: 1 }}>
                {t('options.targetStart')}
                <input
                  type="date"
                  value={prefs.targetStartDate || ''}
                  onChange={(e) => patchPrefs({ targetStartDate: e.target.value })}
                />
              </label>
              <label style={{ flex: 1 }}>
                {t('options.noticeWeeks')}
                <input
                  type="number"
                  min={0}
                  value={prefs.noticePeriodWeeks ?? ''}
                  onChange={(e) =>
                    patchPrefs({
                      noticePeriodWeeks: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.availableImmediately}
                onChange={(e) => patchPrefs({ availableImmediately: e.target.checked })}
              />
              <span>{t('options.availableImmediately')}</span>
            </label>
          </section>
        </>
      ) : null}

      {activeTab === 'geography' ? (
        <section>
          <h2>{t('options.geography')}</h2>
          <p className="note">{t('options.geoHint')}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.remoteOnly}
              onChange={(e) => patchPrefs({ remoteOnly: e.target.checked })}
            />
            <span>{t('options.remoteOnly')}</span>
          </label>
          {prefs.remoteOnly ? (
            <p className="note">{t('options.geoRemoteOnlyHint')}</p>
          ) : (
            <p className="note">{t('options.geoZipHint')}</p>
          )}
          {cfg.locations.map((l, i) => (
            <div className="row" key={i}>
              <input
                placeholder={t('options.zipPlaceholder')}
                value={l.zip}
                onChange={(e) => setLoc(i, 'zip', e.target.value)}
                style={{ maxWidth: 120 }}
              />
              <input
                type="number"
                placeholder={t('options.milesPlaceholder')}
                value={l.radiusMiles}
                onChange={(e) => setLoc(i, 'radiusMiles', Number(e.target.value))}
                style={{ maxWidth: 100 }}
              />
              <button className="rm" type="button" onClick={() => rmLoc(i)}>
                {t('common.remove')}
              </button>
            </div>
          ))}
          <button className="add" type="button" onClick={addLoc}>
            {t('common.addLocation')}
          </button>
          <label>
            {t('options.travelAllowance')}
            <select
              value={prefs.occasionalTravelAllowance || 'none'}
              onChange={(e) =>
                patchPrefs({
                  occasionalTravelAllowance: e.target.value as OccasionalTravelAllowance,
                })
              }
            >
              {OCCASIONAL_TRAVEL_OPTIONS.map((o) => {
                const travelKeys: Record<(typeof OCCASIONAL_TRAVEL_OPTIONS)[number]['id'], string> = {
                  none: 'options.travelNone',
                  weekly: 'options.travelWeekly',
                  monthly: 'options.travelMonthly',
                  quarterly: 'options.travelQuarterly',
                  yearly: 'options.travelYearly',
                };
                return (
                  <option key={o.id} value={o.id}>
                    {t(travelKeys[o.id])}
                  </option>
                );
              })}
            </select>
          </label>
          <p className="note">{t('options.travelHint')}</p>
          <label>
            {t('options.regionsLabel')}
            <input
              value={workEligibleRegionsText}
              onChange={(e) => {
                setWorkEligibleRegionsText(e.target.value);
                markDirty();
              }}
              placeholder="TX, PA"
              autoComplete="off"
            />
          </label>
          <p className="note">{t('options.regionsHint')}</p>
          <details className="advanced">
            <summary>{t('options.advanced')}</summary>
            <label>
              {t('options.remotePreference')}
              <select
                value={prefs.remotePreference}
                onChange={(e) =>
                  patchPrefs({ remotePreference: e.target.value as RemotePreference })
                }
              >
                <option value="prefer_remote">{t('options.preferRemote')}</option>
                <option value="neutral">{t('options.neutral')}</option>
                <option value="prefer_onsite">{t('options.preferOnsite')}</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.requireRelocationSubsidyOutsideMetros}
                onChange={(e) =>
                  patchPrefs({ requireRelocationSubsidyOutsideMetros: e.target.checked })
                }
              />
              <span>{t('options.relocationFlag')}</span>
            </label>
          </details>
        </section>
      ) : null}

      {activeTab === 'skills' ? (
        <>
          <section>
            <h2>{t('options.skills')}</h2>
            <p className="note">{t('options.skillsHint')}</p>
            <table className="skills">
              <thead>
                <tr>
                  <th>{t('options.colSkill')}</th>
                  <th>{t('options.colStanding')}</th>
                  <th>{t('options.colYears')}</th>
                  <th>{t('options.colLastUsed')}</th>
                  <th>{t('options.colScope')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cfg.skillClaims.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        value={c.skill}
                        onChange={(e) => setClaim(i, 'skill', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={c.standing}
                        onChange={(e) =>
                          setClaim(i, 'standing', e.target.value as SkillStanding)
                        }
                      >
                        <option value="held">{t('options.standingHeld')}</option>
                        <option value="ramp">{t('options.standingRamp')}</option>
                        <option value="never_claim">{t('options.standingNever')}</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={c.years ?? ''}
                        onChange={(e) =>
                          setClaim(
                            i,
                            'years',
                            e.target.value === '' ? undefined : Number(e.target.value)
                          )
                        }
                        style={{ maxWidth: 70 }}
                      />
                    </td>
                    <td>
                      <input
                        value={c.lastUsed || ''}
                        onChange={(e) => setClaim(i, 'lastUsed', e.target.value)}
                        placeholder="YYYY"
                        style={{ maxWidth: 80 }}
                      />
                    </td>
                    <td>
                      <input
                        value={c.scopeNote || ''}
                        onChange={(e) => setClaim(i, 'scopeNote', e.target.value)}
                        placeholder={t('options.scopePlaceholder')}
                      />
                    </td>
                    <td>
                      <button className="rm" type="button" onClick={() => rmClaim(i)}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add" type="button" onClick={addClaim}>
              {t('options.addSkill')}
            </button>
            <label style={{ marginTop: 14 }}>
              {t('options.gapsLabel')}
              <textarea
                rows={3}
                value={deficienciesText}
                onChange={(e) => {
                  setDeficienciesText(e.target.value);
                  markDirty();
                }}
                placeholder={'Kubernetes\nRuby'}
              />
            </label>
          </section>

          <section>
            <h2>{t('options.workHistory')}</h2>
            {cfg.workHistory.map((w, i) => (
              <div className="job" key={i}>
                <div className="row">
                  <input
                    placeholder={t('options.orgPlaceholder')}
                    value={w.org}
                    onChange={(e) => setJob(i, 'org', e.target.value)}
                  />
                  <input
                    placeholder={t('options.titlePlaceholder')}
                    value={w.title}
                    onChange={(e) => setJob(i, 'title', e.target.value)}
                  />
                </div>
                <div className="row">
                  <input
                    placeholder={t('options.startPlaceholder')}
                    value={w.start}
                    onChange={(e) => setJob(i, 'start', e.target.value)}
                    style={{ maxWidth: 150 }}
                  />
                  <input
                    placeholder={t('options.endPlaceholder')}
                    value={w.end}
                    onChange={(e) => setJob(i, 'end', e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                  <button className="rm" type="button" onClick={() => rmJob(i)}>
                    {t('common.remove')}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder={t('options.jobDescPlaceholder')}
                  value={w.description}
                  onChange={(e) => setJob(i, 'description', e.target.value)}
                />
              </div>
            ))}
            <button className="add" type="button" onClick={addJob}>
              {t('options.addJob')}
            </button>
            <div style={{ marginTop: 12 }}>
              <button
                className="primary"
                type="button"
                onClick={() => void runExtract()}
                disabled={extracting}
              >
                {extracting ? t('options.extracting') : t('options.extractSkills')}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'preferences' ? (
        <section>
          <h2>{t('options.preferences')}</h2>
          <p className="note" style={{ marginTop: 0 }}>
            {t('options.employmentPriorityHint')}
          </p>
          {EMPLOYMENT_PRIORITY_OPTIONS.map((opt) => {
            const included = prefs.employmentPriority.includes(opt.id);
            const rank = included ? prefs.employmentPriority.indexOf(opt.id) + 1 : null;
            const empKeys: Record<(typeof EMPLOYMENT_PRIORITY_OPTIONS)[number]['id'], string> = {
              permanent: 'options.empPermanent',
              contract_to_hire: 'options.empContractToHire',
              long_contract: 'options.empLongContract',
              short_contract: 'options.empShortContract',
              part_time: 'options.empPartTime',
            };
            return (
              <div className="prio-row" key={opt.id}>
                <label className="check" style={{ margin: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleEmploymentPriority(opt.id)}
                  />
                  <span>
                    {t(empKeys[opt.id])}
                    {rank != null ? ` (#${rank})` : ''}
                  </span>
                </label>
                {included ? (
                  <span className="prio-btns">
                    <button
                      type="button"
                      className="add"
                      onClick={() => moveEmployment(opt.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="add"
                      onClick={() => moveEmployment(opt.id, 1)}
                    >
                      ↓
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
          <label>
            {t('options.minContractMonths')}
            <input
              type="number"
              min={0}
              value={prefs.minContractMonths ?? ''}
              onChange={(e) =>
                patchPrefs({
                  minContractMonths: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder={t('options.minContractPlaceholder')}
            />
          </label>
          <label>
            {t('options.clearancePolicy')}
            <select
              value={prefs.clearancePolicy}
              onChange={(e) =>
                patchPrefs({ clearancePolicy: e.target.value as ClearancePolicy })
              }
            >
              <option value="ignore">{t('options.clearanceIgnore')}</option>
              <option value="flag">{t('options.clearanceFlag')}</option>
              <option value="skip">{t('options.clearanceSkip')}</option>
            </select>
          </label>
          <label>
            {t('options.blockedEmployers')}
            <textarea
              rows={3}
              value={blockedEmployersText}
              onChange={(e) => {
                setBlockedEmployersText(e.target.value);
                markDirty();
              }}
              placeholder={t('options.blockedEmployersPlaceholder')}
            />
          </label>
          <label>
            {t('options.skipTriggers')}
            <textarea
              rows={5}
              value={skipTriggersText}
              onChange={(e) => {
                setSkipTriggersText(e.target.value);
                markDirty();
              }}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.flagPermNotices}
              onChange={(e) => patchPrefs({ flagPermNotices: e.target.checked })}
            />
            <span>{t('options.flagPerm')}</span>
          </label>

          <details className="advanced">
            <summary>{t('options.advanced')}</summary>
            <p className="note" style={{ marginTop: 12 }}>
              {t('options.softSignals')}
            </p>
            <label>
              {t('options.payLimits')}
              <select
                value={prefs.compensationMode}
                onChange={(e) =>
                  patchPrefs({ compensationMode: e.target.value as CompensationMode })
                }
              >
                <option value="suspend_floors">{t('options.paySuspend')}</option>
                <option value="use_floors">{t('options.payUseFloors')}</option>
              </select>
            </label>
            <p className="note">{t('options.payFloorsHint')}</p>
            <div className="row">
              <label style={{ flex: 1 }}>
                {t('options.minAsk')}
                <input
                  type="number"
                  min={0}
                  value={prefs.compensationMinUsd ?? ''}
                  onChange={(e) =>
                    patchPrefs({
                      compensationMinUsd: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label style={{ flex: 1 }}>
                {t('options.maxAsk')}
                <input
                  type="number"
                  min={0}
                  value={prefs.compensationMaxUsd ?? ''}
                  onChange={(e) =>
                    patchPrefs({
                      compensationMaxUsd: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.flagSuspiciousComp}
                onChange={(e) => patchPrefs({ flagSuspiciousComp: e.target.checked })}
              />
              <span>{t('options.flagSuspiciousComp')}</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.preferStructuredWork}
                onChange={(e) => patchPrefs({ preferStructuredWork: e.target.checked })}
              />
              <span>{t('options.preferStructured')}</span>
            </label>
            <label>
              {t('options.pipelineLoad')}
              <select
                value={prefs.pipelineLoad}
                onChange={(e) => patchPrefs({ pipelineLoad: e.target.value as PipelineLoad })}
              >
                <option value="unset">{t('options.pipelineUnset')}</option>
                <option value="light">{t('options.pipelineLight')}</option>
                <option value="moderate">{t('options.pipelineModerate')}</option>
                <option value="heavy">{t('options.pipelineHeavy')}</option>
              </select>
            </label>
            <p className="note">{t('options.pipelineHint')}</p>

            <p className="note" style={{ marginTop: 14 }}>
              {t('options.roleSkipHint')}
            </p>
            {SKIP_CATEGORY_OPTIONS.map((opt) => {
              const skipKeys: Record<
                (typeof SKIP_CATEGORY_OPTIONS)[number]['id'],
                { label: string; hint: string }
              > = {
                ml_training: { label: 'options.skipMl', hint: 'options.skipMlHint' },
                ai_live_tech_interview: {
                  label: 'options.skipAiInterview',
                  hint: 'options.skipAiInterviewHint',
                },
                unverifiable_employer: {
                  label: 'options.skipUnverifiable',
                  hint: 'options.skipUnverifiableHint',
                },
              };
              const keys = skipKeys[opt.id];
              return (
                <label className="check" key={opt.id}>
                  <input
                    type="checkbox"
                    checked={Boolean(
                      (prefs.roleSkipCategories ?? DEFAULT_ROLE_SKIP_CATEGORIES)[opt.id]
                    )}
                    onChange={(e) =>
                      patchPrefs({
                        roleSkipCategories: {
                          ...DEFAULT_ROLE_SKIP_CATEGORIES,
                          ...prefs.roleSkipCategories,
                          [opt.id]: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    {t(keys.label)}
                    <span className="hint"> — {t(keys.hint)}</span>
                  </span>
                </label>
              );
            })}

            <label className="check">
              <input
                type="checkbox"
                checked={prefs.flagShellEmployers}
                onChange={(e) => patchPrefs({ flagShellEmployers: e.target.checked })}
              />
              <span>{t('options.flagShell')}</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.clearanceIncludePreferred}
                onChange={(e) => patchPrefs({ clearanceIncludePreferred: e.target.checked })}
              />
              <span>{t('options.clearancePreferred')}</span>
            </label>
            <label>
              {t('options.clearanceUntil')}
              <input
                type="date"
                value={prefs.clearanceSkipUntil || ''}
                onChange={(e) => patchPrefs({ clearanceSkipUntil: e.target.value })}
              />
            </label>
          </details>
        </section>
      ) : null}

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

const root = document.getElementById('root');
if (!root) throw new Error('JobLens options: #root missing');
ensureI18n();
createRoot(root).render(
  <I18nextProvider i18n={i18n}>
    <Options />
  </I18nextProvider>
);
