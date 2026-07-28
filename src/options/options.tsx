import { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { getConfig } from '../lib/storage';
import type { Config } from '../types/domain';
import { watchThemeFromConfig } from '../lib/theme';
import { applyUiCulture, ensureI18n, i18n } from '../i18n';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { OptionsEditor } from './OptionsEditor';
import './options.css';

function Options(): JSX.Element {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    void getConfig().then(async (c) => {
      setCfg(c);
      await applyUiCulture(c.uiCulture);
    });
  }, []);

  useEffect(() => watchThemeFromConfig(), []);

  if (!cfg) return <div className="wrap">{t('options.loading')}</div>;

  return <OptionsEditor initialCfg={cfg} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('JobLens options: #root missing');
ensureI18n();
createRoot(root).render(
  <I18nextProvider i18n={i18n}>
    <Options />
  </I18nextProvider>
);
