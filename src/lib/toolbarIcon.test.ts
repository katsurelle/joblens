import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('toolbarIcon', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('applyToolbarIcon sets light or dark action paths', async () => {
    const setIcon = vi.fn(async () => undefined);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      action: { setIcon },
      runtime: {
        getURL: (p: string) => `chrome-extension://x/${p}`,
        onMessage: { addListener: () => undefined },
        getContexts: async () => [{ id: '1' }],
      },
      offscreen: { createDocument: vi.fn(async () => undefined) },
    };

    const { applyToolbarIcon } = await import('./toolbarIcon');
    await applyToolbarIcon(false);
    expect(setIcon).toHaveBeenCalledWith({
      path: expect.objectContaining({ '16': 'icons/toolbar-light-16.png' }),
    });
    await applyToolbarIcon(true);
    expect(setIcon).toHaveBeenCalledWith({
      path: expect.objectContaining({ '16': 'icons/toolbar-dark-16.png' }),
    });
  });

  it('startToolbarIconThemeSync applies icons from colorScheme messages', async () => {
    const listeners: Array<(msg: unknown) => unknown> = [];
    const setIcon = vi.fn(async () => undefined);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      action: { setIcon },
      runtime: {
        getURL: (p: string) => `chrome-extension://x/${p}`,
        onMessage: {
          addListener: (fn: (msg: unknown) => unknown) => {
            listeners.push(fn);
          },
        },
        getContexts: async () => [{ id: '1' }],
      },
      offscreen: { createDocument: vi.fn(async () => undefined) },
    };

    const { startToolbarIconThemeSync } = await import('./toolbarIcon');
    startToolbarIconThemeSync();
    expect(listeners).toHaveLength(1);
    listeners[0]?.({ type: 'joblens.colorScheme', dark: true });
    await vi.waitFor(() => {
      expect(setIcon).toHaveBeenCalledWith({
        path: expect.objectContaining({ '16': 'icons/toolbar-dark-16.png' }),
      });
    });
  });
});
