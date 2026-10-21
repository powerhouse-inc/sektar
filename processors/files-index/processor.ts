/**
 * Keeps the Files index in step with a drive and the File documents.
 *
 * Node rows mirror the drive's own node list. Every drive operation carries
 * the drive's resulting state, so the rows are taken from it rather than
 * replayed from the action: a name the drive changed on a collision, or the
 * descendants a folder delete took along, come out right by construction.
 * Only the nodes an operation touched are rewritten; a delete, or a batch
 * touching many (a history replay on first install), reconciles the whole
 * list instead.
 *
 * Processors are not routed by drive: every drive's processor sees every
 * matching operation. Node rows therefore come from this drive's operations
 * only; File rows come from any File document, and a listing joins them to
 * this drive's nodes.
 */
import { RelationalDbProcessor } from "@powerhousedao/reactor-browser";
import type { OperationWithContext } from "document-model";
import { up } from "./migrations.js";
import { fileDocRow, globalOf, nodeRows, sameNode, touchedIds } from "./rows.js";
import type { DB, FileDocRow, FileNodeRow } from "./schema.js";

export const DRIVE_DOCUMENT_TYPE = "powerhouse/document-drive";
export const FILE_DOCUMENT_TYPE = "sektar/file";

/** Rows per statement: well under any bind-parameter cap at these widths. */
const BATCH = 300;
/** Past this many touched nodes a batch reconciles the whole drive instead. */
const RECONCILE_OVER = 200;

/**
 * What the processors over one namespace share: the factory registers one
 * for the drive's operations and one for File documents' (two filters), and
 * their writes must not interleave.
 */
interface Shared {
  queue: Promise<void>;
  /** The node rows as written, once read: the drive's own ops keep it current. */
  nodes: Map<string, FileNodeRow> | null;
  /**
   * Whether this process has reconciled the rows with the drive's whole node
   * list yet. A processor installed into a running reactor starts at the
   * operations it is routed from then on, not at the drive's history, so a
   * node made before then (and not touched since) would never be listed.
   * The first drive operation it sees carries the drive's whole state: one
   * full pass then, incremental after.
   */
  reconciled: boolean;
}

const sharedByNamespace = new Map<string, Shared>();

export class FilesIndex extends RelationalDbProcessor<DB> {
  private get shared(): Shared {
    let s = sharedByNamespace.get(this._namespace);
    if (!s) {
      s = { queue: Promise.resolve(), nodes: null, reconciled: false };
      sharedByNamespace.set(this._namespace, s);
    }
    return s;
  }

  private get nodes(): Map<string, FileNodeRow> | null {
    return this.shared.nodes;
  }

  private set nodes(value: Map<string, FileNodeRow> | null) {
    this.shared.nodes = value;
  }

  onOperations(operations: OperationWithContext[]): Promise<void> {
    const shared = this.shared;
    const next = shared.queue.then(() => this.index(operations));
    // Keep the chain alive after a failure, or one bad batch stalls every
    // later one behind a rejected promise; the cache is re-read after one.
    shared.queue = next.catch(() => {
      shared.nodes = null;
    });
    return next;
  }

  onDisconnect(): Promise<void> {
    return Promise.resolve();
  }

  static override getNamespace(driveId: string): string {
    return super.getNamespace(driveId);
  }

  override async initAndUpgrade(): Promise<void> {
    await up(this.relationalDb);
  }

  private async index(operations: OperationWithContext[]): Promise<void> {
    const driveId = this._driveId;
    const touched = new Set<string>();
    let reconcile = false;
    let lastDriveState: ReturnType<typeof globalOf> = null;
    const docs = new Map<string, FileDocRow | null>();

    for (const { operation, context } of operations) {
      const type = operation.action.type;
      if (type === "DELETE_DOCUMENT" || type === "PURGE_DOCUMENT") {
        const input = operation.action.input as { documentId?: string } | null;
        const id = input?.documentId ?? context.documentId;
        if (this.isNamespaceDrive(id)) {
          await this.dropNamespace();
          this.nodes = null;
          return;
        }
        if (context.documentType === FILE_DOCUMENT_TYPE) docs.set(id, null);
        continue;
      }
      if (operation.error) continue;

      if (context.documentType === DRIVE_DOCUMENT_TYPE) {
        if (context.documentId !== driveId || context.scope !== "global") continue;
        for (const id of touchedIds(type, operation.action.input)) touched.add(id);
        if (type === "DELETE_NODE" || type === "COPY_NODE") reconcile = true;
        const state = globalOf(context.resultingState);
        if (state) lastDriveState = state;
        continue;
      }

      if (context.documentType === FILE_DOCUMENT_TYPE && context.scope === "global") {
        if (docs.get(context.documentId) === null) continue;
        const state = globalOf(context.resultingState);
        if (state) docs.set(context.documentId, fileDocRow(context.documentId, state, timeOf(operation)));
      }
    }

    if (lastDriveState) {
      const first = !this.shared.reconciled;
      await this.writeNodes(
        nodeRows(lastDriveState),
        touched,
        first || reconcile || touched.size > RECONCILE_OVER,
      );
      this.shared.reconciled = true;
    }
    await this.writeDocs(docs);
  }

