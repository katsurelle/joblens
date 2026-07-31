import { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { boardDisplayNames } from '../lib/boards';
import { openSidePanel } from '../lib/messaging';
import './popup.css';

function Popup(): JSX.Element {
  const [msg, setMsg] = useState('');
  // Resolved up front: awaiting a tab query inside the click handler would drop
  // the user gesture that chrome.sidePanel.open() requires.
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setTabId(tab?.id ?? null);
    });
  }, []);

  const scan = async (): Promise<void> => {
    if (tabId == null) return;
    const res = await openSidePanel({ startScan: true, tabId });
    if (!res.ok) {
      const detail = res.error ? ` ${res.error}` : '';
      setMsg(
        `JobLens is not active on this page.${detail} Supported: ${boardDisplayNames()}. Open a posting URL, not a search list.`
      );
      return;
    }
    window.close();
  };

  const bookmarks = (): void => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
  };
  const options = (): void => {
    void chrome.runtime.openOptionsPage();
  };

  return (
    <div className="pop">
      <div className="brand">
        <img className="brand-mark" src="/icons/icon32.png" width={18} height={18} alt="" />
        <span>JobLens</span>
      </div>
      <button type="button" onClick={() => void scan()} disabled={tabId == null}>
        Scan this page
      </button>
      <button type="button" onClick={bookmarks}>
        View bookmarks
      </button>
      <button type="button" onClick={options}>
        Options
      </button>
      {msg && <div className="msg">{msg}</div>}
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('JobLens popup: #root missing');
createRoot(root).render(<Popup />);
