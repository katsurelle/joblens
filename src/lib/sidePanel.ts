export type OpenSidePanelResult =
  | { ok: true; data: { opened: true } }
  | { ok: false; error: string };

function openErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return 'Side panel failed to open.';
}

/**
 * Opens the side panel for a tab and flags a pending scan.
 *
 * chrome.sidePanel.open() is only allowed while the caller's user gesture is
 * still live, so nothing may be awaited ahead of it. The pending-scan write is
 * started first but settled afterwards; the side panel also watches
 * storage.onChanged, so it picks the flag up even if the write lands late.
 */
export async function openSidePanelForTab(
  tabId: number,
  startScan: boolean
): Promise<OpenSidePanelResult> {
  const pendingScanWrite = startScan
    ? chrome.storage.session
        .set({ pendingScan: true, pendingScanTabId: tabId })
        .catch((err: unknown) => {
          console.warn('JobLens: pending scan write failed', err);
        })
    : Promise.resolve();

  try {
    await chrome.sidePanel.open({ tabId });
    await pendingScanWrite;
    return { ok: true, data: { opened: true } };
  } catch (err: unknown) {
    return { ok: false, error: openErrorText(err) };
  }
}
