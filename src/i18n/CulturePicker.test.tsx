import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { CulturePicker } from './CulturePicker';
import { applyDocumentDirection, applyUiCulture, ensureI18n, i18n } from './index';
import { AUTO_CULTURE_VALUE, SUPPORTED_CULTURES } from './cultures';

ensureI18n();

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en-US');
  applyDocumentDirection('en-US');
});

describe('CulturePicker', () => {
  it('filters long culture lists via search and selects a culture', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <CulturePicker value={AUTO_CULTURE_VALUE} onChange={onChange} />
      </I18nextProvider>
    );
    const search = within(container).getByRole('combobox');
    fireEvent.change(search, { target: { value: 'mexico' } });
    const option = await within(container).findByRole('option', { name: /Spanish \(Mexico\)/i });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('es-MX');
  });

  it('exposes listbox semantics for screen readers', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <CulturePicker value="en-US" onChange={() => undefined} />
      </I18nextProvider>
    );
    expect(within(container).getByRole('listbox')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Supported cultures/i)
    );
    expect(
      within(container).getByText(new RegExp(`${SUPPORTED_CULTURES.length} cultures`))
    ).toBeInTheDocument();
  });
});

describe('document direction', () => {
  it('sets rtl for Arabic cultures and ltr for English', () => {
    const root = document.createElement('div');
    applyDocumentDirection('ar-EG', root);
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.getAttribute('lang')).toBe('ar-EG');
    applyDocumentDirection('en-US', root);
    expect(root.getAttribute('dir')).toBe('ltr');
  });

  it('applyUiCulture switches language and document dir', async () => {
    const culture = await applyUiCulture('ar-EG');
    expect(culture.id).toBe('ar-EG');
    expect(i18n.language).toMatch(/^ar/);
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    await applyUiCulture('en-US');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});
