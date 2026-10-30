// Reading a mailbox through its index rather than its documents.
//
// The Mail workspace shows rows, not messages: tens of thousands of them, of
// which a screen holds thirty. The email-index processor keeps one lean row
// per message (processors/email-index); this module reads pages of those
// rows, newest first, and the counts beside them. Where the drive is a
// remote, the switchboard answers over GraphQL (the processor runs there);
// where the tab's own reactor holds the drive, the same queries run as live
// queries on its database. The document itself is loaded only for the
// message that is open.
import {
  useAttachmentService,
  useReactorClientModule,
  useRelationalQuery,
  useSwitchboardUrl,
  useSyncList,
} from "@powerhousedao/reactor-browser";
import { indexGql as gql, indexModeOf, type IndexMode } from "./index-gql.js";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  accountTotalsQuery,
  accountUnreadQuery,
  countQuery,
  EmailIndex,
  mergeAccounts,
  messagesQuery,
  searchWords,
  toMailRow,
  type AccountTotalRow,
  type AccountUnreadRow,
  type DB,
  type EmailRow,
  type MailAccount,
  type MailRow,
  type MailView,
} from "../../../processors/email-index/index.js";

export type { MailAccount, MailRow, MailView };

export interface MailListFilter {
  /** A mailbox address, or null for every mailbox. */
  account: string | null;
  view: MailView;
  /** The top bar's search, raw. */
  query: string;
}

/**
 * A mailbox list sized to the whole filtered set. Rows arrive by page, so
 * any index may not be loaded yet: `rowAt` answers undefined there and the
 * view shows a placeholder until `ensure` has fetched it. That is what lets
 * the scrollbar be the mailbox's real size from the first frame, and a drag
 * to the middle fetch the middle rather than everything above it.
 */
export interface MailList {
  /** Every message the filters match. */
  total: number;
  rowAt: (index: number) => MailRow | undefined;
  /** Fetch the pages covering rows [start, end). */
  ensure: (start: number, end: number) => void;
  /** Some filter has answered (or failed) at least once. */
  loaded: boolean;
  /** The rows shown belong to the previous filter; the new one is on its way. */
  stale: boolean;
  /** A request is in flight. */
  busy: boolean;
  error: string | null;
  /** Bumps when what the list holds changed, for the counts beside it. */
  version: number;
  /** Re-read the top of the list soon, coalescing bursts. */
  refreshSoon: () => void;
  /** Apply a change this tab just made, ahead of the index. */
  patch: (id: string, change: Partial<MailRow>) => void;
}

/* ---------------------------------------------------------------- mode */

/** Where the index for this drive is answered from; see `indexModeOf`. */
export function useMailIndexMode(drive: DocumentDriveDocument | undefined): IndexMode {
  const remotes = useSyncList();
  const switchboardUrl = useSwitchboardUrl();
  const module = useReactorClientModule();
  const attachments = useAttachmentService();
  const driveId = drive?.header.id;
  return useMemo<IndexMode>(
    () =>
      driveId
        ? indexModeOf(driveId, { remotes, module, attachments, switchboardUrl })
        : { kind: "unknown" },
    [driveId, remotes, module, attachments, switchboardUrl],
  );
}

/* -------------------------------------------------------------- remote */

const MESSAGES_QUERY = `query ($d: String!, $a: String, $v: MailView, $q: String, $o: Int, $l: Int) {
  emailIndex { messages(driveId: $d, account: $a, view: $v, query: $q, offset: $o, limit: $l) {
    items { id accountAddress accountName subject fromName fromAddress snippet when read flagged status attachmentCount attachmentRefs labels threadId }
    total
  } }
}`;

const ACCOUNTS_QUERY = `query ($d: String!) {
  emailIndex { accounts(driveId: $d) { address name provider total unread } }
}`;

/**
 * Rows per request. A screen shows a dozen rows, so fifty is a few screens:
 * small enough that the first answer is quick on a slow link, large enough
 * that a steady scroll asks rarely.
 */
export const MAIL_PAGE = 50;

/**
 * Answers this tab already has, shared by every mount. Opening Mail again
 * paints the last first page on the first frame and revalidates behind it;
 * two mounts asking for the same page at once (a remount, a second pane)
 * share one request.
 */
const answered = new Map<string, PageAnswer>();
const asking = new Map<string, Promise<PageAnswer>>();
/** Filters remembered; the oldest is forgotten past this many. */
const ANSWERED_MAX = 24;

