/**
 * Reading the mailbox index.
 *
 * Read-only by design: the index says what a mailbox holds, never changes
 * it. Triage goes through the documents, and the processor brings the index
 * up to date behind it.
 *
 * Access: a message row is one document (`document_id`); the per-mailbox
 * counts derive from those rows. Both are filtered through the host's
 * readable documents read model for the caller, once the drive itself
 * passed (`indexAccess`), so a count never includes a message the caller
 * could not open.
 */
import {
  applyReadableFilter,
  type BaseSubgraph,
  type Context,
} from "@powerhousedao/reactor-api";
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
  offset?: number | null;
  limit?: number | null;
}

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  async function messages(
    ctx: Context,
    args: MessagesArgs,
  ): Promise<MailPageResult> {
    const access = await subgraph.indexAccess(ctx, args.driveId);
    if (access.kind === "none")
      return { items: [], nextCursor: null, total: 0 };
    const db = EmailIndex.query(args.driveId, subgraph.relationalDb);
    const view = (args.view ?? "inbox").toLowerCase() as MailView;
    const filter = {
      account: args.account ?? null,
      view: VIEWS.has(view) ? view : "inbox",
      words: searchWords(args.query),
    };
    const limit = Math.min(Math.max(args.limit ?? MAIL_PAGE, 1), MAIL_PAGE_MAX);
    const [rows, count] = await Promise.all([
      applyReadableFilter(
        messagesQuery(db, filter, {
          cursor: decodeCursor(args.cursor),
          offset: Math.max(0, Math.floor(args.offset ?? 0)),
          limit,
        }),
        "document_id",
        access,
      ).execute(),
      applyReadableFilter(
        countQuery(db, filter),
        "document_id",
        access,
      ).executeTakeFirst(),
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

  async function accounts(
    ctx: Context,
    driveId: string,
  ): Promise<MailAccount[]> {
    const access = await subgraph.indexAccess(ctx, driveId);
    if (access.kind === "none") return [];
    const db = EmailIndex.query(driveId, subgraph.relationalDb);
    const [totals, unread] = await Promise.all([
      applyReadableFilter(
        accountTotalsQuery(db),
        "document_id",
        access,
      ).execute(),
      applyReadableFilter(
        accountUnreadQuery(db),
        "document_id",
        access,
      ).execute(),
    ]);
    return mergeAccounts(totals, unread);
  }

  return {
    Query: {
      emailIndex: () => ({}),
    },
    EmailIndexQueries: {
      messages: (_parent: unknown, args: MessagesArgs, ctx: Context) =>
        messages(ctx, args),
      accounts: (_parent: unknown, args: { driveId: string }, ctx: Context) =>
        accounts(ctx, args.driveId),
    },
  };
};
