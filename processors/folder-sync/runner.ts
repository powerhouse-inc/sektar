// One run of a folder sync: copy the mapped drive folder's files into the
// local folder, keep the manifest beside them, and report the run on the
// mapping (START_RUN, SET_ISSUES, FINISH_RUN). The decisions are plan.ts's;
// this is the reading and the writing.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Action } from "document-model";
import { actions, type FolderSyncIssueInput, type FolderSyncState } from "document-models/folder-sync";
import {
  collectDocuments,
  collectFolders,
  decide,
  depthOf,
  fileNameFor,
  keepBothName,
  MANIFEST_NAME,
  MANIFEST_VERSION,
  pathKey,
  refHash,
  renditionName,
  safeName,
  unchangedSinceWritten,
  type DiskFile,
  type Manifest,
  type ManifestEntry,
  type PlanNode,
  type WantedFile,
} from "./plan.js";
import { DiskChanges, isDocumentFile, listDiskFiles, type PendingPlaceholder, type ReverseDeps } from "./reverse.js";

const FILE_TYPE = "sektar/file";
/** The issues a run reports; the rest are counted, not listed. */
const MAX_ISSUES = 200;

export interface RunnerHost {
  name: string;
  platform: string;
  reactorId: string;
}

/** What the runner needs from the reactor, the attachment store and the clock. */
export interface RunnerDeps extends ReverseDeps {
  /** A document's current state (the drive, a File) */
  getDocument(id: string): Promise<{ header: { revision?: Record<string, number> }; state: { global: unknown } }>;
  /** An attachment's bytes, read through the document that holds it */
  download(documentId: string, ref: string): Promise<Uint8Array>;
  /** Dispatches actions on the mapping */
  dispatch(documentId: string, actions: Action[]): Promise<void>;
  host: RunnerHost;
  now(): Date;
  newId(): string;
}

interface FileStateLike {
  placeholder?: PendingPlaceholder | null;
  source?: { kind: string; ref?: string | null; fileName?: string | null; sizeBytes?: number | null } | null;
  renditions?: { id: string; type?: string | null; label?: string | null; fileName?: string | null; mimeType: string; ref?: string | null; sizeBytes?: number | null; text?: string | null }[];
}

export interface RunOutcome {
  status: "OK" | "PARTIAL" | "ERROR";
  written: number;
  unchanged: number;
  deleted: number;
  skipped: number;
  conflicts: number;
  errors: number;
  bytesWritten: number;
  /** Changes found on disk, recorded as placeholders */
  placeholders: number;
  /** Changes found on disk, pulled into the drive */
  pulled: number;
  error: string | null;
  issues: FolderSyncIssueInput[];
}

/**
 * Runs a mapping once. Reports the start, then the issues and the finish,
 * on the mapping itself; a failure of the whole run (the local folder cannot
 * be made, the drive cannot be read) finishes it as ERROR. A quiet run (an
 * automatic one) reports nothing when it found nothing to do, and otherwise
 * its start, issues and finish together at the end.
 */
