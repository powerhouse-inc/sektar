// The Switchboard side of folder syncs: answers a mapping's REQUEST_SYNC by
// copying its drive folder to disk (runner.ts), and, for mappings that sync
// whenever the folder changes, runs after the drive or one of its Files
// changed. It acts on a mapping's current state, never on a single
// operation, so a replay of old operations cannot start a run twice.
import type { IReactorClient } from "@powerhousedao/reactor";
import { RelationalDbProcessor, type IProcessorHostModule } from "@powerhousedao/reactor-browser";
import type { IProcessorDispatch } from "@powerhousedao/shared/processors";
import type { Action, OperationWithContext } from "document-model";
import { addFolder, deleteNode } from "@powerhousedao/shared/document-drive";
import { utils as fileUtils } from "document-models/file";
import { actions, type FolderSyncState } from "document-models/folder-sync";
import { randomUUID } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { up } from "./migrations.js";
import { Debouncer } from "./debounce.js";
import { runSync, type RunnerDeps } from "./runner.js";
import type { DB } from "./schema.js";

export const SYNC_TYPE = "sektar/folder-sync";
export const DRIVE_TYPE = "powerhouse/document-drive";
export const FILE_TYPE = "sektar/file";

/** An automatic mapping runs once changes (in the drive or on disk) have stopped this long... */
const CHANGE_QUIET_MS = 5_000;
/** ...and never later than this after the first change of a burst. */
const CHANGE_MAX_WAIT_MS = 60_000;
/** Disk events this soon after a run are the run's own writes. */
const RUN_ECHO_MS = 3_000;
/** Files on disk a run writes for itself, whose changes start nothing. */
const OWN_FILES = /(^|[\\/])(\.sektar-sync\.json|[^\\/]*\.sektar-tmp)$/;
/** How long after start-up the sweep looks for requests that are still waiting. */
const SWEEP_DELAY_MS = 5_000;

/**
 * The folders this Switchboard may write into, one per line in
 * `.ph/folder-sync-roots.txt` beside the project (blank lines and # comments
 * ignored). Read before every run, so the list changes without a restart.
 * No file: every absolute path is allowed.
 */
export async function readAllowedRoots(file = join(process.cwd(), ".ph", "folder-sync-roots.txt")): Promise<string[] | null> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return null;
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/** Runs by itself: after changes in the drive or on disk (Sync: Automatic). */
export function isAutomatic(s: FolderSyncState): boolean {
  return s.enabled && s.options.trigger === "ON_CHANGE" && Boolean(s.localPath);
}

export interface FolderSyncRuntime {
  client: IReactorClient;
  attachments: IProcessorHostModule["attachments"];
  dispatch: IProcessorDispatch;
}

export class FolderSync extends RelationalDbProcessor<DB> {
  private runtime: FolderSyncRuntime | undefined;
  private driveId = "";
  /** Mappings with a run in progress here */
  private readonly running = new Set<string>();
  /** The runs this host started: their RUNNING status is not a leftover */
  private readonly ours = new Set<string>();
  private readonly changes = new Debouncer(CHANGE_QUIET_MS, CHANGE_MAX_WAIT_MS);
  /** The local folders of automatic mappings, watched for changes on disk */
  private readonly watchers = new Map<string, { path: string; watcher: FSWatcher }>();
  /** Until when a mapping's disk events are its own run's writes */
  private readonly quietUntil = new Map<string, number>();
  private sweepTimer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private disconnected = false;

  withRuntime(driveId: string, runtime: FolderSyncRuntime): this {
    this.driveId = driveId;
    this.runtime = runtime;
    // A restart forgets what was asked while it was down and what it was doing.
    this.sweepTimer = setTimeout(() => void this.enqueue(() => this.sweep()), SWEEP_DELAY_MS);
    return this;
  }

  onOperations(operations: OperationWithContext[]): Promise<void> {
    const mappings = new Set<string>();
    let folderChanged = false;
    for (const { context } of operations) {
      if (context.scope !== "global") continue;
      if (context.documentType === SYNC_TYPE) mappings.add(context.documentId);
      else if (context.documentType === FILE_TYPE || (context.documentType === DRIVE_TYPE && context.documentId === this.driveId)) folderChanged = true;
    }
    return this.enqueue(async () => {
      for (const id of mappings) await this.consider(id);
      if (folderChanged) await this.scheduleOnChange();
    });
  }

  onDisconnect(): Promise<void> {
    this.disconnected = true;
    clearTimeout(this.sweepTimer);
    this.changes.cancelAll();
    for (const { watcher } of this.watchers.values()) watcher.close();
    this.watchers.clear();
    return Promise.resolve();
  }

  static override getNamespace(driveId: string): string {
    return super.getNamespace(driveId);
  }

  override async initAndUpgrade(): Promise<void> {
    await up(this.relationalDb);
  }

  /* ---------------------------------------------------------------- */

