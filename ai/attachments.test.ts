// The attachment tools over the real attachment client and the real document
// reducers. Only the storage under the client is stubbed, so a file that fails
// to arrive fails here the same way. The PDF renderer is the one stand-in: it
// needs a browser's canvas.
import type { getPHStore } from "@powerhousedao/reactor-browser";
import type { PhAiToolDescriptor } from "@powerhousedao/shared/document-model";
import {
  addAttachment as addEmailAttachment,
  reducer as emailReducer,
  utils as emailUtils,
} from "document-models/email";
import {
  addRendition,
  reducer as fileReducer,
  setAttachmentSource,
  setDocumentSource,
  utils as fileUtils,
} from "document-models/file";
import {
  addAttachment as addInvoiceAttachment,
  addLine,
  reducer as invoiceReducer,
  utils as invoiceUtils,
  voidInvoice,
} from "document-models/invoice";
import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installStore } from "./test-index.js";
import { aiTools } from "./tools.js";

const pdf = vi.hoisted(() => ({ renderPdfPages: vi.fn() }));
vi.mock("./pdf-pages.js", () => pdf);

type IAttachmentService = NonNullable<
  NonNullable<ReturnType<typeof getPHStore>>["attachmentService"]
>;

const hash = (char: string) => char.repeat(64);
const refOf = (char: string) => `attachment://v1:${hash(char)}`;
const RECEIPT = refOf("a");
const LOGO = refOf("b");
const AT = "2026-10-30T12:00:00.000Z";
const JPEG = "data:image/jpeg;base64,/9j/2wBD";

function tool(name: string): PhAiToolDescriptor {
  const found = aiTools.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No tool ${name}`);
  return found;
}

const call = (
  name: string,
  args: unknown,
  context?: Parameters<PhAiToolDescriptor["callback"]>[1],
) =>
  tool(name).callback(args as never, context) as Promise<
    Record<string, unknown>
  >;

interface StoredFile {
  mimeType: string;
  fileName: string;
  bytes: Uint8Array;
  /** Set to report a size other than the bytes, as a cut stream would. */
  sizeBytes?: number;
}

const stored = (
  mimeType: string,
  fileName: string,
  text = "the file's bytes",
): StoredFile => ({
  mimeType,
  fileName,
  bytes: new TextEncoder().encode(text),
});

const headerOf = (file: StoredFile, ref: string) => ({
  hash: ref.slice(-64),
  mimeType: file.mimeType,
  fileName: file.fileName,
  sizeBytes: file.sizeBytes ?? file.bytes.length,
  extension: null,
  status: "available",
  source: "local",
  createdAtUtc: AT,
  lastAccessedAtUtc: AT,
  expiresAtUtc: null,
});

const bodyOf = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

/** A storage holding `files` by ref; what the tools asked for is on `calls`. */
function storage(files: Record<string, StoredFile>) {
  const calls = {
    get: [] as { ref: string; documentId?: string }[],
    reserved: [] as Record<string, unknown>[],
    sent: [] as Blob[],
  };
  const service = {
    get: (ref: string, options: { documentId?: string }) => {
      calls.get.push({ ref, documentId: options.documentId });
      const file = files[ref] as StoredFile | undefined;
      return file
        ? Promise.resolve({
            header: headerOf(file, ref),
            body: bodyOf(file.bytes),
          })
        : Promise.reject(new Error("Attachment not found"));
    },
    reserve: (options: Record<string, unknown>) => {
      calls.reserved.push(options);
      const ref = `attachment://v1:${String(options.clientHash)}`;
      return Promise.resolve({
        ref,
        send: (data: Blob) => {
          calls.sent.push(data);
          return Promise.resolve({
            hash: options.clientHash,
            ref,
            header: {},
          });
        },
      });
    },
  } as unknown as IAttachmentService;
  return { service, calls };
}

/** The browser's reader, which a Node test run does not have. */
class StubFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((bytes) => {
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
      this.onload?.();
    });
  }
}

const openDocuments = (...documents: { header: { id: string } }[]) => ({
  get: (id: string) => {
    const found = documents.find((document) => document.header.id === id);
    return found
      ? Promise.resolve(found)
      : Promise.reject(new Error(`Document not found: ${id}`));
  },
});

const invoiceWithLine = () =>
  invoiceReducer(
    invoiceUtils.createDocument(),
    addLine({
      id: "line-1",
      description: "Train to Ghent",
      quantity: 1,
      unitPrice: 20,
      vatCategory: "STANDARD",
      vatRate: 21,
    }),
  );

