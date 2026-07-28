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

function geoBadgeClass(verdict: string | undefined): string {
  if (verdict === 'eligible') return 'b-ok';
  if (verdict === 'excluded') return 'b-no';
  return 'b-mid';
}

function skillStatusMark(status: string): string {
  if (status === 'match') return '✓ ';
  if (status === 'partial') return '~ ';
  return '✗ ';
}

const FIT_KEYS: Record<FitLabel, string> = {
  'Perfect fit': 'triage.fitPerfect',
  'Excellent fit': 'triage.fitExcellent',
  'Good fit': 'triage.fitGood',
  'Possible fit': 'triage.fitPossible',
  'Unlikely fit': 'triage.fitUnlikely',
  'Poor fit': 'triage.fitPoor',
};

function ProfileWarningBanner({
  message,
  required,
  onOpenOptions,
}: Readonly<{
  message: string;
  required: boolean;
  onOpenOptions?: () => void;
}>): JSX.Element | null {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <output
      className={`profile-warn${required ? ' profile-warn-required' : ''}`}
    >
      <p>{message}</p>
      {onOpenOptions ? (
        <button type="button" className="linkish" onClick={onOpenOptions}>
          {t('common.openOptions')}
        </button>
      ) : null}
    </output>
  );
}

function TriageResultBody({
  analysis,
  saved,
  copied,
  copiedJson,
  onScan,
  onBookmark,
  onCopyMarkdown,
  onCopyJson,
}: Readonly<{
  analysis: Analysis;
  saved: boolean;
  copied: boolean;
  copiedJson: boolean;
  onScan: () => void;
  onBookmark: () => void;
  onCopyMarkdown: () => void;
  onCopyJson: () => void;
}>): JSX.Element {
  const { t } = useTranslation();
  const m = analysis.masthead;
  const geo = analysis.geo;
  const fit = analysis.fit;
  const apply = analysis.apply;
  const geoClass = geoBadgeClass(geo?.verdict);

  const applyLabel = (verdict: ApplyVerdict): string => {
    if (verdict === 'yes') return t('common.yes');
    if (verdict === 'no') return t('common.no');
    return t('common.maybe');
  };

  return (
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
          {analysis.dealbreakers.map((d) => (
            <div className="deal" key={`${d.requirement}|${d.reason}|${d.evidence}`}>
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
          {analysis.skipFlags.map((s) => (
            <div className="skip" key={`${s.trigger}|${s.evidence}`}>
              <div className="req">{s.trigger}</div>
              {s.evidence && <div className="ev">{s.evidence}</div>}
            </div>
          ))}
        </div>
      )}

      {analysis.skillMatches.length > 0 && (
        <div className="section">
          <h2>{t('triage.skills')}</h2>
          {analysis.skillMatches.map((s) => (
            <div className={`flag ${s.status}`} key={`${s.requirement}|${s.status}|${s.confidence}`}>
              <div className="req">
                {skillStatusMark(s.status)}
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
  );
}

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
}: Readonly<TriagePanelProps>): JSX.Element {
  const { t, i18n } = useTranslation();

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
        <ProfileWarningBanner
          message={profileWarning}
          required={profileWarningRequired}
          onOpenOptions={onOpenOptions}
        />

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

        {state === 'result' && analysis?.masthead ? (
          <TriageResultBody
            analysis={analysis}
            saved={saved}
            copied={copied}
            copiedJson={copiedJson}
            onScan={onScan}
            onBookmark={onBookmark}
            onCopyMarkdown={onCopyMarkdown}
            onCopyJson={onCopyJson}
          />
        ) : null}
      </div>
      {footer}
    </div>
  );
}
