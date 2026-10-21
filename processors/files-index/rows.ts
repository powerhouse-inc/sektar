// Rows for the Files index, from document state. Pure, shared by the
// processor and its tests. Operations carry the document's resulting state
// (all scopes and the header), so a row is always rebuilt from the truth:
// the drive's node list for node rows (names included, after any collision
// rename the drive applied), a File's global state for its row.
import type { FileDocRow, FileNodeRow } from "./schema.js";

type Json = Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The global state out of an operation's resulting state. */
export function globalOf(resultingState: string | undefined): Json | null {
  if (!resultingState) return null;
  try {
    const parsed = JSON.parse(resultingState) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Json;
    return obj.global && typeof obj.global === "object" ? (obj.global as Json) : obj;
  } catch {
    return null;
  }
}

/** A drive node as an index row; null for anything that is not one. */
export function nodeRow(node: unknown): FileNodeRow | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Json;
  const id = str(n.id);
  const kind = str(n.kind);
  const name = typeof n.name === "string" ? n.name : null;
  if (!id || (kind !== "folder" && kind !== "file") || name === null) return null;
  return {
    id,
    kind,
    name,
    name_sort: name.toLowerCase(),
    parent_id: str(n.parentFolder),
    document_type: kind === "file" ? str(n.documentType) : null,
  };
}

/** Every node of a drive's global state, by id. */
export function nodeRows(driveGlobal: Json): Map<string, FileNodeRow> {
  const out = new Map<string, FileNodeRow>();
  const nodes = Array.isArray(driveGlobal.nodes) ? (driveGlobal.nodes as unknown[]) : [];
  for (const n of nodes) {
    const row = nodeRow(n);
    if (row) out.set(row.id, row);
  }
  return out;
}

/** Whether two node rows say the same thing (an unchanged node is not rewritten). */
export function sameNode(a: FileNodeRow, b: FileNodeRow): boolean {
  return (
    a.kind === b.kind &&
    a.name === b.name &&
    a.parent_id === b.parent_id &&
    a.document_type === b.document_type
  );
}

/** The node ids a drive action touches; a delete touches its descendants too (found by diff). */
export function touchedIds(type: string, input: unknown): string[] {
  const i = (input && typeof input === "object" ? input : {}) as Json;
  switch (type) {
    case "ADD_FILE":
    case "ADD_FOLDER":
    case "UPDATE_FILE":
    case "UPDATE_NODE":
    case "DELETE_NODE":
      return [str(i.id)].filter((x): x is string => x !== null);
    case "MOVE_NODE":
      return [str(i.srcFolder)].filter((x): x is string => x !== null);
    case "COPY_NODE":
      return [str(i.targetId)].filter((x): x is string => x !== null);
    default:
      return [];
  }
}

const isImage = (mime: string | null) => (mime ?? "").toLowerCase().startsWith("image/");

/** A File document's row from its global state. */
export function fileDocRow(documentId: string, state: Json, at: string): FileDocRow {
  const source = (state.source && typeof state.source === "object" ? state.source : null) as Json | null;
  const renditions = Array.isArray(state.renditions) ? (state.renditions as Json[]) : [];
  const tags = Array.isArray(state.tags)
    ? (state.tags as Json[])
        .map((t) => ({ id: str(t.id) ?? "", label: str(t.label) ?? "", color: str(t.color) ?? "neutral" }))
        .filter((t) => t.id && t.label)
    : [];
  const sourceKind = source ? str(source.kind) : null;
  const sourceMime = source ? str(source.mimeType) : null;
  const sourceRef = source ? str(source.ref) : null;
  const preview =
    renditions.find((r) => str(r.ref) && isImage(str(r.mimeType)) && /preview|thumb/i.test(str(r.type) ?? "")) ??
    renditions.find((r) => str(r.ref) && isImage(str(r.mimeType)));
  const thumb =
    (preview ? str(preview.ref) : null) ??
    (sourceKind === "ATTACHMENT" && sourceRef && isImage(sourceMime) ? sourceRef : null);
  const title = str(state.title);
  const description = str(state.description);
  const sourceName = source ? str(source.fileName) : null;
  const sourceDocName = source ? str(source.documentName) : null;
  return {
    document_id: documentId,
    title,
    description,
    tags: JSON.stringify(tags),
    source_kind: sourceKind,
    source_mime: sourceMime,
    source_name: sourceName,
    source_size: source ? num(source.sizeBytes) : null,
    source_document_type: source ? str(source.documentType) : null,
    source_document_name: sourceDocName,
    rendition_count: renditions.length,
    thumb_ref: thumb,
    disk_change: state.placeholder && typeof state.placeholder === "object" ? str((state.placeholder as Json).change) : null,
    search_text: [
      title,
      description,
      tags.map((t) => t.label).join(" "),
      sourceName,
      sourceDocName,
      renditions.map((r) => [str(r.label), str(r.type)].filter(Boolean).join(" ")).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updated_at: at,
  };
}
