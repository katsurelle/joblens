import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { TriagePanel } from './TriagePanel';
import { makeAnalysis } from '../../tests/helpers/analysis';
import { ensureI18n, i18n } from '../i18n';

ensureI18n();

function wrap(ui: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('TriagePanel', () => {
  it('renders fit apply masthead and skills when ready', () => {
    const analysis = makeAnalysis({
      masthead: {
        organization: 'Matrix Retail',
        title: 'Full Stack Developer',
        workModel: 'remote',
        travel: 'None',
        employmentTerms: 'Full-time',
        healthInsurance: 'Unknown',
        payRange: 'n/a',
        seniority: 'Mid',
        workAuthorization: 'US',
      },
      fit: { label: 'Good fit', score: 85, rationale: 'Strong skills' },
      apply: { verdict: 'yes', rationale: 'Apply' },
      geo: { verdict: 'eligible', reason: 'Remote', method: 'model' },
      skillMatches: [
        {
          requirement: 'TypeScript',
          status: 'match',
          confidence: 'high',
          evidence: 'resume',
          reason: 'held',
        },
      ],
    });

    render(
      wrap(
        <TriagePanel
          boardName="ZipRecruiter"
          state="result"
          analysis={analysis}
          onScan={vi.fn()}
          onBookmark={vi.fn()}
          onCopyMarkdown={vi.fn()}
          onCopyJson={vi.fn()}
        />
      )
    );

    expect(screen.getByText(/Matrix Retail/i)).toBeInTheDocument();
    expect(screen.getByText(/Full Stack Developer/i)).toBeInTheDocument();
    expect(screen.getByText(/Good fit/i)).toBeInTheDocument();
    expect(screen.getByText(/Yes/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      wrap(
        <TriagePanel
          state="error"
          analysis={null}
          error="Scan failed"
          onScan={vi.fn()}
          onBookmark={vi.fn()}
          onCopyMarkdown={vi.fn()}
          onCopyJson={vi.fn()}
        />
      )
    );
    expect(screen.getByText(/Scan failed/i)).toBeInTheDocument();
  });
});
