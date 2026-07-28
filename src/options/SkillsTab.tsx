import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { Config, SkillClaim, SkillStanding, WorkHistoryEntry } from '../types/domain';

export interface SkillsTabProps {
  t: TFunction;
  cfg: Config;
  deficienciesText: string;
  onDeficienciesChange: (value: string) => void;
  setClaim: <K extends keyof SkillClaim>(i: number, k: K, v: SkillClaim[K]) => void;
  rmClaim: (i: number) => void;
  addClaim: () => void;
  setJob: <K extends keyof WorkHistoryEntry>(i: number, k: K, v: WorkHistoryEntry[K]) => void;
  rmJob: (i: number) => void;
  addJob: () => void;
  onExtract: () => void;
  extracting: boolean;
}

export function SkillsTab({
  t,
  cfg,
  deficienciesText,
  onDeficienciesChange,
  setClaim,
  rmClaim,
  addClaim,
  setJob,
  rmJob,
  addJob,
  onExtract,
  extracting,
}: Readonly<SkillsTabProps>): JSX.Element {
  return (
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
              <tr key={c.id}>
                <td>
                  <input value={c.skill} onChange={(e) => setClaim(i, 'skill', e.target.value)} />
                </td>
                <td>
                  <select
                    value={c.standing}
                    onChange={(e) => setClaim(i, 'standing', e.target.value as SkillStanding)}
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
            onChange={(e) => onDeficienciesChange(e.target.value)}
            placeholder={'Kubernetes\nRuby'}
          />
        </label>
      </section>

      <section>
        <h2>{t('options.workHistory')}</h2>
        {cfg.workHistory.map((w, i) => (
          <div className="job" key={w.id}>
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
          <button className="primary" type="button" onClick={onExtract} disabled={extracting}>
            {extracting ? t('options.extracting') : t('options.extractSkills')}
          </button>
        </div>
      </section>
    </>
  );
}