  private async currentNodes(): Promise<Map<string, FileNodeRow>> {
    if (this.nodes) return this.nodes;
    const rows = await this.relationalDb.selectFrom("file_nodes").selectAll().execute();
    this.nodes = new Map(rows.map((r) => [r.id, r]));
    return this.nodes;
  }

  private async writeNodes(
    truth: Map<string, FileNodeRow>,
    touched: Set<string>,
    reconcile: boolean,
  ): Promise<void> {
    const current = await this.currentNodes();
    const upserts: FileNodeRow[] = [];
    const deletes: string[] = [];
    const consider = reconcile ? new Set([...truth.keys(), ...current.keys()]) : touched;
    for (const id of consider) {
      const want = truth.get(id);
      const have = current.get(id);
      if (!want) {
        if (have) deletes.push(id);
      } else if (!have || !sameNode(have, want)) {
        upserts.push(want);
      }
    }
    for (let at = 0; at < deletes.length; at += BATCH) {
      await this.relationalDb
        .deleteFrom("file_nodes")
        .where("id", "in", deletes.slice(at, at + BATCH))
        .execute();
    }
    for (let at = 0; at < upserts.length; at += BATCH) {
      await this.relationalDb
        .insertInto("file_nodes")
        .values(upserts.slice(at, at + BATCH))
        .onConflict((oc) =>
          oc.column("id").doUpdateSet((eb) => ({
            kind: eb.ref("excluded.kind"),
            name: eb.ref("excluded.name"),
            name_sort: eb.ref("excluded.name_sort"),
            parent_id: eb.ref("excluded.parent_id"),
            document_type: eb.ref("excluded.document_type"),
          })),
        )
        .execute();
    }
    for (const id of deletes) current.delete(id);
    for (const row of upserts) current.set(row.id, row);
  }

  private async writeDocs(docs: Map<string, FileDocRow | null>): Promise<void> {
    const deletes = [...docs].filter(([, row]) => row === null).map(([id]) => id);
    const rows = [...docs.values()].filter((r): r is FileDocRow => r !== null);
    if (deletes.length > 0) {
      await this.relationalDb.deleteFrom("file_docs").where("document_id", "in", deletes).execute();
    }
    for (let at = 0; at < rows.length; at += BATCH) {
      await this.relationalDb
        .insertInto("file_docs")
        .values(rows.slice(at, at + BATCH))
        .onConflict((oc) =>
          oc.column("document_id").doUpdateSet((eb) => ({
            title: eb.ref("excluded.title"),
            description: eb.ref("excluded.description"),
            tags: eb.ref("excluded.tags"),
            source_kind: eb.ref("excluded.source_kind"),
            source_mime: eb.ref("excluded.source_mime"),
            source_name: eb.ref("excluded.source_name"),
            source_size: eb.ref("excluded.source_size"),
            source_document_type: eb.ref("excluded.source_document_type"),
            source_document_name: eb.ref("excluded.source_document_name"),
            rendition_count: eb.ref("excluded.rendition_count"),
            thumb_ref: eb.ref("excluded.thumb_ref"),
            disk_change: eb.ref("excluded.disk_change"),
            search_text: eb.ref("excluded.search_text"),
            updated_at: eb.ref("excluded.updated_at"),
          })),
        )
        .execute();
    }
  }
}

function timeOf(operation: OperationWithContext["operation"]): string {
  const stamped = operation as { timestampUtcMs?: unknown };
  if (typeof stamped.timestampUtcMs === "string" && stamped.timestampUtcMs) return stamped.timestampUtcMs;
  return new Date().toISOString();
}
