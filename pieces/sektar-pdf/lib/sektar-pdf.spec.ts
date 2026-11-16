import { createHash } from "node:crypto";
import { generateId, type Operation, type PHDocument } from "document-model";
import { describe, expect, it } from "vitest";
import {
  actions as fileActions,
  isFileDocument,
  reducer as fileReducer,
  utils as fileUtils,
} from "document-models/file";
import {
  actions as emailActions,
  isEmailDocument,
  reducer as emailReducer,
  utils as emailUtils,
} from "document-models/email";
import {
  attachmentRefSchema,
  type ArtifactDescriptor,
  type ConversionWarning,
  type ResolvedConversionPlan,
  type ResolvedSource,
} from "../../../conversions/contracts.js";
import { planFingerprint } from "../../../conversions/engine/plan.js";
import {
  getCurrentConversionRendition,
  resultOfPublication,
  type ConversionDocumentAction,
} from "../../../conversions/model-adapter.js";
import {
  PUBLICATION_MIME,
  MAX_PUBLICATION_MANIFEST_BYTES,
  MAX_PUBLICATION_MARKDOWN_BYTES,
  parsePublicationRowId,
  publicationManifestSchema,
  publicationRowId,
} from "../../../conversions/publication.js";
import { inspectPublications } from "../../../conversions/read-publications.js";
import {
  doctureConversionOutputSchema,
  doctureManifestSchema,
} from "../../docture/lib/contracts.js";
import { sektarPdf } from "../index.js";
import {
  publishedPdfSchema,
  readyPdfSchema,
  SektarPdfRefusal,
} from "./contracts.js";
import {
  publishPdf,
  publishRenditionAction,
  type PdfArtifactStore,
  type PdfPublisher,
  type PublishPdfInput,
} from "./publish-rendition.js";
import {
  resolvePdf,
  resolvePdfAction,
  type PdfResolver,
} from "./resolve-pdf.js";

const AT = "2026-11-11T12:00:00.000Z";
const LATER = "2026-11-11T13:00:00.000Z";
const PDF = attachmentRefSchema.parse(`attachment://v1:${"a".repeat(64)}`);
const OTHER_PDF = attachmentRefSchema.parse(
  `attachment://v1:${"b".repeat(64)}`,
);
const OTHER_JSON = attachmentRefSchema.parse(
  `attachment://v1:${"c".repeat(64)}`,
);
const MARKDOWN_ROW = publicationRowId("generation-1", "markdown");
const MANIFEST_ROW = publicationRowId("generation-1", "manifest");
const kinds = ["file", "mail"] as const;

const unsignedPlan = {
  contractVersion: 1,
  converterVersion: "docture@1",
  reading: { kind: "digital", readerVersion: "1" },
  layout: { kind: "off" },
  pages: { kind: "all" },
  output: { kind: "markdown", pageMarkers: true },
} satisfies Omit<ResolvedConversionPlan, "fingerprint">;
const PLAN: ResolvedConversionPlan = {
  ...unsignedPlan,
  fingerprint: planFingerprint(unsignedPlan),
};

function refOf(data: Uint8Array) {
  return attachmentRefSchema.parse(
    `attachment://v1:${createHash("sha256").update(data).digest("hex")}`,
  );
}

function artifact(
  role: ArtifactDescriptor["role"],
  data: Buffer,
): ArtifactDescriptor {
  return {
    id: role,
    role,
    ref: refOf(data),
    fileName: role === "markdown" ? "source.md" : "source.json",
    mimeType: role === "markdown" ? "text/markdown" : "application/json",
    sizeBytes: data.byteLength,
  };
}

