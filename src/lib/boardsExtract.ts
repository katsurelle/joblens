/** Shared page-text extraction helpers for board adapters. */

const TEXT_CAP = 24_000;

/** Prefer innerText; fall back to textContent (jsdom / some embeds lack innerText). */
export function elementText(el: Element): string {
  const html = el as HTMLElement;
  return (html.innerText || el.textContent || '').trim();
}

/** Default: largest of main / article / body, capped. */
export function defaultExtractPageText(doc: Document = document): string {
  const candidates = [
    doc.querySelector('[role="main"]'),
    doc.querySelector('main'),
    doc.querySelector('article'),
    doc.body,
  ].filter((el): el is Element => el != null);

  let best = '';
  for (const el of candidates) {
    const t = elementText(el);
    if (t.length > best.length) best = t;
  }
  return best.slice(0, TEXT_CAP);
}

export function extractBySelectors(doc: Document, selectors: readonly string[]): string {
  let best = '';
  for (const sel of selectors) {
    for (const el of doc.querySelectorAll(sel)) {
      const t = elementText(el);
      if (t.length > best.length) best = t;
    }
  }
  if (best.length < 200) return defaultExtractPageText(doc);
  return best.slice(0, TEXT_CAP);
}

export { TEXT_CAP };
