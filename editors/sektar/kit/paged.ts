// A list sized to its whole set and fetched page by page where the reader
// is: the technique the Mail list uses, made generic for any index. The
// scrollbar is the set's real size from the first frame, a drag to the
// middle fetches the middle, a filter change keeps the old rows on screen
// until the new first page lands, and pages this tab has seen are
// remembered so a revisit paints at once and revalidates behind it.
import { useCallback, useEffect, useRef, useState } from "react";

export interface PagedAnswer<T> {
  items: T[];
  total: number;
}

export interface PagedList<T> {
  /** Every row the filter covers. */
  total: number;
  /** The row at an index, once its page has arrived. */
  rowAt: (index: number) => T | undefined;
  /** Fetch the pages covering rows [start, end). */
  ensure: (start: number, end: number) => void;
  /** Some filter has answered (or failed) at least once. */
  loaded: boolean;
  /** The rows shown belong to the previous filter; the new one is on its way. */
  stale: boolean;
  busy: boolean;
  error: string | null;
  /** Bumps when what the list holds changed. */
  version: number;
  /** Re-read the top soon, coalescing bursts. */
  refreshSoon: () => void;
  /** Re-read every page in view soon (a change that may have moved rows anywhere). */
  invalidate: () => void;
}

interface Page<T> {
  rows: T[];
  epoch: number;
}

interface Held<T> {
  key: string;
  total: number;
  pages: Map<number, Page<T>>;
  epoch: number;
  loaded: boolean;
  version: number;
}

const EMPTY: Held<never> = { key: "", total: 0, pages: new Map(), epoch: 0, loaded: false, version: 0 };

/** Answers per list kind, shared by every mount of that kind. */
const memories = new Map<string, { answered: Map<string, PagedAnswer<unknown>>; asking: Map<string, Promise<PagedAnswer<unknown>>> }>();
const MEMORY_MAX = 24;

function memoryOf(kind: string) {
  let m = memories.get(kind);
  if (!m) {
    m = { answered: new Map(), asking: new Map() };
    memories.set(kind, m);
  }
  return m;
}

function sameIds<T extends { id: string }>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((r, i) => r.id === b[i].id);
}

/** Keep a row object when nothing about it changed: memoised rows stay put. */
function reuse<T extends { id: string }>(prev: readonly T[] | undefined, next: T[]): T[] {
  if (!prev) return next;
  const byId = new Map(prev.map((r) => [r.id, r]));
  return next.map((r) => {
    const old = byId.get(r.id);
    return old && JSON.stringify(old) === JSON.stringify(r) ? old : r;
  });
}

export function foldPage<T extends { id: string }>(
  prev: Held<T>,
  key: string,
  page: number,
  answer: PagedAnswer<T>,
): Held<T> {
  if (prev.key !== key) {
    if (page !== 0) return prev;
    return {
      key,
      total: answer.total,
      pages: new Map([[0, { rows: answer.items, epoch: 0 }]]),
      epoch: 0,
      loaded: true,
      version: prev.version + 1,
    };
  }
  const old = prev.pages.get(page);
  const rows = reuse(old?.rows, answer.items);
  const shifted = answer.total !== prev.total || (old !== undefined && !sameIds(old.rows, rows));
  const changed = old === undefined || shifted || rows.some((r, i) => r !== old.rows[i]);
  if (!changed && old.epoch === prev.epoch) return prev;
  const epoch = shifted ? prev.epoch + 1 : prev.epoch;
  const pages = new Map(prev.pages);
  pages.set(page, { rows, epoch });
  return { ...prev, total: answer.total, pages, epoch, loaded: true, version: changed ? prev.version + 1 : prev.version };
}

/**
 * The list for `key`, fetched with `fetchPage`. `kind` names the memory the
 * answers are kept in (one per index); `key` must change whenever what
 * `fetchPage` asks for does.
 */
