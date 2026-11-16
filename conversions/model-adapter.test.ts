import { createHash } from "node:crypto";
import type { PHDocument } from "document-model";
import { describe, expect, it, vi } from "vitest";
import {
  actions as fileActions,
  reducer as fileReducer,
  utils as fileUtils,
  type FileDocument,
} from "document-models/file";
import {
  actions as emailActions,
  reducer as emailReducer,
  utils as emailUtils,
  type EmailDocument,
} from "document-models/email";
import {
  attachmentRefSchema,
  conversionSettingsSchema,
  defaultConversionProfile,
  putConversionSettingsSchema,
  requestConversionSchema,
  type ArtifactDescriptor,
  type ResolvedConversionPlan,
  type ResolvedSource,
} from "./contracts.js";
import { planFingerprint } from "./engine/plan.js";
import { modelPreparationSchema } from "./models/contracts.js";
import {
  getCurrentConversionRendition,
  listConversionRenditions,
  planPublication,
  type PublicationInspection,
  type StoredPublication,
} from "./model-adapter.js";
import {
  PUBLICATION_MIME,
  encodePublication,
  parsePublicationRowId,
  publicationManifestSchema,
  publicationRowId,
  type PublicationManifest,
} from "./publication.js";
import {
  inspectPublications,
  type ReadPublicationArtifact,
} from "./read-publications.js";

const AT = "2026-11-10T12:00:00.000Z";
const LATER = "2026-11-10T13:00:00.000Z";
const bytesOf = (value: string) => new TextEncoder().encode(value);
const refOf = (bytes: Uint8Array) =>
  attachmentRefSchema.parse(
    `attachment://v1:${createHash("sha256").update(bytes).digest("hex")}`,
  );
const PDF = refOf(bytesOf("original PDF"));
const NEW_PDF = refOf(bytesOf("new PDF"));

function fileDocument(): FileDocument {
  return fileReducer(
    fileUtils.createDocument(),
    fileActions.setAttachmentSource({
      ref: PDF,
      fileName: "source.pdf",
      mimeType: "application/pdf",
      setAt: AT,
    }),
  );
}

function emailDocument(): EmailDocument {
  return emailReducer(
    emailUtils.createDocument(),
    emailActions.addAttachment({
      id: "received-pdf",
      ref: PDF,
      fileName: "source.pdf",
      mimeType: "application/pdf",
    }),
  );
}

function fileSource(document: FileDocument): ResolvedSource {
  return {
    kind: "file",
    documentId: document.header.id,
    scope: { kind: "files", driveId: "drive" },
    ref: PDF,
    fileName: "source.pdf",
    mimeType: "application/pdf",
    sizeBytes: null,
  };
}

function mailSource(document: EmailDocument): ResolvedSource {
  return {
    kind: "mail",
    documentId: document.header.id,
    attachmentId: "received-pdf",
    scope: { kind: "mail", driveId: "drive", account: "me@example.test" },
    ref: PDF,
    fileName: "source.pdf",
    mimeType: "application/pdf",
    sizeBytes: null,
  };
}

type V1Manifest = Extract<PublicationManifest, { version: 1 }>;
type Fixture<M extends PublicationManifest = PublicationManifest> =
  StoredPublication & {
    manifest: M;
    manifestBytes: Uint8Array;
    markdownBytes: Uint8Array;
  };

function fixture(
  source: ResolvedSource,
  options: { id?: string; at?: string; partial?: boolean } = {},
): Fixture<V1Manifest> {
  const unsigned: Omit<
    Extract<ResolvedConversionPlan, { contractVersion: 1 }>,
    "fingerprint"
  > = {
    contractVersion: 1,
    converterVersion: "0.3.0",
    reading: { kind: "digital", readerVersion: "6" },
    layout: { kind: "off" },
    pages: { kind: "all" },
    output: { kind: "markdown", pageMarkers: true },
  };
  const markdownBytes = bytesOf("# Converted PDF\n");
  const manifest: V1Manifest = {
    kind: "sektar-pdf-publication",
    version: 1,
    generationId: options.id ?? "generation",
    source,
    createdAt: options.at ?? AT,
    output: {
      kind: "docture-conversion-manifest",
      version: 1,
      sourceFileName: source.fileName,
      plan: { ...unsigned, fingerprint: planFingerprint(unsigned) },
      completeness: options.partial ? "partial" : "complete",
      documentPages: options.partial ? 2 : 1,
      pages: [
        { status: "read", page: 1, method: "digital", characters: 15 },
        ...(options.partial
          ? [{ status: "unresolved" as const, page: 2, reason: "Scanned page" }]
          : []),
      ],
      provenance: [
        { role: "digital", engine: "pdfjs", version: "6", model: null },
      ],
      warnings: options.partial
        ? [{ code: "SCAN", message: "Page 2 needs recognition", page: 2 }]
        : [],
      usage: {
        kind: "known",
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        aiPages: 0,
        costUsd: 0,
      },
      markdown: {
        id: "markdown",
        role: "markdown",
        ref: refOf(markdownBytes),
        fileName: "source.md",
        mimeType: "text/markdown",
        sizeBytes: markdownBytes.byteLength,
      },
    },
  };
  return encodedFixture(manifest, markdownBytes);
}

