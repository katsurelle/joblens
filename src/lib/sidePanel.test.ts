import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openSidePanelForTab } from './sidePanel';
import { installChromeMock } from '../../tests/helpers/chromeMock';

type Chrome = {
  storage: { session: { set: (items: Record<string, unknown>) => Promise<void> } };
  sidePanel: { open: (opts: { tabId: number }) => Promise<void> };
};

function chromeGlobal(): Chrome {
  return (globalThis as unknown as { chrome: Chrome }).chrome;
}

describe('openSidePanelForTab', () => {
  beforeEach(() => {
    installChromeMock();
  });

  // Chrome revokes the user gesture across an await, so sidePanel.open() has to
  // run before the pending-scan write settles or the panel silently never opens.
  it('calls sidePanel.open before awaiting the pending scan write', async () => {
    const chrome = chromeGlobal();
    let releaseWrite = (): void => undefined;
    const setSpy = vi
      .spyOn(chrome.storage.session, 'set')
      .mockReturnValue(
        new Promise<void>((resolve) => {
          releaseWrite = resolve;
        })
      );
    const openSpy = vi.spyOn(chrome.sidePanel, 'open').mockResolvedValue(undefined);

    const pending = openSidePanelForTab(7, true);
    await Promise.resolve();

    expect(openSpy).toHaveBeenCalledWith({ tabId: 7 });
    expect(setSpy).toHaveBeenCalledWith({ pendingScan: true, pendingScanTabId: 7 });

    releaseWrite();
    await expect(pending).resolves.toEqual({ ok: true, data: { opened: true } });
  });

  it('still reports success when the pending scan write fails', async () => {
    const chrome = chromeGlobal();
    vi.spyOn(chrome.storage.session, 'set').mockRejectedValue(new Error('quota'));
    vi.spyOn(chrome.sidePanel, 'open').mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(openSidePanelForTab(3, true)).resolves.toEqual({
      ok: true,
      data: { opened: true },
    });
  });

  it('skips the pending scan write when startScan is false', async () => {
    const chrome = chromeGlobal();
    const setSpy = vi.spyOn(chrome.storage.session, 'set');
    vi.spyOn(chrome.sidePanel, 'open').mockResolvedValue(undefined);

    await openSidePanelForTab(9, false);

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('surfaces the sidePanel.open failure message', async () => {
    const chrome = chromeGlobal();
    vi.spyOn(chrome.sidePanel, 'open').mockRejectedValue(
      new Error('`sidePanel.open()` may only be called in response to a user gesture.')
    );

    const res = await openSidePanelForTab(1, true);

    expect(res).toEqual({
      ok: false,
      error: '`sidePanel.open()` may only be called in response to a user gesture.',
    });
  });
});
