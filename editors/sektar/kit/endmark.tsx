// The design system's end of page mark (Patterns · End of page): a hairline,
// the symbol, a hairline, under the last thing on a scrolling page. Rising:
// the first time it is mostly in view, the symbol's columns grow in turn
// (the design system's CSS; this adds .is-risen, as Sektar.endmark does).
// It shows only when the page actually scrolls: a page that fits the screen
// has no end to mark.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** The nearest ancestor that scrolls vertically, or the document's scroller. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

export function EndMark({
  rise = true,
  margin = false,
}: {
  rise?: boolean;
  /** In the page's bottom margin (the page's last child), not on top of it */
  margin?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  const [risen, setRisen] = useState(false);

  // Whether the page is taller than its scroller, kept up as content changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = scrollerOf(el);
    // The mark's own height counts only while it is shown.
    // In the margin the mark adds no height; on top of it, its own height
    // must not count, or showing it would decide that it shows.
    const measure = () => {
      const own = margin ? 0 : el.offsetHeight || 0;
      setScrolls(scroller.scrollHeight - own > scroller.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
    return () => ro.disconnect();
  }, [margin]);

  useEffect(() => {
    const el = ref.current;
    if (!rise || risen || !scrolls || !el) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setRisen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRisen(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rise, risen, scrolls]);

  const cls = [
    "sk-endmark",
    rise && "sk-endmark--rise",
    margin && "sk-endmark--margin",
    risen && "is-risen",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      ref={ref}
      className={cls}
      aria-hidden="true"
      style={
        scrolls
          ? undefined
          : margin
            ? { visibility: "hidden" }
            : {
                visibility: "hidden",
                height: 0,
                padding: 0,
                overflow: "hidden",
              }
      }
    >
      <svg className="sk-endmark__mark" viewBox="0 0 167 152">
        <g className="sk-endmark__c1">
          <path
            d="M42.7294 79.1809V79.5825V151.577H0V137.909C0 122.932 1.4838 109.613 11.0683 97.575C18.9014 87.7364 29.3702 80.6941 42.7294 79.1809Z"
            style={{ fill: "var(--sk-mark-1)" }}
          />
        </g>
        <g className="sk-endmark__c2">
          <path
            d="M48.2294 122.894V104.409C48.2294 86.9906 49.7149 71.8009 60.4906 57.4487C69.0291 46.0764 80.2278 39.5635 94.6577 37.522V114.026V151.577H48.2294V122.894Z"
            style={{ fill: "var(--sk-mark-2)" }}
          />
          <path
            d="M48.2294 122.894V104.409C48.2294 86.9906 49.7149 71.8009 60.4906 57.4487C69.0291 46.0764 80.2278 39.5635 94.6577 37.522V114.026V107.617V79.2148C73.4793 81.2118 56.2142 99.8318 50.3763 118.58C49.9835 119.842 48.2294 121.811 48.2294 122.894Z"
            style={{ fill: "var(--sk-mark-1)" }}
          />
        </g>
        <g className="sk-endmark__c3">
          <path
            d="M162.39 0.097086C163.512 0.006809 166.416 0.025212 166.416 0V50.95V70.2865C166.416 86.3572 166.002 97.3809 158.846 112.304C148.608 133.657 128.368 150.103 104.057 151.577H100.158V82.7054V62.6341V44.4896C107.958 16.6406 135.787 1.64275 162.39 0.097086Z"
            style={{ fill: "var(--sk-mark-3)" }}
          />
          <path
            d="M166.416 67.1074C166.416 70.3105 166.416 73.7365 166.382 76.9326C166.187 89.608 164.973 99.5264 158.846 112.304C154.55 121.264 148.492 129.359 141.112 135.827C130.379 144.903 116.69 151.577 100.158 151.577V133.918V132.648V123.559V122.929V126.439C103.261 111.318 109.307 98.9847 119.795 87.6152C129.173 77.551 141.58 70.7166 155.192 68.1162C159.093 67.4105 162.431 67.2961 166.416 67.1074Z"
            style={{ fill: "var(--sk-mark-4)" }}
          />
        </g>
      </svg>
    </div>
  );
}
