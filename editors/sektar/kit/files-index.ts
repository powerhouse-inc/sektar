// Listing a Files drive through its index rather than its nodes and
// documents (processors/files-index). Behind a remote drive the switchboard
// answers over GraphQL; with the drive in the tab's own reactor the same
// queries run live on its database. Either way the list is paged where the
// reader is (kit/paged.ts) and a File document is loaded only when opened.
import { useRelationalQuery } from "@powerhousedao/reactor-browser";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FILES_PAGE,
  FilesIndex,
  listingCountQuery,
  listingQuery,
  scopeFor,
  searchWords,
  toListRow,
  type DB,
  type FileListPage,
  type FileListRow,
  type FilesFilter,
} from "../../../processors/files-index/index.js";
import { useMailIndexMode } from "./mail-index.js";
import { usePagedList, type PagedList } from "./paged.js";

export type { FileListRow };

export interface FilesListFilter {
  /** The open folder; null at the drive's root. */
  folderId: string | null;
  /** The folder and every folder below it, documents only. */
  deep: boolean;
  /** The top bar's search, raw. */
  query: string;
  /** Group by sync status: the changes a folder sync found on disk come first. */
  syncFirst?: boolean;
}

const LISTING_QUERY = `query ($d: String!, $f: String, $deep: Boolean, $q: String, $o: Int, $l: Int, $s: Boolean) {
  filesIndex { listing(driveId: $d, folderId: $f, deep: $deep, query: $q, offset: $o, limit: $l, syncFirst: $s) {
    total
    items { id kind name parentId documentType title description tags { id label color } sourceKind sourceMime sourceName sourceSize sourceDocumentType sourceDocumentName renditionCount thumbRef diskChange }
  } }
}`;

async function gql<T>(base: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error(`The index answered ${response.status}`);
  return json.data;
}

/* --------------------------------------------------------------- local */

type LocalParams = { filter: FilesFilter; offset: number; limit: number; syncFirst: boolean };
type LocalQB = Parameters<Parameters<typeof useRelationalQuery<DB, FileListRow, LocalParams>>[2]>[0];

/** The listing over the tab's own database: a live window, a page either side. */
function useLocalFiles(
  enabled: boolean,
  drive: DocumentDriveDocument | undefined,
  filter: FilesListFilter,
): PagedList<FileListRow> {
  const driveId = drive?.header.id ?? "";
  const folders = useMemo(
    () =>
      (drive?.state.global.nodes ?? [])
        .filter((n) => n.kind === "folder")
        .map((n) => ({ id: n.id, parent_id: n.parentFolder ?? null })),
    [drive],
  );
  const syncFirst = Boolean(filter.syncFirst);
  const key = JSON.stringify([driveId, filter.folderId, filter.deep, filter.query, syncFirst]);
  const [range, setRange] = useState({ key, offset: 0 });
  const offset = range.key === key ? range.offset : 0;
  const limit = enabled ? FILES_PAGE * 3 : 1;
  const params = useMemo<LocalParams>(
    () => ({
      filter: {
        scope: scopeFor(folders, filter.folderId, filter.deep),
        filesOnly: filter.deep,
        words: searchWords(filter.query),
      },
      offset,
      limit,
      syncFirst,
    }),
    [folders, filter.folderId, filter.deep, filter.query, offset, limit, syncFirst],
  );
  const build = useCallback(
    (db: LocalQB, p?: LocalParams) => {
      const q = p ?? params;
      return listingQuery(db, q.filter, { offset: q.offset, limit: q.limit }, { syncFirst: q.syncFirst }).compile();
    },
    [params],
  );
  const buildCount = useCallback(
    (db: LocalQB, p?: LocalParams) => listingCountQuery(db, (p ?? params).filter).compile(),
    [params],
  );
  const rowsQ = useRelationalQuery<DB, Parameters<typeof toListRow>[0], LocalParams>(FilesIndex, driveId, build, params);
  const countQ = useRelationalQuery<DB, { n: number | string }, LocalParams>(FilesIndex, driveId, buildCount, params);
  const result = rowsQ.result;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const [shown, setShown] = useState<{ offset: number; rows: FileListRow[] }>({ offset: 0, rows: [] });
  useEffect(() => {
    if (result) setShown({ offset: offsetRef.current, rows: result.rows.map(toListRow) });
  }, [result]);
  const total = Number(countQ.result?.rows[0]?.n ?? shown.rows.length);
  const ensure = useCallback(
    (start: number) => {
      const want = Math.max(0, Math.floor(start / FILES_PAGE) - 1) * FILES_PAGE;
      setRange((prev) => (prev.key === key && prev.offset === want ? prev : { key, offset: want }));
    },
    [key],
  );
  const rowAt = useCallback(
    (index: number): FileListRow | undefined => {
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
    // live queries follow the database themselves
    refreshSoon: noop,
    invalidate: noop,
  };
}

/* ---------------------------------------------------------------- api */

/** A Files drive's folder, listed through the index: sized to the whole set, paged where the reader is. */
export function useFilesList(
  drive: DocumentDriveDocument | undefined,
  filter: FilesListFilter,
): PagedList<FileListRow> & { mode: "remote" | "local" | "unknown" } {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const base = mode.kind === "remote" ? mode.base : null;
  const syncFirst = Boolean(filter.syncFirst);
  const key = JSON.stringify([base, driveId, filter.folderId, filter.deep, filter.query.trim().toLowerCase(), syncFirst]);
  const fetchPage = useCallback(
    async (page: number) => {
      if (!base || !driveId) throw new Error("No switchboard for this drive");
      const data = await gql<{ filesIndex: { listing: FileListPage } }>(base, LISTING_QUERY, {
        d: driveId,
        f: filter.folderId,
        deep: filter.deep,
        q: filter.query.trim() || null,
        o: page * FILES_PAGE,
        l: FILES_PAGE,
        s: syncFirst,
      });
      return data.filesIndex.listing;
    },
    [base, driveId, filter.folderId, filter.deep, filter.query, syncFirst],
  );
  const remote = usePagedList<FileListRow>({
    kind: "files",
    key,
    enabled: mode.kind === "remote" && driveId !== null,
    pageSize: FILES_PAGE,
    fetchPage,
  });
  const local = useLocalFiles(mode.kind === "local", drive, filter);
  return { ...(mode.kind === "local" ? local : remote), mode: mode.kind };
}
