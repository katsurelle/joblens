import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import {
  EMPLOYMENT_PRIORITY_OPTIONS,
  SKIP_CATEGORY_OPTIONS,
} from '../lib/settingsOptions';
import type {
  ClearancePolicy,
  CompensationMode,
  EmploymentPriority,
  PipelineLoad,
  Preferences,
} from '../types/domain';
import { DEFAULT_ROLE_SKIP_CATEGORIES } from '../types/domain';
import { currencyForCountry, normalizeHomeCountry } from '../lib/homeCountry';

const EMP_KEYS: Record<(typeof EMPLOYMENT_PRIORITY_OPTIONS)[number]['id'], string> = {
  permanent: 'options.empPermanent',
  contract_to_hire: 'options.empContractToHire',
  long_contract: 'options.empLongContract',
  short_contract: 'options.empShortContract',
  part_time: 'options.empPartTime',
};

const SKIP_KEYS: Record<
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

export interface PreferencesTabProps {
  t: TFunction;
  prefs: Preferences;
  homeCountry?: string;
  blockedEmployersText: string;
  onBlockedEmployersChange: (value: string) => void;
  skipTriggersText: string;
  onSkipTriggersChange: (value: string) => void;
  patchPrefs: (p: Partial<Preferences>) => void;
  toggleEmploymentPriority: (id: EmploymentPriority) => void;
  moveEmployment: (id: EmploymentPriority, dir: -1 | 1) => void;
}

export function PreferencesTab({
  t,
  prefs,
  homeCountry = 'US',
  blockedEmployersText,
  onBlockedEmployersChange,
  skipTriggersText,
  onSkipTriggersChange,
  patchPrefs,
  toggleEmploymentPriority,
  moveEmployment,
}: Readonly<PreferencesTabProps>): JSX.Element {
  const currency = currencyForCountry(homeCountry);
  const isUsMarket = normalizeHomeCountry(homeCountry) === 'US';
  return (
    <section>
      <h2>{t('options.preferences')}</h2>
      <p className="note" style={{ marginTop: 0 }}>
        {t('options.employmentPriorityHint')}
      </p>
      {EMPLOYMENT_PRIORITY_OPTIONS.map((opt) => {
        const included = prefs.employmentPriority.includes(opt.id);
        const rank = included ? prefs.employmentPriority.indexOf(opt.id) + 1 : null;
        return (
          <div className="prio-row" key={opt.id}>
            <label className="check" style={{ margin: 0, flex: 1 }}>
              <input
                type="checkbox"
                checked={included}
                onChange={() => toggleEmploymentPriority(opt.id)}
              />
              <span>
                {t(EMP_KEYS[opt.id])}
                {rank !== null ? ` (#${rank})` : ''}
              </span>
            </label>
            {included ? (
              <span className="prio-btns">
                <button type="button" className="add" onClick={() => moveEmployment(opt.id, -1)}>
                  ↑
                </button>
                <button type="button" className="add" onClick={() => moveEmployment(opt.id, 1)}>
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
          onChange={(e) => patchPrefs({ clearancePolicy: e.target.value as ClearancePolicy })}
        >
          <option value="ignore">{t('options.clearanceIgnore')}</option>
          <option value="flag">{t('options.clearanceFlag')}</option>
          <option value="skip">{t('options.clearanceSkip')}</option>
        </select>
      </label>
      {!isUsMarket ? (
        <p className="note">Clearance vocabulary is US federal (Secret / TS/SCI / Public Trust).</p>
      ) : null}
      <label>
        {t('options.blockedEmployers')}
        <textarea
          rows={3}
          value={blockedEmployersText}
          onChange={(e) => onBlockedEmployersChange(e.target.value)}
          placeholder={t('options.blockedEmployersPlaceholder')}
        />
      </label>
      <label>
        {t('options.skipTriggers')}
        <textarea
          rows={5}
          value={skipTriggersText}
          onChange={(e) => onSkipTriggersChange(e.target.value)}
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
      {!isUsMarket ? (
        <p className="note">PERM is a US Department of Labor labor-certification notice.</p>
      ) : null}

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
            Min ask ({currency}, optional)
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
            Max ask ({currency}, optional)
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
          const keys = SKIP_KEYS[opt.id];
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
  );
}
