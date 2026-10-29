// Folder syncs: a drive folder mapped onto a folder on the Switchboard's
// machine (the sektar/folder-sync model). The mappings live in the drive they
// describe, in a hidden `.sync` folder at its root that the tree and the
// listing leave out. The app writes the mapping and asks for runs; the
// Switchboard writes the files and reports back on the same document.
// What the Files app lists of them (the tree's synced folders, the menu)
// comes from the Files index, one row per mapping (kit/files-index.ts); a
// mapping document is loaded only when it is opened.
import { addDocument, addFolder, dispatchActions } from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import { actions, type FolderSyncDocument, type FolderSyncState } from "document-models/folder-sync";
import type { BadgeTone } from "./format.js";

export const SYNC_TYPE = "sektar/folder-sync";
/** The root folder the mappings are kept in. */
export const SYNC_FOLDER = ".sync";

/**
 * Creates a mapping for a drive folder (null: the drive's root) and returns
 * its id. The mapping is filed in the `.sync` folder, made when the drive
 * has none yet.
 */
export async function createMapping(
  driveId: string,
  folderId: string | null,
  /** The folder's path from the drive's root, e.g. kwartaalaangiftes/2026-Q3; "" for the root */
  path: string,
  driveName: string,
  /** The drive's `.sync` folder, as the Files index knows it */
  syncFolderId: string | null,
): Promise<string> {
  const home = syncFolderId ?? (await addFolder(driveId, SYNC_FOLDER)).id;
  const node = await addDocument(driveId, path.split("/").at(-1) || driveName, SYNC_TYPE, home);
  await dispatchActions(actions.setTarget({ driveId, folderId, folderPath: path || null }), node.id);
  return node.id;
}

/**
 * Whether a document is a mapping, by its type alone. The model's own guard
 * validates the whole state against the current schema, which a mapping
 * stored before a field was added fails until its next operation fills it in.
 */
export function isMapping(doc: { header: { documentType: string } }): doc is FolderSyncDocument {
  return doc.header.documentType === SYNC_TYPE;
}

/** Whether a mapping can run: from its document's state or its index row. */
export function isRunnable(s: { enabled: boolean; driveId?: string | null; localPath?: string | null }): boolean {
  return s.enabled && Boolean(s.driveId && s.localPath);
}

/** Asks the Switchboard for a run of one mapping. */
export function requestSync(mappingId: string, full = false) {
  return dispatchActions(
    actions.requestSync({ id: generateId(), requestedAt: new Date().toISOString(), requestedBy: "app", full }),
    mappingId,
  );
}

/** A File source that stands for something on disk, not pulled yet. */
export function isPlaceholderKind(kind: string | null | undefined): boolean {
  return kind === "FILE_PLACEHOLDER" || kind === "DOCUMENT_PLACEHOLDER";
}

/** Asks a mapping's Switchboard to pull placeholders into the drive: these Files, or (none given) all of them. */
export function requestPull(mappingId: string, nodeIds: string[] = []) {
  return dispatchActions(
    actions.requestPull({ id: generateId(), requestedAt: new Date().toISOString(), requestedBy: "app", nodeIds }),
    mappingId,
  );
}

/** Asks for a run of every mapping that can run; returns how many were asked. */
export async function requestSyncAll(mappings: readonly (MappingStatus & { id: string })[]): Promise<number> {
  const runnable = mappings.filter((m) => isRunnable(m));
  await Promise.all(runnable.map((m) => requestSync(m.id)));
  return runnable.length;
}

/** "just now", "4 min ago", "3 h ago", "yesterday", "12 Oct". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 2 * 86_400) return "yesterday";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export interface SyncStatusInfo {
  tone: BadgeTone;
  label: string;
  /** One line under the label: when, or what went wrong */
  detail: string;
  /** Worth a dot on the toolbar icon */
  attention: boolean;
}

/**
 * What a badge needs of a mapping: the Files index's row for it
 * (SyncMappingSummary) has these fields, and `mappingStatus` makes them out
 * of an open mapping document.
 */
export interface MappingStatus {
  driveId: string | null;
  localPath: string | null;
  enabled: boolean;
  status: string;
  requestedAt: string | null;
  lastRun: { startedAt: string | null; finishedAt: string | null; placeholders: number; error: string | null } | null;
  issueCount: number;
}

/** A mapping document's state, as its badge reads it. */
export function mappingStatus(s: FolderSyncState): MappingStatus {
  const last = s.runs.at(0);
  return {
    driveId: s.driveId ?? null,
    localPath: s.localPath ?? null,
    enabled: s.enabled,
    status: s.status,
    requestedAt: s.request?.requestedAt ?? null,
    lastRun: last
      ? { startedAt: last.startedAt, finishedAt: last.finishedAt ?? null, placeholders: last.placeholders ?? 0, error: last.error ?? null }
      : null,
    issueCount: s.issues.length,
  };
}

/** What a mapping's state comes down to, for a badge and a line under it. */
export function statusInfo(s: MappingStatus, now = Date.now()): SyncStatusInfo {
  const last = s.lastRun;
  if (!s.driveId || !s.localPath) return { tone: "warning", label: "Not set up", detail: "Choose the folder on disk", attention: true };
  if (!s.enabled) return { tone: "outline", label: "Paused", detail: last?.finishedAt ? `Last synced ${ago(last.finishedAt, now)}` : "Never synced", attention: false };
  switch (s.status) {
    case "NEVER":
      return { tone: "outline", label: "Never synced", detail: "Synchronize to write the files", attention: false };
    case "REQUESTED":
      return { tone: "info", label: "Waiting", detail: `Asked ${ago(s.requestedAt, now)} · the Switchboard picks it up`, attention: false };
    case "RUNNING":
      return { tone: "info", label: "Syncing…", detail: last ? `Started ${ago(last.startedAt, now)}` : "", attention: false };
    case "OK": {
      const waiting = last?.placeholders ?? 0;
      if (waiting > 0) return { tone: "info", label: `${waiting} to pull`, detail: `Changes on disk · synced ${ago(last?.finishedAt, now)}`, attention: true };
      return { tone: "success", label: "Synced", detail: ago(last?.finishedAt, now), attention: false };
    }
    case "PARTIAL": {
      const n = s.issueCount;
      return { tone: "warning", label: n === 1 ? "1 issue" : `${n} issues`, detail: `Synced ${ago(last?.finishedAt, now)}`, attention: true };
    }
    case "ERROR":
      return { tone: "danger", label: "Failed", detail: last?.error ?? `Failed ${ago(last?.finishedAt, now)}`, attention: true };
    default:
      return { tone: "outline", label: s.status, detail: "", attention: false };
  }
}

/** The local path shortened from the left for a menu row: …\KSDC\kwartaalaangiftes\2026-Q3 */
export function shortPath(path: string | null | undefined, max = 42): string {
  if (!path) return "No local folder";
  if (path.length <= max) return path;
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(sep);
  let out = parts.at(-1) ?? path;
  for (let i = parts.length - 2; i > 0 && out.length + parts[i].length + 2 < max; i--) out = `${parts[i]}${sep}${out}`;
  return `…${sep}${out}`;
}
