import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { ConfigProposal } from '../lib/docImport';

export interface ImportDocsSectionProps {
  t: TFunction;
  docFiles: File[];
  onDocFilesChange: (files: File[]) => void;
  proposing: boolean;
  onPropose: () => void;
  proposal: ConfigProposal | null;
  selectedChangeIds: Set<string>;
  onToggleChangeSelected: (id: string) => void;
  onApplySelected: () => void;
  onDiscard: () => void;
}

export function ImportDocsSection({
  t,
  docFiles,
  onDocFilesChange,
  proposing,
  onPropose,
  proposal,
  selectedChangeIds,
  onToggleChangeSelected,
  onApplySelected,
  onDiscard,
}: Readonly<ImportDocsSectionProps>): JSX.Element {
  return (
    <section className="import-box">
      <h2>{t('options.importTitle')}</h2>
      <p className="note">{t('options.importHint')}</p>
      <label>
        {t('options.files')}
        <input
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx"
          onChange={(e) => onDocFilesChange(Array.from(e.target.files ?? []))}
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
        onClick={onPropose}
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
                      onChange={() => onToggleChangeSelected(change.id)}
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
            <button className="primary" type="button" onClick={onApplySelected}>
              {t('options.applySelected')}
            </button>
            <button className="rm" type="button" onClick={onDiscard}>
              {t('options.discard')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
