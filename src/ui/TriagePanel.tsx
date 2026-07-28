import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Analysis, ApplyVerdict, FitLabel, PanelUiState } from '../types/domain';

export type TriagePanelProps = {
  boardName?: string;
  state: PanelUiState;
  analysis: Analysis | null;
  error?: string;
  saved?: boolean;
  copied?: boolean;
  copiedJson?: boolean;
  showScanCta?: boolean;
  profileWarning?: string;
  profileWarningRequired?: boolean;
  footer?: JSX.Element | null;
  onScan: () => void;
  onBookmark: () => void;
  onCopyMarkdown: () => void;
  onCopyJson: () => void;
  onOpenOptions?: () => void;
};

function fitBadgeClass(label: FitLabel): string {
  switch (label) {
    case 'Perfect fit':
      return 'b-fit-perfect';
    case 'Excellent fit':
      return 'b-fit-excellent';
    case 'Good fit':
      return 'b-fit-good';
    case 'Possible fit':
      return 'b-fit-possible';
    case 'Unlikely fit':
      return 'b-fit-unlikely';
    case 'Poor fit':
      return 'b-fit-poor';
    default:
      return 'b-mid';
  }
}

function applyBadgeClass(verdict: ApplyVerdict): string {
  if (verdict === 'yes') return 'b-apply-yes';
  if (verdict === 'no') return 'b-apply-no';
  return 'b-apply-maybe';
}

const FIT_KEYS: Record<FitLabel, string> = {
  'Perfect fit': 'triage.fitPerfect',
  'Excellent fit': 'triage.fitExcellent',
  'Good fit': 'triage.fitGood',
  'Possible fit': 'triage.fitPossible',
  'Unlikely fit': 'triage.fitUnlikely',
  'Poor fit': 'triage.fitPoor',
};

