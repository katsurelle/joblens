import { describe, expect, it, beforeEach } from 'vitest';
import { applyTheme } from './theme';

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets light and dark data-theme', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('clears data-theme for default / system', () => {
    applyTheme('dark');
    applyTheme('default');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    applyTheme(undefined);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