/** What Docture stores and hands on for one reading of the PDF. */
function doctureOutput(text: string, warnings: ConversionWarning[] = []) {
  const markdownFile = { data: Buffer.from(text) };
  const body = {
    plan: PLAN,
    markdown: artifact("markdown", markdownFile.data),
    completeness: "complete",
    pages: [
      {
        status: "read",
        page: 1,
        method: "digital",
        characters: text.length,
      },
    ],
    warnings,
    provenance: [
      { role: "digital", engine: "pdfjs", version: "1", model: null },
    ],
    usage: {
      kind: "known",
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
      aiPages: 0,
      costUsd: 0,
    },
    documentPages: 1,
  };
  const doctureManifest = doctureManifestSchema.parse({
    ...body,
    kind: "docture-conversion-manifest",
    version: 1,
    sourceFileName: "source.pdf",
  });
  const manifestFile = {
    data: Buffer.from(JSON.stringify(doctureManifest)),
  };
  const conversion = doctureConversionOutputSchema.parse({
    ...body,
    artifacts: [artifact("manifest", manifestFile.data)],
  });
  return { markdownFile, manifestFile, conversion, doctureManifest };
}

function generatedRows(document: PHDocument) {
  const rows: { id: string; ref?: string | null }[] = isFileDocument(document)
    ? document.state.global.renditions
    : isEmailDocument(document)
      ? document.state.global.attachments
      : [];
  return rows
    .filter((row) => parsePublicationRowId(row.id))
    .map(({ id, ref }) => ({ id, ref }));
}