export function TriagePanel({
  boardName,
  state,
  analysis,
  error = '',
  saved = false,
  copied = false,
  copiedJson = false,
  showScanCta = true,
  profileWarning = '',
  profileWarningRequired = false,
  footer = null,
  onScan,
  onBookmark,
  onCopyMarkdown,
  onCopyJson,
  onOpenOptions,
}: TriagePanelProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const m = analysis?.masthead;
  const geo = analysis?.geo;
  const fit = analysis?.fit;
  const apply = analysis?.apply;
  const geoClass =
    geo?.verdict === 'eligible' ? 'b-ok' : geo?.verdict === 'excluded' ? 'b-no' : 'b-mid';

  const applyLabel = (verdict: ApplyVerdict): string => {
    if (verdict === 'yes') return t('common.yes');
    if (verdict === 'no') return t('common.no');
    return t('common.maybe');
  };

  const warningBanner = profileWarning ? (
    <div
      className={`profile-warn${profileWarningRequired ? ' profile-warn-required' : ''}`}
      role="status"
    >
      <p>{profileWarning}</p>
      {onOpenOptions ? (
        <button type="button" className="linkish" onClick={onOpenOptions}>
          {t('common.openOptions')}
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="panel" dir={i18n.dir()}>
      <div className="head">
        <h1>
          <img className="brand-mark" src="/icons/icon32.png" width={20} height={20} alt="" />
          {t('triage.title')}
          {boardName ? ` · ${boardName}` : ''}
        </h1>
      </div>
      <div className="body">
        {warningBanner}

        {state === 'idle' && showScanCta && (
          <div className="idle">
            <p className="hint">{t('triage.idleHint')}</p>
            <div className="actions">
              <button className="primary" type="button" onClick={onScan}>
                {t('triage.scanCta')}
              </button>
            </div>
          </div>
        )}

        {state === 'loading' && (
          <div className="loading">
            <span className="spin" />
            {t('common.loading')}
          </div>
        )}
        {state === 'error' && <div className="error">{error}</div>}

        {state === 'error' && (
          <div className="actions">
            <button className="primary" type="button" onClick={onScan}>
              {t('triage.scanCta')}
            </button>
          </div>
        )}

        {state === 'result' && analysis && m && (
          <>
            <div className="masthead">
              <div className="org">{m.organization || '—'}</div>
              <div className="title">{m.title || '—'}</div>

              {(fit || apply) && (
                <div className="ratings">
                  {fit && (
                    <span className={`badge ${fitBadgeClass(fit.label)}`}>
                      {t(FIT_KEYS[fit.label] || 'triage.fit')} · {fit.score}%
                    </span>
                  )}
                  {apply && (
                    <span className={`badge ${applyBadgeClass(apply.verdict)}`}>
                      {t('triage.apply')} {applyLabel(apply.verdict)}
                    </span>
                  )}
                </div>
              )}
              {fit?.rationale ? <div className="rating-note">{fit.rationale}</div> : null}
              {apply?.rationale && apply.rationale !== fit?.rationale ? (
                <div className="rating-note">{apply.rationale}</div>
              ) : null}

              <div className="k">{t('triage.workModel')}</div>
              <div>{m.workModel || '—'}</div>
              <div className="k">{t('triage.employment')}</div>
              <div>{m.employmentTerms || '—'}</div>
              <div className="k">{t('triage.travel')}</div>
              <div>{m.travel || '—'}</div>
              <div className="k">{t('triage.health')}</div>
              <div>{m.healthInsurance || '—'}</div>
              <div className="k">{t('triage.pay')}</div>
              <div>{m.payRange || '—'}</div>
              <div className="k">{t('triage.seniority')}</div>
              <div>{m.seniority || '—'}</div>
              {m.workAuthorization ? (
                <>
                  <div className="k">{t('triage.workAuthorization')}</div>
                  <div>{m.workAuthorization}</div>
                </>
              ) : null}
            </div>

            {geo && (
              <div className="section">
                <h2>{t('triage.geo')}</h2>
                <span className={`badge ${geoClass}`}>{geo.verdict}</span>
                {geo.method === 'zip-haversine' && (
                  <span className="badge b-mid" style={{ marginLeft: 6 }}>
                    computed
                  </span>
                )}
                <div className="flag" style={{ borderLeft: 'none' }}>
                  <div className="why">{geo.reason}</div>
                </div>
              </div>
            )}

            {analysis.dealbreakers.length > 0 && (
              <div className="section">
                <h2>{t('triage.dealbreakers')}</h2>
                {analysis.dealbreakers.map((d, i) => (
                  <div className="deal" key={i}>
                    <div className="req">{d.requirement}</div>
                    {d.reason && <div className="why">{d.reason}</div>}
                    {d.evidence && <div className="ev">{d.evidence}</div>}
                  </div>
                ))}
              </div>
            )}

            {analysis.skipFlags.length > 0 && (
              <div className="section">
                <h2>{t('triage.skipFlags')}</h2>
                {analysis.skipFlags.map((s, i) => (
                  <div className="skip" key={i}>
                    <div className="req">{s.trigger}</div>
                    {s.evidence && <div className="ev">{s.evidence}</div>}
                  </div>
                ))}
              </div>
            )}

            {analysis.skillMatches.length > 0 && (
              <div className="section">
                <h2>{t('triage.skills')}</h2>
                {analysis.skillMatches.map((s, i) => (
                  <div className={`flag ${s.status}`} key={i}>
                    <div className="req">
                      {s.status === 'match' ? '✓ ' : s.status === 'partial' ? '~ ' : '✗ '}
                      {s.requirement} <span className="k">({s.confidence})</span>
                    </div>
                    {s.reason && <div className="why">{s.reason}</div>}
                    {s.evidence && <div className="ev">{s.evidence}</div>}
                  </div>
                ))}
              </div>
            )}

            {analysis.postingSmell && (
              <div className="section">
                <h2>{t('triage.postingSmell')}</h2>
                <div className="hint">{analysis.postingSmell}</div>
              </div>
            )}

            {analysis.declutteredJD && (
              <div className="section">
                <h2>{t('triage.decluttered')}</h2>
                <div className="jd">{analysis.declutteredJD}</div>
              </div>
            )}

            <div className="actions">
              <button className="primary" type="button" onClick={onBookmark} disabled={saved}>
                {saved ? t('triage.bookmarked') : t('triage.bookmark')}
              </button>
              <button type="button" onClick={onCopyMarkdown}>
                {copied ? t('triage.copiedMarkdown') : t('triage.copyMarkdown')}
              </button>
              <button type="button" onClick={onCopyJson}>
                {copiedJson ? t('triage.copiedJson') : t('triage.copyJson')}
              </button>
              <button type="button" onClick={onScan}>
                {t('app.scan')}
              </button>
            </div>
          </>
        )}
      </div>
      {footer}
    </div>
  );
}
