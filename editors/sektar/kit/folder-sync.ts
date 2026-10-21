// Folder syncs: a drive folder mapped onto a folder on the Switchboard's
// machine (the sektar/folder-sync model). The mappings live in the drive they
// describe, in a hidden `.sync` folder at its root that the tree and the
// listing leave out. The app writes the mapping and asks for runs; the
// Switchboard writes the files and reports back on the same document.
import { addDocument, addFolder, dispatchActions, isFileNodeKind } from "@powerhousedao/reactor-browser";
import type { Node } from "@powerhousedao/shared/document-drive";
import { generateId } from "document-model";
import { actions, type FolderSyncDocument, type FolderSyncState } from "document-models/folder-sync";
import type { BadgeTone } from "./format.js";

export const SYNC_TYPE = "sektar/folder-sync";
/** The root folder the mappings are kept in. */
export const SYNC_FOLDER = ".sync";

/** The `.sync` folder and everything in it: what the Files app does not show. */
export function hiddenSyncIds(nodes: readonly Node[]): Set<string> {
  const hidden = new Set<string>();
  for (const n of nodes) if (n.kind === "folder" && !n.parentFolder && n.name === SYNC_FOLDER) hidden.add(n.id);
  // Nodes can come in any order: repeat until nothing more is added below a hidden folder.
  for (let grew = hidden.size > 0; grew; ) {
    grew = false;
    for (const n of nodes) {
      if (!hidden.has(n.id) && n.parentFolder && hidden.has(n.parentFolder)) {
        hidden.add(n.id);
        grew = true;
      }
    }
  }
  return hidden;
}

/** The ids of the drive's mapping documents. */
export function mappingIds(nodes: readonly Node[]): string[] {
  return nodes.filter((n) => isFileNodeKind(n) && n.documentType === SYNC_TYPE).map((n) => n.id);
}

/** A folder's path from the drive's root, e.g. kwartaalaangiftes/2026-Q3; "" for the root. */
export function folderPath(nodes: readonly Node[], folderId: string | null): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let cur = folderId; cur && !seen.has(cur); ) {
    seen.add(cur);
    const n = byId.get(cur);
    if (!n) break;
    parts.unshift(n.name);
    cur = n.parentFolder ?? null;
  }
  return parts.join("/");
}

/** Creates a mapping for a drive folder (null: the drive's root) and returns its id. */
export async function createMapping(driveId: string, nodes: readonly Node[], folderId: string | null, driveName: string): Promise<string> {
  let home = nodes.find((n) => n.kind === "folder" && !n.parentFolder && n.name === SYNC_FOLDER)?.id;
  if (!home) home = (await addFolder(driveId, SYNC_FOLDER)).id;
  const path = folderPath(nodes, folderId);
  const node = await addDocument(driveId, path.split("/").at(-1) || driveName, SYNC_TYPE, home);
  await dispatchActions(actions.setTarget({ driveId, folderId, folderPath: path || null }), node.id);
  return node.id;
}

export function isRunnable(s: FolderSyncState): boolean {
  return s.enabled && Boolean(s.driveId && s.localPath);
}

/** Asks the Switchboard for a run of one mapping. */
export function requestSync(doc: FolderSyncDocument, full = false) {
  return dispatchActions(
    actions.requestSync({ id: generateId(), requestedAt: new Date().toISOString(), requestedBy: "app", full }),
    doc.header.id,
  );
}

/** Asks for a run of every mapping that can run; returns how many were asked. */
export async function requestSyncAll(docs: readonly FolderSyncDocument[]): Promise<number> {
  const runnable = docs.filter((d) => isRunnable(d.state.global));
  await Promise.all(runnable.map((d) => requestSync(d)));
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

/** What a mapping's state comes down to, for a badge and a line under it. */
export function statusInfo(s: FolderSyncState, now = Date.now()): SyncStatusInfo {
  const last = s.runs.at(0);
  if (!s.driveId || !s.localPath) return { tone: "warning", label: "Not set up", detail: "Choose the folder on disk", attention: true };
  if (!s.enabled) return { tone: "outline", label: "Paused", detail: last?.finishedAt ? `Last synced ${ago(last.finishedAt, now)}` : "Never synced", attention: false };
  switch (s.status) {
    case "NEVER":
      return { tone: "outline", label: "Never synced", detail: "Synchronize to write the files", attention: false };
    case "REQUESTED":
      return { tone: "info", label: "Waiting", detail: `Asked ${ago(s.request?.requestedAt, now)} · the Switchboard picks it up`, attention: false };
    case "RUNNING":
      return { tone: "info", label: "Syncing…", detail: last ? `Started ${ago(last.startedAt, now)}` : "", attention: false };
    case "OK":
      return { tone: "success", label: "Synced", detail: ago(last?.finishedAt, now), attention: false };
    case "PARTIAL": {
      const n = s.issues.length;
      return { tone: "warning", label: n === 1 ? "1 issue" : `${n} issues`, detail: `Synced ${ago(last?.finishedAt, now)}`, attention: true };
    }
    case "ERROR":
      return { tone: "danger", label: "Failed", detail: last?.error ?? `Failed ${ago(last?.finishedAt, now)}`, attention: true };
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
