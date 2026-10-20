import {
  addRendition,
  addTag,
  clearSource,
  reducer,
  removeRendition,
  removeTag,
  setAttachmentSource,
  setDescription,
  setDocumentSource,
  setTitle,
  updateRendition,
  updateTag,
  utils,
  type FileDocument,
} from "document-models/file/v1";
import { describe, expect, it } from "vitest";

const AT = "2026-10-20T12:00:00.000Z";
const PDF = "attachment://v1:5311d387c1e9d56010dd23e5d04dbadb8d69b95e0a5996cbd4bffb14d0fc494f" as const;
const PNG = "attachment://v1:0663769596ac8296eac18e061a5c5c90800022de3919cd10080214d2753c4f17" as const;

const lastError = (doc: FileDocument) => doc.operations.global.at(-1)?.error;
const apply = (doc: FileDocument, ...actions: Parameters<typeof reducer>[1][]) =>
  actions.reduce((d, a) => reducer(d, a), doc);

describe("a file's life", () => {
  it("files a PDF, extracts its text, renders a preview, tags it, then points at the invoice it came from", () => {
    let doc = utils.createDocument();
    expect(doc.state.global).toEqual({
      title: null,
      description: null,
      source: null,
      renditions: [],
      tags: [],
    });

    // A stored file becomes the source; an untitled file takes its name.
    doc = apply(
      doc,
      setAttachmentSource({
        ref: PDF,
        fileName: "  invoice-2026-042.pdf ",
        mimeType: " application/pdf ",
        sizeBytes: 84212,
        setAt: AT,
      }),
    );
    expect(doc.state.global.source).toEqual({
      kind: "ATTACHMENT",
      ref: PDF,
      fileName: "invoice-2026-042.pdf",
      mimeType: "application/pdf",
      sizeBytes: 84212,
      documentId: null,
      documentType: null,
      documentName: null,
      setAt: AT,
    });
    expect(doc.state.global.title).toBe("invoice-2026-042.pdf");

    // A title and description of our own; empty clears them.
    doc = apply(
      doc,
      setTitle({ title: "  Acme invoice April " }),
      setDescription({ description: " Paid on the 3rd. " }),
    );
    expect(doc.state.global.title).toBe("Acme invoice April");
    expect(doc.state.global.description).toBe("Paid on the 3rd.");

    // Renditions: inline text, a stored image, any MIME type.
    doc = apply(
      doc,
      addRendition({
        id: "r-text",
        mimeType: "Text/Plain; charset=utf-8",
        type: " ocr ",
        label: " Extracted text ",
        text: "Invoice 2026-042\nAcme Ltd",
        createdAt: AT,
      }),
      addRendition({
        id: "r-png",
        mimeType: "image/png",
        type: "preview",
        ref: PNG,
        fileName: " page-1.png ",
        sizeBytes: 2048,
        createdAt: AT,
      }),
      // empty text is still inline content
      addRendition({ id: "r-empty", mimeType: "text/html", text: "", createdAt: AT }),
    );
    expect(doc.state.global.renditions).toEqual([
      {
        id: "r-text",
        mimeType: "text/plain; charset=utf-8",
        type: "ocr",
        label: "Extracted text",
        ref: null,
        fileName: null,
        sizeBytes: null,
        text: "Invoice 2026-042\nAcme Ltd",
        createdAt: AT,
      },
      {
        id: "r-png",
        mimeType: "image/png",
        type: "preview",
        label: null,
        ref: PNG,
        fileName: "page-1.png",
        sizeBytes: 2048,
        text: null,
        createdAt: AT,
      },
      {
        id: "r-empty",
        mimeType: "text/html",
        type: null,
        label: null,
        ref: null,
        fileName: null,
        sizeBytes: null,
        text: "",
        createdAt: AT,
      },
    ]);

    // Update: kept when omitted, cleared when empty, MIME normalised.
    doc = apply(
      doc,
      updateRendition({ id: "r-png", label: "First page" }),
      updateRendition({ id: "r-png", type: "", mimeType: " IMAGE/WEBP " }),
      updateRendition({ id: "r-text", type: null, label: null }),
      removeRendition({ id: "r-empty" }),
    );
    expect(doc.state.global.renditions.map((r) => [r.id, r.type, r.label, r.mimeType])).toEqual([
      ["r-text", null, null, "text/plain; charset=utf-8"],
      ["r-png", null, "First page", "image/webp"],
    ]);

    // Tags: label + colour, unique by label ignoring case.
    doc = apply(
      doc,
      addTag({ id: "t1", label: " Finance ", color: "forest" }),
      addTag({ id: "t2", label: "Q2", color: "  " }),
      updateTag({ id: "t2", label: "Q2 2026", color: "mint" }),
      updateTag({ id: "t1", color: null }),
      updateTag({ id: "t1", label: "finance" }),
      addTag({ id: "t3", label: "draft", color: "amber" }),
      removeTag({ id: "t3" }),
    );
    expect(doc.state.global.tags).toEqual([
      { id: "t1", label: "finance", color: "forest" },
      { id: "t2", label: "Q2 2026", color: "mint" },
    ]);

    // The invoice document becomes the source; a titled file keeps its title.
    doc = apply(
      doc,
      setDocumentSource({
        documentId: "inv-42",
        documentType: " sektar/invoice ",
        documentName: " Invoice 2026-042 ",
        setAt: AT,
      }),
    );
    expect(doc.state.global.source).toEqual({
      kind: "DOCUMENT",
      ref: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      documentId: "inv-42",
      documentType: "sektar/invoice",
      documentName: "Invoice 2026-042",
      setAt: AT,
    });
    expect(doc.state.global.title).toBe("Acme invoice April");

    // Clearing the source keeps renditions and tags; empty title clears it.
    doc = apply(doc, clearSource({}), setTitle({ title: "  " }), setDescription({ description: null }));
    expect(doc.state.global.source).toBeNull();
    expect(doc.state.global.title).toBeNull();
    expect(doc.state.global.description).toBeNull();
    expect(doc.state.global.renditions).toHaveLength(2);
    expect(doc.state.global.tags).toHaveLength(2);

    // A document source on an untitled file names it; without a name it stays untitled.
    doc = apply(
      doc,
      setDocumentSource({ documentId: "c-1", documentType: "sektar/contact", setAt: AT }),
    );
    expect(doc.state.global.title).toBeNull();
    expect(doc.state.global.source?.documentName).toBeNull();
    doc = apply(
      doc,
      setDocumentSource({ documentId: "c-1", documentType: "sektar/contact", documentName: "Ann", setAt: AT }),
    );
    expect(doc.state.global.title).toBe("Ann");
    // and a stored source without size or type
    doc = apply(doc, setAttachmentSource({ ref: PNG, fileName: "logo.png", setAt: AT }));
    expect(doc.state.global.source).toMatchObject({ mimeType: null, sizeBytes: null });
  });
});

