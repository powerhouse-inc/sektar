/**
 * Reading the Files index. Read-only: the drive and the File documents are
 * changed through their own operations, and the processor follows.
 */
import { type BaseSubgraph } from "@powerhousedao/reactor-api";
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

export const getResolvers = (subgraph: BaseSubgraph): Record<string, unknown> => {
  async function listing(args: ListingArgs): Promise<FileListPage> {
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
    const limit = Math.min(Math.max(args.limit ?? FILES_PAGE, 1), FILES_PAGE_MAX);
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    const [rows, count] = await Promise.all([
      listingQuery(db, filter, { offset, limit }, { syncFirst: Boolean(args.syncFirst) }).execute(),
      listingCountQuery(db, filter).executeTakeFirst(),
    ]);
    return { items: rows.map(toListRow), total: Number(count?.n ?? 0) };
  }

  return {
    Query: { filesIndex: () => ({}) },
    FilesIndexQueries: {
      listing: (_parent: unknown, args: ListingArgs) => listing(args),
    },
  };
};