function encodedFixture<M extends PublicationManifest>(
  manifest: M,
  markdownBytes: Uint8Array,
): Fixture<M> {
  const manifestBytes = encodePublication(manifest);
  return {
    manifest,
    artifact: {
      id: "manifest",
      role: "manifest",
      ref: refOf(manifestBytes),
      fileName: "source.json",
      mimeType: PUBLICATION_MIME,
      sizeBytes: manifestBytes.byteLength,
    },
    manifestBytes,
    markdownBytes,
  };
}

function appendFile(
  document: FileDocument,
  publication: StoredPublication,
): FileDocument {
  const plan = planPublication({
    document,
    manifest: publication.manifest,
    manifestArtifact: publication.artifact,
  });
  expect(plan.kind).toBe("append");
  if (plan.kind !== "append") throw new Error("Expected publication actions");
  for (const action of plan.actions) {
    if (action.type !== "ADD_RENDITION")
      throw new Error("Expected a rendition");
    document = fileReducer(document, action);
    expect(document.operations.global.at(-1)?.error).toBeUndefined();
  }
  return document;
}

function appendMail(
  document: EmailDocument,
  publication: StoredPublication,
): EmailDocument {
  const plan = planPublication({
    document,
    manifest: publication.manifest,
    manifestArtifact: publication.artifact,
  });
  expect(plan.kind).toBe("append");
  if (plan.kind !== "append") throw new Error("Expected publication actions");
  for (const action of plan.actions) {
    if (action.type !== "ADD_ATTACHMENT")
      throw new Error("Expected an attachment");
    document = emailReducer(document, action);
    expect(document.operations.global.at(-1)?.error).toBeUndefined();
  }
  return document;
}

function readFixtures(...publications: Fixture[]): ReadPublicationArtifact {
  const files = new Map(
    publications.flatMap(
      (publication) =>
        [
          [publication.artifact.ref, publication.manifestBytes],
          [publication.manifest.output.markdown.ref, publication.markdownBytes],
        ] satisfies [string, Uint8Array][],
    ),
  );
  return ({ ref }) => {
    const bytes = files.get(ref);
    return bytes
      ? Promise.resolve(bytes)
      : Promise.reject(new Error("Unavailable"));
  };
}

function ready(publication: StoredPublication): PublicationInspection {
  return { kind: "ready", publication };
}

function publicationPlan(document: PHDocument, publication: StoredPublication) {
  return planPublication({
    document,
    manifest: publication.manifest,
    manifestArtifact: publication.artifact,
  });
}