describe("refusals leave the file as it was", () => {
  const base = () =>
    apply(
      utils.createDocument(),
      addRendition({ id: "r1", mimeType: "text/plain", text: "x", createdAt: AT }),
      addTag({ id: "t1", label: "Finance", color: "forest" }),
      addTag({ id: "t2", label: "Legal", color: "clay" }),
    );

  const cases: [string, Parameters<typeof reducer>[1], string][] = [
    ["empty source file name", setAttachmentSource({ ref: PDF, fileName: "  ", setAt: AT }), "The file name is empty"],
    ["empty source document type", setDocumentSource({ documentId: "d", documentType: " ", setAt: AT }), "The document type is empty"],
    ["duplicate rendition", addRendition({ id: "r1", mimeType: "text/plain", text: "y", createdAt: AT }), "A rendition with id r1 exists already"],
    ["not a MIME type", addRendition({ id: "r2", mimeType: "pdf", text: "y", createdAt: AT }), '"pdf" is not a MIME type'],
    ["neither ref nor text", addRendition({ id: "r2", mimeType: "image/png", createdAt: AT }), "A rendition carries either stored content (ref) or inline text, exactly one"],
    ["both ref and text", addRendition({ id: "r2", mimeType: "image/png", ref: PNG, text: "y", createdAt: AT }), "A rendition carries either stored content (ref) or inline text, exactly one"],
    ["update an unknown rendition", updateRendition({ id: "nope", label: "x" }), "No rendition with id nope"],
    ["update to a bad MIME type", updateRendition({ id: "r1", mimeType: "text" }), '"text" is not a MIME type'],
    ["remove an unknown rendition", removeRendition({ id: "nope" }), "No rendition with id nope"],
    ["empty tag label", addTag({ id: "t9", label: " ", color: "mint" }), "The tag label is empty"],
    ["tag label taken, any case", addTag({ id: "t9", label: "FINANCE", color: "mint" }), 'The file is tagged "FINANCE" already'],
    ["tag id taken", addTag({ id: "t1", label: "Other", color: "mint" }), 'The file is tagged "Other" already'],
    ["update an unknown tag", updateTag({ id: "nope", color: "mint" }), "No tag with id nope"],
    ["rename a tag to empty", updateTag({ id: "t1", label: "  " }), "The tag label is empty"],
    ["rename a tag onto another", updateTag({ id: "t1", label: "legal" }), 'The file is tagged "legal" already'],
    ["remove an unknown tag", removeTag({ id: "nope" }), "No tag with id nope"],
  ];

  it.each(cases)("%s", (_name, action, message) => {
    const before = base();
    const after = reducer(before, action);
    expect(lastError(after)).toBe(message);
    expect(after.state.global).toEqual(before.state.global);
  });
});
