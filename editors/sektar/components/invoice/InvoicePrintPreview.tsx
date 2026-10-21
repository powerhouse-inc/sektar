// The invoice as its PDF will be: the very HTML that Print turns into the PDF
// (kit/invoice-print.ts), shown as an A4 sheet scaled to the column. What is
// seen here is what is printed, not a second rendering that could drift.
import type { InvoiceState } from "document-models/invoice";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoicePrintHtml } from "../../kit/invoice-print.js";

/** A4 at CSS pixels (96 per inch). */
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
/** Room either side of the sheet, for its shadow. */
const GUTTER = 12;

/**
 * `@page` margins only exist on paper; on screen the sheet gets the same
 * margins and at least a page's height, and never scrolls inside itself.
 * Print is untouched.
 */
const SCREEN_SHEET = `<style>@media screen {
  html { background: #fff; overflow: hidden; }
  body { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 16mm 15mm 18mm; overflow: hidden; }
}</style>`;

export function InvoicePrintPreview({ state }: { state: InvoiceState }) {
  const html = useMemo(() => invoicePrintHtml(state).replace("</head>", `${SCREEN_SHEET}</head>`), [state]);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(A4_HEIGHT);

  // The sheet is drawn at A4 width and scaled to the column (less a gutter
  // each side for its shadow), however wide, never larger than life.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.max(0, Math.min(1, (el.clientWidth - 2 * GUTTER) / A4_WIDTH)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Its height is the content's (a long invoice is a long sheet), followed
  // from inside the frame: a frame loaded in a folded pane measures nothing
  // useful, and unfolding it, fonts arriving or new HTML all reflow it.
  const watch = useRef<ResizeObserver | null>(null);
  useEffect(() => () => watch.current?.disconnect(), []);
  const measure = () => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow as (Window & typeof globalThis) | null;
    if (!doc || !win) return;
    const read = () => setHeight(Math.max(A4_HEIGHT, doc.body.scrollHeight, doc.documentElement.scrollHeight));
    read();
    watch.current?.disconnect();
    watch.current = new win.ResizeObserver(read);
    watch.current.observe(doc.body);
  };

  return (
    <div ref={box} className="sk-inv-print">
      <div className="sk-inv-print__sheet" style={{ width: Math.round(A4_WIDTH * scale), height: Math.round(height * scale) }}>
        <iframe
          ref={frame}
          title="The invoice as its PDF"
          srcDoc={html}
          // Same origin, so its height can be read; no scripts in it.
          sandbox="allow-same-origin"
          scrolling="no"
          onLoad={measure}
          style={{ width: A4_WIDTH, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