function fixture(kind: "file" | "mail" = "file") {
  let document: PHDocument =
    kind === "file"
      ? fileReducer(
          fileUtils.createDocument(),
          fileActions.setAttachmentSource({
            ref: PDF,
            fileName: "source.pdf",
            setAt: AT,
          }),
        )
      : emailReducer(
          emailUtils.createDocument(),
          emailActions.addAttachment({
            id: "pdf",
            ref: PDF,
            fileName: "source.pdf",
          }),
        );
  const source: ResolvedSource =
    kind === "file"
      ? {
          kind,
          documentId: document.header.id,
          scope: { kind: "files", driveId: "files" },
          ref: PDF,
          fileName: "source.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
        }
      : {
          kind,
          documentId: document.header.id,
          attachmentId: "pdf",
          scope: {
            kind: "mail",
            driveId: "mail",
            account: "person@example.com",
          },
          ref: PDF,
          fileName: "source.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
        };
  const prepared = readyPdfSchema.parse({
    kind: "ready",
    source,
    file: PDF,
    generationId: "generation-1",
    createdAt: AT,
    plan: PLAN,
    limits: {
      maxBytes: 1000,
      maxPages: 20,
      maxAiPages: 0,
      maxAiRequests: 0,
      automaticAiPagesPerDay: 0,
      maxDurationMs: 10000,
    },
  });
  const output = doctureOutput("# Invoice\n\nTotal: 42\n");
  const stored = new Map<string, Buffer>();
  const store = (data: Buffer) => {
    stored.set(refOf(data), data);
  };
  store(output.markdownFile.data);
  store(output.manifestFile.data);
  const requests: unknown[] = [];
  const writes: string[][] = [];
  const uploads: string[] = [];
  let denied = false;
  const hooks: {
    upload?: () => void;
    uploadId?: string;
    beforeWrite?: (actions: ConversionDocumentAction[]) => void;
    afterWrite?: () => void;
    beforeRead?: () => void;
    loseAck?: boolean;
  } = {};
  const apply = (action: ConversionDocumentAction) => {
    if (isFileDocument(document)) document = fileReducer(document, action);
    else if (isEmailDocument(document))
      document = emailReducer(document, action);
    else throw new Error("Unexpected model");
  };
  const files: PdfArtifactStore = {
    upload({ data }) {
      if (!Buffer.isBuffer(data)) throw new Error("Expected stored bytes");
      store(data);
      uploads.push(refOf(data));
      hooks.upload?.();
      return Promise.resolve({
        id: hooks.uploadId ?? refOf(data),
        url: "https://files.example/upload",
      });
    },
  };
  const reactor: PdfPublisher & PdfResolver = {
    get() {
      hooks.beforeRead?.();
      return Promise.resolve(document);
    },
    query(request) {
      const input = request.variables?.input;
      if (typeof input !== "string")
        throw new Error("Expected serialized input");
      requests.push(JSON.parse(input));
      const field = request.query.includes("prepare(input:")
        ? "prepare"
        : "validate";
      return Promise.resolve({
        data: {
          conversion: {
            [field]: JSON.stringify(
              denied
                ? {
                    kind: "error",
                    code: "access-denied",
                    message: "You can no longer write to this source",
                  }
                : {
                    kind: "ok",
                    value: field === "prepare" ? prepared : { valid: true },
                  },
            ),
          },
        },
      });
    },
    execute(documentId, branch, actions) {
      expect(documentId).toBe(document.header.id);
      expect(branch).toBe("main");
      hooks.beforeWrite?.(actions);
      writes.push(actions.map((action) => action.type));
      actions.forEach(apply);
      hooks.afterWrite?.();
      return hooks.loseAck
        ? Promise.reject(
            new Error("The connection closed before the reactor answered"),
          )
        : Promise.resolve(document);
    },
    getOperations(documentId, view, filter, paging) {
      expect(documentId).toBe(document.header.id);
      expect(view).toEqual({ branch: "main", scopes: ["global"] });
      return Promise.resolve({
        results: document.operations.global
          .filter((operation) => operation.index >= filter.sinceRevision)
          .slice(0, paging.limit),
      });
    },
  };
  const input: PublishPdfInput = {
    prepared,
    conversion: output.conversion,
    markdownFile: output.markdownFile,
    manifestFile: output.manifestFile,
    workflowId: "workflow",
    runId: "run",
  };
  return {
    prepared,
    ...output,
    input,
    reactor,
    files,
    hooks,
    requests,
    writes,
    uploads,
    apply,
    args: (overrides: Partial<PublishPdfInput> = {}) => ({
      reactor,
      files,
      input: { ...input, ...overrides },
    }),
    document: () => document,
    inspect: () =>
      inspectPublications({
        document,
        read: ({ ref }) => {
          const data = stored.get(ref);
          return data
            ? Promise.resolve(new Uint8Array(data))
            : Promise.reject(new Error(`Nothing is stored at ${ref}`));
        },
      }),
    uploaded: (ref: string | undefined) => {
      const data = ref === undefined ? undefined : stored.get(ref);
      if (!data) throw new Error("Expected an uploaded manifest");
      return publicationManifestSchema.parse(JSON.parse(data.toString("utf8")));
    },
    deny: () => {
      denied = true;
    },
    /** Another client's row under this generation's manifest ID. */
    foreignManifestRow: (): ConversionDocumentAction => {
      const row = {
        id: MANIFEST_ROW,
        ref: OTHER_JSON,
        fileName: "other.json",
        mimeType: PUBLICATION_MIME,
        sizeBytes: 3,
      };
      return kind === "file"
        ? fileActions.addRendition({ ...row, createdAt: AT })
        : emailActions.addAttachment(row);
    },
    removeRow: (id: string): ConversionDocumentAction =>
      kind === "file"
        ? fileActions.removeRendition({ id })
        : emailActions.removeAttachment({ id }),
    replaceSource: () => {
      if (kind === "file") {
        apply(
          fileActions.setAttachmentSource({
            ref: OTHER_PDF,
            fileName: "replacement.pdf",
            setAt: LATER,
          }),
        );
        return;
      }
      apply(emailActions.removeAttachment({ id: "pdf" }));
      apply(
        emailActions.addAttachment({
          id: "pdf",
          ref: OTHER_PDF,
          fileName: "replacement.pdf",
        }),
      );
    },
  };
}