export async function runSync(
  mappingId: string,
  s: FolderSyncState,
  deps: RunnerDeps,
  options: {
    requestId: string | null;
    full: boolean;
    /** When set, the only folders a run may write into (and below); the mapping's own path is checked against it */
    allowedRoots?: readonly string[] | null;
    /** Leave no record of a run that found nothing to do (an automatic run) */
    quiet?: boolean;
  },
): Promise<RunOutcome> {
  const runId = deps.newId();
  let driveRevision: number | null = null;
  let drive: Awaited<ReturnType<RunnerDeps["getDocument"]>> | undefined;
  try {
    drive = s.driveId ? await deps.getDocument(s.driveId) : undefined;
    driveRevision = drive?.header.revision?.global ?? null;
  } catch {
    // reported below, once the run is on record
  }
  const started = actions.startRun({
    id: runId,
    requestId: options.requestId,
    startedAt: deps.now().toISOString(),
    full: options.full,
    driveRevision,
    hostName: deps.host.name,
    hostPlatform: deps.host.platform,
    reactorId: deps.host.reactorId,
  });
  if (!options.quiet) await deps.dispatch(mappingId, [started]);

  let outcome: RunOutcome;
  try {
    if (!s.driveId || !s.localPath) throw new Error("The mapping has no drive folder or no local path");
    if (!isAllowed(s.localPath, options.allowedRoots ?? null, deps.host.platform)) {
      throw new Error(`${s.localPath} is outside the folders this Switchboard may write to (.ph/folder-sync-roots.txt)`);
    }
    if (!drive) throw new Error(`The drive ${s.driveId} could not be read`);
    outcome = await copyFolder(mappingId, s, drive.state.global as { nodes: PlanNode[] }, s.localPath, deps, options.full);
  } catch (e) {
    outcome = { ...emptyOutcome(), status: "ERROR", error: e instanceof Error ? e.message : String(e) };
  }

  if (options.quiet && isIdle(outcome, s)) return outcome;
  const finishedAt = deps.now().toISOString();
  await deps.dispatch(mappingId, [
    ...(options.quiet ? [started] : []),
    actions.setIssues({ issues: outcome.issues.slice(0, MAX_ISSUES) }),
    // Every pull asked for was looked at in this run; one that failed is an issue, not a retry.
    // Before FINISH_RUN: a pull still on the list there would make the mapping owe another run.
    ...(s.pulls ?? []).map((p) => actions.completePull({ id: p.id })),
    actions.finishRun({
      id: runId,
      finishedAt,
      status: outcome.status,
      written: outcome.written,
      unchanged: outcome.unchanged,
      deleted: outcome.deleted,
      skipped: outcome.skipped,
      conflicts: outcome.conflicts,
      errors: outcome.errors,
      bytesWritten: outcome.bytesWritten,
      placeholders: outcome.placeholders,
      pulled: outcome.pulled,
      error: outcome.error,
    }),
  ]);
  return outcome;
}

/**
 * Whether a local path is inside one of the allowed roots. Mappings arrive
 * from other reactors too, so a Switchboard can be told where it may write;
 * without a list (null) every absolute path is allowed.
 */
export function isAllowed(localPath: string, roots: readonly string[] | null, platform: string): boolean {
  if (roots === null) return true;
  const norm = (p: string) => {
    const r = resolve(p).replace(/[\\/]+$/, "");
    return platform === "win32" ? r.toLowerCase() : r;
  };
  const target = norm(localPath);
  return roots.some((root) => {
    const r = norm(root);
    return target === r || target.startsWith(`${r}${sep}`);
  });
}

/** A run that changed nothing, anywhere, and has nothing new to report. */
export function isIdle(o: RunOutcome, s: FolderSyncState): boolean {
  const did = o.written + o.deleted + o.conflicts + o.errors + o.placeholders + o.pulled;
  return o.status === "OK" && !o.error && did === 0 && o.issues.length === 0 && s.issues.length === 0 && (s.pulls ?? []).length === 0;
}

function emptyOutcome(): RunOutcome {
  return { status: "OK", written: 0, unchanged: 0, deleted: 0, skipped: 0, conflicts: 0, errors: 0, bytesWritten: 0, placeholders: 0, pulled: 0, error: null, issues: [] };
}

