import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  utils as folderSyncUtils,
  type FolderSyncState,
} from "document-models/folder-sync";
import { expect, it } from "vitest";
import { fileDocRow } from "../processors/files-index/rows.js";
import { runSync, type RunnerDeps } from "../processors/folder-sync/runner.js";
import {
  applyAction,
  emptyRow,
  rowFromState,
} from "../processors/email-index/rows.js";
import { publicationRowId, PUBLICATION_MIME } from "./publication.js";

it("keeps conversion metadata out of Files and generations out of folder export", async () => {
  const root = await mkdtemp(join(tmpdir(), "sektar-publication-"));
  const bytes = new Map<string, Uint8Array>();
  const stored = (text: string) => {
    const data = new TextEncoder().encode(text);
    const ref = `attachment://v1:${createHash("sha256").update(data).digest("hex")}`;
    bytes.set(ref, data);
    return ref;
  };
  const sourceRef = stored("Original PDF bytes");
  const outputRef = stored("# Recovered document\n");
  const manifestRef = stored('{"kind":"sektar-pdf-publication"}');
  const state = {
    title: "Invoice",
    source: {
      kind: "ATTACHMENT",
      ref: sourceRef,
      fileName: "invoice.pdf",
      mimeType: "application/pdf",
    },
    renditions: [
      {
        id: "manual",
        mimeType: "text/plain",
        type: "notes",
        fileName: "notes.txt",
        text: "Manual notes",
      },
      {
        id: publicationRowId("first", "markdown"),
        mimeType: "text/markdown",
        type: "markdown",
        label: "Extracted text",
        fileName: "invoice.first.md",
        ref: outputRef,
      },
      {
        id: publicationRowId("first", "manifest"),
        mimeType: PUBLICATION_MIME,
        type: "conversion-manifest",
        label: "Internal metadata",
        fileName: "invoice.first.json",
        ref: manifestRef,
      },
    ],
  };
  const downloads: string[] = [];
  const unexpected = (): Promise<never> =>
    Promise.reject(new Error("Disk imports are disabled in this scenario"));
  const deps: RunnerDeps = {
    getDocument: (id) =>
      Promise.resolve({
        header: {
          documentType:
            id === "files" ? "powerhouse/reactor-drive" : "sektar/file",
          revision: { document: 1, global: 1 },
        },
        state: { global: id === "files" ? {} : state },
      }),
    listNodes: () =>
      Promise.resolve([
        {
          id: "file",
          kind: "file",
          name: "invoice.pdf",
          parentFolder: null,
          documentType: "sektar/file",
        },
      ]),
    download: (_documentId, ref) => {
      downloads.push(ref);
      const data = bytes.get(ref);
      if (!data) return Promise.reject(new Error("Missing stored bytes"));
      return Promise.resolve(data);
    },
    dispatch: async () => {},
    createFile: unexpected,
    createFolder: unexpected,
    deleteNode: unexpected,
    stage: unexpected,
    host: {
      name: "test",
      platform: process.platform,
      reactorId: "test-reactor",
    },
    now: () => new Date("2026-11-10T12:00:00.000Z"),
    newId: randomUUID,
  };
  const defaults = folderSyncUtils.createDocument().state.global;
  const mapping: FolderSyncState = {
    ...defaults,
    driveId: "files",
    localPath: root,
    options: { ...defaults.options, content: "SOURCE_AND_RENDITIONS" },
  };
  try {
    const row = fileDocRow("file", state, deps.now().toISOString());
    expect(row.rendition_count).toBe(2);
    expect(row.search_text).not.toContain("internal metadata");
    const run = await runSync("mapping", mapping, deps, {
      requestId: null,
      full: true,
    });
    expect(run).toMatchObject({ status: "OK", written: 2, errors: 0 });
    expect(downloads).toEqual([sourceRef]);
    expect(await readFile(join(root, "invoice.notes.txt"), "utf8")).toBe(
      "Manual notes",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("keeps received Markdown and JSON in Mail counts while excluding generated rows", () => {
  const at = "2026-11-11T12:00:00.000Z";
  const received = [
    { id: "pdf", ref: "attachment://v1:pdf", fileName: "invoice.pdf" },
    { id: "received-md", ref: "attachment://v1:md", fileName: "README.md" },
    { id: "received-json", ref: "attachment://v1:json", fileName: "data.json" },
  ];
  const generated = [
    {
      id: publicationRowId("first", "markdown"),
      ref: "attachment://v1:derived-md",
      fileName: "derived.md",
    },
    {
      id: publicationRowId("first", "manifest"),
      ref: "attachment://v1:metadata",
      fileName: "metadata.json",
    },
  ];
  const attachments = [...received, ...generated];
  const full = rowFromState("email", { attachments }, at);
  let incremental = emptyRow("email", at);
  for (const input of attachments)
    incremental = applyAction(incremental, "ADD_ATTACHMENT", input, at);
  for (const row of [full, incremental]) {
    expect(row.attachment_count).toBe(3);
    expect(row.search_text).toContain("readme.md");
    expect(row.search_text).toContain("data.json");
    expect(row.search_text).not.toContain("derived.md");
    expect(row.search_text).not.toContain("metadata.json");
  }
  expect(incremental.attachments).toBe(full.attachments);
});
