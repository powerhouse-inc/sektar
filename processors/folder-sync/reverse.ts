// The other way round: what a folder sync finds changed on disk. A file
// edited, deleted or added there becomes a placeholder on a File (or a new
// placeholder File), or is pulled into the drive straight away, as the
// mapping's "from disk" setting and its pull requests say. runner.ts calls
// this for the files it tracks and for what it finds on disk besides.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Action } from "document-model";
import { actions as fileActions } from "document-models/file";
import type { FolderSyncFromDisk, FolderSyncPull } from "document-models/folder-sync";
import { MANIFEST_NAME, safeName, type PlanNode } from "./plan.js";

export type DiskChange = "CREATE" | "UPDATE" | "DELETE";

/** What a File's pending change from disk looks like, as far as the runner cares. */
export interface PendingPlaceholder {
  change: DiskChange;
  hash?: string | null;
  relativePath?: string;
}

/** What the reverse half needs from the reactor and the attachment store. */
export interface ReverseDeps {
  dispatch(documentId: string, actions: Action[]): Promise<void>;
  /** Creates a File in a drive folder (null: the drive's root) and returns its id */
  createFile(driveId: string, parentFolder: string | null, name: string): Promise<string>;
  /** Creates a folder in the drive and returns its id */
  createFolder(driveId: string, parentFolder: string | null, name: string): Promise<string>;
  /** Removes a node and the document behind it from the drive */
  deleteNode(driveId: string, nodeId: string): Promise<void>;
  /**
   * Hashes bytes for the attachment store: the ref, and the upload to run once
   * a document refers to it (preprocess, dispatch, upload, as the store expects).
   */
  stage(bytes: Uint8Array, fileName: string, mimeType: string | null): Promise<{ ref: string; upload(): Promise<void> }>;
  now(): Date;
  newId(): string;
}

const IGNORED = /^(\.|~\$)|\.sektar-tmp$|^(desktop\.ini|thumbs\.db)$/i;

/** Every file below the local folder that a reverse sync looks at, as "/"-separated relative paths. */
export async function listDiskFiles(root: string, includeSubfolders: boolean): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, rel: string) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === MANIFEST_NAME || IGNORED.test(e.name)) continue;
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (includeSubfolders) await walk(join(dir, e.name), path);
      } else if (e.isFile()) {
        out.push(path);
      }
    }
  };
  await walk(root, "");
  return out.sort();
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  phd: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function mimeFor(name: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && MIME[ext]) || null;
}

export const isDocumentFile = (name: string) => /\.phd$/i.test(name);

/**
 * One run's reverse half: what to pull, and the drive operations that turn
 * changes on disk into placeholders and pulls.
 */
export class DiskChanges {
  placeholders = 0;
  pulled = 0;
  private readonly pullAll: boolean;
  private readonly pullIds: Set<string>;
  private readonly folders = new Map<string, string | null>();

  constructor(
    readonly mode: FolderSyncFromDisk,
    pulls: readonly FolderSyncPull[],
    private readonly driveId: string,
    private readonly mappingId: string,
    private readonly rootFolderId: string | null,
    private readonly nodes: PlanNode[],
    private readonly deps: ReverseDeps,
  ) {
    this.pullAll = pulls.some((p) => p.nodeIds.length === 0);
    this.pullIds = new Set(pulls.flatMap((p) => p.nodeIds));
    this.folders.set("", rootFolderId);
  }

  get on(): boolean {
    return this.mode !== "OFF";
  }

  /** Whether a change is pulled now: by the mode, or because a pull asked for it. */
  pulls(nodeId: string | null, change: DiskChange): boolean {
    if (this.mode === "OFF") return false;
    const asked = this.pullAll || (nodeId !== null && this.pullIds.has(nodeId));
    if (change === "DELETE") return asked || this.mode === "AUTO_PULL_WITH_DELETES";
    return asked || this.mode === "AUTO_PULL" || this.mode === "AUTO_PULL_WITH_DELETES";
  }

  /** Records (or refreshes) a File's pending change, unless it is recorded as it is already. */
  async mark(fileId: string, relPath: string, change: DiskChange, disk: { hash: string | null; size: number | null; mtimeMs: number | null }, pending: PendingPlaceholder | null | undefined): Promise<void> {
    this.placeholders++;
    if (pending && pending.change === change && (pending.hash ?? null) === disk.hash && pending.relativePath === relPath) return;
    const fileName = relPath.slice(relPath.lastIndexOf("/") + 1);
    await this.deps.dispatch(fileId, [this.placeholderAction(relPath, fileName, change, disk)]);
  }

