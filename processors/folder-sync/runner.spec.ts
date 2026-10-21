import { reducer, requestPull, requestSync, setLocalPath, setOptions, setTarget, utils, type FolderSyncDocument, type FolderSyncState } from "document-models/folder-sync/v1";
import type { Action } from "document-model";
import { reducer as fileReducer, utils as fileUtils, type FileDocument } from "document-models/file/v1";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decide, fileNameFor, keepBothName, MANIFEST_NAME, refHash, renditionName, safeName, type Manifest } from "./plan.js";
import { readAllowedRoots } from "./processor.js";
import { isAllowed, runSync, type RunnerDeps } from "./runner.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ref = (s: string) => `attachment://v1:${sha(s)}`;

type Node = { id: string; name: string; kind: string; parentFolder?: string | null; documentType?: string };

/** A drive with a mapped folder, Files with stored sources, and a mapping document that the dispatched actions run through. */
class World {
  nodes: Node[] = [];
  docs = new Map<string, unknown>();
  blobs = new Map<string, string>();
  mapping: FolderSyncDocument = utils.createDocument();
  dispatched: string[] = [];
  revision = 41;
  clock = Date.parse("2026-10-21T12:00:00.000Z");
  ids = 0;

  folder(id: string, name: string, parentFolder: string | null = null) {
    this.nodes.push({ id, name, kind: "folder", parentFolder });
  }
  file(id: string, name: string, parentFolder: string, content: string | null, extra: object = {}) {
    this.nodes.push({ id, name, kind: "file", parentFolder, documentType: "sektar/file" });
    if (content !== null) this.blobs.set(ref(content), content);
    this.docs.set(id, {
      header: {},
      state: { global: { source: content === null ? null : { kind: "ATTACHMENT", ref: ref(content), fileName: name, mimeType: "application/pdf", sizeBytes: content.length, setAt: "2026-10-01T00:00:00.000Z" }, renditions: [], ...extra } },
    });
  }
  setContent(id: string, content: string) {
    this.blobs.set(ref(content), content);
    const doc = this.docs.get(id) as { state: { global: { source: object } } };
    doc.state.global.source = { kind: "ATTACHMENT", ref: ref(content), fileName: "x", sizeBytes: content.length, setAt: "2026-10-02T00:00:00.000Z" };
  }
  map(state: (s: FolderSyncDocument) => FolderSyncDocument) {
    this.mapping = state(this.mapping);
  }
  get s(): FolderSyncState {
    return this.mapping.state.global;
  }
  deps(platform = "linux"): RunnerDeps {
    return {
      getDocument: (id) => {
        if (id === "drive") return Promise.resolve({ header: { revision: { global: this.revision } }, state: { global: { nodes: this.nodes } } });
        const doc = this.docs.get(id);
        if (!doc) return Promise.reject(new Error(`no document ${id}`));
        return Promise.resolve(doc as Awaited<ReturnType<RunnerDeps["getDocument"]>>);
      },
      download: (_documentId, r) => {
        const content = this.blobs.get(r);
        if (content === undefined) return Promise.reject(new Error(`no blob ${r}`));
        return Promise.resolve(Buffer.from(content, "utf8"));
      },
      dispatch: (id, list: Action[]) => {
        if (id !== "mapping-1") return this.dispatchToFile(id, list);
        for (const a of list) {
          this.dispatched.push(a.type);
          this.mapping = reducer(this.mapping, a);
          const error = this.mapping.operations.global.at(-1)?.error;
          if (error) return Promise.reject(new Error(`${a.type} failed: ${error}`));
        }
        return Promise.resolve();
      },
      createFile: (_driveId, parentFolder, name) => {
        const id = `new-${++this.ids}`;
        this.nodes.push({ id, name, kind: "file", parentFolder, documentType: "sektar/file" });
        this.docs.set(id, fileUtils.createDocument());
        this.created.push(id);
        return Promise.resolve(id);
      },
      createFolder: (_driveId, parentFolder, name) => {
        const id = `folder-${++this.ids}`;
        this.nodes.push({ id, name, kind: "folder", parentFolder });
        return Promise.resolve(id);
      },
      deleteNode: (_driveId, nodeId) => {
        this.nodes = this.nodes.filter((n) => n.id !== nodeId);
        this.docs.delete(nodeId);
        this.deleted.push(nodeId);
        return Promise.resolve();
      },
      stage: (bytes) => {
        const text = Buffer.from(bytes).toString("utf8");
        return Promise.resolve({
          ref: ref(text),
          upload: () => {
            this.blobs.set(ref(text), text);
            return Promise.resolve();
          },
        });
      },
      host: { name: "test-host", platform, reactorId: "switchboard@test" },
      now: () => new Date((this.clock += 1000)),
      newId: () => `id-${++this.ids}`,
    };
  }
  created: string[] = [];
  deleted: string[] = [];
  /** A File's actions, through the File reducer: a plain test File becomes a real document first. */
  dispatchToFile(id: string, list: Action[]): Promise<void> {
    const found = this.docs.get(id) as FileDocument | { state: { global: object } } | undefined;
    if (!found) return Promise.reject(new Error(`no File ${id}`));
    let doc: FileDocument =
      "operations" in found
        ? found
        : fileUtils.createDocument({ global: { title: null, description: null, tags: [], renditions: [], placeholder: null, ...found.state.global } } as never);
    for (const a of list) {
      this.dispatched.push(a.type);
      doc = fileReducer(doc, a);
      const error = doc.operations.global.at(-1)?.error;
      if (error) return Promise.reject(new Error(`${a.type} failed: ${error}`));
    }
    this.docs.set(id, doc);
    return Promise.resolve();
  }
  renditionsOf(id: string) {
    return this.fileState(id).renditions;
  }
  fileState(id: string) {
    return (this.docs.get(id) as FileDocument).state.global;
  }
  run(full = false, platform = "linux") {
    return runSync("mapping-1", this.s, this.deps(platform), { requestId: this.s.request?.id ?? null, full });
  }
}

