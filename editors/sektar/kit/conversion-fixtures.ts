// Contract-shaped values for tests of the conversion client, forms, views and
// the Docture workflow step: each is valid against conversions/contracts.ts,
// so a test states only what it is about.
import { createHash } from "node:crypto";
import {
  actions as fileActions,
  reducer as fileReducer,
  utils as fileUtils,
  type FileDocument,
} from "document-models/file";
import {
  defaultConversionProfile,
  type ConversionAttachmentRef,
  type ConversionCapabilities,
  type ConversionJobView,
  type ConversionLimits,
  type ConversionSettings,
  type ConversionProblem,
  type ConversionProgress,
  type ConversionResult,
  type ConversionScope,
  type PageOutcome,
  type ResolvedConversionPlan,
  type ResolvedSource,
} from "../../../conversions/contracts.js";
import {
  planPublication,
  type ConversionRenditionView,
} from "../../../conversions/model-adapter.js";
import { attachmentRefSchema } from "../../../conversions/contracts.js";
import {
  canonicalPublicationJson,
  encodePublication,
  publicationManifestSchema,
  publicationRowId,
  PUBLICATION_MIME,
} from "../../../conversions/publication.js";

/** A stored reference from a few hex digits. */
export const ref = (hex: string): ConversionAttachmentRef =>
  `attachment://v1:${hex.padEnd(64, "0")}`;

export const FILES_SCOPE: ConversionScope = {
  kind: "files",
  driveId: "drive-files",
};
export const MAIL_SCOPE: ConversionScope = {
  kind: "mail",
  driveId: "drive-mail",
  account: "ada@example.com",
};

export const FILE_SOURCE: Extract<ResolvedSource, { kind: "file" }> = {
  kind: "file",
  documentId: "file-1",
  scope: FILES_SCOPE,
  ref: ref("a1"),
  fileName: "invoice.pdf",
  mimeType: "application/pdf",
  sizeBytes: 248_000,
};

export const MAIL_SOURCE: Extract<ResolvedSource, { kind: "mail" }> = {
  kind: "mail",
  documentId: "email-1",
  attachmentId: "att-1",
  scope: MAIL_SCOPE,
  ref: ref("b2"),
  fileName: "statement.pdf",
  mimeType: "application/pdf",
  sizeBytes: 91_000,
};

export const PLAN: ResolvedConversionPlan = {
  contractVersion: 1,
  converterVersion: "docture-0.3.0",
  fingerprint: "plan-smart-tesseract",
  reading: {
    kind: "smart",
    readerVersion: "pdfjs-dist@6.4.299",
    fallback: {
      kind: "ocr",
      engine: "tesseract",
      languages: ["eng"],
      version: "tesseract.js@7.0.0+core@7.0.0",
      languageVersions: { eng: "1.0.0" },
    },
  },
  layout: { kind: "off" },
  pages: { kind: "all" },
  output: { kind: "markdown", pageMarkers: true },
};
PLAN.fingerprint = createHash("sha256")
  .update(canonicalPublicationJson({ ...PLAN, fingerprint: undefined }))
  .digest("hex");

export const HOST_LIMITS: ConversionLimits = {
  maxBytes: 200 * 1024 * 1024,
  maxPages: 2000,
  maxAiPages: 500,
  maxAiRequests: 1000,
  automaticAiPagesPerDay: 5000,
  maxDurationMs: 2 * 60 * 60 * 1000,
};

const AVAILABLE = (version: string) =>
  ({ status: "available", version }) as const;

/** A host with PDF.js, Tesseract (eng, spa) and the integrated model; PaddleOCR needs setup. */
export function capabilities(
  over: Partial<ConversionCapabilities> = {},
): ConversionCapabilities {
  return {
    contractVersion: 1,
    digital: AVAILABLE("pdfjs-dist@6.4.299"),
    ocr: [
      {
        id: "tesseract",
        label: "Tesseract",
        availability: AVAILABLE("tesseract.js@7.0.0+core@7.0.0"),
        languages: ["eng", "spa"],
        models: [],
      },
      {
        id: "paddleocr",
        label: "PaddleOCR",
        availability: {
          status: "unavailable",
          reason: "PaddleOCR is not installed on this host.",
          setup: "Reinstall Sektar's dependencies.",
        },
        languages: [],
        models: [],
      },
    ],
    ai: {
      availability: AVAILABLE("openrouter/qwen3.8-max-prime"),
      model: {
        provider: "openrouter",
        modelId: "qwen/qwen3.8-max-prime",
        configurationRevision: "rev-7",
      },
    },
    layout: { availability: AVAILABLE("openrouter/qwen3.8-max-prime") },
    limits: HOST_LIMITS,
    ...over,
  };
}

