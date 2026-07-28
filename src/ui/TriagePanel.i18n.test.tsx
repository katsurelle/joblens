import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { ensureI18n, i18n } from '../i18n';
import { TriagePanel } from './TriagePanel';
import { EMPTY_ANALYSIS } from '../types/domain';

ensureI18n();

describe('TriagePanel i18n', () => {
  it('renders localized chrome for es', async () => {
    await i18n.changeLanguage('es');
    render(
      <I18nextProvider i18n={i18n}>
        <TriagePanel
          state="idle"
          analysis={null}
          onScan={() => undefined}
          onBookmark={() => undefined}
          onCopyMarkdown={() => undefined}
          onCopyJson={() => undefined}
        />
      </I18nextProvider>
    );
    expect(screen.getByRole('button', { name: /Analizar esta oferta/i })).toBeInTheDocument();
    await i18n.changeLanguage('en-US');
  });

  it('renders English fit labels for result state', async () => {
    await i18n.changeLanguage('en-US');
    const analysis = {
      ...EMPTY_ANALYSIS,
      masthead: {
        ...EMPTY_ANALYSIS.masthead,
        organization: 'Acme',
        title: 'Engineer',
        workModel: 'remote' as const,
      },
      fit: { label: 'Good fit' as const, score: 85 as const, rationale: 'ok' },
      apply: { verdict: 'yes' as const, rationale: 'ok' },
    };
    render(
      <I18nextProvider i18n={i18n}>
        <TriagePanel
          state="result"
          analysis={analysis}
          onScan={() => undefined}
          onBookmark={() => undefined}
          onCopyMarkdown={() => undefined}
          onCopyJson={() => undefined}
        />
      </I18nextProvider>
    );
    expect(screen.getByText(/Good fit/i)).toBeInTheDocument();
  });
});
