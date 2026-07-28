import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { OCCASIONAL_TRAVEL_OPTIONS } from '../lib/settingsOptions';
import {
  HOME_COUNTRY_OPTIONS,
  currencyForCountry,
  geoLabelsForCountry,
} from '../lib/homeCountry';
import { locationPostalCode } from '../lib/postalDirectory';
import type { Config, Location, OccasionalTravelAllowance, Preferences, RemotePreference } from '../types/domain';

const TRAVEL_KEYS: Record<(typeof OCCASIONAL_TRAVEL_OPTIONS)[number]['id'], string> = {
  none: 'options.travelNone',
  weekly: 'options.travelWeekly',
  monthly: 'options.travelMonthly',
  quarterly: 'options.travelQuarterly',
  yearly: 'options.travelYearly',
};

/** Common ISO country codes for remote eligibility quick-add. */
const COUNTRY_QUICK_ADD = [
  'US',
  'CA',
  'GB',
  'IE',
  'AU',
  'NZ',
  'DE',
  'FR',
  'NL',
  'EU',
] as const;

export interface GeographyTabProps {
  t: TFunction;
  cfg: Config;
  prefs: Preferences;
  workEligibleRegionsText: string;
  onWorkEligibleRegionsChange: (value: string) => void;
  patch: (p: Partial<Config>) => void;
  patchPrefs: (p: Partial<Preferences>) => void;
  setLoc: <K extends keyof Location>(i: number, k: K, v: Location[K]) => void;
  rmLoc: (i: number) => void;
  addLoc: () => void;
}

function toggleRegionToken(text: string, token: string): string {
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const upper = token.toUpperCase();
  const has = parts.some((p) => p.toUpperCase() === upper);
  const next = has
    ? parts.filter((p) => p.toUpperCase() !== upper)
    : [...parts, upper];
  return next.join(', ');
}

export function GeographyTab({
  t,
  cfg,
  prefs,
  workEligibleRegionsText,
  onWorkEligibleRegionsChange,
  patch,
  patchPrefs,
  setLoc,
  rmLoc,
  addLoc,
}: Readonly<GeographyTabProps>): JSX.Element {
  const labels = geoLabelsForCountry(cfg.homeCountry);
  const currency = currencyForCountry(cfg.homeCountry);

  return (
    <section>
      <h2>{t('options.geography')}</h2>
      <label>
        <span>Home / search country</span>
        <select
          value={cfg.homeCountry || 'US'}
          onChange={(e) => patch({ homeCountry: e.target.value })}
        >
          {HOME_COUNTRY_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="note">{labels.geoHint}</p>
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
        <p className="note">{labels.postalHint}</p>
      )}
      {cfg.locations.map((l, i) => (
        <div className="row" key={l.id}>
          <input
            placeholder={labels.postalPlaceholder}
            value={locationPostalCode(l)}
            onChange={(e) => {
              const v = e.target.value;
              setLoc(i, 'postalCode', v);
            }}
            style={{ maxWidth: 120 }}
          />
          <input
            type="number"
            placeholder={labels.radiusPlaceholder}
            value={l.radiusMiles}
            onChange={(e) => setLoc(i, 'radiusMiles', Number(e.target.value))}
            style={{ maxWidth: 100 }}
          />
          <span className="note" style={{ margin: 0 }}>
            {l.radiusUnit || labels.radiusPlaceholder}
          </span>
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
          {OCCASIONAL_TRAVEL_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {t(TRAVEL_KEYS[o.id])}
            </option>
          ))}
        </select>
      </label>
      <p className="note">{t('options.travelHint')}</p>
      <label>
        {labels.regionsLabel}
        <input
          value={workEligibleRegionsText}
          onChange={(e) => onWorkEligibleRegionsChange(e.target.value)}
          placeholder={labels.regionsPlaceholder}
          autoComplete="off"
        />
      </label>
      <p className="note">{t('options.regionsHint')}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <span className="note" style={{ margin: 0 }}>
          Countries I can work in:
        </span>
        {COUNTRY_QUICK_ADD.map((code) => {
          const active = workEligibleRegionsText
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .includes(code);
          return (
            <button
              key={code}
              type="button"
              className={active ? 'add' : 'rm'}
              style={{ padding: '2px 8px' }}
              onClick={() =>
                onWorkEligibleRegionsChange(toggleRegionToken(workEligibleRegionsText, code))
              }
            >
              {code}
            </button>
          );
        })}
      </div>
      <p className="note">
        Pay floors use {currency} amounts (no automatic conversion).
      </p>
      <details className="advanced">
        <summary>{t('options.advanced')}</summary>
        <label>
          {t('options.remotePreference')}
          <select
            value={prefs.remotePreference}
            onChange={(e) => patchPrefs({ remotePreference: e.target.value as RemotePreference })}
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
  );
}
