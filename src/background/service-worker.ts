import { handleBackgroundRequest } from '../lib/backgroundHandle';
import { startToolbarIconThemeSync } from '../lib/toolbarIcon';
import { OpenSidePanelRequestSchema } from '../types/messages';

startToolbarIconThemeSync();

void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => {
    console.warn('JobLens: setPanelBehavior failed', err);
  });

async function openSidePanelForTab(
  tabId: number,
  startScan: boolean
): Promise<{ ok: true; data: { opened: true } } | { ok: false; error: string }> {
  try {
    if (startScan) {
      await chrome.storage.session.set({ pendingScan: true, pendingScanTabId: tabId });
    }
    await chrome.sidePanel.open({ tabId });
    return { ok: true, data: { opened: true } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (
    msg &&
    typeof msg === 'object' &&
    (msg as { type?: string }).type === 'joblens.colorScheme'
  ) {
    return false;
  }

  const openReq = OpenSidePanelRequestSchema.safeParse(msg);
  if (openReq.success) {
    const tabId = openReq.data.tabId ?? sender.tab?.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: 'No tab for side panel open.' });
      return false;
    }
    const startScan = openReq.data.startScan !== false;
    void openSidePanelForTab(tabId, startScan).then(sendResponse);
    return true;
  }

  handleBackgroundRequest(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      sendResponse({ ok: false, error: message });
    });
  return true;
});