export function usePagedList<T extends { id: string }>(options: {
  kind: string;
  key: string;
  enabled: boolean;
  pageSize: number;
  fetchPage: (page: number) => Promise<PagedAnswer<T>>;
  refreshDebounceMs?: number;
  refreshIntervalMs?: number;
}): PagedList<T> {
  const { kind, key, enabled, pageSize, fetchPage } = options;
  const debounce = options.refreshDebounceMs ?? 600;
  const interval = options.refreshIntervalMs ?? 30_000;
  const memory = memoryOf(kind);

  const seeded = (): Held<T> => {
    const first = memory.answered.get(`${key}|0`) as PagedAnswer<T> | undefined;
    if (!first) return EMPTY;
    return { key, total: first.total, pages: new Map([[0, { rows: first.items, epoch: 0 }]]), epoch: 0, loaded: true, version: 1 };
  };

  const [held, setHeld] = useState<Held<T>>(seeded);
  const heldRef = useRef(held);
  heldRef.current = held;
  const [inflightCount, setInflightCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const ask = useCallback(
    (page: number): Promise<PagedAnswer<T>> => {
      const tag = `${key}|${page}`;
      const pending = memory.asking.get(tag) as Promise<PagedAnswer<T>> | undefined;
      if (pending) return pending;
      const request = fetchRef.current(page)
        .then((answer) => {
          memory.answered.delete(tag);
          memory.answered.set(tag, answer);
          while (memory.answered.size > MEMORY_MAX) {
            const oldest = memory.answered.keys().next().value;
            if (oldest === undefined) break;
            memory.answered.delete(oldest);
          }
          return answer;
        })
        .finally(() => memory.asking.delete(tag));
      memory.asking.set(tag, request);
      return request;
    },
    [key, memory],
  );

  const load = useCallback(
    (page: number, refresh = false) => {
      const h = heldRef.current;
      const epoch = h.key === key ? h.epoch : -1;
      const tag = `${key}|${page}|${refresh ? "refresh" : epoch}`;
      if (inflight.current.has(tag)) return;
      inflight.current.add(tag);
      setInflightCount((n) => n + 1);
      ask(page)
        .then((answer) => {
          setError(null);
          setHeld((prev) => foldPage(prev, key, page, answer));
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
          if (page === 0) {
            setHeld((prev) =>
              prev.key === key ? { ...prev, loaded: true } : { ...(EMPTY as Held<T>), key, loaded: true, version: prev.version + 1 },
            );
          }
        })
        .finally(() => {
          inflight.current.delete(tag);
          setInflightCount((n) => n - 1);
        });
    },
    [key, ask],
  );

  // A new filter: what this tab remembers of it at once, then its first page.
  useEffect(() => {
    if (!enabled) return;
    setHeld((prev) => {
      if (prev.key === key) return prev;
      const memo = seeded();
      return memo.loaded ? { ...memo, version: prev.version + 1 } : prev;
    });
    load(0, true);
    // seeded reads the memory for this key only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, load]);

  const ensure = useCallback(
    (start: number, end: number) => {
      const h = heldRef.current;
      if (h.key !== key || h.total === 0) return;
      const first = Math.max(0, Math.floor(start / pageSize));
      const last = Math.floor((Math.min(end, h.total) - 1) / pageSize);
      for (let p = first; p <= last; p++) {
        const page = h.pages.get(p);
        if (!page || page.epoch < h.epoch) load(p);
      }
    },
    [key, load, pageSize],
  );

  const refreshRef = useRef(() => {});
  refreshRef.current = () => {
    if (heldRef.current.key === key) load(0, true);
  };
  const refreshSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => refreshRef.current(), debounce);
  }, [debounce]);

  // A change that may move rows anywhere (a rename, a move): every held
  // page is out of date; the ones in view are re-read by `ensure`.
  const invalidate = useCallback(() => {
    setHeld((prev) => ({ ...prev, epoch: prev.epoch + 1, version: prev.version + 1 }));
    refreshSoon();
  }, [refreshSoon]);

  useEffect(() => {
    if (!enabled) return;
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") refreshRef.current();
    }, interval);
    return () => {
      clearInterval(tick);
      clearTimeout(timer.current);
    };
  }, [enabled, interval]);

  const pages = held.pages;
  const rowAt = useCallback(
    (index: number): T | undefined => pages.get(Math.floor(index / pageSize))?.rows[index % pageSize],
    [pages, pageSize],
  );

  return {
    total: held.total,
    rowAt,
    ensure,
    loaded: held.loaded,
    stale: held.key !== key,
    busy: inflightCount > 0,
    error,
    version: held.version,
    refreshSoon,
    invalidate,
  };
}
