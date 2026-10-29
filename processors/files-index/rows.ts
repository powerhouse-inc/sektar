// Rows for the Files index, from document state. Pure, shared by the
// processor and its tests. Operations carry the document's resulting state
// (all scopes and the header), so a row is always rebuilt from the truth:
// the drive's node list for node rows (names included, after any collision
// rename the drive applied), a File's global state for its row.
//
// A reactor-drive's operations carry no node list: its node rows are
// rebuilt by replaying its structure operations over the rows (DriveTree),
// as the reactor's own node projection does.
import type { FileDocRow, FileNodeRow, SyncMappingRow } from "./schema.js";

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
    requested_name: null,
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
    a.document_type === b.document_type &&
    (a.requested_name ?? null) === (b.requested_name ?? null)
  );
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

/* ----------------------------------------------------- reactor-drive */

/** The relationship that files a document in a reactor-drive. */
export const DRIVE_CHILD = "drive/child";

/** The header's name out of an operation's resulting state; null when it carries none. */
export function headerNameOf(resultingState: string | undefined): string | null {
  if (!resultingState) return null;
  try {
    const parsed = JSON.parse(resultingState) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const header = (parsed as Json).header;
    if (!header || typeof header !== "object") return null;
    const name = (header as Json).name;
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

/**
 * The drive's collision rule: the name asked for, else "name (2)", "name (3)",
 * the first one no sibling has (reactor-drive processors/utils/collisions.ts).
 */
export function resolveCollision(requested: string, taken: ReadonlySet<string>): string {
  if (!taken.has(requested)) return requested;
  let suffix = 2;
  while (taken.has(`${requested} (${suffix})`)) suffix += 1;
  return `${requested} (${suffix})`;
}

const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const nonEmpty = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * A reactor-drive's node rows, kept by replaying its structure operations,
 * as the reactor's node projection does (reactor-drive NodeProcessor): the
 * reactor-drive's own folder and relationship actions, and the legacy node
 * actions sent to a reactor-drive, which it projects the same way under the
 * reactor-drive's collision rule. A row's sibling names are looked up
 * through a per-folder index, so a long replay stays linear.
 */
export class DriveTree {
  readonly rows: Map<string, FileNodeRow>;
  private readonly kids = new Map<string | null, Set<string>>();
  /** The requested name of a node removed earlier in the replay: a move is a remove and an add. */
  private readonly gone = new Map<string, string>();

  constructor(
    rows: Iterable<FileNodeRow>,
    /** A document's own name, for a file node whose relationship names none. */
    private readonly nameOf: (documentId: string) => string | undefined,
  ) {
    this.rows = new Map();
    for (const row of rows) this.put(row);
  }

  /** Applies one operation on the drive; anything that is not a structure operation is ignored. */
  apply(type: string, rawInput: unknown): void {
    const input = obj(rawInput);
    switch (type) {
      case "ADD_FOLDER": {
        // The reactor-drive's own shape names `folderId`; the legacy one `id`.
        const folderId = nonEmpty(input.folderId);
        if (folderId) {
          this.upsert(folderId, "folder", str0(input.name), str(input.parentFolderId), null);
          return;
        }
        const id = nonEmpty(input.id);
        if (id) this.upsert(id, "folder", str0(input.name), str(input.parentFolder), null);
        return;
      }
      case "UPDATE_FOLDER": {
        const row = this.rows.get(nonEmpty(input.folderId) ?? "");
        if (!row) return;
        const parent = input.parentFolderId === undefined ? row.parent_id : str(input.parentFolderId);
        const requested = typeof input.name === "string" ? input.name : this.requestedOf(row);
        this.upsert(row.id, row.kind, requested, parent, row.document_type);
        return;
      }
      case "REMOVE_FOLDER": {
        // The folder alone: the projection removes no descendants (the
        // client unlinks them first).
        const id = nonEmpty(input.folderId);
        if (id) this.remove(id);
        return;
      }
      case "ADD_RELATIONSHIP": {
        if (input.relationshipType !== DRIVE_CHILD) return;
        const target = nonEmpty(input.targetId);
        const meta = obj(input.metadata);
        // The projection refuses a link without file metadata; the index skips it.
        if (!target || meta.kind !== "file" || typeof meta.documentType !== "string") return;
        const requested =
          nonEmpty(meta.name) ?? this.nameOf(target) ?? this.gone.get(target) ?? this.rows.get(target)?.requested_name ?? "";
        this.upsert(target, "file", requested, str(meta.parentFolderId), meta.documentType);
        return;
      }
      case "REMOVE_RELATIONSHIP": {
        if (input.relationshipType !== DRIVE_CHILD) return;
        const target = nonEmpty(input.targetId);
        if (target) this.remove(target);
        return;
      }
      case "ADD_FILE": {
        const id = nonEmpty(input.id);
        const documentType = nonEmpty(input.documentType);
        if (!id || !documentType) return;
        this.upsert(id, "file", str0(input.name), str(input.parentFolder), documentType);
        return;
      }
      case "UPDATE_FILE":
      case "UPDATE_NODE": {
        const row = this.rows.get(nonEmpty(input.id) ?? "");
        if (!row) return;
        // UPDATE_FILE never moves a node; UPDATE_NODE moves it only to the root, on null.
        const parent = type === "UPDATE_NODE" && input.parentFolder === null ? null : row.parent_id;
        const requested = typeof input.name === "string" ? input.name : this.requestedOf(row);
        const documentType =
          type === "UPDATE_FILE" && row.kind === "file" ? (nonEmpty(input.documentType) ?? row.document_type) : row.document_type;
        this.upsert(row.id, row.kind, requested, parent, documentType);
        return;
      }
      case "MOVE_NODE": {
        const row = this.rows.get(nonEmpty(input.srcFolder) ?? "");
        if (!row || input.srcFolder === input.targetParentFolder) return;
        const target = str(input.targetParentFolder);
        // A folder never moves into itself or below itself.
        if (row.kind === "folder" && target !== null && this.subtree(row.id).includes(target)) return;
        this.upsert(row.id, row.kind, this.requestedOf(row), target, row.document_type);
        return;
      }
      case "COPY_NODE": {
        const src = this.rows.get(nonEmpty(input.srcId) ?? "");
        const targetId = nonEmpty(input.targetId);
        if (!src || !targetId) return;
        const name = nonEmpty(input.targetName) ?? this.requestedOf(src);
        this.upsert(targetId, src.kind, name, str(input.targetParentFolder), src.document_type);
        return;
      }
      case "DELETE_NODE": {
        const id = nonEmpty(input.id);
        if (!id || !this.rows.has(id)) return;
        for (const n of this.subtree(id)) this.remove(n);
        return;
      }
    }
  }

  /** A document of the drive got a new name: a file node shows it (the drive's rule applied). */
  rename(documentId: string, name: string): void {
    const row = this.rows.get(documentId);
    if (!row || row.kind !== "file" || row.requested_name === name) return;
    this.upsert(row.id, row.kind, name, row.parent_id, row.document_type);
  }

  /** A document deleted: a reactor-drive drops its node with it. */
  drop(documentId: string): void {
    if (this.rows.has(documentId)) this.remove(documentId);
  }

  private requestedOf(row: FileNodeRow): string {
    return row.requested_name ?? row.name;
  }

  private upsert(id: string, kind: string, requested: string, parent: string | null, documentType: string | null): void {
    const before = this.rows.get(id);
    if (before) this.unlink(before);
    const taken = new Set<string>();
    for (const sibling of this.kids.get(parent) ?? []) {
      const r = this.rows.get(sibling);
      if (r) taken.add(r.name);
    }
    const name = resolveCollision(requested, taken);
    this.gone.delete(id);
    this.put({
      id,
      kind,
      name,
      name_sort: name.toLowerCase(),
      parent_id: parent,
      document_type: kind === "file" ? documentType : null,
      requested_name: requested,
    });
  }

  private remove(id: string): void {
    const row = this.rows.get(id);
    if (!row) return;
    this.unlink(row);
    this.rows.delete(id);
    this.gone.set(id, this.requestedOf(row));
  }

  private put(row: FileNodeRow): void {
    this.rows.set(row.id, row);
    const set = this.kids.get(row.parent_id);
    if (set) set.add(row.id);
    else this.kids.set(row.parent_id, new Set([row.id]));
  }

  private unlink(row: FileNodeRow): void {
    this.kids.get(row.parent_id)?.delete(row.id);
  }

  /** The node and every node below it. */
  private subtree(id: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const queue = [id]; queue.length > 0; ) {
      const next = queue.shift() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      out.push(next);
      queue.push(...(this.kids.get(next) ?? []));
    }
    return out;
  }
}

/** A string that may be empty; "" for anything else (a node without a name keeps one). */
function str0(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/* ------------------------------------------------------- folder syncs */

/** A folder-sync mapping's row from its global state. */
export function syncMappingRow(documentId: string, name: string, state: Json, at: string): SyncMappingRow {
  const options = obj(state.options);
  const request = obj(state.request);
  const runs = Array.isArray(state.runs) ? (state.runs as unknown[]).map(obj) : [];
  const last = runs.at(0);
  const host = obj(state.host);
  return {
    document_id: documentId,
    name,
    drive_id: str(state.driveId),
    folder_id: str(state.folderId),
    folder_path: str(state.folderPath),
    local_path: str(state.localPath),
    enabled: state.enabled === true,
    trigger: str(options.trigger) ?? "MANUAL",
    include_subfolders: options.includeSubfolders === true,
    status: str(state.status) ?? "NEVER",
    requested_at: str(request.requestedAt),
    last_run_started_at: last ? str(last.startedAt) : null,
    last_run_finished_at: last ? str(last.finishedAt) : null,
    last_run_status: last ? str(last.status) : null,
    last_run_placeholders: last ? (num(last.placeholders) ?? 0) : 0,
    last_run_error: last ? str(last.error) : null,
    issue_count: Array.isArray(state.issues) ? state.issues.length : 0,
    pull_count: Array.isArray(state.pulls) ? state.pulls.length : 0,
    host_name: str(host.name),
    updated_at: at,
  };
}
