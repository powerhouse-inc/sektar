/**
 * Reading the Files index. Read-only: the drive and the File documents are
 * changed through their own operations, and the processor follows.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: the
 * listing and its count go through `restrict`, which passes folder rows
 * and narrows file rows to the caller's readable documents.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import {
  FILES_PAGE,
  FILES_PAGE_MAX,
  type FilesIndex,
  foldersQuery,
  listingCountQuery,
  listingQuery,
  scopeFor,
  searchWords,
  toListRow,
  type FileListPage,
} from "processors/files-index";

type Db = FilesIndex["query"];

interface ListingArgs {
  driveId: string;
  folderId?: string | null;
  deep?: boolean | null;
  query?: string | null;
  offset?: number | null;
  limit?: number | null;
  syncFirst?: boolean | null;
}

async function listing({
  db,
  args,
  restrict,
}: IndexQuery<Db, ListingArgs>): Promise<FileListPage> {
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
    restrict(
      listingQuery(
        db,
        filter,
        { offset, limit },
        { syncFirst: Boolean(args.syncFirst) },
      ),
    ).execute(),
    restrict(listingCountQuery(db, filter)).executeTakeFirst(),
  ]);
  return { items: rows.map(toListRow), total: Number(count?.n ?? 0) };
}

export const resolvers = {
  Query: { filesIndex: () => ({}) },
};

export const queries = {
  "FilesIndexQueries.listing": listing,
};