describe("existing document publication rows", () => {
  it("still shows a saved conversion after someone relabels its Markdown", async () => {
    let document = fileDocument();
    const publication = fixture(fileSource(document));
    document = appendFile(document, publication);
    document = fileReducer(
      document,
      fileActions.updateRendition({
        id: publicationRowId("generation", "markdown"),
        label: "A friendly label",
      }),
    );
    expect(publicationPlan(document, publication)).toEqual({ kind: "present" });
    const inspections = await inspectPublications({
      document,
      read: readFixtures(publication),
    });
    expect(
      getCurrentConversionRendition(
        document,
        publication.manifest.source,
        inspections,
      ),
    ).toMatchObject({
      jobId: "generation",
      readPages: 1,
      publication: publication.manifest,
    });
  });

  it("shows a Mail conversion only for the PDF attachment it was made from", () => {
    let document = emailDocument();
    const publication = fixture(mailSource(document));
    document = appendMail(document, publication);
    const inspections = [ready(publication)];
    expect(
      getCurrentConversionRendition(
        document,
        publication.manifest.source,
        inspections,
      )?.jobId,
    ).toBe("generation");
    for (const source of [
      {
        kind: "mail" as const,
        documentId: document.header.id,
        attachmentId: "another",
      },
      { kind: "file" as const, documentId: document.header.id },
    ])
      expect(listConversionRenditions(document, source, inspections)).toEqual(
        [],
      );
  });

  it("stops showing a conversion once its Markdown row is removed", () => {
    let document = fileDocument();
    const publication = fixture(fileSource(document));
    document = appendFile(document, publication);
    document = fileReducer(
      document,
      fileActions.removeRendition({
        id: publicationRowId("generation", "markdown"),
      }),
    );
    expect(
      listConversionRenditions(document, publication.manifest.source, [
        ready(publication),
      ]),
    ).toEqual([]);
  });

  it("refuses a Mail conversion whose Markdown an ordinary attachment already holds under its name", () => {
    let mail = emailDocument();
    const publication = fixture(mailSource(mail));
    mail = emailReducer(
      mail,
      emailActions.addAttachment({
        id: "ordinary",
        ref: publication.manifest.output.markdown.ref,
        fileName: "pdf-conversion.generation.md",
      }),
    );
    expect(publicationPlan(mail, publication).kind).toBe("conflict");
  });

  it("can recreate both removed rows on native retry, without a history-based fence", () => {
    let document = fileDocument();
    const publication = fixture(fileSource(document));
    document = appendFile(document, publication);
    for (const role of ["markdown", "manifest"] as const)
      document = fileReducer(
        document,
        fileActions.removeRendition({
          id: publicationRowId("generation", role),
        }),
      );
    expect(publicationPlan(document, publication).kind).toBe("append");
  });
});

describe("current selection from latest source and rows", () => {
  it("keeps complete output selected ahead of newer partial or pending results and uses creation time then generation ID", () => {
    let document = fileDocument();
    const source = fileSource(document);
    const older = fixture(source, { id: "z-old" });
    const newer = fixture(source, { id: "a-new", at: LATER });
    const tied = fixture(source, { id: "b-new", at: LATER });
    const partial = fixture(source, {
      id: "partial",
      at: "2026-11-11T12:00:00.000Z",
      partial: true,
    });
    const unknown = fixture(source, { id: "unknown" });
    for (const entry of [tied, partial, older, newer, unknown])
      document = appendFile(document, entry);
    const inspections = [
      ready(partial),
      ready(older),
      ready(tied),
      ready(newer),
      { kind: "pending" as const, id: "unknown", reason: "Offline" },
    ];
    expect(
      getCurrentConversionRendition(document, source, inspections)?.jobId,
    ).toBe("b-new");
    expect(
      getCurrentConversionRendition(document, source, inspections.toReversed())
        ?.jobId,
    ).toBe("b-new");
  });

  it("does not select a partial while another candidate is pending or uninspected; malformed results settle independently", async () => {
    let document = fileDocument();
    const source = fileSource(document);
    const partial = fixture(source, { id: "partial", partial: true });
    const unknown = fixture(source, { id: "unknown" });
    document = appendFile(appendFile(document, partial), unknown);
    expect(
      getCurrentConversionRendition(document, source, [ready(partial)]),
    ).toBeUndefined();
    const read = readFixtures(partial, unknown);
    const pending = await inspectPublications({
      document,
      read: (input) =>
        input.ref === unknown.artifact.ref
          ? Promise.reject(new Error("Offline"))
          : read(input),
    });
    expect(pending.find((entry) => entry.kind === "pending")).toBeDefined();
    expect(
      getCurrentConversionRendition(document, source, pending),
    ).toBeUndefined();
    const invalid = await inspectPublications({
      document,
      read: (input) =>
        input.ref === unknown.artifact.ref
          ? Promise.resolve(bytesOf("bad"))
          : read(input),
    });
    expect(invalid.find((entry) => entry.kind === "unusable")).toBeDefined();
    expect(
      getCurrentConversionRendition(document, source, invalid)?.jobId,
    ).toBe("partial");
    document = fileReducer(
      document,
      fileActions.updateRendition({
        id: publicationRowId("unknown", "manifest"),
        type: "changed",
      }),
    );
    expect(
      getCurrentConversionRendition(document, source, invalid),
    ).toBeUndefined();
  });

  it("reprojects late metadata against a replaced or no-longer-PDF File source and a removed Email source", async () => {
    let document = fileDocument();
    const publication = fixture(fileSource(document));
    document = appendFile(document, publication);
    const download = Promise.withResolvers<void>();
    const read = readFixtures(publication);
    const inspecting = inspectPublications({
      document,
      read: async (input) => {
        await download.promise;
        return read(input);
      },
    });
    document = fileReducer(
      document,
      fileActions.setAttachmentSource({
        ref: NEW_PDF,
        fileName: "new.pdf",
        setAt: LATER,
      }),
    );
    download.resolve();
    const inspections = await inspecting;
    expect(
      getCurrentConversionRendition(
        document,
        publication.manifest.source,
        inspections,
      ),
    ).toBeUndefined();
    expect(
      listConversionRenditions(
        document,
        publication.manifest.source,
        inspections,
      )[0]?.stale,
    ).toBe(true);
    document = fileReducer(
      document,
      fileActions.setAttachmentSource({
        ref: PDF,
        fileName: "image.png",
        mimeType: "image/png",
        setAt: LATER,
      }),
    );
    expect(
      getCurrentConversionRendition(
        document,
        publication.manifest.source,
        inspections,
      ),
    ).toBeUndefined();
    let mail = emailDocument();
    const mailPublication = fixture(mailSource(mail));
    mail = appendMail(mail, mailPublication);
    mail = emailReducer(
      mail,
      emailActions.removeAttachment({ id: "received-pdf" }),
    );
    expect(
      getCurrentConversionRendition(mail, mailPublication.manifest.source, [
        ready(mailPublication),
      ]),
    ).toBeUndefined();
    expect(
      listConversionRenditions(mail, mailPublication.manifest.source, [
        ready(mailPublication),
      ])[0]?.stale,
    ).toBe(true);
  });
});