/** The input the instructions spell out for ADD_ATTACHMENT. */
const attachmentInput = (over: Record<string, unknown> = {}) => ({
  id: "4ae1d2b8-5d0a-4d51-a6a9-3a6d8ad1e001",
  role: "SUPPORTING" as const,
  fileName: "receipt.pdf",
  mimeType: "application/pdf",
  ref: RECEIPT as `attachment://v${number}:${string}`,
  sizeBytes: 1200,
  addedAt: AT,
  ...over,
});

beforeEach(() => {
  pdf.renderPdfPages.mockReset();
  vi.stubGlobal("FileReader", StubFileReader);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the attach recipes the instructions give", () => {
  it("puts a stored file on an invoice", () => {
    const document = invoiceReducer(
      invoiceUtils.createDocument(),
      addInvoiceAttachment(attachmentInput()),
    );
    expect(document.operations.global.at(-1)?.error).toBeUndefined();
    expect(document.state.global.attachments).toMatchObject([
      { ref: RECEIPT, role: "SUPPORTING" },
    ]);
  });

  it("puts a stored file on a line, not on the invoice", () => {
    const document = invoiceReducer(
      invoiceWithLine(),
      addInvoiceAttachment(
        attachmentInput({ lineId: "line-1", role: "RECEIPT" }),
      ),
    );
    expect(document.operations.global.at(-1)?.error).toBeUndefined();
    expect(document.state.global.attachments).toEqual([]);
    expect(document.state.global.lines[0].attachments).toMatchObject([
      { ref: RECEIPT, role: "RECEIPT" },
    ]);
  });

  it("refuses a line the invoice does not have", () => {
    const document = invoiceReducer(
      invoiceWithLine(),
      addInvoiceAttachment(attachmentInput({ lineId: "no-such-line" })),
    );
    expect(document.operations.global.at(-1)?.error).toBeTruthy();
  });

  it("makes a stored file a File's source", () => {
    const document = fileReducer(
      fileUtils.createDocument(),
      setAttachmentSource({
        ref: RECEIPT as `attachment://v${number}:${string}`,
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1200,
        setAt: AT,
      }),
    );
    expect(document.operations.global.at(-1)?.error).toBeUndefined();
    expect(document.state.global).toMatchObject({
      title: "receipt.pdf",
      source: { kind: "ATTACHMENT", ref: RECEIPT },
    });
  });
});

describe("sektarListAttachments", () => {
  const list = (document: { header: { id: string } }) => {
    installStore({ reactorClient: openDocuments(document) });
    return call("sektarListAttachments", { documentId: document.header.id });
  };

  it("finds an invoice's files, on the invoice and on its lines", async () => {
    const document = [
      addInvoiceAttachment(attachmentInput()),
      addInvoiceAttachment(
        attachmentInput({
          id: "4ae1d2b8-5d0a-4d51-a6a9-3a6d8ad1e002",
          lineId: "line-1",
          ref: LOGO,
          fileName: "ticket.png",
          mimeType: "image/png",
          sizeBytes: 90,
          role: "RECEIPT",
        }),
      ),
    ].reduce((doc, action) => invoiceReducer(doc, action), invoiceWithLine());

    expect(await list(document)).toMatchObject({
      document: { id: document.header.id, type: document.header.documentType },
      found: 2,
      items: expect.arrayContaining([
        {
          ref: RECEIPT,
          fileName: "receipt.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1200,
          at: "attachments.0",
        },
        {
          ref: LOGO,
          fileName: "ticket.png",
          mimeType: "image/png",
          sizeBytes: 90,
          at: "lines.0.attachments.0",
        },
      ]),
    });
  });

  it("gives a message's files once each, under their real names", async () => {
    const add = (id: string, ref: string, fileName: string, inline = false) =>
      addEmailAttachment({
        id,
        ref: ref as `attachment://v${number}:${string}`,
        fileName,
        mimeType: inline ? "image/png" : "application/pdf",
        sizeBytes: 500,
        inline,
      });
    const document = [
      add("a1", RECEIPT, "attachment-1"),
      add("a2", RECEIPT, "invoice.pdf"),
      add("a3", LOGO, "logo.png", true),
    ].reduce(
      (doc, action) => emailReducer(doc, action),
      emailUtils.createDocument(),
    );

    const result = await list(document);
    expect(result).toMatchObject({
      found: 2,
      items: [
        { ref: RECEIPT, fileName: "invoice.pdf" },
        { ref: LOGO, fileName: "logo.png", inline: true },
      ],
    });
    expect((result.items as object[])[0]).not.toHaveProperty("inline");
  });

  it("gives a File's source and renditions", async () => {
    const document = [
      setAttachmentSource({
        ref: RECEIPT as `attachment://v${number}:${string}`,
        fileName: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1200,
        setAt: AT,
      }),
      addRendition({
        id: "r1",
        mimeType: "image/png",
        ref: LOGO as `attachment://v${number}:${string}`,
        fileName: "thumb.png",
        sizeBytes: 90,
        createdAt: AT,
      }),
    ].reduce(
      (doc, action) => fileReducer(doc, action),
      fileUtils.createDocument(),
    );

    expect(await list(document)).toMatchObject({
      found: 2,
      items: [
        { ref: RECEIPT, at: "source" },
        { ref: LOGO, at: "renditions.0" },
      ],
    });
  });

  it("says a document without stored files holds none", async () => {
    const document = fileReducer(
      fileUtils.createDocument(),
      setDocumentSource({
        documentId: "other-document",
        documentType: "sektar/invoice",
        setAt: AT,
      }),
    );
    expect(await list(document)).toMatchObject({
      found: 0,
      items: [],
      note: "The document was read and holds no stored files.",
    });
  });

  it("reports a document it cannot read as an error", async () => {
    installStore({ reactorClient: openDocuments() });
    await expect(
      call("sektarListAttachments", { documentId: "missing" }),
    ).rejects.toThrow(/could not be read.*Document not found/);
  });

  it("reports a session without documents as an error", async () => {
    installStore();
    await expect(
      call("sektarListAttachments", { documentId: "any" }),
    ).rejects.toThrow(/could not be read/);
  });
});

