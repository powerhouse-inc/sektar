/**
 * Reading the Files index. Read-only: the drive and the File documents are
 * changed through their own operations, and the processor follows.
 *
 * Access: a file row is one document (the node id is the File document's
 * id), filtered through the host's readable documents read model for the
 * caller once the drive passed (`indexAccess`). A folder row is drive
 * structure, not a document: it is listed whenever the drive is, so the
 * tree stays navigable, and what it holds is filtered file by file.
 */
import {
  applyReadableFilter,
  type BaseSubgraph,
  type Context,
  type ReadableFilter,
} from "@powerhousedao/reactor-api";
import {
  FILES_PAGE,
  FILES_PAGE_MAX,
  FilesIndex,
  foldersQuery,
  listingCountQuery,
  listingQuery,
  scopeFor,
  searchWords,
  toListRow,
  type FileListPage,
} from "processors/files-index";

interface ListingArgs {
  driveId: string;
  folderId?: string | null;
  deep?: boolean | null;
  query?: string | null;
  offset?: number | null;
  limit?: number | null;
  syncFirst?: boolean | null;
}

/** Folders pass; a file row passes when its document is readable. */
function readableNodes<Q extends { where(...args: any[]): Q }>(
  q: Q,
  access: ReadableFilter,
): Q {
  return applyReadableFilter(q, "n.id", access, {
    passWhen: { column: "n.kind", equals: "folder" },
  });
}

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  async function listing(
    ctx: Context,
    args: ListingArgs,
  ): Promise<FileListPage> {
    const access = await subgraph.indexAccess(ctx, args.driveId);
    if (access.kind === "none") return { items: [], total: 0 };
    const db = FilesIndex.query(args.driveId, subgraph.relationalDb);
    const deep = Boolean(args.deep);
    const folderId = args.folderId ?? null;
    // A deep listing below a folder needs its descendants; the folders are
    // a small table, read once per request.
    const folders = deep && folderId ? await foldersQuery(db).execute() : [];
    const filter = {
      scope: scopeFor(folders, folderId, deep),
      filesOnly: deep,
      words: searchWords(args.query),
    };
    const limit = Math.min(
      Math.max(args.limit ?? FILES_PAGE, 1),
      FILES_PAGE_MAX,
    );
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    const [rows, count] = await Promise.all([
      readableNodes(
        listingQuery(
          db,
          filter,
          { offset, limit },
          { syncFirst: Boolean(args.syncFirst) },
        ),
        access,
      ).execute(),
      readableNodes(listingCountQuery(db, filter), access).executeTakeFirst(),
    ]);
    return { items: rows.map(toListRow), total: Number(count?.n ?? 0) };
  }

  return {
    Query: { filesIndex: () => ({}) },
    FilesIndexQueries: {
      listing: (_parent: unknown, args: ListingArgs, ctx: Context) =>
        listing(ctx, args),
    },
  };
};