describe("stored artifact inspection", () => {
  it("returns immediately for ordinary rows and does not classify received Markdown or JSON by MIME", async () => {
    let document = emailDocument();
    for (const name of ["notes.md", "manifest.json"])
      document = emailReducer(
        document,
        emailActions.addAttachment({
          id: name,
          ref: PDF,
          fileName: name,
          mimeType: name.endsWith("md") ? "text/markdown" : PUBLICATION_MIME,
        }),
      );
    const read = vi.fn<ReadPublicationArtifact>();
    expect(await inspectPublications({ document, read })).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it("checks Markdown bytes too and recovers a transient read failure on the next inspection", async () => {
    let document = fileDocument();
    const publication = fixture(fileSource(document));
    document = appendFile(document, publication);
    const read = readFixtures(publication);
    const corrupted = await inspectPublications({
      document,
      read: (input) =>
        input.ref === publication.manifest.output.markdown.ref
          ? Promise.resolve(bytesOf("# Xonverted PDF\n"))
          : read(input),
    });
    expect(corrupted[0]?.kind).toBe("unusable");
    const failed = await inspectPublications({
      document,
      read: () =>
        Promise.reject(new DOMException("Read timed out", "AbortError")),
    });
    expect(failed[0]).toMatchObject({ kind: "pending" });
    expect((await inspectPublications({ document, read }))[0]?.kind).toBe(
      "ready",
    );
  });

  it.each([
    "malformed",
    "version",
    "fingerprint",
    "wrong-document",
    "wrong-generation",
  ] as const)(
    "rejects %s metadata with an otherwise valid content hash",
    async (problem) => {
      let document = fileDocument();
      const publication = fixture(fileSource(document));
      const altered = {
        ...publication.manifest,
        ...(problem === "version" ? { version: 2 } : {}),
        ...(problem === "wrong-generation" ? { generationId: "another" } : {}),
        source:
          problem === "wrong-document"
            ? { ...publication.manifest.source, documentId: "another" }
            : publication.manifest.source,
        output:
          problem === "fingerprint"
            ? {
                ...publication.manifest.output,
                plan: {
                  ...publication.manifest.output.plan,
                  converterVersion: "unexpected",
                },
              }
            : publication.manifest.output,
      };
      const manifestBytes = bytesOf(
        problem === "malformed" ? "{" : JSON.stringify(altered),
      );
      const artifact: ArtifactDescriptor = {
        ...publication.artifact,
        ref: refOf(manifestBytes),
        sizeBytes: manifestBytes.byteLength,
      };
      document = appendFile(document, { ...publication, artifact });
      const inspections = await inspectPublications({
        document,
        read: readFixtures({ ...publication, artifact, manifestBytes }),
      });
      expect(inspections[0]?.kind).toBe("unusable");
      expect(
        listConversionRenditions(
          document,
          publication.manifest.source,
          inspections,
        ),
      ).toEqual([]);
    },
  );

  it("refuses oversized metadata before downloading and honors cancellation", async () => {
    let document = fileDocument();
    const publication = fixture(fileSource(document));
    document = appendFile(document, {
      ...publication,
      artifact: { ...publication.artifact, sizeBytes: 3 * 1024 * 1024 },
    });
    const read = vi.fn<ReadPublicationArtifact>();
    expect((await inspectPublications({ document, read }))[0]?.kind).toBe(
      "unusable",
    );
    expect(read).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(
      inspectPublications({ document, read, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("publication boundary schemas", () => {
  it.each([1, 2] as const)(
    "keeps saved version %s Markdown readable without changing its plan",
    async (version) => {
      let document = fileDocument();
      const saved = fixture(fileSource(document));
      const unsigned =
        version === 1
          ? saved.manifest.output.plan
          : {
              ...saved.manifest.output.plan,
              contractVersion: 2 as const,
              renderer: { pdfjsVersion: "6", rasterizerVersion: "1" },
            };
      const plan = { ...unsigned, fingerprint: planFingerprint(unsigned) };
      const manifest = publicationManifestSchema.parse({
        ...saved.manifest,
        version,
        output: { ...saved.manifest.output, version, plan },
      });
      const publication = encodedFixture(manifest, saved.markdownBytes);
      document = appendFile(document, publication);
      const inspections = await inspectPublications({
        document,
        read: readFixtures(publication),
      });
      const current = getCurrentConversionRendition(
        document,
        manifest.source,
        inspections,
      );
      expect(current?.publication.output.plan).toEqual(plan);
      expect(current?.publication.version).toBe(version);
      expect(current?.completeness).toBe("complete");
      if (!current)
        throw new Error("Expected the saved Markdown to be readable");
      expect(encodePublication(current.publication)).toEqual(
        publication.manifestBytes,
      );
      expect(
        publicationManifestSchema.safeParse({
          ...manifest,
          version: version === 1 ? 2 : 1,
        }).success,
      ).toBe(false);
    },
  );

  it("accepts selected-page requests using the engine's sorted unique coverage", async () => {
    let document = fileDocument();
    const initial = fixture(fileSource(document));
    const plan = {
      ...initial.manifest.output.plan,
      pages: { kind: "selected" as const, pages: [3, 1, 3] },
    };
    const manifest: PublicationManifest = {
      ...initial.manifest,
      output: {
        ...initial.manifest.output,
        documentPages: 3,
        plan: { ...plan, fingerprint: planFingerprint(plan) },
        pages: [
          { status: "read", page: 1, method: "digital", characters: 15 },
          { status: "blank", page: 3, method: "digital" },
        ],
      },
    };
    const publication = encodedFixture(manifest, initial.markdownBytes);
    document = appendFile(document, publication);
    const inspections = await inspectPublications({
      document,
      read: readFixtures(publication),
    });
    expect(
      getCurrentConversionRendition(document, manifest.source, inspections),
    ).toMatchObject({ pageCount: 2, blankPages: 1, completeness: "complete" });
  });

  it("recognizes only exact namespaced row IDs and serializes the parsed schema deterministically", () => {
    expect(
      parsePublicationRowId(publicationRowId("run-123", "manifest")),
    ).toEqual({ generationId: "run-123", role: "manifest" });
    for (const id of [
      null,
      "",
      "source.md",
      "sektar-pdf:v2:run:markdown",
      "sektar-pdf:v1::markdown",
      "sektar-pdf:v1:a:b:markdown",
      "sektar-pdf:v1:run:markdown\n",
      "sektar-pdf:v1:run:asset",
    ])
      expect(parsePublicationRowId(id)).toBeNull();
    expect(() => publicationRowId("run:123", "markdown")).toThrow();
    const publication = fixture(fileSource(fileDocument()));
    const reordered = {
      output: publication.manifest.output,
      createdAt: publication.manifest.createdAt,
      source: publication.manifest.source,
      generationId: publication.manifest.generationId,
      version: publication.manifest.version,
      kind: publication.manifest.kind,
    };
    expect(encodePublication(reordered)).toEqual(publication.manifestBytes);
  });

  it("rejects duplicate, missing, out-of-range, mismatched coverage and swapped Markdown roles", () => {
    const manifest = fixture(fileSource(fileDocument())).manifest;
    const page = manifest.output.pages[0];
    for (const output of [
      { ...manifest.output, pages: [page, page] },
      { ...manifest.output, documentPages: 2 },
      { ...manifest.output, pages: [{ ...page, page: 2 }] },
      { ...manifest.output, completeness: "partial" },
      {
        ...manifest.output,
        markdown: { ...manifest.output.markdown, role: "asset" },
      },
      {
        ...manifest.output,
        plan: {
          ...manifest.output.plan,
          pages: { kind: "selected", pages: [2] },
        },
      },
    ])
      expect(
        publicationManifestSchema.safeParse({ ...manifest, output }).success,
      ).toBe(false);
    const partial = fixture(manifest.source, { partial: true }).manifest;
    expect(publicationManifestSchema.safeParse(partial).success).toBe(true);
    expect(
      publicationManifestSchema.safeParse({
        ...partial,
        output: { ...partial.output, completeness: "complete" },
      }).success,
    ).toBe(false);
  });

  it("preserves API validation for source variants, caller identities and settings saves", () => {
    expect(attachmentRefSchema.safeParse("attachment://v1:short").success).toBe(
      false,
    );
    expect(
      requestConversionSchema.parse({
        source: { kind: "file", documentId: "doc" },
      }).intent.kind,
    ).toBe("ensure");
    expect(
      requestConversionSchema.safeParse({
        source: { kind: "mail", documentId: "doc" },
      }).success,
    ).toBe(false);
    expect(
      requestConversionSchema.safeParse({
        source: { kind: "file", documentId: "doc" },
        actor: "admin",
      }).success,
    ).toBe(false);
    expect(
      putConversionSettingsSchema.safeParse({ authorizingIdentity: "admin" })
        .success,
    ).toBe(false);
  });

  it("still reads settings and scanner downloads saved with AI fields", () => {
    const saved = {
      activation: "manual",
      profile: { ...defaultConversionProfile, layout: { kind: "off" } },
      limits: {
        maxBytes: 1,
        maxPages: 1,
        maxDurationMs: 1,
        maxAiPages: 50,
        maxAiRequests: 120,
        automaticAiPagesPerDay: 0,
      },
    };
    const settings = conversionSettingsSchema.parse({
      ...saved,
      needsReview: false,
      revision: 1,
      authorizingIdentity: "host-default",
      updatedAt: "2026-11-10T09:00:00.000Z",
      automaticSince: null,
    });
    expect(settings.profile).toEqual(defaultConversionProfile);
    expect(settings.limits).toEqual({ maxBytes: 1, maxPages: 1, maxDurationMs: 1 });
    expect(
      modelPreparationSchema.safeParse({
        kind: "preparation",
        id: "preparation-1",
        intent: { kind: "settings", settings: { ...saved, expectedRevision: 0 } },
        progress: {
          phase: "failed",
          transferredBytes: 0,
          totalBytes: 1,
          readyFiles: 0,
          totalFiles: 1,
          file: null,
        },
        updatedAt: "2026-11-10T09:00:00.000Z",
        error: { code: "interrupted", message: "Retry.", retryable: true },
        result: null,
      }).success,
    ).toBe(true);
  });

  it("refuses a settings save that asks for AI reading, AI layout or AI limits", () => {
    const save = {
      activation: "manual",
      profile: defaultConversionProfile,
      limits: { maxBytes: 1, maxPages: 1, maxDurationMs: 1 },
      expectedRevision: 0,
    };
    expect(putConversionSettingsSchema.safeParse(save).success).toBe(true);
    for (const asked of [
      {
        profile: {
          ...defaultConversionProfile,
          reading: {
            kind: "smart",
            fallback: { kind: "ai", model: "integrated" },
          },
        },
      },
      {
        profile: {
          ...defaultConversionProfile,
          layout: { kind: "ai", model: "integrated" },
        },
      },
      { limits: { ...save.limits, maxAiPages: 1 } },
    ]) {
      expect(
        putConversionSettingsSchema.safeParse({ ...save, ...asked }).success,
      ).toBe(false);
    }
  });
});