  /** Serialises the processor's own work; a failure does not stall what follows. */
  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.queue.then(work);
    this.queue = next.catch((e: unknown) => console.warn("[folder-sync]", e instanceof Error ? e.message : e));
    return this.queue;
  }

  private async mappingsInDrive(): Promise<string[]> {
    const client = this.runtime?.client;
    if (!client) return [];
    const drive = (await client.get(this.driveId)) as unknown as { state: { global: { nodes: { id: string; kind: string; documentType?: string }[] } } };
    return drive.state.global.nodes.filter((n) => n.kind === "file" && n.documentType === SYNC_TYPE).map((n) => n.id);
  }

  private async sweep(): Promise<void> {
    for (const id of await this.mappingsInDrive()) await this.consider(id);
  }

  private async scheduleOnChange(): Promise<void> {
    const client = this.runtime?.client;
    if (!client) return;
    for (const id of await this.mappingsInDrive()) {
      const s = await this.stateOf(id);
      if (s && s.driveId === this.driveId && isAutomatic(s)) this.changed(id);
    }
  }

  /** A change for an automatic mapping: it runs once the changes stop (debounced, with a ceiling). */
  private changed(id: string): void {
    if (this.disconnected) return;
    this.changes.touch(id, () => {
      if (!this.disconnected) void this.enqueue(() => this.start(id, null, false));
    });
  }

  /** Watches an automatic mapping's local folder, and stops watching any other. */
  private syncWatcher(id: string, s: FolderSyncState | undefined): void {
    const path = s && s.driveId === this.driveId && isAutomatic(s) ? s.localPath : null;
    const current = this.watchers.get(id);
    if (current && current.path === path) return;
    current?.watcher.close();
    this.watchers.delete(id);
    if (!path || this.disconnected) return;
    try {
      const watcher = watch(path, { recursive: true }, (_event, name) => {
        if (name && OWN_FILES.test(String(name))) return;
        if (this.running.has(id) || Date.now() < (this.quietUntil.get(id) ?? 0)) return;
        this.changed(id);
      });
      watcher.on("error", () => {
        watcher.close();
        if (this.watchers.get(id)?.watcher === watcher) this.watchers.delete(id);
      });
      this.watchers.set(id, { path, watcher });
    } catch {
      // The folder is not there yet: the first run makes it, and the next look watches it.
    }
  }

  private async stateOf(id: string): Promise<FolderSyncState | undefined> {
    try {
      const doc = (await this.runtime?.client.get(id)) as unknown as { header: { documentType: string }; state: { global: FolderSyncState } } | undefined;
      return doc?.header.documentType === SYNC_TYPE ? doc.state.global : undefined;
    } catch {
      return undefined;
    }
  }

  /** Runs a mapping of this drive that is waiting for one; closes a run a restart left open. */
  private async consider(id: string): Promise<void> {
    if (this.running.has(id) || this.disconnected) return;
    const s = await this.stateOf(id);
    this.syncWatcher(id, s);
    if (!s || s.driveId !== this.driveId) return;
    const last = s.runs.at(0);
    if (s.status === "RUNNING" && last && !last.finishedAt && !this.ours.has(last.id)) {
      await this.dispatch(id, [
        actions.finishRun({ id: last.id, finishedAt: new Date().toISOString(), status: "CANCELLED", error: "Interrupted: the Switchboard stopped during the run" }),
      ]);
      return; // the FINISH_RUN comes back as an operation, and is considered then
    }
    if (s.status !== "REQUESTED" || !s.enabled || !s.localPath) return;
    await this.start(id, s.request?.id ?? null, s.request?.full ?? false);
  }

  /** Starts a run in the background: a long copy must not hold up the processor. */
  private async start(id: string, requestId: string | null, full: boolean): Promise<void> {
    if (this.running.has(id) || this.disconnected || !this.runtime) return;
    const s = await this.stateOf(id);
    if (!s || s.driveId !== this.driveId || !s.enabled || !s.localPath) return;
    this.running.add(id);
    const deps = this.deps();
    const allowedRoots = await readAllowedRoots();
    void runSync(id, s, deps, { requestId, full, allowedRoots })
      .catch((e: unknown) => console.warn(`[folder-sync] ${id}:`, e instanceof Error ? e.message : e))
      .finally(() => {
        this.running.delete(id);
        this.quietUntil.set(id, Date.now() + RUN_ECHO_MS);
      });
  }

  private deps(): RunnerDeps {
    const runtime = this.runtime as FolderSyncRuntime;
    return {
      getDocument: (id) => runtime.client.get(id) as unknown as ReturnType<RunnerDeps["getDocument"]>,
      download: async (documentId, ref) => {
        const { blob } = await runtime.attachments.downloadBlob({ documentId, ref: ref as `attachment://v${number}:${string}` });
        return new Uint8Array(await blob.arrayBuffer());
      },
      dispatch: (documentId, list) => this.dispatch(documentId, list),
      createFile: async (driveId, parentFolder, name) => {
        const doc = fileUtils.createDocument();
        doc.header.name = name;
        const created = await runtime.client.createDocumentInDrive(driveId, doc, parentFolder ?? undefined);
        return created.header.id;
      },
      createFolder: async (driveId, parentFolder, name) => {
        const id = randomUUID();
        await this.dispatch(driveId, [addFolder({ id, name, parentFolder: parentFolder ?? undefined })]);
        return id;
      },
      deleteNode: async (driveId, nodeId) => {
        await this.dispatch(driveId, [deleteNode({ id: nodeId })]);
        try {
          await runtime.client.deleteDocument(nodeId);
        } catch {
          // already gone with its node
        }
      },
      stage: async (bytes, fileName, mimeType) => {
        const pre = await runtime.attachments.preprocess(new Blob([new Uint8Array(bytes)]), { fileName, mimeType: mimeType ?? undefined });
        return {
          ref: pre.ref,
          upload: async () => {
            await runtime.attachments.upload({ preprocessed: pre });
          },
        };
      },
      host: { name: hostname(), platform: process.platform, reactorId: `switchboard@${hostname()}` },
      now: () => new Date(),
      newId: () => {
        const id = randomUUID();
        this.ours.add(id);
        return id;
      },
    };
  }

  private async dispatch(documentId: string, list: Action[]): Promise<void> {
    await this.runtime?.dispatch.execute(documentId, "main", list);
  }
}