let root: string;
let w: World;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "sektar-sync-"));
  w = new World();
  w.folder("q3", "2026-Q3");
  w.folder("ap", "accounts-payable", "q3");
  w.folder("aws", "aws", "ap");
  w.file("f1", "20260710-indigo-hotel.pdf", "q3", "hotel");
  w.file("f2", "EUINBE26-200560.pdf", "aws", "aws july");
  w.folder("other", "elsewhere");
  w.file("f3", "not-mapped.pdf", "other", "outside");
  w.map((d) =>
    [setTarget({ driveId: "drive", folderId: "q3", folderPath: "2026-Q3" }), setLocalPath({ localPath: root }), requestSync({ id: "r1", requestedAt: "2026-10-21T11:59:00.000Z" })].reduce(
      (doc, a) => reducer(doc, a),
      d,
    ),
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const read = (rel: string) => readFile(join(root, ...rel.split("/")), "utf8");
/** A person editing a file: later than the sync wrote it (a write in the same millisecond, at the same size, is indistinguishable by design). */
const editOnDisk = async (rel: string, content: string) => {
  const path = join(root, ...rel.split("/"));
  await writeFile(path, content);
  const later = new Date(Date.now() + 60_000);
  await utimes(path, later, later);
};
const manifest = async () => JSON.parse(await read(MANIFEST_NAME)) as Manifest;

describe("a folder sync run", () => {
  it("writes the mapped folder, keeps a manifest and reports the run on the mapping", async () => {
    const out = await w.run();
    expect(out).toMatchObject({ status: "OK", written: 2, unchanged: 0, errors: 0, bytesWritten: 13 });
    expect(await read("20260710-indigo-hotel.pdf")).toBe("hotel");
    expect(await read("accounts-payable/aws/EUINBE26-200560.pdf")).toBe("aws july");
    expect(existsSync(join(root, "not-mapped.pdf"))).toBe(false);
    expect(Object.keys((await manifest()).files).sort()).toEqual(["f1", "f2"]);
    expect(w.dispatched).toEqual(["START_RUN", "SET_ISSUES", "FINISH_RUN"]);
    expect(w.s.status).toBe("OK");
    expect(w.s.runs[0]).toMatchObject({ status: "OK", written: 2, requestId: "r1", driveRevision: 41 });
    expect(w.s.host).toEqual({ name: "test-host", platform: "linux", reactorId: "switchboard@test" });
    // No temp files are left behind.
    expect((await readdir(root)).filter((n) => n.endsWith(".sektar-tmp"))).toEqual([]);
  });

  it("leaves unchanged files alone, and follows a source that changed", async () => {
    await w.run();
    expect(await w.run()).toMatchObject({ written: 0, unchanged: 2 });
    expect(await w.run(true)).toMatchObject({ written: 0, unchanged: 2 });
    w.setContent("f1", "hotel, corrected");
    expect(await w.run()).toMatchObject({ written: 1, unchanged: 1 });
    expect(await read("20260710-indigo-hotel.pdf")).toBe("hotel, corrected");
  });

  it("recognises a file that is already there with the same content", async () => {
    await writeFile(join(root, "20260710-indigo-hotel.pdf"), "hotel");
    expect(await w.run()).toMatchObject({ written: 1, unchanged: 1, conflicts: 0 });
  });

  it("does not overwrite a file changed on disk, unless told to", async () => {
    await w.run();
    await editOnDisk("20260710-indigo-hotel.pdf", "my notes");
    let out = await w.run();
    expect(out).toMatchObject({ status: "PARTIAL", conflicts: 1, written: 0 });
    expect(w.s.issues).toHaveLength(1);
    expect(w.s.issues[0]).toMatchObject({ kind: "CONFLICT", relativePath: "20260710-indigo-hotel.pdf" });
    expect(await read("20260710-indigo-hotel.pdf")).toBe("my notes");
    // Still a conflict the next time: the manifest keeps what was written.
    expect(await w.run()).toMatchObject({ conflicts: 1 });

    w.map((d) => reducer(d, setOptions({ onConflict: "KEEP_BOTH" })));
    out = await w.run();
    expect(out).toMatchObject({ conflicts: 1, written: 1 });
    expect(await read("20260710-indigo-hotel.pdf")).toBe("hotel");
    expect(await read("20260710-indigo-hotel (changed on disk 2026-10-21).pdf")).toBe("my notes");

    await editOnDisk("20260710-indigo-hotel.pdf", "again");
    w.map((d) => reducer(d, setOptions({ onConflict: "OVERWRITE" })));
    expect(await w.run()).toMatchObject({ conflicts: 1, written: 1, status: "OK" });
    expect(await read("20260710-indigo-hotel.pdf")).toBe("hotel");
  });

  it("moves a file whose document moved, and keeps or deletes what left the folder", async () => {
    await w.run();
    w.nodes.find((n) => n.id === "f2")!.parentFolder = "q3";
    expect(await w.run()).toMatchObject({ written: 1, unchanged: 1 });
    expect(await read("EUINBE26-200560.pdf")).toBe("aws july");
    expect(existsSync(join(root, "accounts-payable", "aws", "EUINBE26-200560.pdf"))).toBe(false);

    w.nodes = w.nodes.filter((n) => n.id !== "f2");
    expect(await w.run()).toMatchObject({ deleted: 0 });
    expect(existsSync(join(root, "EUINBE26-200560.pdf"))).toBe(true);
    expect(Object.keys((await manifest()).files)).toEqual(["f1"]);

    // DELETE removes what the sync wrote, but not a file changed on disk.
    w.file("f4", "gone.pdf", "q3", "gone");
    w.file("f5", "edited.pdf", "q3", "edited");
    await w.run();
    await editOnDisk("edited.pdf", "my edit");
    w.nodes = w.nodes.filter((n) => n.id !== "f4" && n.id !== "f5");
    w.map((d) => reducer(d, setOptions({ onRemoved: "DELETE" })));
    const out = await w.run();
    expect(out).toMatchObject({ deleted: 1, conflicts: 1 });
    expect(existsSync(join(root, "gone.pdf"))).toBe(false);
    expect(await read("edited.pdf")).toBe("my edit");
  });

  it("reports what it cannot write and goes on with the rest", async () => {
    w.file("f6", "empty", "q3", null);
    w.nodes.push({ id: "inv", name: "2026010 Powerhouse", kind: "file", parentFolder: "q3", documentType: "sektar/invoice" });
    w.file("f7", "Indigo.PDF", "q3", "clash");
    w.file("f8", "linked", "q3", null, { source: { kind: "DOCUMENT", documentId: "inv" } });
    w.nodes.push({ id: "ghost", name: "ghost.pdf", kind: "file", parentFolder: "q3", documentType: "sektar/file" });
    w.map((d) => reducer(d, setOptions({ otherDocuments: "EXPORT_PHD" })));
    // "Indigo.PDF" and "indigo.pdf" are one file on Windows.
    w.file("f9", "indigo.pdf", "q3", "first");
    const out = await w.run(false, "win32");
    expect(out.status).toBe("PARTIAL");
    expect(out.errors).toBe(1);
    expect(w.s.issues.map((x) => x.kind).sort()).toEqual(["ERROR", "ERROR", "NAME_CLASH", "NO_SOURCE", "NO_SOURCE"]);
    expect(w.s.issues.find((x) => x.kind === "NO_SOURCE" && x.relativePath === "linked")?.message).toMatch(/another document/);
    expect(w.s.issues.find((x) => x.message.includes(".phd"))).toBeTruthy();
    expect(out.written).toBe(3);
  });

  it("writes renditions beside their source when asked", async () => {
    w.file("f10", "scan.pdf", "q3", "scan", {
      renditions: [
        { id: "r-ocr", type: "ocr", mimeType: "text/plain", text: "the text", createdAt: "2026-10-21T00:00:00.000Z" },
        { id: "r-pdf", label: "Preview", mimeType: "application/pdf", ref: ref("preview"), fileName: "preview.pdf", createdAt: "2026-10-21T00:00:00.000Z" },
        { id: "r-none", mimeType: "image/png", createdAt: "2026-10-21T00:00:00.000Z" },
      ],
    });
    w.blobs.set(ref("preview"), "preview");
    w.map((d) => reducer(d, setOptions({ content: "SOURCE_AND_RENDITIONS", includeSubfolders: false })));
    const out = await w.run();
    expect(out).toMatchObject({ written: 4, status: "OK" });
    expect(await read("scan.ocr.txt")).toBe("the text");
    expect(await read("scan.preview.pdf")).toBe("preview");
    expect(existsSync(join(root, "accounts-payable"))).toBe(false);
    expect(await w.run()).toMatchObject({ unchanged: 4, written: 0 });
  });

  it("fails the whole run when the drive cannot be read, and records it", async () => {
    w.map((d) => reducer(d, setTarget({ driveId: "missing" })));
    const out = await w.run();
    expect(out).toMatchObject({ status: "ERROR", written: 0 });
    expect(out.error).toMatch(/could not be read/);
    expect(w.s.status).toBe("ERROR");
    expect(w.s.runs[0]).toMatchObject({ status: "ERROR", driveRevision: null });
  });

  it("writes nothing outside the folders it may write to", async () => {
    const out = await runSync("mapping-1", w.s, w.deps(), { requestId: null, full: false, allowedRoots: [join(tmpdir(), "somewhere-else")] });
    expect(out.status).toBe("ERROR");
    expect(out.error).toMatch(/outside the folders/);
    expect(existsSync(join(root, "20260710-indigo-hotel.pdf"))).toBe(false);
    expect(await runSync("mapping-1", w.s, w.deps(), { requestId: null, full: false, allowedRoots: [tmpdir()] })).toMatchObject({ status: "OK", written: 2 });
  });

  it("starts afresh on a manifest another mapping wrote", async () => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, MANIFEST_NAME), JSON.stringify({ version: 1, mappingId: "someone-else", files: { f1: { relPath: "x", hash: "y", size: 1, mtimeMs: 1, writtenAt: "" } } }));
    await w.run();
    expect((await manifest()).mappingId).toBe("mapping-1");
  });
});

