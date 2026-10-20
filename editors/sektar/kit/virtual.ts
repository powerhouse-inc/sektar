// A window over a long list: only the rows near the viewport are in the
// DOM, and padding stands in for the rest so the scrollbar is honest. Rows
// are assumed to share a height (the design system's rich rows do); the
// first rendered row is measured so the estimate corrects itself.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface RowWindow {
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
  rowHeight: number;
  /** Attach to any rendered row to keep the row height honest. */
  measure: (el: HTMLElement | null) => void;
}

export function useRowWindow(
  scroller: RefObject<HTMLElement | null>,
  count: number,
  options: { estimate?: number; overscan?: number; mounted?: unknown } = {},
): RowWindow {
  const { estimate = 76, overscan = 8, mounted } = options;
  const [rowHeight, setRowHeight] = useState(estimate);
  const [view, setView] = useState({ top: 0, height: 0 });
  const frame = useRef(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => {
      frame.current = 0;
      const top = el.scrollTop;
      const height = el.clientHeight;
      setView((prev) =>
        prev.top === top && prev.height === height ? prev : { top, height },
      );
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(read);
    };
    read();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [scroller, mounted]);

  const measure = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) setRowHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  }, []);

  // A zero-height viewport (not laid out yet) shows the first screenful.
  const height = view.height || 600;
  const first = Math.floor(view.top / rowHeight);
  const visible = Math.ceil(height / rowHeight) + 1;
  const start = Math.max(0, Math.min(count, first - overscan));
  const end = Math.max(start, Math.min(count, first + visible + overscan));
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
    rowHeight,
    measure,
  };
}
