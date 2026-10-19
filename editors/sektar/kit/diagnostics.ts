// Opt-in diagnostics for a live surface: what re-renders, what the DOM
// does, and what visibly moves. Off unless `localStorage["sk:mail-debug"]`
// is "1" or the URL carries `debug=mail`; costs nothing when off.
//
// Everything is logged under one prefix so it can be filtered in the
// console:
//   [mail-debug] render  <component> ×<count in the last second>
//   [mail-debug] dom     <mutations in the last second, by target[attr]>
//   [mail-debug] remount <element removed and a like one added in one tick>
//   [mail-debug] shift   <layout shift score, the elements that moved>
//   [mail-debug] frame   <an iframe (re)loaded>
import { useEffect, type RefObject } from "react";

const PREFIX = "[mail-debug]";

export function diagnosticsEnabled(): boolean {
  try {
    if (localStorage.getItem("sk:mail-debug") === "1") return true;
  } catch {
    // no storage, no flag
  }
  try {
    return new URLSearchParams(window.location.search).get("debug") === "mail";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ renders */

const renders = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

/** Call at the top of a component body: counts renders per second. */
export function traceRender(name: string): void {
  if (!diagnosticsEnabled()) return;
  renders.set(name, (renders.get(name) ?? 0) + 1);
  flushTimer ??= setTimeout(() => {
    flushTimer = undefined;
    const parts = [...renders.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n} ×${c}`);
    renders.clear();
    console.info(`${PREFIX} render  ${parts.join("  ")}`);
  }, 1000);
}

/* ------------------------------------------------------------- values */

const lastValues = new Map<string, string>();

/** Logs a derived value when, and only when, it changes between renders. */
export function traceChange(name: string, value: unknown): void {
  if (!diagnosticsEnabled()) return;
  const next = JSON.stringify(value);
  const prev = lastValues.get(name);
  if (prev === next) return;
  lastValues.set(name, next);
  console.info(`${PREFIX} change  ${name} ${prev === undefined ? "" : prev + " → "}${next}`);
}

/* -------------------------------------------------------------- DOM */

function describe(node: Node | null): string {
  const el =
    node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null);
  if (!el) return "?";
  const cls = (typeof el.className === "string" ? el.className : "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join(".");
  return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
}

type LayoutShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
};

/**
 * Watches a root element: mutations per second by target, remounts, layout
 * shifts inside it, iframe loads. Attach to the surface's root; detaches
 * when the component unmounts or the flag is off.
 */
export function useDomDiagnostics(
  root: RefObject<HTMLElement | null>,
  mounted: boolean,
): void {
  useEffect(() => {
    const el = root.current;
    if (!el || !diagnosticsEnabled()) return;
    console.info(`${PREFIX} on — watching`, el);

    const counts = new Map<string, number>();
    let total = 0;
    const removed = new Map<string, number>();
    const added = new Map<string, number>();

    const mo = new MutationObserver((records) => {
      for (const m of records) {
        total += 1;
        const key =
          m.type === "attributes"
            ? `${describe(m.target)}[${m.attributeName}]`
            : m.type === "characterData"
              ? `${describe(m.target)} text`
              : `${describe(m.target)} children`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (m.type === "childList") {
          m.removedNodes.forEach((n) => removed.set(describe(n), (removed.get(describe(n)) ?? 0) + 1));
          m.addedNodes.forEach((n) => {
            const d = describe(n);
            added.set(d, (added.get(d) ?? 0) + 1);
            if (n instanceof HTMLIFrameElement) {
              n.addEventListener("load", () => console.info(`${PREFIX} frame   loaded ${n.title || n.src.slice(0, 40)}`));
            }
          });
        }
      }
    });
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });

    const tick = setInterval(() => {
      if (total === 0) return;
      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, c]) => `${k} ×${c}`)
        .join("  ");
      console.info(`${PREFIX} dom     ${total} mutations: ${top}`);
      for (const [d, c] of removed) {
        const a = added.get(d) ?? 0;
        if (a > 0) console.warn(`${PREFIX} remount ${d} removed ×${c}, added ×${a} in the same second`);
      }
      counts.clear();
      removed.clear();
      added.clear();
      total = 0;
    }, 1000);

    let po: PerformanceObserver | undefined;
    try {
      po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShiftEntry[]) {
          if (entry.hadRecentInput) continue;
          const sources = (entry.sources ?? [])
            .filter((s) => s.node && el.contains(s.node))
            .map((s) => `${describe(s.node)} ${Math.round(s.previousRect.top)}→${Math.round(s.currentRect.top)}`);
          if (sources.length === 0) continue;
          console.warn(`${PREFIX} shift   ${entry.value.toFixed(4)} ${sources.slice(0, 4).join(", ")}`);
        }
      });
      po.observe({ type: "layout-shift", buffered: false });
    } catch {
      // no layout-shift support here
    }

    el.querySelectorAll("iframe").forEach((f) =>
      f.addEventListener("load", () => console.info(`${PREFIX} frame   loaded ${f.title || f.src.slice(0, 40)}`)),
    );

    return () => {
      mo.disconnect();
      clearInterval(tick);
      po?.disconnect();
      console.info(`${PREFIX} off`);
    };
  }, [root, mounted]);
}