function remember(tag: string, answer: PageAnswer): void {
  answered.delete(tag);
  answered.set(tag, answer);
  while (answered.size > ANSWERED_MAX) {
    const oldest = answered.keys().next().value;
    if (oldest === undefined) break;
    answered.delete(oldest);
  }
}

/** What a mount starts from: the remembered first page of its filter, if any. */
function seeded(key: string): Held {
  const first = answered.get(`${key}|0`);
  if (!first) return EMPTY_HELD;
  return {
    key,
    total: first.total,
    pages: new Map([[0, { rows: first.items, epoch: 0 }]]),
    epoch: 0,
    loaded: true,
    version: 1,
  };
}

/** How long a burst of changes is left to settle before the top is re-read. */
const REFRESH_DEBOUNCE_MS = 800;
/** A quiet mailbox is still re-read now and then: triage from another tab. */
const REFRESH_INTERVAL_MS = 30_000;

interface Page {
  rows: MailRow[];
  /** The epoch the page was read in; an older one is shown but re-read. */
  epoch: number;
}

/**
 * What the list holds for one filter. The epoch moves when the set shifted
 * under the loaded pages (new mail on top, a message leaving the view): a
 * page from an older epoch is still shown, so nothing blanks, and is re-read
 * the next time it is in view.
 */
export interface Held {
  key: string;
  total: number;
  pages: Map<number, Page>;
  epoch: number;
  loaded: boolean;
  version: number;
}

export const EMPTY_HELD: Held = {
  key: "",
  total: 0,
  pages: new Map(),
  epoch: 0,
  loaded: false,
  version: 0,
};

const sameIds = (a: readonly MailRow[], b: readonly MailRow[]) =>
  a.length === b.length && a.every((r, i) => r.id === b[i].id);

/** Keep a row object when the index says nothing about it changed: memoised rows stay put. */
function reuse(prev: readonly MailRow[] | undefined, next: MailRow[]): MailRow[] {
  if (!prev) return next;
  const byId = new Map(prev.map((r) => [r.id, r]));
  return next.map((r) => {
    const old = byId.get(r.id);
    return old && JSON.stringify(old) === JSON.stringify(r) ? old : r;
  });
}

export interface PageAnswer {
  items: MailRow[];
  total: number;
}

/** Fold one page's answer into what is held for the current filter. */
export function foldPage(prev: Held, key: string, page: number, answer: PageAnswer): Held {
  // A new filter replaces what was held only when its first page lands.
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
  const shifted =
    answer.total !== prev.total || (old !== undefined && !sameIds(old.rows, rows));
  const changed =
    old === undefined || shifted || rows.some((r, i) => r !== old.rows[i]);
  if (!changed && old.epoch === prev.epoch) return prev;
  // The set moved under the other pages: they are re-read when next in view.
  const epoch = shifted ? prev.epoch + 1 : prev.epoch;
  const pages = new Map(prev.pages);
  pages.set(page, { rows, epoch });
  return {
    ...prev,
    total: answer.total,
    pages,
    epoch,
    loaded: true,
    version: changed ? prev.version + 1 : prev.version,
  };
}