describe("changes found on disk", () => {
  const fromDisk = (mode: "PLACEHOLDERS" | "AUTO_PULL" | "AUTO_PULL_WITH_DELETES") => w.map((d) => reducer(d, setOptions({ fromDisk: mode })));
  const pull = (id: string, nodeIds?: string[]) => w.map((d) => reducer(d, requestPull({ id, requestedAt: "2026-10-21T12:30:00.000Z", nodeIds })));
  const nodeAt = (name: string) => w.nodes.find((n) => n.name === name);
  /** Edits, a deletion and new files, as a person makes them in the synced folder. */
  async function changeDisk() {
    await editOnDisk("20260710-indigo-hotel.pdf", "hotel, annotated");
    await rm(join(root, "accounts-payable", "aws", "EUINBE26-200560.pdf"));
    await mkdir(join(root, "receipts"), { recursive: true });
    await editOnDisk("receipts/20260930-lunch.pdf", "lunch");
    await editOnDisk("2026010.phd", "a document");
    await editOnDisk("desktop.ini", "ignored");
  }

  it("become placeholders, and are left alone on disk until pulled", async () => {
    await w.run();
    fromDisk("PLACEHOLDERS");
    await changeDisk();
    const out = await w.run();
    expect(out).toMatchObject({ status: "OK", placeholders: 4, pulled: 0, written: 0, conflicts: 0 });
    expect(w.fileState("f1").placeholder).toMatchObject({ change: "UPDATE", target: "FILE", hash: sha("hotel, annotated"), relativePath: "20260710-indigo-hotel.pdf", mappingId: "mapping-1" });
    expect(w.fileState("f1").source?.ref).toBe(ref("hotel"));
    expect(w.fileState("f2").placeholder).toMatchObject({ change: "DELETE", hash: null });
    // New on disk: placeholder Files, in a drive folder made for them.
    const lunch = nodeAt("20260930-lunch.pdf");
    expect(w.nodes.find((n) => n.id === lunch?.parentFolder)).toMatchObject({ kind: "folder", name: "receipts", parentFolder: "q3" });
    expect(w.fileState(lunch!.id).source).toMatchObject({ kind: "FILE_PLACEHOLDER", fileName: "20260930-lunch.pdf", mimeType: "application/pdf" });
    expect(w.fileState(nodeAt("2026010.phd")!.id).source?.kind).toBe("DOCUMENT_PLACEHOLDER");
    expect(nodeAt("desktop.ini")).toBeUndefined();
    // The edit stays, the deletion stays deleted.
    expect(await read("20260710-indigo-hotel.pdf")).toBe("hotel, annotated");
    expect(existsSync(join(root, "accounts-payable", "aws", "EUINBE26-200560.pdf"))).toBe(false);
    expect(w.s.runs[0]).toMatchObject({ placeholders: 4, pulled: 0 });

    // Seen again: nothing new to record.
    const before = w.dispatched.length;
    expect(await w.run()).toMatchObject({ placeholders: 4, written: 0 });
    expect(w.dispatched.slice(before).filter((t) => t === "SET_PLACEHOLDER")).toEqual([]);

    // The edit undone on disk: its placeholder goes.
    await editOnDisk("20260710-indigo-hotel.pdf", "hotel");
    expect(await w.run()).toMatchObject({ placeholders: 3 });
    expect(w.fileState("f1").placeholder).toBeNull();
    // A new file gone from disk again: its placeholder File goes too.
    await rm(join(root, "2026010.phd"));
    await w.run();
    expect(nodeAt("2026010.phd")).toBeUndefined();
  });

  it("are pulled when asked for: one File, or all of them", async () => {
    await w.run();
    fromDisk("PLACEHOLDERS");
    await changeDisk();
    await w.run();
    pull("p1", ["f1"]);
    let out = await w.run();
    expect(out).toMatchObject({ pulled: 1, placeholders: 3 });
    expect(w.fileState("f1").source).toMatchObject({ kind: "ATTACHMENT", ref: ref("hotel, annotated"), fileName: "20260710-indigo-hotel.pdf" });
    expect(w.fileState("f1").renditions).toEqual([expect.objectContaining({ type: "previous-version", ref: ref("hotel") })]);
    expect(w.fileState("f1").placeholder).toBeNull();
    expect(w.s.pulls).toEqual([]);
    expect(w.s.status).toBe("OK");
    // Pulled: from now on the drive and the disk agree.
    expect(await w.run()).toMatchObject({ written: 0, unchanged: 1, pulled: 0 });

    pull("p2");
    out = await w.run();
    expect(out).toMatchObject({ pulled: 2, placeholders: 1, errors: 0 });
    expect(out.issues.map((x) => x.message)).toEqual([expect.stringMatching(/\.phd\) is not available yet/)]);
    const lunch = nodeAt("20260930-lunch.pdf")!;
    expect(w.fileState(lunch.id).source).toMatchObject({ kind: "ATTACHMENT", ref: ref("lunch") });
    expect(w.renditionsOf(lunch.id)).toEqual([]);
    expect(nodeAt("EUINBE26-200560.pdf")).toBeUndefined();
    expect(w.deleted).toEqual(["f2"]);
    const m = await manifest();
    expect(m.files.f2).toBeUndefined();
    expect(m.files[lunch.id]).toMatchObject({ relPath: "receipts/20260930-lunch.pdf", hash: sha("lunch") });
    expect(await w.run()).toMatchObject({ written: 0, pulled: 0, placeholders: 1, unchanged: 2 });
  });

  it("are pulled straight away when the mapping auto-pulls, deletions only when asked to", async () => {
    await w.run();
    fromDisk("AUTO_PULL");
    await changeDisk();
    let out = await w.run();
    expect(out).toMatchObject({ pulled: 2, placeholders: 2 });
    expect(w.fileState("f1").source?.ref).toBe(ref("hotel, annotated"));
    expect(w.fileState("f2").placeholder?.change).toBe("DELETE");

    fromDisk("AUTO_PULL_WITH_DELETES");
    out = await w.run();
    expect(out).toMatchObject({ pulled: 1, placeholders: 1 });
    expect(w.deleted).toEqual(["f2"]);
  });

  it("are not taken when the setting is off: an edit is a conflict, a deletion is written again", async () => {
    await w.run();
    await changeDisk();
    const out = await w.run();
    expect(out).toMatchObject({ placeholders: 0, pulled: 0, conflicts: 1, written: 1 });
    expect(w.created).toEqual([]);
    expect(await read("accounts-payable/aws/EUINBE26-200560.pdf")).toBe("aws july");
  });
});

