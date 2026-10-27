/**
 * Reading the mailbox index.
 *
 * Read-only by design: the index says what a mailbox holds, never changes
 * it. Triage goes through the documents, and the processor brings the index
 * up to date behind it.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: every
 * query goes through `restrict`, which narrows it to the caller's readable
 * documents.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import {
  accountTotalsQuery,
  accountUnreadQuery,
  countQuery,
  decodeCursor,
  type EmailIndex,
  encodeCursor,
  MAIL_PAGE,
  MAIL_PAGE_MAX,
  mergeAccounts,
  messagesQuery,
  searchWords,
  toMailRow,
  type MailAccount,
  type MailPageResult,
  type MailView,
} from "processors/email-index";

type Db = EmailIndex["query"];

const VIEWS = new Set<MailView>(["inbox", "unread", "flagged", "archived"]);

interface MessagesArgs {
  driveId: string;
  account?: string | null;
  view?: string | null;
  query?: string | null;
  cursor?: string | null;
  offset?: number | null;
  limit?: number | null;
}

async function messages({
  db,
  args,
  restrict,
}: IndexQuery<Db, MessagesArgs>): Promise<MailPageResult> {
  const view = (args.view ?? "inbox").toLowerCase() as MailView;
  const filter = {
    account: args.account ?? null,
    view: VIEWS.has(view) ? view : "inbox",
    words: searchWords(args.query),
  };
  const limit = Math.min(Math.max(args.limit ?? MAIL_PAGE, 1), MAIL_PAGE_MAX);
  const [rows, count] = await Promise.all([
    restrict(
      messagesQuery(db, filter, {
        cursor: decodeCursor(args.cursor),
        offset: Math.max(0, Math.floor(args.offset ?? 0)),
        limit,
      }),
    ).execute(),
    restrict(countQuery(db, filter)).executeTakeFirst(),
  ]);
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    items: page.map(toMailRow),
    nextCursor:
      more && last
        ? encodeCursor({ when: last.when_at, id: last.document_id })
        : null,
    total: Number(count?.n ?? 0),
  };
}

async function accounts({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<MailAccount[]> {
  const [totals, unread] = await Promise.all([
    restrict(accountTotalsQuery(db)).execute(),
    restrict(accountUnreadQuery(db)).execute(),
  ]);
  return mergeAccounts(totals, unread);
}

export const resolvers = {
  Query: {
    emailIndex: () => ({}),
  },
};

export const queries = {
  "EmailIndexQueries.messages": messages,
  "EmailIndexQueries.accounts": accounts,
};