  /** Clears a File's pending change that is no longer there on disk. */
  async clear(fileId: string, pending: PendingPlaceholder | null | undefined): Promise<void> {
    if (pending) await this.deps.dispatch(fileId, [fileActions.clearPlaceholder({})]);
  }

  /** Pulls the file on disk into a File: its bytes become the source, the old ones a previous version. */
  async pull(fileId: string, root: string, relPath: string, change: "CREATE" | "UPDATE", disk: { hash: string; size: number; mtimeMs: number }, pending: PendingPlaceholder | null | undefined): Promise<void> {
    const fileName = relPath.slice(relPath.lastIndexOf("/") + 1);
    const bytes = await readFile(join(root, ...relPath.split("/")));
    const staged = await this.deps.stage(bytes, fileName, mimeFor(fileName));
    const list: Action[] = [];
    // APPLY_DISK_VERSION needs the change on record first.
    if (!pending || pending.change !== change || pending.hash !== disk.hash) list.push(this.placeholderAction(relPath, fileName, change, disk));
    list.push(fileActions.applyDiskVersion({ ref: staged.ref as `attachment://v${number}:${string}`, fileName, mimeType: mimeFor(fileName), sizeBytes: bytes.byteLength, setAt: this.deps.now().toISOString(), previousId: this.deps.newId() }));
    await this.deps.dispatch(fileId, list);
    await staged.upload();
    this.pulled++;
  }

  /** Pulls a deletion on disk: the File leaves the drive. */
  async pullDelete(fileId: string): Promise<void> {
    await this.deps.deleteNode(this.driveId, fileId);
    this.removeNode(fileId);
    this.pulled++;
  }

  /** Pulls a folder deleted on disk, once nothing is left in it: the drive folder goes too. */
  async pullFolderDelete(folderId: string): Promise<void> {
    await this.deps.deleteNode(this.driveId, folderId);
    this.removeNode(folderId);
    this.pulled++;
  }

  /** Removes a placeholder File whose file is gone from disk again: there is nothing left it stands for. */
  async dropPlaceholderFile(fileId: string): Promise<void> {
    await this.deps.deleteNode(this.driveId, fileId);
    this.removeNode(fileId);
  }

  /** A new placeholder File for a file found on disk, in the drive folder that mirrors its folder. */
  async createPlaceholderFile(relPath: string, disk: { hash: string; size: number; mtimeMs: number }): Promise<string> {
    const slash = relPath.lastIndexOf("/");
    const parent = await this.ensureFolder(slash >= 0 ? relPath.slice(0, slash) : "");
    const fileName = relPath.slice(slash + 1);
    const id = await this.deps.createFile(this.driveId, parent, fileName);
    this.nodes.push({ id, name: fileName, kind: "file", parentFolder: parent, documentType: "sektar/file" });
    await this.deps.dispatch(id, [this.placeholderAction(relPath, fileName, "CREATE", disk)]);
    return id;
  }

  private placeholderAction(relPath: string, fileName: string, change: DiskChange, disk: { hash: string | null; size: number | null; mtimeMs: number | null }): Action {
    const deleted = change === "DELETE";
    return fileActions.setPlaceholder({
      change,
      target: isDocumentFile(fileName) ? "DOCUMENT" : "FILE",
      mappingId: this.mappingId,
      relativePath: relPath,
      fileName,
      mimeType: deleted ? null : mimeFor(fileName),
      sizeBytes: deleted ? null : disk.size,
      hash: deleted ? null : disk.hash,
      modifiedAt: deleted || disk.mtimeMs === null ? null : new Date(disk.mtimeMs).toISOString(),
      foundAt: this.deps.now().toISOString(),
    });
  }

  /** The drive folder that mirrors a folder on disk ("a/b"), made where it is missing. */
  private async ensureFolder(dir: string): Promise<string | null> {
    const known = this.folders.get(dir);
    if (known !== undefined) return known;
    const slash = dir.lastIndexOf("/");
    const parent = await this.ensureFolder(slash >= 0 ? dir.slice(0, slash) : "");
    const name = dir.slice(slash + 1);
    // An existing folder whose name is written this way on disk.
    const existing = this.nodes.find((n) => n.kind === "folder" && (n.parentFolder ?? null) === parent && safeName(n.name) === name);
    const id = existing ? existing.id : await this.deps.createFolder(this.driveId, parent, name);
    if (!existing) this.nodes.push({ id, name, kind: "folder", parentFolder: parent });
    this.folders.set(dir, id);
    return id;
  }

  private removeNode(id: string): void {
    const at = this.nodes.findIndex((n) => n.id === id);
    if (at >= 0) this.nodes.splice(at, 1);
  }
}
