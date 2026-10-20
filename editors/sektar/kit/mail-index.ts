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
  DriveCollectionId,
  getPHStore,
  getSwitchboardBaseFromChannelUrl,
  useAttachmentService,
  useReactorClientModule,
  useRelationalQuery,
  useSwitchboardUrl,
  useSyncList,
} from "@powerhousedao/reactor-browser";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  accountTotalsQuery,
  accountUnreadQuery,
  countQuery,
  EmailIndex,
  MAIL_PAGE,
  mergeAccounts,
  messagesQuery,
  searchWords,
  toMailRow,
  type AccountTotalRow,
  type AccountUnreadRow,
  type DB,
  type EmailRow,
  type MailAccount,
  type MailPageResult,
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

export interface MailList {
  rows: MailRow[];
  /** Every message the filters match, not just the rows loaded. */
  total: number;
  hasMore: boolean;
  /** The first page of this filter has arrived (or failed). */
  loaded: boolean;
  /** A request is in flight. */
  busy: boolean;
  error: string | null;
  /** Bumps when the top of the list was (re)read, for the counts beside it. */
  version: number;
  loadMore: () => void;
  /** Re-read the top of the list soon, coalescing bursts. */
  refreshSoon: () => void;
  /** Apply a change this tab just made, ahead of the index. */
  patch: (id: string, change: Partial<MailRow>) => void;
}

/* ---------------------------------------------------------------- mode */

type Mode =
  | { kind: "remote"; base: string }
  | { kind: "local" }
  | { kind: "unknown" };

/**
 * Where the index for this drive is answered from. A synchronized remote
 * drive's channel URL names its switchboard (the way the framework builds
 * its own switchboard links); a tab with its own reactor and no remote for
 * the drive queries locally. A pure remote client (the studio and cli
 * Connect) has neither a sync list nor a GraphQL client in the store: its
 * switchboard is the one the attachment service talks to, which is the
 * origin every read and write already goes to.
 */
export function useMailIndexMode(drive: DocumentDriveDocument | undefined): Mode {
  const remotes = useSyncList();
  const switchboardUrl = useSwitchboardUrl();
  const module = useReactorClientModule();
  const attachments = useAttachmentService();
  const driveId = drive?.header.id;
  return useMemo<Mode>(() => {
    if (!driveId) return { kind: "unknown" };
    const remote = remotes.find((r) =>
      r.meta.collectionId.equals(DriveCollectionId.forDrive(driveId)),
    );
    const channelUrl = (
      remote?.channel as { config?: { url?: unknown } } | undefined
    )?.config?.url;
    if (typeof channelUrl === "string" && channelUrl) {
      return { kind: "remote", base: getSwitchboardBaseFromChannelUrl(channelUrl) };
    }
    if (module?.kind === "browser") return { kind: "local" };
    const gql = (getPHStore()?.reactorGraphQLClient as { url?: unknown } | undefined)
      ?.url;
    const store = (attachments as { store?: { remoteUrl?: unknown } } | undefined)
      ?.store?.remoteUrl;
    const fallback =
      typeof gql === "string" && gql
        ? gql
        : typeof store === "string" && store
          ? store
          : typeof switchboardUrl === "string"
            ? switchboardUrl
            : "";
    if (fallback) {
      return { kind: "remote", base: fallback.replace(/\/graphql(\/.*)?$/, "") };
    }
    return { kind: "unknown" };
  }, [driveId, remotes, module, attachments, switchboardUrl]);
}

/* -------------------------------------------------------------- remote */

const MESSAGES_QUERY = `query ($d: String!, $a: String, $v: MailView, $q: String, $c: String, $l: Int) {
  emailIndex { messages(driveId: $d, account: $a, view: $v, query: $q, cursor: $c, limit: $l) {
    items { id accountAddress accountName subject fromName fromAddress snippet when read flagged status attachmentCount attachmentRefs labels threadId }
    nextCursor total
  } }
}`;

const ACCOUNTS_QUERY = `query ($d: String!) {
  emailIndex { accounts(driveId: $d) { address name provider total unread } }
}`;