export function settings(
  over: Partial<ConversionSettings> = {},
): ConversionSettings {
  return {
    needsReview: false,
    revision: 3,
    activation: "manual",
    profile: defaultConversionProfile,
    limits: {
      ...HOST_LIMITS,
      maxAiPages: 25,
      maxAiRequests: 50,
      automaticAiPagesPerDay: 0,
    },
    authorizingIdentity: "0xabc0000000000000000000000000000000000def",
    updatedAt: "2026-11-10T09:00:00.000Z",
    automaticSince: null,
    ...over,
  };
}

/** `count` pages read from their text layer, except the ones named unread. */
export function pages(
  count: number,
  unread: readonly number[] = [],
): PageOutcome[] {
  return Array.from({ length: count }, (_, index): PageOutcome => {
    const page = index + 1;
    return unread.includes(page)
      ? { status: "unresolved", page, reason: "The page has no text layer." }
      : { status: "read", page, method: "digital", characters: 1200 };
  });
}

export function result(over: Partial<ConversionResult> = {}): ConversionResult {
  const source = over.source ?? FILE_SOURCE;
  return {
    jobId: "job-1",
    renditionId: publicationRowId(over.jobId ?? "job-1", "markdown"),
    source,
    planFingerprint: PLAN.fingerprint,
    createdAt: "2026-11-10T09:44:00.000Z",
    completeness: "complete",
    markdown: {
      id: "artifact-md",
      role: "markdown",
      ref: ref("c3"),
      fileName: "invoice.md",
      mimeType: "text/markdown",
      sizeBytes: 1234,
    },
    artifacts: [],
    pages: pages(3),
    warnings: [],
    provenance: [
      {
        role: "digital",
        engine: "pdfjs",
        version: "pdfjs-dist@6.4.299",
        model: null,
      },
    ],
    usage: {
      kind: "known",
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
      aiPages: 0,
      costUsd: 0,
    },
    ...over,
  };
}

type JobBase = Pick<
  ConversionJobView,
  | "id"
  | "source"
  | "profile"
  | "plan"
  | "trigger"
  | "createdAt"
  | "updatedAt"
  | "warnings"
>;

function base(over: Partial<JobBase>): JobBase {
  return {
    id: "job-1",
    source: FILE_SOURCE,
    profile: defaultConversionProfile,
    plan: PLAN,
    trigger: "manual",
    createdAt: "2026-11-10T09:43:00.000Z",
    updatedAt: "2026-11-10T09:43:05.000Z",
    warnings: [],
    ...over,
  };
}

export const queuedJob = (over: Partial<JobBase> = {}): ConversionJobView => ({
  ...base(over),
  status: "queued",
});

export const waitingJob = (over: Partial<JobBase> = {}): ConversionJobView => ({
  ...base(over),
  status: "waiting-for-bytes",
  progress: {
    stage: "waiting-for-bytes",
    completedPages: null,
    totalPages: null,
  },
});

export const runningJob = (
  progress: ConversionProgress = {
    stage: "recognizing",
    completedPages: 3,
    totalPages: 12,
  },
  over: Partial<JobBase> = {},
): ConversionJobView => ({ ...base(over), status: "running", progress });

export const publishingJob = (
  over: Partial<JobBase> = {},
): ConversionJobView => ({
  ...base(over),
  status: "publishing",
  progress: { stage: "uploading", completedPages: null, totalPages: null },
});

export const completeJob = (
  over: Partial<JobBase> = {},
  outcome: Partial<ConversionResult> = {},
): ConversionJobView => {
  const fields = base(over);
  return {
    ...fields,
    status: "complete",
    result: result({ jobId: fields.id, source: fields.source, ...outcome }),
  };
};

export const partialJob = (
  unread: readonly number[] = [3],
  over: Partial<JobBase> = {},
  outcome: Partial<ConversionResult> = {},
): ConversionJobView => {
  const fields = base(over);
  return {
    ...fields,
    status: "partial",
    result: result({
      jobId: fields.id,
      source: fields.source,
      completeness: "partial",
      pages: pages(3, unread),
      ...outcome,
    }),
  };
};

const PROBLEM: ConversionProblem = {
  code: "encrypted",
  message: "This PDF is password protected.",
  retryable: false,
};

export const failedJob = (
  error: ConversionProblem = PROBLEM,
  over: Partial<JobBase> = {},
): ConversionJobView => ({ ...base(over), status: "failed", error });

export const needsAttentionJob = (
  error: ConversionProblem = {
    code: "ai-outcome-unknown",
    message:
      "A model request was sent and its outcome is unknown. It may have been charged.",
    retryable: false,
  },
  over: Partial<JobBase> = {},
): ConversionJobView => ({ ...base(over), status: "needs-attention", error });

export const cancelledJob = (
  reason = "Cancelled by 0xabc.",
  over: Partial<JobBase> = {},
): ConversionJobView => ({ ...base(over), status: "cancelled", reason });