describe("where a Switchboard may write", () => {
  it("allows a root and what is below it, nothing beside it", () => {
    expect(isAllowed("/data/ksdc/2026-Q3", null, "linux")).toBe(true);
    expect(isAllowed("/data/ksdc/2026-Q3", ["/data/ksdc"], "linux")).toBe(true);
    expect(isAllowed("/data/ksdc", ["/data/ksdc/"], "linux")).toBe(true);
    expect(isAllowed("/data/ksdc-other", ["/data/ksdc"], "linux")).toBe(false);
    expect(isAllowed("/data/ksdc/../etc", ["/data/ksdc"], "linux")).toBe(false);
    expect(isAllowed("/Data/KSDC/x", ["/data/ksdc"], "linux")).toBe(false);
    expect(isAllowed("D:\\Dropbox\\KSDC\\2026-Q3", ["d:\\dropbox\\ksdc"], "win32")).toBe(process.platform === "win32");
    expect(isAllowed("/data/x", [], "linux")).toBe(false);
  });

  it("reads the list from a file, and allows everything without one", async () => {
    const file = join(root, "roots.txt");
    expect(await readAllowedRoots(file)).toBeNull();
    await writeFile(file, "# where syncs may write\r\nD:\\Dropbox\\KSDC\n\n  /data/ksdc  \n");
    expect(await readAllowedRoots(file)).toEqual(["D:\\Dropbox\\KSDC", "/data/ksdc"]);
  });
});

