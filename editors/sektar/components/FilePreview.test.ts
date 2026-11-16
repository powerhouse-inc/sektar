import {
  actions as fileActions,
  reducer as fileReducer,
  utils as fileUtils,
  type FileDocument,
} from "document-models/file";
import { describe, expect, it, vi } from "vitest";
import { listConversionRenditions } from "../../../conversions/model-adapter.js";
import { inspectPublications } from "../../../conversions/read-publications.js";
import {
  converted,
  pdfFile,
  ref,
  renditionView,
  storedConversionBytes,
} from "../kit/conversion-fixtures.js";
import { hasStoredPdf } from "../kit/files.js";
import { publicationRowId } from "../../../conversions/publication.js";
import { versionWhen } from "../kit/conversion-model.js";
import { listedRenditions, renditionOptions } from "./FilePreview.js";

// The preview's components reach the app through these; the helpers under
// test do not.
vi.mock("@powerhousedao/reactor-browser", () => ({}));

/** What a view lists for a File: its finished conversions, as the hook hands them on. */
const finished = async (doc: FileDocument) =>
  listConversionRenditions(
    doc,
    {
      kind: "file",
      documentId: doc.header.id,
    },
    await inspectPublications({
      document: doc,
      read: ({ ref }) => {
        const bytes = storedConversionBytes.get(ref);
        if (!bytes) throw new Error("Missing fixture bytes");
        return Promise.resolve(bytes);
      },
    }),
  );

const withManual = (doc: FileDocument) =>
  fileReducer(
    doc,
    fileActions.addRendition({
      id: "manual-1",
      mimeType: "text/plain",
      type: "text",
      label: "Typed notes",
      text: "Paid on the 12th.",
      createdAt: "2026-11-10T09:00:00.000Z",
    }),
  );

describe("the renditions a File lists and lets a person pick", () => {
  it("keep what a person added and complete conversions, never an incomplete pair", async () => {
    const first = converted(withManual(pdfFile()), true);
    const again = converted(first, false, {
      jobId: "job-2",
      renditionId: "rendition-2",
      markdown: {
        id: "artifact-md-2",
        role: "markdown",
        ref: ref("e5"),
        fileName: "invoice.md",
        mimeType: "text/markdown",
        sizeBytes: 900,
      },
    });
    expect(
      listedRenditions(again, await finished(again)).map((r) => r.id),
    ).toEqual(["manual-1", "sektar-pdf:v1:job-1:markdown"]);
  });
});

describe("how a picker names the Markdown a conversion made", () => {
  it("names the latest and the earlier versions apart, with their time, after what was added by hand", () => {
    const first = converted(withManual(pdfFile()), true);
    const doc = converted(first, true, {
      jobId: "job-2",
      createdAt: "2026-11-10T10:00:00.000Z",
      markdown: {
        id: "artifact-md-2",
        role: "markdown",
        ref: ref("e5"),
        fileName: "invoice.md",
        mimeType: "text/markdown",
        sizeBytes: 900,
      },
    });
    const earlier = renditionView({ completeness: "partial", current: false });
    const latest = renditionView({
      id: publicationRowId("job-2", "markdown"),
      jobId: "job-2",
      createdAt: "2026-11-10T10:00:00.000Z",
    });
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    const options = renditionOptions(
      listedRenditions(doc, [earlier, latest]),
      { renditions: [earlier, latest], renditionsPending: false },
      now,
    );
    expect(options.map(({ name, meta }) => ({ name, meta }))).toEqual([
      { name: "Typed notes", meta: "text/plain" },
      { name: "Latest Markdown", meta: versionWhen(latest.createdAt, now) },
      {
        name: "Earlier Markdown",
        meta: `partial, ${versionWhen(earlier.createdAt, now)}`,
      },
    ]);
    const stale = { ...latest, stale: true, current: false };
    expect(
      renditionOptions(
        listedRenditions(doc, [stale]),
        { renditions: [stale], renditionsPending: false },
        now,
      ).at(-1)?.meta,
    ).toBe(`previous PDF, ${versionWhen(stale.createdAt, now)}`);
  });
});

describe("a File that can be converted", () => {
  it("has a stored PDF as its source", () => {
    expect(hasStoredPdf(pdfFile())).toBe(true);
    expect(hasStoredPdf(fileUtils.createDocument())).toBe(false);
    const text = fileReducer(
      fileUtils.createDocument(),
      fileActions.setAttachmentSource({
        ref: ref("f6"),
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 12,
        setAt: "2026-11-10T12:00:00.000Z",
      }),
    );
    expect(hasStoredPdf(text)).toBe(false);
  });
});