/** A job as the host answers it for a workflow run, which says whether it can be cancelled. */
export const workflowRun = (
  job: ConversionJobView,
  cancellable: boolean,
): ConversionJobView => ({ ...job, workflowId: "workflow-1", cancellable });

/** A finished conversion as its document lists it (conversions/model-adapter.ts). */
export function renditionView(
  over: Partial<ConversionRenditionView> = {},
): ConversionRenditionView {
  const pageCount = over.pageCount ?? 3;
  const unreadCount =
    (over.unresolvedPages ?? 0) + (over.failedPages ?? 0) ||
    (over.completeness === "partial" ? 1 : 0);
  const outcomes = pages(
    pageCount,
    Array.from({ length: unreadCount }, (_, index) => pageCount - index),
  );
  return {
    id: publicationRowId("job-1", "markdown"),
    jobId: "job-1",
    status: "ready",
    completeness: "complete",
    sourceRef: FILE_SOURCE.ref,
    ref: ref("c3"),
    manifestRef: ref("d4"),
    fileName: "invoice.md",
    sizeBytes: 1234,
    createdAt: "2026-11-10T09:44:00.000Z",
    planFingerprint: PLAN.fingerprint,
    pageCount,
    readPages: pageCount - unreadCount,
    blankPages: 0,
    unresolvedPages: unreadCount,
    failedPages: 0,
    warnings: [],
    methods: ["digital:pdfjs@pdfjs-dist@6.4.299"],
    model: null,
    stale: false,
    current: true,
    publication: publicationManifestSchema.parse({
      kind: "sektar-pdf-publication",
      version: 1,
      generationId: over.jobId ?? "job-1",
      source: FILE_SOURCE,
      createdAt: over.createdAt ?? "2026-11-10T09:44:00.000Z",
      output: {
        ...result({
          completeness: over.completeness ?? "complete",
          pages: outcomes,
        }),
        plan: PLAN,
        kind: "docture-conversion-manifest",
        version: 1,
        sourceFileName: FILE_SOURCE.fileName,
        documentPages: pageCount,
      },
    }),
    ...over,
  };
}

/* -------------------------------------------------------------- documents */

/** A File whose source is a stored PDF (the one of `FILE_SOURCE`). */
export function pdfFile(): FileDocument {
  return fileReducer(
    fileUtils.createDocument(),
    fileActions.setAttachmentSource({
      ref: FILE_SOURCE.ref,
      fileName: "invoice.pdf",
      mimeType: "application/pdf",
      sizeBytes: 248_000,
      setAt: "2026-11-10T12:00:00.000Z",
    }),
  );
}

export const storedConversionBytes = new Map<string, Uint8Array>();

export function publicationFixture(
  outcome: ConversionResult,
  text = "# Converted\n",
) {
  const markdownBytes = new TextEncoder().encode(text);
  const markdown = {
    ...outcome.markdown,
    ref: attachmentRefSchema.parse(
      `attachment://v1:${createHash("sha256").update(markdownBytes).digest("hex")}`,
    ),
    sizeBytes: markdownBytes.length,
  };
  storedConversionBytes.set(markdown.ref, markdownBytes);
  const manifest = publicationManifestSchema.parse({
    kind: "sektar-pdf-publication",
    version: 1,
    generationId: outcome.jobId,
    source: outcome.source,
    createdAt: outcome.createdAt,
    output: {
      ...outcome,
      markdown,
      plan: PLAN,
      kind: "docture-conversion-manifest",
      version: 1,
      sourceFileName: outcome.source.fileName,
      documentPages: outcome.pages.length,
    },
  });
  const bytes = encodePublication(manifest);
  const artifact = {
    id: publicationRowId(outcome.jobId, "manifest"),
    role: "manifest" as const,
    ref: attachmentRefSchema.parse(
      `attachment://v1:${createHash("sha256").update(bytes).digest("hex")}`,
    ),
    fileName: `pdf-conversion.${outcome.jobId}.json`,
    mimeType: PUBLICATION_MIME,
    sizeBytes: bytes.length,
  };
  storedConversionBytes.set(artifact.ref, bytes);
  return { manifest, artifact };
}

/** A saved pair, or a pair whose manifest was removed by another writer. */
export function converted(
  doc: FileDocument,
  finalized: boolean,
  over: Partial<ConversionResult> = {},
): FileDocument {
  const source = { ...FILE_SOURCE, documentId: doc.header.id };
  const outcome = result({ source, ...over });
  const { manifest, artifact } = publicationFixture(outcome);
  const planned = planPublication({
    document: doc,
    manifest,
    manifestArtifact: artifact,
  });
  if (planned.kind !== "append")
    throw new Error("Expected new fixture publication");
  let next = doc;
  for (const action of planned.actions) {
    if (action.type !== "ADD_RENDITION")
      throw new Error("Expected a File rendition");
    if (finalized || action.input.mimeType === "text/markdown")
      next = fileReducer(next, action);
  }
  return next;
}
