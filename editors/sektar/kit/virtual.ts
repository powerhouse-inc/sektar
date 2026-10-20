// A window over a long list: only the rows near the viewport are in the
// DOM, and padding stands in for the rest so the scrollbar is honest. Rows
// are assumed to share a height (the design system's rich rows do, give or
// take a pixel); one rendered row is measured so the estimate corrects
// itself.
//
// The measurement is taken once per list width, never per render. Rows
// differ by a pixel (a badge, the last row's missing hairline), and
// re-measuring whichever row heads the window fed back into the window:
// a new height moved the window, a different row headed it, its height
// differed — React's "maximum update depth" at the end of a fast scroll.
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
  /** The list width the row height was measured at; null re-arms a measure. */
  const measuredAt = useRef<number | null>(null);

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
    const ro = new ResizeObserver(() => {
      // Rows wrap differently at another width: measure again.
      if (measuredAt.current !== null && measuredAt.current !== el.clientWidth)
        measuredAt.current = null;
      onScroll();
    });
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [scroller, mounted]);

  const measure = useCallback(
    (el: HTMLElement | null) => {
      if (!el || measuredAt.current !== null) return;
      const h = el.getBoundingClientRect().height;
      // Zero means not laid out (a hidden pane): try again on the next row.
      if (h <= 0) return;
      measuredAt.current = scroller.current?.clientWidth ?? 0;
      setRowHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
    },
    [scroller],
  );

  // The viewport is never taller than the screen. Before the pane has its
  // height (the first frame, before the workspace measures itself) its body
  // is as tall as its content, and taking that at face value rendered every
  // row of the mailbox and asked for every page of it on the first frame.
  // A zero-height viewport (not laid out yet) shows the first screenful.
  const screen = typeof window === "undefined" ? 1000 : window.innerHeight;
  const height = Math.min(view.height || screen, screen);
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
