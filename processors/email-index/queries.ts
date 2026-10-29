// The questions a mailbox answers, as queries over the index. Shared by the
// subgraph (the switchboard answers Connect over GraphQL) and by a tab whose
// own reactor runs the processor (standalone Connect, a live query), so the
// two never disagree on what "unread" or "a match" means.
// The declarations name kysely's builder types (these queries return them):
// importing the package lets tsc refer to "kysely", not to a path into .pnpm.
import type {} from "kysely";
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { DB, EmailRow } from "./schema.js";

export type MailView = "inbox" | "unread" | "flagged" | "archived";

/** What both a namespaced query builder and a Kysely instance offer. */
export type MailQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

export interface MailFilter {
  /** A mailbox address; every mailbox when absent. */
  account?: string | null;
  view?: MailView;
  /** Lower-cased words, each of which must appear in the row's search text. */
  words?: readonly string[];
}

/** Where a page ends: the last row's listing instant and id. */
export interface MailCursor {
  when: string;
  id: string;
}

/** Rows per page by default; the subgraph caps a request at MAIL_PAGE_MAX. */
export const MAIL_PAGE = 100;
export const MAIL_PAGE_MAX = 500;

/** A message as the list shows it: the row, in the subgraph's vocabulary. */
export interface MailRow {
  id: string;
  accountAddress: string | null;
  accountName: string | null;
  subject: string | null;
  fromName: string | null;
  fromAddress: string | null;
  snippet: string | null;
  when: string;
  read: boolean;
  flagged: boolean;
  status: string;
  attachmentCount: number;
  attachmentRefs: string[];
  labels: string[];
  threadId: string | null;
}

export interface MailPageResult {
  items: MailRow[];
  nextCursor: string | null;
  total: number;
}

export interface MailAccount {
  address: string;
  name: string;
  provider: string | null;
  total: number;
  unread: number;
}

/** The words of a search, lower-cased, at most `max` of them. */
export function searchWords(
  query: string | null | undefined,
  max = 6,
): string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** LIKE's own wildcards are dropped from a word: a search is for text, not patterns. */
function likeWord(word: string): string {
  return `%${word.replace(/[%_\\]/g, "")}%`;
}

function filtered(db: MailQueryBuilder, f: MailFilter) {
  const view = f.view ?? "inbox";
  let q = db
    .selectFrom("email_index")
    .where("captured", "=", true)
    .where("status", "=", view === "archived" ? "ARCHIVED" : "INBOX");
  if (view === "unread") q = q.where("read", "=", false);
  if (view === "flagged") q = q.where("flagged", "=", true);
  if (f.account) q = q.where("account_address", "=", f.account);
  for (const word of f.words ?? []) {
    if (word) q = q.where("search_text", "like", likeWord(word));
  }
  return q;
}

/**
 * One page, newest first: the rows after `cursor` in (when_at, document_id)
 * order, or from row `offset` of that order. A cursor is for reading on from
 * a page; an offset is for jumping to where the scrollbar was dragged, which
 * a list sized to the whole mailbox needs. Both walk the (when_at,
 * document_id) index. Asks for one row more than the page so the caller
 * knows whether another page exists without a second query.
 */
export function messagesQuery(
  db: MailQueryBuilder,
  f: MailFilter,
  page: { cursor?: MailCursor | null; offset?: number | null; limit: number },
) {
  let q = filtered(db, f).selectAll();
  const cursor = page.cursor;
  if (cursor) {
    q = q.where((eb) =>
      eb.or([
        eb("when_at", "<", cursor.when),
        eb.and([eb("when_at", "=", cursor.when), eb("document_id", "<", cursor.id)]),
      ]),
    );
  }
  const ordered = q
    .orderBy("when_at", "desc")
    .orderBy("document_id", "desc")
    .limit(page.limit + 1);
  return !cursor && page.offset ? ordered.offset(page.offset) : ordered;
}

/** How many rows the filters match. */
export function countQuery(db: MailQueryBuilder, f: MailFilter) {
  return filtered(db, f).select((eb) => eb.fn.countAll<number>().as("n"));
}

/** Messages per mailbox. */
export function accountTotalsQuery(db: MailQueryBuilder) {
  return db
    .selectFrom("email_index")
    .where("captured", "=", true)
    .select("account_address")
    .select((eb) => [
      eb.fn.max("account_name").as("name"),
      eb.fn.max("account_provider").as("provider"),
      eb.fn.countAll<number>().as("n"),
    ])
    .groupBy("account_address");
}

/** Unread inbox messages per mailbox. */
export function accountUnreadQuery(db: MailQueryBuilder) {
  return db
    .selectFrom("email_index")
    .where("captured", "=", true)
    .where("status", "=", "INBOX")
    .where("read", "=", false)
    .select("account_address")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .groupBy("account_address");
}

export interface AccountTotalRow {
  account_address: string | null;
  name: string | null;
  provider: string | null;
  n: number | string;
}

export interface AccountUnreadRow {
  account_address: string | null;
  n: number | string;
}

/** The two per-mailbox counts folded into one list, by name. */
export function mergeAccounts(
  totals: readonly AccountTotalRow[],
  unread: readonly AccountUnreadRow[],
): MailAccount[] {
  const unreadBy = new Map(
    unread.map((r) => [r.account_address ?? "unknown", Number(r.n)]),
  );
  return totals
    .map((r) => {
      const address = r.account_address ?? "unknown";
      return {
        address,
        name: r.name ?? address,
        provider: r.provider ?? null,
        total: Number(r.n),
        unread: unreadBy.get(address) ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** A stored row in the list's vocabulary. */
export function toMailRow(r: EmailRow): MailRow {
  const files = parseJson<{ ref: string }[]>(r.attachments, []);
  return {
    id: r.document_id,
    accountAddress: r.account_address,
    accountName: r.account_name,
    subject: r.subject,
    fromName: r.from_name,
    fromAddress: r.from_address,
    snippet: r.snippet,
    when: r.when_at,
    // SQLite has no boolean, so a driver may hand back 0/1.
    read: Boolean(r.read),
    flagged: Boolean(r.flagged),
    status: r.status,
    attachmentCount: Number(r.attachment_count),
    attachmentRefs: [...new Set(files.map((f) => f.ref))],
    labels: parseJson<string[]>(r.labels, []),
    threadId: r.thread_id,
  };
}

/** A cursor as a string a client can hand back, opaque to it. */
export function encodeCursor(c: MailCursor): string {
  return `${encodeURIComponent(c.when)}|${encodeURIComponent(c.id)}`;
}

export function decodeCursor(text: string | null | undefined): MailCursor | null {
  if (!text) return null;
  const at = text.indexOf("|");
  if (at <= 0) return null;
  try {
    return {
      when: decodeURIComponent(text.slice(0, at)),
      id: decodeURIComponent(text.slice(at + 1)),
    };
  } catch {
    return null;
  }
}
