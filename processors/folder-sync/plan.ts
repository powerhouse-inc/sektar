// What a folder sync writes where, and what to do with each file: the pure
// half of the runner (runner.ts does the reading and writing). Paths are
// kept as "/"-separated relative paths here; the runner joins them onto the
// local folder with the platform's separator.

export const MANIFEST_NAME = ".sektar-sync.json";
export const MANIFEST_VERSION = 1;

/** A drive node, as much of it as the plan needs. */
export interface PlanNode {
  id: string;
  name: string;
  kind: string;
  parentFolder?: string | null;
  documentType?: string;
}

/** One file the mapping wants on disk. */
export interface WantedFile {
  /** The manifest key: the node id, plus `#<rendition id>` for a rendition */
  key: string;
  nodeId: string;
  documentId: string;
  relPath: string;
  /** Lowercase SHA-256 hex of the content (an attachment ref's hash); null for inline text */
  hash: string | null;
  /** Where the bytes come from */
  source: { ref: string } | { text: string };
  size: number | null;
}

export interface ManifestEntry {
  relPath: string;
  hash: string;
  size: number;
  mtimeMs: number;
  writtenAt: string;
}

export interface Manifest {
  version: number;
  mappingId: string;
  files: Record<string, ManifestEntry>;
  /** The drive folders mirrored on disk: node id to the directory's relative path */
  folders?: Record<string, string>;
  /**
   * Files a run stopped tracking but left on disk (their document left the
   * folder and nothing was to be deleted), by relative path, with the content
   * they had: while that is still what is there, they are not new on disk.
   */
  left?: Record<string, { hash: string }>;
}

/** What is on disk at a wanted path. `hash` is filled only when it was computed. */
export interface DiskFile {
  exists: boolean;
  size?: number;
  mtimeMs?: number;
  hash?: string;
}

export type ConflictPolicy = "SKIP" | "OVERWRITE" | "KEEP_BOTH";

export type Decision =
  /** Already there with the same content */
  | { kind: "unchanged" }
  /** Write (or rewrite) the file */
  | { kind: "write" }
  /** Changed on disk since it was written, or there before and different */
  | { kind: "conflict"; resolution: "skip" | "overwrite" | "keep-both" };

/** The hash in an attachment ref (`attachment://v1:<sha256>`), or null. */
export function refHash(ref: string | null | undefined): string | null {
  const m = /^attachment:\/\/v1:([0-9a-f]{64})$/i.exec(ref ?? "");
  return m ? m[1].toLowerCase() : null;
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** A name that every file system accepts: no separators or reserved characters, no trailing dots or spaces, no device names. */
export function safeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  let out = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "");
  if (RESERVED.test(out)) out = `_${out}`;
  return out || "_";
}

/** A node's file name with the source's extension when the node's name has none. */
export function fileNameFor(nodeName: string, sourceFileName: string | null | undefined): string {
  const ext = extOf(sourceFileName);
  return ext && !extOf(nodeName) ? `${nodeName}${ext}` : nodeName;
}