describe("sektarReadAttachment", () => {
  const read = (
    files: Record<string, StoredFile>,
    args: Record<string, unknown> = {},
  ) => {
    const { service, calls } = storage(files);
    installStore({ attachmentService: service });
    return {
      calls,
      result: call("sektarReadAttachment", {
        documentId: "mail-1",
        ref: RECEIPT,
        ...args,
      }),
    };
  };

  it("asks for the file through the document that holds it", async () => {
    const { result, calls } = read({
      [RECEIPT]: stored("image/png", "photo.png"),
    });
    await result;
    expect(calls.get).toEqual([{ ref: RECEIPT, documentId: "mail-1" }]);
  });

  it("shows an image as an image", async () => {
    const { result } = read({ [RECEIPT]: stored("image/png", "photo.png") });
    expect(await result).toMatchObject({
      structuredContent: {
        fileName: "photo.png",
        mimeType: "image/png",
        read: true,
      },
      content: [
        { type: "text" },
        {
          type: "image",
          mimeType: "image/png",
          data: Buffer.from("the file's bytes").toString("base64"),
        },
      ],
    });
  });

  it.each([
    ["image/jpg", "photo.jpg", "image/jpeg"],
    ["application/octet-stream", "scan.JPEG", "image/jpeg"],
    ["image/png; name=x.png", "x.png", "image/png"],
  ])("takes %s named %s for an image", async (mimeType, fileName, shownAs) => {
    const { result } = read({ [RECEIPT]: stored(mimeType, fileName) });
    expect(await result).toMatchObject({
      content: [{ type: "text" }, { type: "image", mimeType: shownAs }],
    });
  });

  it("goes by the document's own name and type over what was uploaded", async () => {
    const { result } = read(
      { [RECEIPT]: stored("application/octet-stream", "attachment") },
      { fileName: "photo.webp", mimeType: "image/webp" },
    );
    expect(await result).toMatchObject({
      structuredContent: { fileName: "photo.webp" },
      content: [{ type: "text" }, { type: "image", mimeType: "image/webp" }],
    });
  });

  it("shows a short PDF whole", async () => {
    pdf.renderPdfPages.mockResolvedValue({
      total: 3,
      pages: [1, 2, 3].map(() => ({
        dataUrl: JPEG,
        mediaType: "image/jpeg",
      })),
    });
    const { result } = read({
      [RECEIPT]: stored("application/pdf", "invoice.pdf"),
    });
    const answer = await result;
    expect(pdf.renderPdfPages.mock.calls[0][1]).toBe(5);
    expect(answer).toMatchObject({
      structuredContent: { read: true, pages: 3, pagesShown: 3 },
    });
    expect((answer.content as object[]).slice(1)).toEqual(
      [1, 2, 3].map(() => ({
        type: "image",
        data: "/9j/2wBD",
        mimeType: "image/jpeg",
      })),
    );
    expect(answer.structuredContent).not.toHaveProperty("note");
  });

  it("says when a PDF has more pages than were shown", async () => {
    pdf.renderPdfPages.mockResolvedValue({
      total: 12,
      pages: Array.from({ length: 5 }, () => ({
        dataUrl: JPEG,
        mediaType: "image/jpeg",
      })),
    });
    const { result } = read({
      [RECEIPT]: stored("application/octet-stream", "contract.PDF"),
    });
    expect(await result).toMatchObject({
      structuredContent: {
        pages: 12,
        pagesShown: 5,
        cutOff: true,
        note: expect.stringContaining("first 5 of 12 pages") as string,
      },
    });
  });

  it("says plainly that other files cannot be read, without fetching them", async () => {
    const cancel = vi.fn();
    const service = {
      get: () =>
        Promise.resolve({
          header: headerOf(stored("text/csv", "lines.csv"), RECEIPT),
          body: new ReadableStream({ cancel }),
        }),
    } as unknown as IAttachmentService;
    installStore({ attachmentService: service });
    const answer = await call("sektarReadAttachment", {
      documentId: "mail-1",
      ref: RECEIPT,
    });
    expect(answer).toMatchObject({
      fileName: "lines.csv",
      read: false,
      note: expect.stringContaining("cannot be read") as string,
    });
    expect(answer).not.toHaveProperty("content");
    expect(cancel).toHaveBeenCalled();
  });

  it("treats an image type the chat cannot carry the same way", async () => {
    const { result } = read({ [RECEIPT]: stored("image/heic", "photo.heic") });
    expect(await result).toMatchObject({ read: false });
  });

  it("does not fetch a file too large to read", async () => {
    const huge = {
      ...stored("application/pdf", "scan.pdf"),
      sizeBytes: 60 * 1024 * 1024,
    };
    const { result } = read({ [RECEIPT]: huge });
    expect(await result).toMatchObject({
      read: false,
      note: expect.stringContaining("60 MB") as string,
    });
    expect(pdf.renderPdfPages).not.toHaveBeenCalled();
  });

  it("reports a missing file as an error, not as nothing", async () => {
    const { result } = read({});
    await expect(result).rejects.toThrow(
      /could not be loaded: Attachment not found.*unknown/,
    );
  });

  it("reports an empty file as an error", async () => {
    const { result } = read({
      [RECEIPT]: stored("application/pdf", "empty.pdf", ""),
    });
    await expect(result).rejects.toThrow(/could not be loaded.*empty/);
    expect(pdf.renderPdfPages).not.toHaveBeenCalled();
  });

  it("reports a cut-off download as an error", async () => {
    const { result } = read({
      [RECEIPT]: { ...stored("image/png", "photo.png"), sizeBytes: 9000 },
    });
    await expect(result).rejects.toThrow(/could not be loaded.*of 9000 bytes/);
  });

  it("reports a stream that fails midway as an error", async () => {
    const service = {
      get: () =>
        Promise.resolve({
          header: headerOf(stored("image/png", "photo.png"), RECEIPT),
          body: new ReadableStream({
            pull: (controller) => controller.error(new Error("socket closed")),
          }),
        }),
    } as unknown as IAttachmentService;
    installStore({ attachmentService: service });
    await expect(
      call("sektarReadAttachment", { documentId: "mail-1", ref: RECEIPT }),
    ).rejects.toThrow(/could not be loaded: socket closed/);
  });

  it("reports a PDF it cannot open as an error", async () => {
    pdf.renderPdfPages.mockRejectedValue(new Error("Invalid PDF structure."));
    const { result } = read({
      [RECEIPT]: stored("application/pdf", "broken.pdf"),
    });
    await expect(result).rejects.toThrow(
      /PDF could not be read: Invalid PDF structure/,
    );
  });

  it("refuses something that is not a reference", async () => {
    const { result } = read({}, { ref: "invoice.pdf" });
    await expect(result).rejects.toThrow(/not a file reference/);
  });

  it("reports a session without stored files as an error", async () => {
    installStore();
    await expect(
      call("sektarReadAttachment", { documentId: "mail-1", ref: RECEIPT }),
    ).rejects.toThrow(/not available/);
  });

  it("passes the turn's signal on, so Stop stops the download", async () => {
    const seen: unknown[] = [];
    const { service } = storage({
      [RECEIPT]: stored("image/png", "photo.png"),
    });
    const get = service.get.bind(service);
    service.get = ((ref: never, options: { signal?: AbortSignal }) => {
      seen.push(options.signal);
      return get(ref, options);
    }) as never;
    installStore({ attachmentService: service });
    const { signal } = new AbortController();
    await call(
      "sektarReadAttachment",
      { documentId: "mail-1", ref: RECEIPT },
      { signal },
    );
    expect(seen).toEqual([signal]);
  });
});

