// Measuring hooks a workspace needs: its height below whatever sits above
// it, and whether it is too narrow for three readable panes side by side.
import { useEffect, useState, type RefObject } from "react";

/** Whether the workspace is narrower than `px` (side by side, but cramped). */
export function useNarrow(
  ref: RefObject<HTMLDivElement | null>,
  px: number,
  mounted: boolean,
): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < px);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, px, mounted]);
  return narrow;
}

/**
 * The workspace fills the viewport below whatever sits above it. Connect's
 * wrapper grows with its content, so `height: 100%` would be circular; the
 * offset is measured instead and re-measured on resize.
 */
export function useFillHeight(
  ref: RefObject<HTMLDivElement | null>,
  mounted: boolean,
): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      const next = Math.max(360, Math.round(window.innerHeight - top));
      setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, mounted]);
  return height;
}