describe("Sektar PDF workflow actions", () => {
  it("declares read access for resolution and write access for publication", () => {
    expect(sektarPdf.getAction("resolve-pdf")).toBe(resolvePdfAction);
    expect(resolvePdfAction.requireReactor).toBe("read");
    expect(sektarPdf.getAction("publish-rendition")).toBe(
      publishRenditionAction,
    );
    expect(publishRenditionAction.requireReactor).toBe("write");
  });

  it("passes the original request to the authenticated gateway and pins the returned file", async () => {
    const f = fixture();
    const request = {
      kind: "manual",
      source: {
        kind: "file",
        documentId: f.prepared.source.documentId,
        expectedRef: PDF,
      },
    };
    const output = await resolvePdf(f.reactor, {
      request,
      workflowId: "workflow",
      runId: "run",
    });
    expect(output).toEqual(f.prepared);
    expect(f.requests).toEqual([
      {
        request,
        workflowId: "workflow",
        runId: "run",
      },
    ]);
    expect(f.writes).toEqual([]);
  });

  it.each(kinds)(
    "saves the Markdown and a manifest bound to the exact PDF as one %s pair that readers accept, then replays without writing",
    async (kind) => {
      const f = fixture(kind);
      const first = await publishPdf(f.args());
      const added = kind === "file" ? "ADD_RENDITION" : "ADD_ATTACHMENT";
      expect(f.writes).toEqual([[added, added]]);
      expect(
        f
          .document()
          .operations.global.every(
            (operation) => operation.error === undefined,
          ),
      ).toBe(true);
      expect(f.uploaded(f.uploads[0])).toEqual({
        kind: "sektar-pdf-publication",
        version: 1,
        generationId: "generation-1",
        source: f.prepared.source,
        createdAt: AT,
        output: f.doctureManifest,
      });
      expect(generatedRows(f.document())).toEqual([
        { id: MARKDOWN_ROW, ref: f.conversion.markdown.ref },
        { id: MANIFEST_ROW, ref: f.uploads[0] },
      ]);
      const inspections = await f.inspect();
      const [inspection] = inspections;
      if (inspections.length !== 1 || inspection.kind !== "ready")
        throw new Error(
          `Expected one ready pair: ${JSON.stringify(inspections)}`,
        );
      expect(first).toEqual({
        kind: "published",
        result: resultOfPublication(inspection.publication),
      });
      expect(publishedPdfSchema.parse(first)).toEqual(first);
      expect(
        getCurrentConversionRendition(
          f.document(),
          f.prepared.source,
          inspections,
        ),
      ).toMatchObject({
        id: MARKDOWN_ROW,
        jobId: "generation-1",
        ref: f.conversion.markdown.ref,
        stale: false,
      });

      expect(await publishPdf(f.args())).toEqual(first);
      expect(f.writes).toHaveLength(1);
    },
  );

  it("retries a write whose acknowledgement was lost without saving the pair twice", async () => {
    const f = fixture();
    f.hooks.loseAck = true;
    await expect(publishPdf(f.args())).rejects.toThrow("connection closed");
    f.hooks.loseAck = false;
    expect((await publishPdf(f.args())).kind).toBe("published");
    expect(f.writes).toHaveLength(1);
    expect(generatedRows(f.document())).toHaveLength(2);
  });

  it.each(kinds)(
    "accepts the identical %s pair when a retry of this run saved it first",
    async (kind) => {
      const f = fixture(kind);
      f.hooks.beforeWrite = (actions) => {
        for (const action of actions) f.apply({ ...action, id: generateId() });
      };
      expect((await publishPdf(f.args())).kind).toBe("published");
      expect(generatedRows(f.document())).toHaveLength(2);
      expect(
        f
          .document()
          .operations.global.filter(
            (operation) => operation.error !== undefined,
          ),
      ).toHaveLength(2);
    },
  );

  it.each(kinds)(
    "keeps the %s Markdown row when its sibling fails, and refuses without repairing either",
    async (kind) => {
      const f = fixture(kind);
      f.hooks.beforeWrite = () => f.apply(f.foreignManifestRow());
      await expect(publishPdf(f.args())).rejects.toThrow(
        kind === "file"
          ? /differs from this conversion[\s\S]*exists already/
          : /differs from this conversion[\s\S]*already on the message/,
      );
      expect(generatedRows(f.document())).toEqual([
        { id: MANIFEST_ROW, ref: OTHER_JSON },
        { id: MARKDOWN_ROW, ref: f.conversion.markdown.ref },
      ]);
    },
  );

  it.each(kinds)(
    "refuses to refill a %s pair that another client cut to one row",
    async (kind) => {
      const f = fixture(kind);
      await publishPdf(f.args());
      f.apply(f.removeRow(MANIFEST_ROW));
      await expect(publishPdf(f.args())).rejects.toThrow(
        /Only part of this conversion remains[\s\S]*Convert again/,
      );
      expect(f.writes).toHaveLength(1);
      expect(generatedRows(f.document())).toEqual([
        { id: MARKDOWN_ROW, ref: f.conversion.markdown.ref },
      ]);
    },
  );

  it.each([
    ["one row", [MANIFEST_ROW], "Only part of this conversion remains"],
    [
      "both rows",
      [MARKDOWN_ROW, MANIFEST_ROW],
      "removed before the conversion finished",
    ],
  ])(
    "does not report a pair as saved when %s goes between the write and the final read",
    async (_label, removed, message) => {
      const f = fixture();
      f.hooks.afterWrite = () => {
        f.hooks.beforeRead = () => {
          f.hooks.beforeRead = undefined;
          for (const id of removed) f.apply(f.removeRow(id));
        };
      };
      await expect(publishPdf(f.args())).rejects.toThrow(message);
      expect(f.writes).toHaveLength(1);
    },
  );

  it("refuses another payload under a saved generation without overwriting it", async () => {
    const f = fixture();
    await publishPdf(f.args());
    const other = doctureOutput("# Invoice\n\nTotal: 43\n");
    await expect(
      publishPdf(
        f.args({
          conversion: other.conversion,
          markdownFile: other.markdownFile,
          manifestFile: other.manifestFile,
        }),
      ),
    ).rejects.toThrow("differs from this conversion");
    expect(f.writes).toHaveLength(1);
    expect(generatedRows(f.document())).toEqual([
      { id: MARKDOWN_ROW, ref: f.conversion.markdown.ref },
      { id: MANIFEST_ROW, ref: f.uploads[0] },
    ]);
  });

  it("keeps two Mail generations apart when their Markdown is identical, and selects the newer", async () => {
    const f = fixture("mail");
    await publishPdf(f.args());
    const second = await publishPdf(
      f.args({
        prepared: {
          ...f.prepared,
          generationId: "generation-2",
          createdAt: LATER,
        },
      }),
    );
    expect(second.kind).toBe("published");
    expect(generatedRows(f.document()).map((row) => row.id)).toEqual([
      MARKDOWN_ROW,
      MANIFEST_ROW,
      publicationRowId("generation-2", "markdown"),
      publicationRowId("generation-2", "manifest"),
    ]);
    const inspections = await f.inspect();
    expect(inspections.map((inspection) => inspection.kind)).toEqual([
      "ready",
      "ready",
    ]);
    expect(
      getCurrentConversionRendition(
        f.document(),
        f.prepared.source,
        inspections,
      )?.jobId,
    ).toBe("generation-2");
  });

  it("skips excluded requests and reuses a saved result without uploading or writing", async () => {
    const f = fixture();
    expect(
      await publishPdf(
        f.args({ prepared: { kind: "skip", reason: "Conversion is off" } }),
      ),
    ).toEqual({ kind: "skip", reason: "Conversion is off" });
    expect(f.requests).toEqual([]);
    const first = await publishPdf(f.args());
    if (first.kind !== "published") throw new Error("Expected publication");
    f.writes.length = 0;
    f.uploads.length = 0;
    expect(
      await publishPdf({
        reactor: f.reactor,
        files: f.files,
        input: {
          prepared: { ...f.prepared, reuse: first.result },
          runId: "run",
        },
      }),
    ).toEqual({ kind: "reused", result: first.result });
    expect(f.writes).toEqual([]);
    expect(f.uploads).toEqual([]);
  });

  it("refuses a changed plan, missing bytes, altered Markdown and altered manifest before uploading", async () => {
    const f = fixture();
    await expect(
      publishPdf(
        f.args({
          conversion: {
            ...f.conversion,
            plan: { ...f.conversion.plan, fingerprint: "other" },
          },
        }),
      ),
    ).rejects.toThrow("different reading plan");
    await expect(
      publishPdf(f.args({ markdownFile: undefined })),
    ).rejects.toThrow("required to verify");
    await expect(
      publishPdf(f.args({ markdownFile: { data: Buffer.from("fake") } })),
    ).rejects.toThrow("does not match");
    await expect(
      publishPdf(f.args({ manifestFile: { data: Buffer.from("{}") } })),
    ).rejects.toThrow("does not match");
    expect(f.uploads).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("refuses conversion details above the reader's limit before uploading or writing", async () => {
    const f = fixture();
    const output = doctureOutput("# Invoice", [
      {
        code: "ocr-low-confidence",
        message: "x".repeat(MAX_PUBLICATION_MANIFEST_BYTES),
      },
    ]);
    await expect(publishPdf(f.args(output))).rejects.toThrow(
      "The conversion details are larger than the 2 MB Sektar can save.",
    );
    expect(f.uploads).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("refuses Markdown above the reader's limit before uploading or writing", async () => {
    const f = fixture();
    const output = doctureOutput(
      "x".repeat(MAX_PUBLICATION_MARKDOWN_BYTES + 1),
    );
    await expect(publishPdf(f.args(output))).rejects.toThrow(
      "The Markdown is larger than the 50 MB Sektar can save.",
    );
    expect(f.uploads).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("refuses inconsistent metadata even when the manifest's hash is correct", async () => {
    const f = fixture();
    const altered = {
      data: Buffer.from(
        JSON.stringify({
          ...f.doctureManifest,
          warnings: [{ code: "changed", message: "Changed warning" }],
        }),
      ),
    };
    await expect(
      publishPdf(
        f.args({
          manifestFile: altered,
          conversion: {
            ...f.conversion,
            artifacts: [artifact("manifest", altered.data)],
          },
        }),
      ),
    ).rejects.toThrow("does not describe");
    expect(f.uploads).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("rejects unverified extra artifacts", async () => {
    const f = fixture();
    await expect(
      publishPdf(
        f.args({
          conversion: {
            ...f.conversion,
            artifacts: [
              ...f.conversion.artifacts,
              artifact("asset", Buffer.from("image")),
            ],
          },
        }),
      ),
    ).rejects.toThrow("unverified additional artifacts");
    expect(f.writes).toEqual([]);
  });

  it.each([
    ["another file's reference", OTHER_JSON],
    ["a provisional token", "file-1"],
  ])("refuses an upload that comes back under %s", async (_label, uploadId) => {
    const f = fixture();
    f.hooks.uploadId = uploadId;
    await expect(publishPdf(f.args())).rejects.toThrow(
      "does not match their contents",
    );
    expect(f.writes).toEqual([]);
  });

  it("stops when the gateway denies current access, before uploading or writing", async () => {
    const f = fixture();
    f.deny();
    const refused = publishPdf(f.args());
    await expect(refused).rejects.toBeInstanceOf(SektarPdfRefusal);
    await expect(refused).rejects.toMatchObject({
      name: "SektarPdfRefusal",
      code: "access-denied",
      message: "You can no longer write to this source",
    });
    expect(f.uploads).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it("checks access and policy again right before saving", async () => {
    const f = fixture();
    f.hooks.upload = () => f.deny();
    await expect(publishPdf(f.args())).rejects.toMatchObject({
      code: "access-denied",
    });
    expect(f.uploads).toHaveLength(1);
    expect(f.writes).toEqual([]);
  });

  it.each(kinds)(
    "refuses a %s PDF replaced before the write and saves nothing",
    async (kind) => {
      const f = fixture(kind);
      f.hooks.upload = () => f.replaceSource();
      await expect(publishPdf(f.args())).rejects.toThrow(
        "replaced before its Markdown was saved",
      );
      expect(f.writes).toEqual([]);
    },
  );

  it.each(kinds)(
    "reports a %s PDF replaced during the write and keeps the pair with the earlier PDF",
    async (kind) => {
      const f = fixture(kind);
      f.hooks.afterWrite = () => f.replaceSource();
      await expect(publishPdf(f.args())).rejects.toThrow(
        "belongs to the earlier PDF",
      );
      expect(generatedRows(f.document())).toHaveLength(2);
    },
  );

  it("propagates native write-access refusal and saves nothing", async () => {
    const f = fixture();
    const readonly: PdfPublisher = {
      ...f.reactor,
      execute: () =>
        Promise.reject(new Error("The reactor connection is read-only")),
    };
    await expect(
      publishPdf({ reactor: readonly, files: f.files, input: f.input }),
    ).rejects.toThrow("read-only");
  });

  it("reports the recorded denial when a write resolves without the pair", async () => {
    const f = fixture();
    let submitted: ConversionDocumentAction[] = [];
    const denying: PdfPublisher = {
      ...f.reactor,
      execute: (_documentId, _branch, actions) => {
        submitted = actions;
        return Promise.resolve(f.document());
      },
      getOperations: () =>
        Promise.resolve({
          results: submitted.map((action, index): Operation => ({
            id: `operation-${index}`,
            index: f.document().header.revision.global + index,
            skip: 0,
            timestampUtcMs: action.timestampUtcMs,
            hash: "",
            action,
            deniedReason: "The workflow's identity cannot write here",
          })),
        }),
    };
    await expect(
      publishPdf({ reactor: denying, files: f.files, input: f.input }),
    ).rejects.toThrow(
      /was not saved[\s\S]*The workflow's identity cannot write here/,
    );
  });

  it("propagates GraphQL errors instead of treating them as an empty source", async () => {
    const f = fixture();
    await expect(
      resolvePdf(
        {
          ...f.reactor,
          query: () =>
            Promise.resolve({
              data: null,
              errors: [{ message: "The source is not readable" }],
            }),
        },
        { request: {}, runId: "run", workflowId: "workflow" },
      ),
    ).rejects.toThrow("not readable");
  });

  it("refuses native source-read denial or an unexpected returned document", async () => {
    const f = fixture();
    const input = { request: {}, runId: "run", workflowId: "workflow" };
    await expect(
      resolvePdf(
        {
          ...f.reactor,
          get: () => Promise.reject(new Error("Source is not readable")),
        },
        input,
      ),
    ).rejects.toThrow("not readable");
    await expect(
      resolvePdf(
        {
          ...f.reactor,
          get: () =>
            Promise.resolve({
              header: { ...f.document().header, id: "other-document" },
            }),
        },
        input,
      ),
    ).rejects.toThrow("different source document");
  });

  it("rejects source and saved-result substitutions in prepared input", async () => {
    const f = fixture();
    expect(() =>
      readyPdfSchema.parse({ ...f.prepared, file: OTHER_PDF }),
    ).toThrow("pinned source");
    const published = await publishPdf(f.args());
    if (published.kind !== "published") throw new Error("Expected publication");
    expect(() =>
      readyPdfSchema.parse({
        ...f.prepared,
        reuse: { ...published.result, planFingerprint: "different-plan" },
      }),
    ).toThrow("another source or plan");
  });
});