const MIME_EXT: Record<string, string> = {
  "text/plain": ".txt",
  "text/html": ".html",
  "text/markdown": ".md",
  "application/json": ".json",
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/** A rendition's file name beside its source: `invoice.ocr.txt` for an ocr rendition of invoice.pdf. */
export function renditionName(
  sourceName: string,
  rendition: { id: string; type?: string | null; label?: string | null; fileName?: string | null; mimeType: string },
): string {
  const stem = extOf(sourceName) ? sourceName.slice(0, -extOf(sourceName).length) : sourceName;
  const role = (rendition.type || rendition.label || rendition.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rendition";
  const ext = extOf(rendition.fileName) || MIME_EXT[rendition.mimeType.split(";")[0].trim().toLowerCase()] || "";
  return `${stem}.${role}${ext}`;
}

function extOf(name: string | null | undefined): string {
  const m = /(\.[A-Za-z0-9]{1,8})$/.exec(name ?? "");
  return m ? m[1] : "";
}

/**
 * The mapped folder's documents, each with the folder path below the mapped
 * folder ("" directly in it). Subfolders only when asked for.
 */
export function collectDocuments(
  nodes: readonly PlanNode[],
  rootFolderId: string | null,
  includeSubfolders: boolean,
): { node: PlanNode; dir: string }[] {
  const children = new Map<string | null, PlanNode[]>();
  for (const n of nodes) {
    const parent = n.parentFolder ?? null;
    children.set(parent, [...(children.get(parent) ?? []), n]);
  }
  const out: { node: PlanNode; dir: string }[] = [];
  const seen = new Set<string>();
  const walk = (folderId: string | null, dir: string) => {
    for (const n of children.get(folderId) ?? []) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      if (n.kind === "folder") {
        // The folder syncs' own folder is never copied out.
        if (folderId === null && n.name === ".sync") continue;
        if (includeSubfolders) walk(n.id, dir ? `${dir}/${safeName(n.name)}` : safeName(n.name));
      } else {
        out.push({ node: n, dir });
      }
    }
  };
  walk(rootFolderId, "");
  return out;
}

/** The drive folders below the mapped one, each with the directory it is on disk; none without subfolders. */
export function collectFolders(
  nodes: readonly PlanNode[],
  rootFolderId: string | null,
  includeSubfolders: boolean,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!includeSubfolders) return out;
  const children = new Map<string | null, PlanNode[]>();
  for (const n of nodes) {
    if (n.kind !== "folder") continue;
    const parent = n.parentFolder ?? null;
    children.set(parent, [...(children.get(parent) ?? []), n]);
  }
  const walk = (folderId: string | null, dir: string) => {
    for (const n of children.get(folderId) ?? []) {
      if (out.has(n.id)) continue;
      // The folder syncs' own folder is never copied out.
      if (folderId === null && n.name === ".sync") continue;
      const rel = dir ? `${dir}/${safeName(n.name)}` : safeName(n.name);
      out.set(n.id, rel);
      walk(n.id, rel);
    }
  };
  walk(rootFolderId, "");
  return out;
}

/** How deep a relative path is: deepest first is the order to remove directories in. */
export const depthOf = (relPath: string) => relPath.split("/").length;

/** The comparison key of a path on this platform: case-insensitive where the file system is. */
export function pathKey(relPath: string, platform: string): string {
  return platform === "win32" || platform === "darwin" ? relPath.toLowerCase() : relPath;
}

/**
 * Whether the disk can be trusted without hashing it: the manifest wrote this
 * very content and the file still has the size and time it had then.
 */
export function unchangedSinceWritten(want: WantedFile, entry: ManifestEntry | undefined, disk: DiskFile): boolean {
  return (
    entry !== undefined &&
    want.hash !== null &&
    entry.hash === want.hash &&
    entry.relPath === want.relPath &&
    disk.exists &&
    disk.size === entry.size &&
    disk.mtimeMs === entry.mtimeMs
  );
}

/** What to do with one wanted file, given what the manifest wrote and what is on disk (hashed). */
export function decide(want: WantedFile, entry: ManifestEntry | undefined, disk: DiskFile, policy: ConflictPolicy): Decision {
  if (!disk.exists) return { kind: "write" };
  if (want.hash !== null && disk.hash === want.hash) return { kind: "unchanged" };
  // Still what the sync wrote last: the source moved on, so follow it.
  if (entry && entry.relPath === want.relPath && disk.hash === entry.hash) return { kind: "write" };
  return {
    kind: "conflict",
    resolution: policy === "OVERWRITE" ? "overwrite" : policy === "KEEP_BOTH" ? "keep-both" : "skip",
  };
}

/** Where a file changed on disk is kept when both are kept: `name (changed on disk 2026-10-21).ext`. */
export function keepBothName(relPath: string, at: Date): string {
  const slash = relPath.lastIndexOf("/");
  const dir = slash >= 0 ? relPath.slice(0, slash + 1) : "";
  const name = relPath.slice(slash + 1);
  const ext = extOf(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  return `${dir}${stem} (changed on disk ${at.toISOString().slice(0, 10)})${ext}`;
}
