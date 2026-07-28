import { useEffect, useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTO_CULTURE_VALUE,
  DEFAULT_CULTURE_ID,
  filterCultures,
  getCultureById,
  SUPPORTED_CULTURES,
} from '../i18n/cultures';

export type CulturePickerProps = {
  value: string;
  onChange: (next: string) => void;
};

/**
 * Searchable listbox for long culture catalogs (better than a native &lt;select&gt; of 30+).
 */
export function CulturePicker({ value, onChange }: CulturePickerProps): JSX.Element {
  const { t } = useTranslation();
  const listId = useId();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selected = value === AUTO_CULTURE_VALUE ? null : getCultureById(value);
  const rows = useMemo(() => {
    const cultures = filterCultures(query);
    return [
      {
        id: AUTO_CULTURE_VALUE,
        primary: t('common.autoDetect'),
        secondary: DEFAULT_CULTURE_ID,
      },
      ...cultures.map((c) => ({
        id: c.id,
        primary: `${c.nativeLabel} — ${c.labelEn}`,
        secondary: c.id,
      })),
    ];
  }, [query, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const select = (id: string): void => {
    onChange(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) select(row.id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, rows.length - 1));
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="culture-picker">
      <label htmlFor={inputId}>{t('culture.pickerLabel')}</label>
      <p className="note" id={`${inputId}-hint`}>
        {t('culture.hint')}
      </p>
      <p className="note" role="status" aria-live="polite">
        {t('culture.selected', {
          label: selected ? `${selected.nativeLabel} — ${selected.labelEn}` : t('common.autoDetect'),
        })}
      </p>
      <div className="culture-picker-search">
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={rows[activeIndex] ? `${listId}-${rows[activeIndex].id}` : undefined}
          aria-describedby={`${inputId}-hint`}
          placeholder={t('common.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="linkish"
            onClick={() => setQuery('')}
            aria-label={t('common.clearSearch')}
          >
            {t('common.clearSearch')}
          </button>
        ) : null}
      </div>
      <ul
        ref={listRef}
        id={listId}
        className="culture-picker-list"
        role="listbox"
        aria-label={t('culture.listLabel')}
      >
        {rows.length === 0 ? (
          <li className="culture-picker-empty" role="option" aria-disabled="true">
            {t('culture.noMatches')}
          </li>
        ) : (
          rows.map((row, index) => {
            const selectedRow = row.id === value || (value === '' && row.id === AUTO_CULTURE_VALUE);
            return (
              <li
                key={row.id}
                id={`${listId}-${row.id}`}
                data-index={index}
                role="option"
                aria-selected={selectedRow}
                className={`culture-picker-option${index === activeIndex ? ' is-active' : ''}${
                  selectedRow ? ' is-selected' : ''
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(row.id)}
              >
                <span className="culture-picker-primary">{row.primary}</span>
                <span className="culture-picker-secondary">{row.secondary}</span>
              </li>
            );
          })
        )}
      </ul>
      <p className="note">
        {t('culture.catalogNote', { count: SUPPORTED_CULTURES.length })}
      </p>
    </div>
  );
}