async function gql<T>(
  base: string,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  const json = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error(`The index answered ${response.status}`);
  return json.data;
}

/** How long a burst of changes is left to settle before the top is re-read. */
const REFRESH_DEBOUNCE_MS = 800;
/** A quiet mailbox is still re-read now and then: triage from another tab. */
const REFRESH_INTERVAL_MS = 30_000;

interface Pages {
  key: string;
  rows: MailRow[];
  total: number;
  next: string | null;
  loaded: boolean;
  version: number;
}

function useRemoteMail(
  base: string | null,
  driveId: string | null,
  filter: MailListFilter,
  words: readonly string[],
): MailList {
  const key = JSON.stringify([base, driveId, filter.account, filter.view, words]);
  const [pages, setPages] = useState<Pages>({
    key,
    rows: [],
    total: 0,
    next: null,
    loaded: false,
    version: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Answers for a filter that is no longer current are dropped.
  const generation = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const variables = useCallback(
    (cursor: string | null, limit = MAIL_PAGE) => ({
      d: driveId,
      a: filter.account,
      v: filter.view.toUpperCase(),
      q: words.join(" ") || null,
      c: cursor,
      l: limit,
    }),
    [driveId, filter.account, filter.view, words],
  );

  const fetchPage = useCallback(
    async (cursor: string | null, limit?: number) => {
      if (!base) throw new Error("No switchboard for this drive");
      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      const data = await gql<{ emailIndex: { messages: MailPageResult } }>(
        base,
        MESSAGES_QUERY,
        variables(cursor, limit),
        controller.signal,
      );
      return data.emailIndex.messages;
    },
    [base, variables],
  );

  // A new filter: start over from the top.
  useEffect(() => {
    if (!base || !driveId) return;
    const mine = ++generation.current;
    setBusy(true);
    setError(null);
    fetchPage(null)
      .then((page) => {
        if (mine !== generation.current) return;
        setPages((prev) => ({
          key,
          rows: page.items,
          total: page.total,
          next: page.nextCursor,
          loaded: true,
          version: prev.version + 1,
        }));
      })
      .catch((e: unknown) => {
        if (mine !== generation.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setPages((prev) => ({ ...prev, key, rows: [], total: 0, next: null, loaded: true }));
      })
      .finally(() => {
        if (mine === generation.current) setBusy(false);
      });
  }, [key, base, driveId, fetchPage]);

  const loadMore = useCallback(() => {
    if (busy || !pages.next || pages.key !== key) return;
    const mine = generation.current;
    setBusy(true);
    fetchPage(pages.next)
      .then((page) => {
        if (mine !== generation.current) return;
        setPages((prev) => {
          const seen = new Set(prev.rows.map((r) => r.id));
          return {
            ...prev,
            rows: [...prev.rows, ...page.items.filter((r) => !seen.has(r.id))],
            total: page.total,
            next: page.nextCursor,
            // a further page is not news: the counts beside it stand
          };
        });
      })
      .catch((e: unknown) => {
        if (mine !== generation.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mine === generation.current) setBusy(false);
      });
  }, [busy, pages.next, pages.key, key, fetchPage]);

  /**
   * Re-read the top of the list and fold it in: new mail lands above what is
   * loaded, rows already loaded take the index's current values. Rows a
   * change elsewhere moved out of this view stay until the filter changes;
   * a list that pulls rows from under the reader is worse than one that is
   * briefly generous.
   */
  const refresh = useCallback(() => {
    if (!base || !driveId || !pages.loaded) return;
    const mine = generation.current;
    const limit = Math.min(Math.max(pages.rows.length, MAIL_PAGE), 300);
    gql<{ emailIndex: { messages: MailPageResult } }>(
      base,
      MESSAGES_QUERY,
      variables(null, limit),
    )
      .then(({ emailIndex: { messages: page } }) => {
        if (mine !== generation.current) return;
        setPages((prev) => {
          if (prev.key !== key) return prev;
          const fresh = new Map(page.items.map((r) => [r.id, r]));
          const kept = prev.rows.map((r) => fresh.get(r.id) ?? r);
          const known = new Set(kept.map((r) => r.id));
          const added = page.items.filter((r) => !known.has(r.id));
          const rows = added.length
            ? [...added, ...kept].sort(
                (a, b) => b.when.localeCompare(a.when) || b.id.localeCompare(a.id),
              )
            : kept;
          const next =
            prev.rows.length === 0 ? page.nextCursor : prev.next;
          return { ...prev, rows, total: page.total, next, version: prev.version + 1 };
        });
      })
      .catch(() => {
        // a missed refresh is caught by the next one
      });
  }, [base, driveId, pages.loaded, pages.rows.length, key, variables]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

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
    setPages((prev) => {
      const at = prev.rows.findIndex((r) => r.id === id);
      if (at < 0) return prev;
      const rows = prev.rows.slice();
      rows[at] = { ...rows[at], ...change };
      return { ...prev, rows };
    });
  }, []);

  const current = pages.key === key;
  return {
    rows: current ? pages.rows : [],
    total: current ? pages.total : 0,
    hasMore: current && pages.next !== null,
    loaded: current && pages.loaded,
    busy,
    error,
    version: pages.version,
    loadMore,
    refreshSoon,
    patch,
  };
}

function useRemoteAccounts(
  base: string | null,
  driveId: string | null,
  version: number,
): MailAccount[] | null {
  const [accounts, setAccounts] = useState<{ key: string; list: MailAccount[] } | null>(null);
  const key = `${base ?? ""}|${driveId ?? ""}`;
  useEffect(() => {
    if (!base || !driveId) return;
    let active = true;
    gql<{ emailIndex: { accounts: MailAccount[] } }>(base, ACCOUNTS_QUERY, { d: driveId })
      .then((data) => {
        if (active) setAccounts({ key, list: data.emailIndex.accounts });
      })
      .catch(() => {
        if (active) setAccounts((prev) => prev ?? { key, list: [] });
      });
    return () => {
      active = false;
    };
  }, [base, driveId, key, version]);
  return accounts?.key === key ? accounts.list : null;
}

/* --------------------------------------------------------------- local */

type LocalParams = {
  account: string | null;
  view: MailView;
  words: string[];
  limit: number;
};
type LocalQB = Parameters<
  Parameters<typeof useRelationalQuery<DB, EmailRow, LocalParams>>[2]
>[0];

function useLocalMail(
  enabled: boolean,
  driveId: string | null,
  filter: MailListFilter,
  words: string[],
): MailList {
  const [pagesWanted, setPagesWanted] = useState(1);
  const key = JSON.stringify([driveId, filter.account, filter.view, words]);
  useEffect(() => setPagesWanted(1), [key]);
  const limit = enabled ? pagesWanted * MAIL_PAGE : 1;
  const params = useMemo<LocalParams>(
    () => ({ account: filter.account, view: filter.view, words, limit }),
    [filter.account, filter.view, words, limit],
  );
  const buildRows = useCallback(
    (db: LocalQB, p?: LocalParams) =>
      messagesQuery(db, p ?? params, { limit: p?.limit ?? limit }).compile(),
    [params, limit],
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
  const result = rowsQ.result;
  const raw = useMemo(() => result?.rows ?? [], [result]);
  const rows = useMemo(() => raw.slice(0, limit).map(toMailRow), [raw, limit]);
  const loadMore = useCallback(() => setPagesWanted((n) => n + 1), []);
  const noop = useCallback(() => {}, []);
  return {
    rows,
    total: Number(countQ.result?.rows[0]?.n ?? rows.length),
    hasMore: raw.length > limit,
    loaded: enabled && !rowsQ.isLoading,
    busy: enabled && rowsQ.isLoading,
    error: rowsQ.error?.message ?? null,
    version: raw.length,
    loadMore,
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

/** A page-able, filtered list of the drive's mail, newest first. */
export function useMailList(
  drive: DocumentDriveDocument | undefined,
  filter: MailListFilter,
): MailList & { mode: Mode["kind"] } {
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
