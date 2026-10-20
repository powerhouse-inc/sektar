// The questions a Files listing asks, as queries over the index. Shared by
// the subgraph (the switchboard answers Connect) and a tab whose own reactor
// runs the processor (live queries), so both list a folder the same way.
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { DB, FileDocRow, FileNodeRow } from "./schema.js";

export type FilesQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

/** Which nodes a listing covers. */
export type FilesScope =
  /** every node of the drive */
  | { all: true }
  /** the nodes directly in these folders, and at the root when `root` */
  | { all?: false; parents: readonly string[]; root: boolean };

export interface FilesFilter {
  scope: FilesScope;
  /** Leave folders out: a listing that includes subfolders lists documents only. */
  filesOnly: boolean;
  /** Lower-cased words, each matched against the name and the File's search text. */
  words: readonly string[];
}

export const FILES_PAGE = 60;
export const FILES_PAGE_MAX = 500;

export interface FileTagLite {
  id: string;
  label: string;
  color: string;
}

/** A listing row: the node, and what the File it names says about itself. */
export interface FileListRow {
  id: string;
  kind: "folder" | "file";
  name: string;
  parentId: string | null;
  documentType: string | null;
  title: string | null;
  description: string | null;
  tags: FileTagLite[];
  sourceKind: string | null;
  sourceMime: string | null;
  sourceName: string | null;
  sourceSize: number | null;
  sourceDocumentType: string | null;
  sourceDocumentName: string | null;
  renditionCount: number;
  thumbRef: string | null;
}

export interface FileListPage {
  items: FileListRow[];
  total: number;
}

export function searchWords(query: string | null | undefined, max = 6): string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, max);
}

const likeWord = (w: string) => `%${w.replace(/[%_\\]/g, "")}%`;

function filtered(db: FilesQueryBuilder, f: FilesFilter) {
  let q = db
    .selectFrom("file_nodes as n")
    .leftJoin("file_docs as d", "d.document_id", "n.id");
  const scope = f.scope;
  if (!scope.all) {
    const parents = [...scope.parents];
    q = q.where((eb) => {
      const parts = [];
      if (scope.root) parts.push(eb("n.parent_id", "is", null));
      if (parents.length > 0) parts.push(eb("n.parent_id", "in", parents));
      // An empty scope lists nothing.
      return parts.length > 0 ? eb.or(parts) : eb.val(false);
    });
  }
  if (f.filesOnly) q = q.where("n.kind", "=", "file");
  for (const word of f.words) {
    if (!word) continue;
    const pattern = likeWord(word);
    q = q.where((eb) => eb.or([eb("n.name_sort", "like", pattern), eb("d.search_text", "like", pattern)]));
  }
  return q;
}

/** One page: folders first, then by name. */
export function listingQuery(db: FilesQueryBuilder, f: FilesFilter, page: { offset: number; limit: number }) {
  return filtered(db, f)
    .select([
      "n.id",
      "n.kind",
      "n.name",
      "n.name_sort",
      "n.parent_id",
      "n.document_type",
      "d.title",
      "d.description",
      "d.tags",
      "d.source_kind",
      "d.source_mime",
      "d.source_name",
      "d.source_size",
      "d.source_document_type",
      "d.source_document_name",
      "d.rendition_count",
      "d.thumb_ref",
    ])
    // "folder" sorts after "file": descending puts folders first.
    .orderBy("n.kind", "desc")
    .orderBy("n.name_sort")
    .orderBy("n.id")
    .offset(Math.max(0, page.offset))
    .limit(page.limit);
}

export function listingCountQuery(db: FilesQueryBuilder, f: FilesFilter) {
  return filtered(db, f).select((eb) => eb.fn.countAll<number>().as("n"));
}

/** Every folder with its parent: enough to find a folder's descendants. */
export function foldersQuery(db: FilesQueryBuilder) {
  return db.selectFrom("file_nodes").select(["id", "parent_id"]).where("kind", "=", "folder");
}

/** Every folder below `id` (below the root when null). */
export function descendantsOf(
  folders: readonly { id: string; parent_id: string | null }[],
  id: string | null,
): string[] {
  const kids = new Map<string | null, string[]>();
  for (const f of folders) kids.set(f.parent_id, [...(kids.get(f.parent_id) ?? []), f.id]);
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...(kids.get(id) ?? [])];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(...(kids.get(next) ?? []));
  }
  return out;
}

/** The scope a folder listing covers: the folder, or (deep) it and everything below. */
export function scopeFor(
  folders: readonly { id: string; parent_id: string | null }[],
  folderId: string | null,
  deep: boolean,
): FilesScope {
  if (!deep) return folderId ? { parents: [folderId], root: false } : { parents: [], root: true };
  if (!folderId) return { all: true };
  return { parents: [folderId, ...descendantsOf(folders, folderId)], root: false };
}

/** A node joined to its File row; every File column is null for a node without one. */
interface ListingRow {
  id: FileNodeRow["id"];
  kind: FileNodeRow["kind"];
  name: FileNodeRow["name"];
  parent_id: FileNodeRow["parent_id"];
  document_type: FileNodeRow["document_type"];
  title: FileDocRow["title"];
  description: FileDocRow["description"];
  tags: string | null;
  source_kind: FileDocRow["source_kind"];
  source_mime: FileDocRow["source_mime"];
  source_name: FileDocRow["source_name"];
  source_size: number | string | null;
  source_document_type: FileDocRow["source_document_type"];
  source_document_name: FileDocRow["source_document_name"];
  rendition_count: number | string | null;
  thumb_ref: FileDocRow["thumb_ref"];
}

function parseTags(text: string | null | undefined): FileTagLite[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text) as unknown;
    return Array.isArray(v) ? (v as FileTagLite[]) : [];
  } catch {
    return [];
  }
}

export function toListRow(r: ListingRow): FileListRow {
  return {
    id: r.id,
    kind: r.kind === "folder" ? "folder" : "file",
    name: r.name,
    parentId: r.parent_id,
    documentType: r.document_type,
    title: r.title ?? null,
    description: r.description ?? null,
    tags: parseTags(r.tags),
    sourceKind: r.source_kind ?? null,
    sourceMime: r.source_mime ?? null,
    sourceName: r.source_name ?? null,
    sourceSize: r.source_size === null ? null : Number(r.source_size),
    sourceDocumentType: r.source_document_type ?? null,
    sourceDocumentName: r.source_document_name ?? null,
    renditionCount: Number(r.rendition_count ?? 0),
    thumbRef: r.thumb_ref ?? null,
  };
}