function useRemoteMail(
  base: string | null,
  driveId: string | null,
  filter: MailListFilter,
  words: readonly string[],
): MailList {
  const key = JSON.stringify([base, driveId, filter.account, filter.view, words]);
  const [held, setHeld] = useState<Held>(() => seeded(key));
  const heldRef = useRef(held);
  heldRef.current = held;
  const [inflightCount, setInflightCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchPage = useCallback(
    (page: number): Promise<PageAnswer> => {
      if (!base || !driveId) return Promise.reject(new Error("No switchboard for this drive"));
      const tag = `${key}|${page}`;
      const pending = asking.get(tag);
      if (pending) return pending;
      const request = gql<{ emailIndex: { messages: PageAnswer } }>(
        base,
        MESSAGES_QUERY,
        {
          d: driveId,
          a: filter.account,
          v: filter.view.toUpperCase(),
          q: words.join(" ") || null,
          o: page * MAIL_PAGE,
          l: MAIL_PAGE,
        },
      )
        .then((data) => {
          remember(tag, data.emailIndex.messages);
          return data.emailIndex.messages;
        })
        .finally(() => asking.delete(tag));
      asking.set(tag, request);
      return request;
    },
    [key, base, driveId, filter.account, filter.view, words],
  );

  /** Read one page and fold it in. One request per page and epoch at a time. */
  const load = useCallback(
    (page: number, refresh = false) => {
      const h = heldRef.current;
      const epoch = h.key === key ? h.epoch : -1;
      const tag = `${key}|${page}|${refresh ? "refresh" : epoch}`;
      if (inflight.current.has(tag)) return;
      inflight.current.add(tag);
      setInflightCount((n) => n + 1);
      fetchPage(page)
        .then((answer) => {
          setError(null);
          setHeld((prev) => foldPage(prev, key, page, answer));
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
          // A filter that cannot answer still stops being "on its way".
          if (page === 0) {
            setHeld((prev) =>
              prev.key === key
                ? { ...prev, loaded: true }
                : { ...EMPTY_HELD, key, loaded: true, version: prev.version + 1 },
            );
          }
        })
        .finally(() => {
          inflight.current.delete(tag);
          setInflightCount((n) => n - 1);
        });
    },
    [key, fetchPage],
  );

  // A new filter: show what this tab remembers of it at once, then read its
  // first page. Without a memory, the previous filter's rows stay on screen
  // until the page lands, so switching views never flashes a loader.
  useEffect(() => {
    if (!base || !driveId) return;
    setHeld((prev) => {
      if (prev.key === key) return prev;
      const memory = seeded(key);
      return memory.loaded ? { ...memory, version: prev.version + 1 } : prev;
    });
    load(0, true);
  }, [key, base, driveId, load]);

  const ensure = useCallback(
    (start: number, end: number) => {
      const h = heldRef.current;
      if (h.key !== key || h.total === 0) return;
      const first = Math.max(0, Math.floor(start / MAIL_PAGE));
      const last = Math.floor((Math.min(end, h.total) - 1) / MAIL_PAGE);
      for (let p = first; p <= last; p++) {
        const page = h.pages.get(p);
        if (!page || page.epoch < h.epoch) load(p);
      }
    },
    [key, load],
  );

  const refreshRef = useRef(() => {});
  refreshRef.current = () => {
    if (heldRef.current.key === key) load(0, true);
  };

  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => refreshRef.current(), REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") refreshRef.current();
    }, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(refreshTimer.current);
    };
  }, []);

  const patch = useCallback((id: string, change: Partial<MailRow>) => {
    setHeld((prev) => {
      for (const [n, page] of prev.pages) {
        const at = page.rows.findIndex((r) => r.id === id);
        if (at < 0) continue;
        const rows = page.rows.slice();
        rows[at] = { ...rows[at], ...change };
        const pages = new Map(prev.pages);
        pages.set(n, { ...page, rows });
        return { ...prev, pages };
      }
      return prev;
    });
  }, []);

  const pages = held.pages;
  const rowAt = useCallback(
    (index: number): MailRow | undefined =>
      pages.get(Math.floor(index / MAIL_PAGE))?.rows[index % MAIL_PAGE],
    [pages],
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
    patch,
  };
}

/** How long after a failed account count to ask again. */
const ACCOUNTS_RETRY_MS = 5_000;

function useRemoteAccounts(
  base: string | null,
  driveId: string | null,
  version: number,
): MailAccount[] | null {
  const [accounts, setAccounts] = useState<{ key: string; list: MailAccount[] } | null>(null);
  // Bumped to ask again after a failure: a switchboard that was busy or
  // restarting must not leave the inbox tabs empty until the next change.
  const [attempt, setAttempt] = useState(0);
  const key = `${base ?? ""}|${driveId ?? ""}`;
  const known = accounts?.key === key;
  useEffect(() => {
    if (!base || !driveId) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Coalesced: a run of page loads asks once.
    const timer = setTimeout(
      () => {
        gql<{ emailIndex: { accounts: MailAccount[] } }>(base, ACCOUNTS_QUERY, { d: driveId })
          .then((data) => {
            if (active) setAccounts({ key, list: data.emailIndex.accounts });
          })
          .catch(() => {
            // Keep what was known; ask again shortly.
            if (active) retry = setTimeout(() => setAttempt((n) => n + 1), ACCOUNTS_RETRY_MS);
          });
      },
      known ? 600 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(retry);
    };
  }, [base, driveId, key, version, known, attempt]);
  return known ? accounts.list : null;
}

/* --------------------------------------------------------------- local */

type LocalParams = {
  account: string | null;
  view: MailView;
  words: string[];
  offset: number;
  limit: number;
};
type LocalQB = Parameters<
  Parameters<typeof useRelationalQuery<DB, EmailRow, LocalParams>>[2]
>[0];

/**
 * The same list over the tab's own database: a live query over the window
 * in view, a page either side, so the database rather than the tab holds
 * the mailbox.
 */