describe("sektarSaveChatImage", () => {
  const PNG = Buffer.from("png bytes");
  const image = (handle: string, name?: string) => ({
    handle,
    dataUrl: `data:image/png;base64,${PNG.toString("base64")}`,
    mediaType: "image/png",
    name,
  });

  it("asks for approval, as a write", () => {
    expect(tool("sektarSaveChatImage").annotations?.readOnlyHint).toBe(false);
  });

  it("uploads the chat's image and returns its reference", async () => {
    const { service, calls } = storage({});
    installStore({ attachmentService: service });
    const answer = await call(
      "sektarSaveChatImage",
      { handle: "image-2", documentId: "invoice-1" },
      { chatImages: [image("image-1", "a.png"), image("image-2", "b.png")] },
    );

    expect(answer.ref).toMatch(/^attachment:\/\/v1:[0-9a-f]{64}$/);
    expect(answer).toMatchObject({
      fileName: "b.png",
      mimeType: "image/png",
      sizeBytes: PNG.length,
    });
    expect(calls.reserved).toMatchObject([
      { fileName: "b.png", mimeType: "image/png", sizeBytes: PNG.length },
    ]);
    expect(Buffer.from(await calls.sent[0].arrayBuffer())).toEqual(PNG);
  });

  it("names the document, so a routing store keeps it where that document lives", async () => {
    const reserved: Record<string, unknown>[] = [];
    const { service } = storage({});
    const reserve = service.reserve.bind(service);
    service.reserve = ((options: Record<string, unknown>) => {
      reserved.push(options);
      return reserve(options as never);
    }) as never;
    installStore({ attachmentService: service });
    await call(
      "sektarSaveChatImage",
      { handle: "image-1", documentId: "invoice-1" },
      { chatImages: [image("image-1")] },
    );
    expect(reserved[0].documentId).toBe("invoice-1");
  });

  it("names a nameless paste after its handle, and takes a given name first", async () => {
    const { service } = storage({});
    installStore({ attachmentService: service });
    const nameless = await call(
      "sektarSaveChatImage",
      { handle: "image-1" },
      { chatImages: [image("image-1")] },
    );
    expect(nameless.fileName).toBe("image-1.png");
    const named = await call(
      "sektarSaveChatImage",
      { handle: "image-1", fileName: "Train ticket.png" },
      { chatImages: [image("image-1", "paste.png")] },
    );
    expect(named.fileName).toBe("Train ticket.png");
  });

  it("says the image is on no document yet", async () => {
    const { service } = storage({});
    installStore({ attachmentService: service });
    const answer = await call(
      "sektarSaveChatImage",
      { handle: "image-1" },
      { chatImages: [image("image-1")] },
    );
    expect(answer.note).toMatch(/on no document yet/);
  });

  it("names the images there are when the handle is wrong", async () => {
    const { service } = storage({});
    installStore({ attachmentService: service });
    await expect(
      call(
        "sektarSaveChatImage",
        { handle: "image-9" },
        { chatImages: [image("image-1")] },
      ),
    ).rejects.toThrow(/no image image-9.*image-1/);
    await expect(
      call("sektarSaveChatImage", { handle: "image-1" }),
    ).rejects.toThrow(/no image was attached/);
  });

  it("reports a failed upload as an error", async () => {
    const { service } = storage({});
    service.reserve = (() =>
      Promise.reject(new Error("Unauthorized"))) as never;
    installStore({ attachmentService: service });
    await expect(
      call(
        "sektarSaveChatImage",
        { handle: "image-1" },
        { chatImages: [image("image-1")] },
      ),
    ).rejects.toThrow(/not saved: Unauthorized/);
  });

  it("reports a session without stored files as an error", async () => {
    installStore();
    await expect(
      call(
        "sektarSaveChatImage",
        { handle: "image-1" },
        { chatImages: [image("image-1")] },
      ),
    ).rejects.toThrow(/not available/);
  });
});

describe("a void invoice", () => {
  it("takes no attachments, so the model hears why", () => {
    const voided = invoiceReducer(
      invoiceWithLine(),
      voidInvoice({ reason: "Billed twice" }),
    );
    const document = invoiceReducer(
      voided,
      addInvoiceAttachment(attachmentInput()),
    );
    expect(document.operations.global.at(-1)?.error).toBeTruthy();
  });
});
