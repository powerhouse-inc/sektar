import {
  applyDiskVersion,
  clearPlaceholder,
  reducer,
  setAttachmentSource,
  setDocumentSource,
  setPlaceholder,
  utils,
  type FileDocument,
} from "document-models/file/v1";
import { describe, expect, it } from "vitest";

const FOUND = "2026-10-21T14:00:00.000Z";
const PULLED = "2026-10-21T14:05:00.000Z";
const V1 = "attachment://v1:1111111111111111111111111111111111111111111111111111111111111111" as const;
const V2 = "attachment://v1:2222222222222222222222222222222222222222222222222222222222222222" as const;
const MAPPING = "YOHOInG53Stm8PjqvCxLNzg4F3vs4xt3e8AC1T0wzc8";

type Action = Parameters<typeof reducer>[1];
const apply = (doc: FileDocument, ...actions: Action[]) => actions.reduce((d, a) => reducer(d, a), doc);
const lastError = (doc: FileDocument) => doc.operations.global.at(-1)?.error;
/** Applies one action that must fail, and checks the state did not move. */
function rejects(doc: FileDocument, action: Action, message: RegExp) {
  const before = JSON.stringify(doc.state.global);
  const next = reducer(doc, action);
  expect(lastError(next)).toMatch(message);
  expect(JSON.stringify(next.state.global)).toBe(before);
  return next;
}

const found = (change: "CREATE" | "UPDATE" | "DELETE", target: "FILE" | "DOCUMENT" = "FILE", extra: Partial<Parameters<typeof setPlaceholder>[0]> = {}) =>
  setPlaceholder({
    change,
    target,
    mappingId: MAPPING,
    relativePath: " receipts/20260915-scan.pdf ",
    fileName: " 20260915-scan.pdf ",
    mimeType: change === "DELETE" ? null : " application/pdf ",
    sizeBytes: change === "DELETE" ? null : 4096,
    hash: change === "DELETE" ? null : "2222222222222222222222222222222222222222222222222222222222222222",
    modifiedAt: change === "DELETE" ? null : "2026-10-21T13:59:00.000Z",
    foundAt: FOUND,
    ...extra,
  });