function useLocalMail(
  enabled: boolean,
  driveId: string | null,
  filter: MailListFilter,
  words: string[],
): MailList {
  const key = JSON.stringify([driveId, filter.account, filter.view, words]);
  const [range, setRange] = useState({ key, offset: 0 });
  const offset = range.key === key ? range.offset : 0;
  const limit = enabled ? MAIL_PAGE * 3 : 1;
  const params = useMemo<LocalParams>(
    () => ({ account: filter.account, view: filter.view, words, offset, limit }),
    [filter.account, filter.view, words, offset, limit],
  );
  const buildRows = useCallback(
    (db: LocalQB, p?: LocalParams) => {
      const q = p ?? params;
      return messagesQuery(db, q, { offset: q.offset, limit: q.limit }).compile();
    },
    [params],
  );
  const buildCount = useCallback(
    (db: LocalQB, p?: LocalParams) => countQuery(db, p ?? params).compile(),
    [params],
  );
  const rowsQ = useRelationalQuery<DB, EmailRow, LocalParams>(
    EmailIndex,
    driveId ?? "",
    buildRows,
    params,
  );
  const countQ = useRelationalQuery<DB, { n: number | string }, LocalParams>(
    EmailIndex,
    driveId ?? "",
    buildCount,
    params,
  );
  // A result belongs to the window that was current when it arrived.
  const result = rowsQ.result;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const [shown, setShown] = useState<{ offset: number; rows: MailRow[] }>({
    offset: 0,
    rows: [],
  });
  useEffect(() => {
    if (result) {
      setShown({
        offset: offsetRef.current,
        rows: result.rows.slice(0, limit).map(toMailRow),
      });
    }
  }, [result, limit]);
  const total = Number(countQ.result?.rows[0]?.n ?? shown.rows.length);
  const ensure = useCallback(
    (start: number) => {
      const want = Math.max(0, Math.floor(start / MAIL_PAGE) - 1) * MAIL_PAGE;
      setRange((prev) =>
        prev.key === key && prev.offset === want ? prev : { key, offset: want },
      );
    },
    [key],
  );
  const rowAt = useCallback(
    (index: number): MailRow | undefined => {
      const at = index - shown.offset;
      return at >= 0 && at < shown.rows.length ? shown.rows[at] : undefined;
    },
    [shown],
  );
  const noop = useCallback(() => {}, []);
  return {
    total,
    rowAt,
    ensure,
    loaded: enabled && Boolean(result),
    stale: false,
    busy: enabled && rowsQ.isLoading,
    error: rowsQ.error?.message ?? null,
    version: total,
    // live queries refresh themselves, and a patch would be undone by one
    refreshSoon: noop,
    patch: noop,
  };
}

type AccountsQB = Parameters<
  Parameters<typeof useRelationalQuery<DB, AccountTotalRow, null>>[2]
>[0];

function useLocalAccounts(enabled: boolean, driveId: string | null): MailAccount[] | null {
  const totals = useRelationalQuery<DB, AccountTotalRow, null>(
    EmailIndex,
    driveId ?? "",
    useCallback((db: AccountsQB) => accountTotalsQuery(db).compile(), []),
    null,
  );
  const unread = useRelationalQuery<DB, AccountUnreadRow, null>(
    EmailIndex,
    driveId ?? "",
    useCallback((db: AccountsQB) => accountUnreadQuery(db).compile(), []),
    null,
  );
  return useMemo(() => {
    if (!enabled || !totals.result) return null;
    return mergeAccounts(totals.result.rows, unread.result?.rows ?? []);
  }, [enabled, totals.result, unread.result]);
}

/* ---------------------------------------------------------------- api */

/** The drive's mail, filtered, newest first, sized to the whole set. */
export function useMailList(
  drive: DocumentDriveDocument | undefined,
  filter: MailListFilter,
): MailList & { mode: IndexMode["kind"] } {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const words = useMemo(() => searchWords(filter.query), [filter.query]);
  const remote = useRemoteMail(
    mode.kind === "remote" ? mode.base : null,
    driveId,
    filter,
    words,
  );
  const local = useLocalMail(mode.kind === "local", driveId, filter, words);
  const list = mode.kind === "local" ? local : remote;
  return { ...list, mode: mode.kind };
}

/** The mailboxes the drive holds mail for, with counts; null until known. */
export function useMailAccounts(
  drive: DocumentDriveDocument | undefined,
  version: number,
): MailAccount[] | null {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const remote = useRemoteAccounts(
    mode.kind === "remote" ? mode.base : null,
    driveId,
    version,
  );
  const local = useLocalAccounts(mode.kind === "local", driveId);
  return mode.kind === "local" ? local : remote;
}
