import { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { getConfig, removeBookmark } from '../lib/storage';
import { watchThemeFromConfig } from '../lib/theme';
import { analysisToMarkdown } from '../lib/markdown';
import { analysisToJsonString } from '../lib/jsonExport';
import type { Bookmark } from '../types/domain';
import { applyUiCulture, ensureI18n, i18n } from '../i18n';
import '../options/options.css';

function Bookmarks(): JSX.Element {
  const { t, i18n: i18nInstance } = useTranslation();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [copiedUrl, setCopiedUrl] = useState('');

  useEffect(() => {
    void getConfig().then(async (c) => {
      await applyUiCulture(c.uiCulture);
      setItems(c.bookmarks);
    });
  }, []);

  useEffect(() => watchThemeFromConfig(), []);

  const del = async (url: string): Promise<void> => {
    setItems(await removeBookmark(url));
  };

  const copyMd = async (b: Bookmark): Promise<void> => {
    await navigator.clipboard.writeText(analysisToMarkdown(b.analysis, b.url));
    setCopiedUrl(`md:${b.url}`);
    setTimeout(() => setCopiedUrl(''), 1500);
  };

  const copyJson = async (b: Bookmark): Promise<void> => {
    await navigator.clipboard.writeText(
      analysisToJsonString(b.analysis, {
        url: b.url,
        board: b.board || '',
        company: b.company,
        title: b.title,
        savedAt: b.savedAt,
      })
    );
    setCopiedUrl(`json:${b.url}`);
    setTimeout(() => setCopiedUrl(''), 1500);
  };

  const dateFmt = new Intl.DateTimeFormat(i18nInstance.language || 'en-US', {
    dateStyle: 'medium',
  });

  return (
    <div className="wrap" dir={i18nInstance.dir()}>
      <h1 className="page-title">
        <img className="brand-mark" src="/icons/icon48.png" width={28} height={28} alt="" />
        {t('bookmarks.pageTitle')}
      </h1>
      {items.length === 0 && (
        <section>
          <p className="note">{t('bookmarks.empty')}</p>
        </section>
      )}
      {items.map((b) => {
        const m = b.analysis.masthead;
        return (
          <section key={b.url}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {b.company || m.organization || t('bookmarks.unknownCompany')}
                </div>
                <div style={{ color: 'var(--jl-text)' }}>{b.title || m.title}</div>
                <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                  {b.url}
                </a>
                <div className="note" style={{ marginTop: 6 }}>
                  {b.board ? `${b.board} · ` : ''}
                  {String(m.workModel)} · {String(m.employmentTerms)} ·{' '}
                  {m.payRange || t('bookmarks.payNa')} · {t('bookmarks.saved')}{' '}
                  {dateFmt.format(new Date(b.savedAt))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="add" type="button" onClick={() => void copyMd(b)}>
                  {copiedUrl === `md:${b.url}`
                    ? t('triage.copiedMarkdown')
                    : t('triage.copyMarkdown')}
                </button>
                <button className="add" type="button" onClick={() => void copyJson(b)}>
                  {copiedUrl === `json:${b.url}`
                    ? t('triage.copiedJson')
                    : t('triage.copyJson')}
                </button>
                <button className="rm" type="button" onClick={() => void del(b.url)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('JobLens bookmarks: #root missing');
ensureI18n();
createRoot(root).render(
  <I18nextProvider i18n={i18n}>
    <Bookmarks />
  </I18nextProvider>
);
