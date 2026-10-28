// Pull to refresh (design system: Patterns · Integrations · Pull to
// refresh): on a touch screen, pulling a list down from its top runs the
// live updates behind it once. The header follows the finger, turns its
// arrow at the threshold ("Release to sync"), and holds at its resting
// height with a spinner until the sync finishes; then a toast says how it went.
import { useEffect, useRef, useState } from "react";
import { Icon, Toast } from "./ui.js";

/** How far to pull before a release syncs, and the height the header holds while it does */
const READY_AT = 72;
const HOLD_AT = 64;
const MAX_PULL = 120;
const TOAST_MS = 3_000;

export type PullWords = {
  /** "Work mail · synced 4 min ago": under Pull to sync */
  idle: string;
  /** "Checking for new mail…" */
  busy: string;
  /** Under the busy line: what is syncing */
  busySub?: string;
};

type Phase = "idle" | "pulling" | "ready" | "syncing";

/**
 * Pull to refresh on a scrolling element (null until it is there). `onSync` runs the sync and
 * resolves to what the toast says. Only on a coarse pointer (a phone or
 * tablet): a mouse has the Sync buttons.
 */
export function usePullToRefresh(
  el: HTMLElement | null,
  onSync: () => Promise<string>,
): { phase: Phase; pull: number; toast: string | null } {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const sync = useRef(onSync);
  sync.current = onSync;
  const busy = useRef(false);

  useEffect(() => {
    if (!el || !window.matchMedia("(pointer: coarse)").matches) return;
    // At the top only when nothing between the finger and the page is
    // scrolled: the element, any scroller inside it, and the document.
    const atTop = (target: EventTarget | null) => {
      for (
        let n = target instanceof Element ? target : null;
        n;
        n = n.parentElement
      ) {
        if (n.scrollTop > 0) return false;
      }
      return (document.scrollingElement?.scrollTop ?? 0) <= 0;
    };
    let startY: number | null = null;
    let distance = 0;
    const onStart = (e: TouchEvent) => {
      if (busy.current || !atTop(e.target)) return;
      startY = e.touches[0]?.clientY ?? null;
      distance = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = (e.touches[0]?.clientY ?? startY) - startY;
      if (dy <= 0 || !atTop(e.target)) {
        startY = dy <= 0 ? startY : null;
        distance = 0;
        setPull(0);
        setPhase("idle");
        return;
      }
      // The list stays put; the header takes the pull, with resistance
      e.preventDefault();
      distance = Math.min(MAX_PULL, dy * 0.5);
      setPull(distance);
      setPhase(distance >= READY_AT ? "ready" : "pulling");
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      if (distance < READY_AT) {
        setPull(0);
        setPhase("idle");
        return;
      }
      busy.current = true;
      setPull(HOLD_AT);
      setPhase("syncing");
      void sync
        .current()
        .catch((e: unknown) =>
          e instanceof Error ? `Could not sync: ${e.message}` : "Could not sync",
        )
        .then((words) => {
          busy.current = false;
          setPull(0);
          setPhase("idle");
          setToast(words);
        });
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [el]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return { phase, pull, toast };
}

/** The header above the list, as tall as the pull; nothing while at rest. */
export function PullHeader({
  phase,
  pull,
  toast,
  words,
}: {
  phase: Phase;
  pull: number;
  toast: string | null;
  words: PullWords;
}) {
  return (
    <>
      {pull > 0 && (
        <div
          className={phase === "ready" ? "sk-ptr is-ready" : "sk-ptr"}
          style={{ ["--sk-ptr-h" as string]: `${Math.round(pull)}px` }}
          aria-live="polite"
        >
          {phase === "syncing" ? (
            <span className="sk-spinner" />
          ) : (
            <Icon name="chevron-down" className="sk-ptr__icon" />
          )}
          <div className="sk-ptr__text">
            <b>
              {phase === "syncing"
                ? words.busy
                : phase === "ready"
                  ? "Release to sync"
                  : "Pull to sync"}
            </b>
            <span>{phase === "syncing" ? (words.busySub ?? "") : words.idle}</span>
          </div>
        </div>
      )}
      {toast && <Toast>{toast}</Toast>}
    </>
  );
}

/** What the toast says after a pull: synced, or why nothing ran. */
export function pullResult(result: {
  synced: readonly string[];
  skipped: readonly string[];
  failed: readonly string[];
}): string {
  if (result.synced.length > 0) return "Up to date";
  if (result.failed.length > 0) return "Could not sync: the switchboard did not answer";
  if (result.skipped.length > 0) return "Live updates are paused or stopped";
  return "Nothing to sync";
}
