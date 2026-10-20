/**
 * Reading the mailbox index.
 *
 * Read-only by design: the index says what a mailbox holds, never changes
 * it. Triage goes through the documents, and the processor brings the index
 * up to date behind it.
 */
import { type BaseSubgraph } from "@powerhousedao/reactor-api";
import {
  accountTotalsQuery,
  accountUnreadQuery,
  countQuery,
  decodeCursor,
  EmailIndex,
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

const VIEWS = new Set<MailView>(["inbox", "unread", "flagged", "archived"]);

interface MessagesArgs {
  driveId: string;
  account?: string | null;
  view?: string | null;
  query?: string | null;
  cursor?: string | null;
  limit?: number | null;
}

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  async function messages(args: MessagesArgs): Promise<MailPageResult> {
    const db = EmailIndex.query(args.driveId, subgraph.relationalDb);
    const view = (args.view ?? "inbox").toLowerCase() as MailView;
    const filter = {
      account: args.account ?? null,
      view: VIEWS.has(view) ? view : "inbox",
      words: searchWords(args.query),
    };
    const limit = Math.min(Math.max(args.limit ?? MAIL_PAGE, 1), MAIL_PAGE_MAX);
    const [rows, count] = await Promise.all([
      messagesQuery(db, filter, { cursor: decodeCursor(args.cursor), limit }).execute(),
      countQuery(db, filter).executeTakeFirst(),
    ]);
    const more = rows.length > limit;
    const page = more ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map(toMailRow),
      nextCursor:
        more && last ? encodeCursor({ when: last.when_at, id: last.document_id }) : null,
      total: Number(count?.n ?? 0),
    };
  }

  async function accounts(driveId: string): Promise<MailAccount[]> {
    const db = EmailIndex.query(driveId, subgraph.relationalDb);
    const [totals, unread] = await Promise.all([
      accountTotalsQuery(db).execute(),
      accountUnreadQuery(db).execute(),
    ]);
    return mergeAccounts(totals, unread);
  }

  return {
    Query: {
      emailIndex: () => ({}),
    },
    EmailIndexQueries: {
      messages: (_parent: unknown, args: MessagesArgs) => messages(args),
      accounts: (_parent: unknown, args: { driveId: string }) =>
        accounts(args.driveId),
    },
  };
};