describe("the plan", () => {
  it("reads a ref's hash, and nothing else", () => {
    expect(refHash(ref("a"))).toBe(sha("a"));
    expect(refHash("attachment://v1:xyz")).toBeNull();
    expect(refHash(null)).toBeNull();
  });

  it("makes names every file system accepts", () => {
    expect(safeName('a:b/c\\d*e?"f<g>h|i')).toBe("a_b_c_d_e__f_g_h_i");
    expect(safeName("report. ")).toBe("report");
    expect(safeName("CON")).toBe("_CON");
    expect(safeName("nul.txt")).toBe("_nul.txt");
    expect(safeName("...")).toBe("_");
  });

  it("names files after their node, with the source's extension when missing", () => {
    expect(fileNameFor("Invoice 12", "invoice-12.pdf")).toBe("Invoice 12.pdf");
    expect(fileNameFor("a.pdf", "b.png")).toBe("a.pdf");
    expect(fileNameFor("notes", null)).toBe("notes");
    expect(renditionName("scan.pdf", { id: "X1", mimeType: "image/webp" })).toBe("scan.x1.webp");
    expect(renditionName("scan", { id: "x", type: "OCR text", mimeType: "application/octet-stream" })).toBe("scan.ocr-text");
    expect(renditionName("scan.pdf", { id: "x", label: "***", mimeType: "text/html; charset=utf-8" })).toBe("scan.rendition.html");
  });

  it("keeps both versions under a dated name in the same folder", () => {
    expect(keepBothName("a/b/report.pdf", new Date("2026-10-21T08:00:00Z"))).toBe("a/b/report (changed on disk 2026-10-21).pdf");
    expect(keepBothName("README", new Date("2026-10-21T08:00:00Z"))).toBe("README (changed on disk 2026-10-21)");
  });

  it("decides on what is on disk", () => {
    const want = { key: "k", nodeId: "n", documentId: "n", relPath: "a.pdf", hash: "h2", source: { ref: "r" }, size: 1 };
    const entry = { relPath: "a.pdf", hash: "h1", size: 1, mtimeMs: 1, writtenAt: "" };
    expect(decide(want, entry, { exists: false }, "SKIP")).toEqual({ kind: "write" });
    expect(decide(want, entry, { exists: true, hash: "h2" }, "SKIP")).toEqual({ kind: "unchanged" });
    expect(decide(want, entry, { exists: true, hash: "h1" }, "SKIP")).toEqual({ kind: "write" });
    expect(decide(want, entry, { exists: true, hash: "h9" }, "SKIP")).toEqual({ kind: "conflict", resolution: "skip" });
    expect(decide(want, undefined, { exists: true, hash: "h9" }, "OVERWRITE")).toEqual({ kind: "conflict", resolution: "overwrite" });
    expect(decide(want, { ...entry, relPath: "b.pdf" }, { exists: true, hash: "h1" }, "KEEP_BOTH")).toEqual({ kind: "conflict", resolution: "keep-both" });
  });
});