async function copyFolder(
  mappingId: string,
  s: FolderSyncState,
  drive: { nodes: PlanNode[] },
  root: string,
  deps: RunnerDeps,
  full: boolean,
): Promise<RunOutcome> {
  const out = emptyOutcome();
  const at = () => deps.now().toISOString();
  const issue = (x: Omit<FolderSyncIssueInput, "id" | "at">) => out.issues.push({ id: deps.newId(), at: at(), ...x });

  await mkdir(root, { recursive: true });
  const manifest = await readManifest(root, mappingId);
  const nodes = [...drive.nodes];
  const changes = new DiskChanges(s.options.fromDisk ?? "OFF", s.pulls ?? [], s.driveId ?? "", mappingId, s.folderId ?? null, nodes, deps);
  /** Placeholder Files (nothing pulled yet), by the path they stand for */
  const placeholderFiles = new Map<string, { id: string; pending: PendingPlaceholder | null | undefined }>();
  /** The change from disk a File with a source waits on */
  const pendingOf = new Map<string, PendingPlaceholder | null | undefined>();
  /** Files whose deletion on disk was pulled: their record goes */
  const dropped = new Set<string>();

  /* -- the folders: made on disk (empty ones too), or found deleted there -- */
  const platform = deps.host.platform;
  const folders = collectFolders(nodes, s.folderId ?? null, s.options.includeSubfolders);
  const nextFolders: Record<string, string> = {};
  /** Drive folders whose directory was deleted on disk */
  const goneOnDisk: string[] = [];
  // A record from before folders were kept: a directory the sync wrote files
  // into was there; one it never wrote into was never made.
  const writtenInto = (rel: string) => {
    const prefix = `${pathKey(rel, platform)}/`;
    return Object.values(manifest.files).some((e) => pathKey(e.relPath, platform).startsWith(prefix));
  };
  for (const [id, rel] of folders) {
    const exists = await isDir(join(root, ...rel.split("/")));
    const recorded = manifest.folders ? manifest.folders[id] : writtenInto(rel) ? rel : undefined;
    if (exists) {
      nextFolders[id] = rel;
    } else if (changes.on && recorded !== undefined && pathKey(recorded, platform) === pathKey(rel, platform)) {
      // There before, at the same place, and gone now: deleted on disk, not made again.
      goneOnDisk.push(id);
      nextFolders[id] = rel;
    } else if (s.options.writeFiles !== false) {
      try {
        await mkdir(join(root, ...rel.split("/")), { recursive: true });
        nextFolders[id] = rel;
      } catch (e) {
        out.errors++;
        issue({ kind: "ERROR", nodeId: id, relativePath: rel, message: `The folder could not be made: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  }

  /* -- what the folder wants on disk -- */
  const wanted: WantedFile[] = [];
  const taken = new Map<string, string>();
  const claim = (want: WantedFile): boolean => {
    const k = pathKey(want.relPath, deps.host.platform);
    const holder = taken.get(k);
    if (holder !== undefined) {
      out.skipped++;
      issue({ kind: "NAME_CLASH", nodeId: want.nodeId, documentId: want.documentId, relativePath: want.relPath, message: `Another document already writes ${want.relPath}` });
      return false;
    }
    taken.set(k, want.key);
    return true;
  };

  for (const { node, dir } of collectDocuments(nodes, s.folderId ?? null, s.options.includeSubfolders)) {
    const prefix = dir ? `${dir}/` : "";
    if (node.documentType !== FILE_TYPE) {
      out.skipped++;
      if (s.options.otherDocuments === "EXPORT_PHD") {
        issue({ kind: "ERROR", nodeId: node.id, documentId: node.id, relativePath: `${prefix}${safeName(node.name)}.phd`, message: "Exporting documents as .phd is not available yet" });
      }
      continue;
    }
    let file: FileStateLike;
    try {
      file = (await deps.getDocument(node.id)).state.global as FileStateLike;
    } catch (e) {
      out.errors++;
      issue({ kind: "ERROR", nodeId: node.id, documentId: node.id, relativePath: `${prefix}${safeName(node.name)}`, message: `The File could not be read: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const source = file.source;
    if (source?.kind === "FILE_PLACEHOLDER" || source?.kind === "DOCUMENT_PLACEHOLDER") {
      // Stands for a file on disk that is not pulled yet: nothing to write.
      placeholderFiles.set(pathKey(`${prefix}${safeName(node.name)}`, deps.host.platform), { id: node.id, pending: file.placeholder });
      continue;
    }
    pendingOf.set(node.id, file.placeholder);
    const hash = refHash(source?.ref);
    if (!source || source.kind !== "ATTACHMENT" || !source.ref || !hash) {
      out.skipped++;
      issue({
        kind: "NO_SOURCE",
        nodeId: node.id,
        documentId: node.id,
        relativePath: `${prefix}${safeName(node.name)}`,
        message: source?.kind === "DOCUMENT" ? "The File stands for another document; there are no bytes to write" : "The File has no stored source yet",
      });
      continue;
    }
    const name = safeName(fileNameFor(node.name, source.fileName));
    const main: WantedFile = { key: node.id, nodeId: node.id, documentId: node.id, relPath: `${prefix}${name}`, hash, source: { ref: source.ref }, size: source.sizeBytes ?? null };
    if (!claim(main)) continue;
    wanted.push(main);
    if (s.options.content === "SOURCE_AND_RENDITIONS") {
      for (const r of file.renditions ?? []) {
        const rHash = refHash(r.ref);
        const content: WantedFile["source"] | null = r.ref && rHash ? { ref: r.ref } : typeof r.text === "string" ? { text: r.text } : null;
        if (!content) continue;
        const want: WantedFile = { key: `${node.id}#${r.id}`, nodeId: node.id, documentId: node.id, relPath: `${prefix}${safeName(renditionName(name, r))}`, hash: "ref" in content ? rHash : sha256(Buffer.from(content.text, "utf8")), source: content, size: r.sizeBytes ?? null };
        if (claim(want)) wanted.push(want);
      }
    }
  }

  /* -- write what changed -- */
  const nextFiles: Record<string, ManifestEntry> = {};
  const recorded = new Map(Object.entries(manifest.files));
  for (const want of wanted) {
    const entry = recorded.get(want.key);
    try {
      const target = join(root, ...want.relPath.split("/"));
      let disk = await look(target);
      // Changed on disk, the drive's copy not: the other way round (reverse.ts).
      if (changes.on && want.key === want.nodeId && entry && entry.relPath === want.relPath && entry.hash === want.hash) {
        const pending = pendingOf.get(want.nodeId);
        if (!disk.exists) {
          if (changes.pulls(want.nodeId, "DELETE")) {
            await changes.pullDelete(want.nodeId);
            dropped.add(want.key);
          } else {
            await changes.mark(want.nodeId, want.relPath, "DELETE", { hash: null, size: null, mtimeMs: null }, pending);
            nextFiles[want.key] = entry;
          }
          continue;
        }
        if (full || !unchangedSinceWritten(want, entry, disk)) disk = { ...disk, hash: await hashFile(target) };
        if (disk.hash !== undefined && disk.hash !== entry.hash) {
          const found = { hash: disk.hash, size: disk.size ?? 0, mtimeMs: disk.mtimeMs ?? 0 };
          if (changes.pulls(want.nodeId, "UPDATE")) {
            await changes.pull(want.nodeId, root, want.relPath, "UPDATE", found, pending);
            nextFiles[want.key] = { relPath: want.relPath, ...found, writtenAt: at() };
          } else {
            await changes.mark(want.nodeId, want.relPath, "UPDATE", found, pending);
            nextFiles[want.key] = entry;
          }
          continue;
        }
        // On disk as it was written: a change recorded before was undone there.
        await changes.clear(want.nodeId, pending);
      }
      // A mapping that only reads from disk writes nothing there.
      if (s.options.writeFiles === false) {
        if (entry) nextFiles[want.key] = entry;
        continue;
      }
      // Moved or renamed in the drive: move the file along rather than write it again.
      if (!disk.exists && entry && entry.relPath !== want.relPath && entry.hash === want.hash) {
        const from = join(root, ...entry.relPath.split("/"));
        const old = await look(from);
        if (old.exists && (await hashFile(from)) === entry.hash) {
          await mkdir(dirname(target), { recursive: true });
          await rename(from, target);
          disk = await look(target);
          nextFiles[want.key] = { ...entry, relPath: want.relPath, mtimeMs: disk.mtimeMs ?? entry.mtimeMs };
          out.written++;
          continue;
        }
      }
      if (!full && unchangedSinceWritten(want, entry, disk)) {
        nextFiles[want.key] = entry as ManifestEntry;
        out.unchanged++;
        continue;
      }
      if (disk.exists) disk = { ...disk, hash: await hashFile(target) };
      const decision = decide(want, entry, disk, s.options.onConflict);
      if (decision.kind === "unchanged") {
        nextFiles[want.key] = { relPath: want.relPath, hash: disk.hash as string, size: disk.size ?? 0, mtimeMs: disk.mtimeMs ?? 0, writtenAt: entry?.writtenAt ?? at() };
        out.unchanged++;
        continue;
      }
      if (decision.kind === "conflict") {
        out.conflicts++;
        if (decision.resolution === "skip") {
          issue({ kind: "CONFLICT", nodeId: want.nodeId, documentId: want.documentId, relativePath: want.relPath, message: entry ? "Changed on disk since it was written; left as it is" : "A different file is already there; left as it is" });
          // Keep what was recorded, so the file is still recognised as changed next time.
          if (entry) nextFiles[want.key] = entry;
          continue;
        }
        if (decision.resolution === "keep-both") {
          const aside = keepBothName(want.relPath, deps.now());
          await rename(target, join(root, ...aside.split("/")));
          issue({ kind: "CONFLICT", nodeId: want.nodeId, documentId: want.documentId, relativePath: want.relPath, message: `Changed on disk; that version was kept as ${aside}` });
        }
      }
      const bytes = "ref" in want.source ? await deps.download(want.documentId, want.source.ref) : Buffer.from(want.source.text, "utf8");
      const written = await writeAtomically(target, bytes);
      nextFiles[want.key] = { relPath: want.relPath, hash: want.hash ?? sha256(bytes), size: written.size, mtimeMs: written.mtimeMs, writtenAt: at() };
      out.written++;
      out.bytesWritten += bytes.byteLength;
    } catch (e) {
      out.errors++;
      const code = (e as { code?: string }).code;
      issue({
        kind: code === "ENAMETOOLONG" ? "PATH_TOO_LONG" : "ERROR",
        nodeId: want.nodeId,
        documentId: want.documentId,
        relativePath: want.relPath,
        message: code === "ENAMETOOLONG" ? "The path is too long for this file system" : e instanceof Error ? e.message : String(e),
      });
      if (entry) nextFiles[want.key] = entry;
    }
  }

  /* -- what is on disk and not in the drive: new files, the other way round -- */
  /** Files left on disk by an earlier run, still as they were left */
  const nextLeft: Record<string, { hash: string }> = {};
  const leftBefore = new Map(Object.entries(manifest.left ?? {}).map(([rel, l]) => [pathKey(rel, platform), { rel, hash: l.hash }]));
  if (changes.on) {
    const known = new Set(
      [...Object.values(nextFiles), ...Object.values(manifest.files), ...wanted].map((x) => pathKey(x.relPath, deps.host.platform)),
    );
    const used = new Set<string>();
    for (const rel of await listDiskFiles(root, s.options.includeSubfolders)) {
      const k = pathKey(rel, deps.host.platform);
      if (known.has(k)) continue;
      const placeholder = placeholderFiles.get(k);
      try {
        const path = join(root, ...rel.split("/"));
        const st = await look(path);
        const found = { hash: await hashFile(path), size: st.size ?? 0, mtimeMs: st.mtimeMs ?? 0 };
        // Left here by the sync and not touched since: not new. Edited since: it is someone's now.
        const left = leftBefore.get(k);
        if (left && left.hash === found.hash) {
          nextLeft[left.rel] = { hash: left.hash };
          continue;
        }
        if (placeholder) used.add(placeholder.id);
        const id = placeholder?.id ?? (await changes.createPlaceholderFile(rel, found));
        const pending = placeholder ? placeholder.pending : { change: "CREATE" as const, hash: found.hash, relativePath: rel };
        if (!changes.pulls(id, "CREATE")) {
          await changes.mark(id, rel, "CREATE", found, pending);
        } else if (isDocumentFile(rel)) {
          await changes.mark(id, rel, "CREATE", found, pending);
          issue({ kind: "ERROR", nodeId: id, documentId: id, relativePath: rel, message: "Pulling documents (.phd) is not available yet; it stays a placeholder" });
        } else {
          await changes.pull(id, root, rel, "CREATE", found, pending);
          nextFiles[id] = { relPath: rel, ...found, writtenAt: at() };
        }
      } catch (e) {
        out.errors++;
        issue({ kind: "ERROR", relativePath: rel, message: `Could not take it from disk: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
    // A placeholder whose file left the disk again stands for nothing.
    for (const { id } of placeholderFiles.values()) if (!used.has(id)) await changes.dropPlaceholderFile(id);
  } else {
    // Not looking at the disk this run: what was left stays on record as it was.
    for (const { rel, hash } of leftBefore.values()) nextLeft[rel] = { hash };
  }
  out.placeholders = changes.placeholders;
  out.pulled = changes.pulled;

  /* -- what left the folder (or moved within it) -- */
  const kept = new Set(Object.values(nextFiles).map((e) => pathKey(e.relPath, deps.host.platform)));
  for (const [key, entry] of Object.entries(manifest.files)) {
    if (dropped.has(key)) continue;
    if (nextFiles[key]?.relPath === entry.relPath || kept.has(pathKey(entry.relPath, deps.host.platform))) continue;
    if (wanted.some((w) => w.key === key) && !(key in nextFiles)) {
      // Wanted but not written this time (an error, a skipped conflict): keep the record.
      nextFiles[key] = entry;
      continue;
    }
    const path = join(root, ...entry.relPath.split("/"));
    if (s.options.onRemoved !== "DELETE" || s.options.writeFiles === false) {
      // Kept on disk: remembered as left there, so a later look does not take it for a new file.
      try {
        if ((await look(path)).exists && (await hashFile(path)) === entry.hash) nextLeft[entry.relPath] = { hash: entry.hash };
      } catch {
        // gone or unreadable: nothing to remember
      }
      continue;
    }
    try {
      const disk = await look(path);
      if (!disk.exists) continue;
      if ((await hashFile(path)) !== entry.hash) {
        out.conflicts++;
        issue({ kind: "CONFLICT", relativePath: entry.relPath, message: "Its document left the folder, but the file was changed on disk; it was kept" });
        continue;
      }
      await rm(path);
      out.deleted++;
    } catch (e) {
      out.errors++;
      issue({ kind: "ERROR", relativePath: entry.relPath, message: e instanceof Error ? e.message : String(e) });
    }
  }

  /* -- folders deleted on disk leave the drive, once nothing is left in them -- */
  for (const id of goneOnDisk.sort((a, b) => depthOf(folders.get(b) ?? "") - depthOf(folders.get(a) ?? ""))) {
    if (nodes.some((n) => (n.parentFolder ?? null) === id)) continue;
    try {
      await changes.pullFolderDelete(id);
      delete nextFolders[id];
    } catch (e) {
      out.errors++;
      issue({ kind: "ERROR", nodeId: id, relativePath: folders.get(id), message: `The folder could not be removed from the drive: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  out.pulled = changes.pulled;

  /* -- directories the drive no longer has there: moved or renamed (always), removed (when deleting) -- */
  if (s.options.writeFiles !== false) {
    const current = new Set(Object.values(nextFolders).map((rel) => pathKey(rel, platform)));
    const stale = Object.entries(manifest.folders ?? {})
      .filter(([, rel]) => !current.has(pathKey(rel, platform)))
      .filter(([id]) => nodes.some((n) => n.id === id) || s.options.onRemoved === "DELETE")
      .sort((a, b) => depthOf(b[1]) - depthOf(a[1]));
    for (const [id, rel] of stale) {
      try {
        await rmdir(join(root, ...rel.split("/")));
        if (!nodes.some((n) => n.id === id)) out.deleted++;
      } catch {
        // Not empty (something of someone's is in it) or gone already: left as it is.
      }
    }
  }

  // A file left on disk that the folder wants again is tracked again.
  const tracked = new Set(Object.values(nextFiles).map((e) => pathKey(e.relPath, platform)));
  for (const rel of Object.keys(nextLeft)) if (tracked.has(pathKey(rel, platform))) delete nextLeft[rel];

  const record: Manifest = { version: MANIFEST_VERSION, mappingId, files: nextFiles, folders: nextFolders, left: nextLeft };
  await writeAtomically(join(root, MANIFEST_NAME), Buffer.from(JSON.stringify(record, null, 1), "utf8"));
  out.status = out.errors > 0 && out.written + out.unchanged === 0 ? "ERROR" : out.issues.length > 0 ? "PARTIAL" : "OK";
  if (out.status === "ERROR") out.error = out.issues[0]?.message ?? "Nothing could be written";
  return out;
}

async function readManifest(root: string, mappingId: string): Promise<Manifest> {
  try {
    const m = JSON.parse(await readFile(join(root, MANIFEST_NAME), "utf8")) as Partial<Manifest>;
    // Another mapping's manifest (a folder that was mapped before) is not this one's record.
    if (m.version === MANIFEST_VERSION && m.mappingId === mappingId && m.files) {
      // No `folders` yet: a record from before folders were kept (see the folder pass).
      return { version: m.version, mappingId, files: m.files, folders: m.folders, left: m.left ?? {} };
    }
  } catch {
    // none yet
  }
  return { version: MANIFEST_VERSION, mappingId, files: {}, folders: {}, left: {} };
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function look(path: string): Promise<DiskFile> {
  try {
    const st = await stat(path);
    return st.isFile() ? { exists: true, size: st.size, mtimeMs: st.mtimeMs } : { exists: false };
  } catch {
    return { exists: false };
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => h.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

/** Writes beside the target, then renames over it: a reader never sees half a file. */
async function writeAtomically(target: string, bytes: Uint8Array): Promise<{ size: number; mtimeMs: number }> {
  await mkdir(dirname(target), { recursive: true });
  const tmp = join(dirname(target), `.${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.sektar-tmp`);
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  const st = await stat(target);
  return { size: st.size, mtimeMs: st.mtimeMs };
}
