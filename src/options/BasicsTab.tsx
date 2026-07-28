import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import {
  CLAUDE_MODELS,
  EDUCATION_LEVELS,
  PREFLIGHT_MODE_OPTIONS,
} from '../lib/settingsOptions';
import type { Config, Preferences, ThemePreference } from '../types/domain';
import { CulturePicker } from '../i18n/CulturePicker';
import { AUTO_CULTURE_VALUE } from '../i18n/cultures';
import { applyUiCulture } from '../i18n';
import { geoLabelsForCountry } from '../lib/homeCountry';

const THEME_OPTIONS: Array<{ id: ThemePreference; labelKey: string }> = [
  { id: 'default', labelKey: 'theme.default' },
  { id: 'light', labelKey: 'theme.light' },
  { id: 'dark', labelKey: 'theme.dark' },
];

export interface BasicsTabProps {
  t: TFunction;
  cfg: Config;
  prefs: Preferences;
  modelValue: string;
  modelIds: Set<string>;
  educationKnown: boolean;
  patch: (p: Partial<Config>) => void;
  patchPrefs: (p: Partial<Preferences>) => void;
}

export function BasicsTab({
  t,
  cfg,
  prefs,
  modelValue,
  modelIds,
  educationKnown,
  patch,
  patchPrefs,
}: Readonly<BasicsTabProps>): JSX.Element {
  return (
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
            onChange={(e) => patch({ preflightMode: e.target.value as 'auto' | 'hybrid' })}
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
          <p className="note">{t('options.educationCustom', { value: cfg.education })}</p>
        ) : null}
        <label>
          {t('options.workAuth')}
          <textarea
            rows={2}
            value={cfg.workAuthorizationNote || ''}
            onChange={(e) => patch({ workAuthorizationNote: e.target.value })}
            placeholder={geoLabelsForCountry(cfg.homeCountry).workAuthPlaceholder}
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
  );
}