describe("a file that comes from disk", () => {
  it("is created as a placeholder, then pulled", () => {
    let doc = apply(utils.createDocument(), found("CREATE"));
    expect(doc.state.global.source).toEqual({
      kind: "FILE_PLACEHOLDER",
      ref: null,
      fileName: "20260915-scan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      documentId: null,
      documentType: null,
      documentName: null,
      setAt: FOUND,
    });
    expect(doc.state.global.title).toBe("20260915-scan.pdf");
    expect(doc.state.global.placeholder).toMatchObject({ change: "CREATE", target: "FILE", relativePath: "receipts/20260915-scan.pdf", mappingId: MAPPING });

    // Seen again before it was pulled: the placeholder is refreshed.
    doc = apply(doc, found("CREATE", "FILE", { sizeBytes: 5000 }));
    expect(doc.state.global.source?.sizeBytes).toBe(5000);

    doc = apply(doc, applyDiskVersion({ ref: V2, fileName: "20260915-scan.pdf", mimeType: "application/pdf", sizeBytes: 5000, setAt: PULLED, previousId: "prev-1" }));
    expect(doc.state.global.source).toMatchObject({ kind: "ATTACHMENT", ref: V2, setAt: PULLED });
    // Nothing was there before, so nothing is kept as a previous version.
    expect(doc.state.global.renditions).toEqual([]);
    expect(doc.state.global.placeholder).toBeNull();
  });

  it("keeps the replaced content as the previous version when an update is pulled", () => {
    let doc = apply(
      utils.createDocument(),
      setAttachmentSource({ ref: V1, fileName: "scan.pdf", mimeType: "application/pdf", sizeBytes: 3000, setAt: "2026-09-15T08:00:00.000Z" }),
      found("UPDATE"),
    );
    // The source stays until the update is pulled.
    expect(doc.state.global.source?.ref).toBe(V1);
    doc = rejects(doc, applyDiskVersion({ ref: V2, fileName: "  ", setAt: PULLED, previousId: "prev-1" }), /file name is empty/);
    doc = apply(doc, applyDiskVersion({ ref: V2, fileName: "scan.pdf", setAt: PULLED, previousId: "prev-1" }));
    expect(doc.state.global.source).toMatchObject({ kind: "ATTACHMENT", ref: V2, mimeType: null, sizeBytes: null });
    expect(doc.state.global.renditions).toEqual([
      {
        id: "prev-1",
        mimeType: "application/pdf",
        type: "previous-version",
        label: "Version of 2026-09-15",
        ref: V1,
        fileName: "scan.pdf",
        sizeBytes: 3000,
        text: null,
        createdAt: PULLED,
      },
    ]);

    // A second update keeps the version before it too, under its own id.
    doc = apply(doc, found("UPDATE"));
    doc = rejects(doc, applyDiskVersion({ ref: V1, fileName: "scan.pdf", setAt: PULLED, previousId: "prev-1" }), /exists already/);
    doc = apply(doc, applyDiskVersion({ ref: V1, fileName: "scan.pdf", setAt: PULLED, previousId: "prev-2" }));
    expect(doc.state.global.renditions.map((r) => [r.id, r.ref, r.mimeType])).toEqual([
      ["prev-1", V1, "application/pdf"],
      ["prev-2", V2, "application/octet-stream"],
    ]);
  });

  it("records a deletion on disk, which is not a version to pull", () => {
    let doc = apply(utils.createDocument(), setAttachmentSource({ ref: V1, fileName: "scan.pdf", setAt: FOUND }), found("DELETE"));
    expect(doc.state.global.placeholder).toMatchObject({ change: "DELETE", hash: null, mimeType: null, sizeBytes: null, modifiedAt: null });
    doc = rejects(doc, applyDiskVersion({ ref: V2, fileName: "scan.pdf", setAt: PULLED, previousId: "p" }), /no file created or updated/);
    doc = apply(doc, clearPlaceholder({}));
    expect(doc.state.global.placeholder).toBeNull();
    expect(doc.state.global.source?.ref).toBe(V1);
    doc = rejects(doc, applyDiskVersion({ ref: V2, fileName: "scan.pdf", setAt: PULLED, previousId: "p" }), /no file created or updated/);
  });

  it("stands for a document found on disk until it is imported", () => {
    let doc = apply(
      utils.createDocument(),
      found("CREATE", "DOCUMENT", { fileName: "2026010.phd", relativePath: "2026010.phd", mimeType: null, documentId: "inv-2026010", documentType: "sektar/invoice", documentName: "2026010" }),
    );
    expect(doc.state.global.source).toMatchObject({ kind: "DOCUMENT_PLACEHOLDER", documentId: "inv-2026010", documentType: "sektar/invoice", documentName: "2026010", mimeType: null });
    doc = rejects(doc, applyDiskVersion({ ref: V2, fileName: "2026010.phd", setAt: PULLED, previousId: "p" }), /no file created or updated/);
    doc = rejects(doc, found("UPDATE", "DOCUMENT"), /Only a File with a source/);
    // Imported: the File points at the document, and the placeholder is resolved.
    doc = apply(doc, setDocumentSource({ documentId: "inv-2026010", documentType: "sektar/invoice", setAt: PULLED }), clearPlaceholder({}));
    expect(doc.state.global.source?.kind).toBe("DOCUMENT");
    // Newer on disk later: an update to the document.
    doc = apply(doc, found("UPDATE", "DOCUMENT", { documentId: "inv-2026010" }));
    expect(doc.state.global.placeholder).toMatchObject({ change: "UPDATE", target: "DOCUMENT", documentId: "inv-2026010" });
  });

  it("refuses placeholders that do not fit the File", () => {
    const blank = utils.createDocument();
    rejects(blank, found("CREATE", "FILE", { relativePath: "  " }), /path and the file name/);
    rejects(blank, found("CREATE", "FILE", { fileName: "" }), /path and the file name/);
    rejects(blank, found("UPDATE"), /Only a File with a source/);
    rejects(blank, found("DELETE"), /Only a File with a source/);
    const stored = apply(blank, setAttachmentSource({ ref: V1, fileName: "a.pdf", setAt: FOUND }));
    rejects(stored, found("CREATE"), /updated or deleted from disk, not created/);
    // A titled File keeps its title.
    const titled = apply(blank, found("CREATE"));
    const kept = apply({ ...titled, state: { ...titled.state, global: { ...titled.state.global, title: "Scan" } } }, applyDiskVersion({ ref: V2, fileName: "x.pdf", setAt: PULLED, previousId: "p" }));
    expect(kept.state.global.title).toBe("Scan");
    // An untitled File takes the pulled file's name.
    const pending = apply(stored, found("UPDATE"));
    const untitled = apply({ ...pending, state: { ...pending.state, global: { ...pending.state.global, title: null } } }, applyDiskVersion({ ref: V2, fileName: "b.pdf", setAt: PULLED, previousId: "p" }));
    expect(untitled.state.global.title).toBe("b.pdf");
  });
});
