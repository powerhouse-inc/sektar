import { z } from "zod";
import { resolvedConversionPlanV1Schema } from "./publication/v1.js";
import { resolvedConversionPlanV2Schema } from "./publication/v2.js";

export const conversionApiPrefix = "/conversion";
export const conversionContractVersion = 1;
export const APP_CONVERSION_KEY = "app";
export const APP_CONVERSION_RESOURCE = "sektar/conversion:app";

const identifier = z.string().trim().min(1).max(512);
const timestamp = z.iso.datetime({ offset: true });
export const attachmentRefSchema = z.templateLiteral([
  "attachment://v1:",
  z.string().regex(/^[a-f0-9]{64}$/),
]);
export type ConversionAttachmentRef = z.infer<typeof attachmentRefSchema>;

export const conversionScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("files"), driveId: identifier }),
  z.object({
    kind: z.literal("mail"),
    driveId: identifier,
    account: identifier,
  }),
]);
export type ConversionScope = z.infer<typeof conversionScopeSchema>;

export const sourceSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("file"),
    documentId: identifier,
    expectedRef: attachmentRefSchema.optional(),
  }),
  z.object({
    kind: z.literal("mail"),
    documentId: identifier,
    attachmentId: identifier,
    expectedRef: attachmentRefSchema.optional(),
  }),
]);
export type SourceSelection = z.infer<typeof sourceSelectionSchema>;

const resolvedSourceFields = {
  documentId: identifier,
  scope: conversionScopeSchema,
  ref: attachmentRefSchema,
  fileName: z.string().min(1),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().nonnegative().nullable(),
};
export const resolvedSourceSchema = z.discriminatedUnion("kind", [
  z.object({ ...resolvedSourceFields, kind: z.literal("file") }),
  z.object({
    ...resolvedSourceFields,
    kind: z.literal("mail"),
    attachmentId: identifier,
  }),
]);
export type ResolvedSource = z.infer<typeof resolvedSourceSchema>;

export const localOcrEngineSchema = z.enum(["tesseract", "paddleocr"]);
export type LocalOcrEngine = z.infer<typeof localOcrEngineSchema>;
export const ocrSelectionSchema = z.object({
  kind: z.literal("ocr"),
  engine: localOcrEngineSchema,
  languages: z.array(z.string().min(1).max(32)).min(1).max(16),
  model: z.string().min(1).optional(),
});
export const recognitionSelectionSchema = z.discriminatedUnion("kind", [
  ocrSelectionSchema,
  z.object({ kind: z.literal("ai"), model: z.literal("integrated") }),
]);
export type RecognitionSelection = z.infer<typeof recognitionSelectionSchema>;
export const readingProfileSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("digital") }),
  z.object({ kind: z.literal("smart"), fallback: recognitionSelectionSchema }),
  z.object({
    kind: z.literal("recognize"),
    engine: recognitionSelectionSchema,
  }),
]);
export const conversionProfileSchema = z.object({
  reading: readingProfileSchema,
  layout: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("off") }),
    z.object({ kind: z.literal("ai"), model: z.literal("integrated") }),
  ]),
  pages: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("all") }),
    z.object({
      kind: z.literal("selected"),
      pages: z.array(z.number().int().positive()).min(1).max(10000),
    }),
  ]),
});
export type ReadingProfile = z.infer<typeof readingProfileSchema>;
export type ConversionProfile = z.infer<typeof conversionProfileSchema>;
export const defaultConversionProfile: ConversionProfile = {
  reading: {
    kind: "smart",
    fallback: { kind: "ocr", engine: "tesseract", languages: ["eng"] },
  },
  layout: { kind: "off" },
  pages: { kind: "all" },
};

export const resolvedModelSchema = z.object({
  provider: identifier,
  modelId: identifier,
  configurationRevision: identifier,
});
export type ResolvedModel = z.infer<typeof resolvedModelSchema>;
export const resolvedRecognitionSchema = z.discriminatedUnion("kind", [
  ocrSelectionSchema.extend({
    version: identifier,
    languageVersions: z.record(z.string(), z.string()),
  }),
  z.object({
    kind: z.literal("ai"),
    model: resolvedModelSchema,
    promptVersion: identifier,
  }),
]);
export const resolvedReadingPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("digital"), readerVersion: identifier }),
  z.object({
    kind: z.literal("smart"),
    readerVersion: identifier,
    fallback: resolvedRecognitionSchema,
  }),
  z.object({ kind: z.literal("recognize"), engine: resolvedRecognitionSchema }),
]);
export const executableConversionPlanSchema = resolvedConversionPlanV2Schema;
export type ExecutableConversionPlan = z.infer<
  typeof executableConversionPlanSchema
>;
export const resolvedConversionPlanSchema = z.discriminatedUnion(
  "contractVersion",
  [resolvedConversionPlanV1Schema, resolvedConversionPlanV2Schema],
);
export type ResolvedRecognition = z.infer<typeof resolvedRecognitionSchema>;
export type ResolvedReadingPlan = z.infer<typeof resolvedReadingPlanSchema>;
export type ResolvedConversionPlan = z.infer<
  typeof resolvedConversionPlanSchema
>;

export const conversionLimitsSchema = z.object({
  maxBytes: z.number().int().positive(),
  maxPages: z.number().int().positive(),
  maxAiPages: z.number().int().nonnegative(),
  maxAiRequests: z.number().int().nonnegative(),
  automaticAiPagesPerDay: z.number().int().nonnegative(),
  maxDurationMs: z.number().int().positive(),
});
export type ConversionLimits = z.infer<typeof conversionLimitsSchema>;
export const conversionActivationSchema = z.enum([
  "off",
  "manual",
  "automatic",
]);
export const conversionSettingsSchema = z.object({
  needsReview: z.boolean(),
  revision: z.number().int().nonnegative(),
  activation: conversionActivationSchema,
  profile: conversionProfileSchema,
  limits: conversionLimitsSchema,
  authorizingIdentity: identifier,
  updatedAt: timestamp,
  automaticSince: timestamp.nullable(),
});
export type ConversionSettings = z.infer<typeof conversionSettingsSchema>;
export const putConversionSettingsSchema = conversionSettingsSchema
  .pick({ activation: true, profile: true, limits: true })
  .extend({
    expectedRevision: z.number().int().nonnegative(),
    requestId: z.string().min(1).max(512).optional(),
    workflowGrant: z.string().min(1).max(65536).optional(),
  })
  .strict();
export type PutConversionSettings = z.infer<typeof putConversionSettingsSchema>;
export const renewConversionAccessSchema = putConversionSettingsSchema.pick({
  expectedRevision: true,
  workflowGrant: true,
});
export type RenewConversionAccess = z.infer<typeof renewConversionAccessSchema>;

const engineAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), version: identifier }),
  z.object({
    status: z.literal("unavailable"),
    reason: z.string().min(1),
    setup: z.string().min(1),
    /** Package and platform specifics for support; never the main text. */
    detail: z.string().min(1).optional(),
  }),
]);
export const conversionCapabilitiesSchema = z.object({
  contractVersion: z.literal(1),
  execution: z
    .object({
      kind: z.literal("workflow"),
      runningCancellation: z.literal(false),
      pageProgress: z.literal(false),
      maxFileBytes: z.number().int().positive().optional(),
    })
    .optional(),
  digital: engineAvailabilitySchema,
  ocr: z.array(
    z.object({
      id: localOcrEngineSchema,
      label: z.string(),
      availability: engineAvailabilitySchema,
      languages: z.array(z.string()),
      models: z.array(z.string()),
    }),
  ),
  ai: z.object({
    availability: engineAvailabilitySchema,
    model: resolvedModelSchema.nullable(),
  }),
  layout: z.object({ availability: engineAvailabilitySchema }),
  limits: conversionLimitsSchema,
});
export type ConversionCapabilities = z.infer<
  typeof conversionCapabilitiesSchema
>;

export const conversionWarningSchema = z.object({
  code: identifier,
  message: z.string().min(1),
  page: z.number().int().positive().optional(),
});
export type ConversionWarning = z.infer<typeof conversionWarningSchema>;
export const pageOutcomeSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("read"),
    page: z.number().int().positive(),
    method: z.enum(["digital", "ocr", "ai"]),
    characters: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("blank"),
    page: z.number().int().positive(),
    method: z.enum(["digital", "ocr", "ai"]),
  }),
  z.object({
    status: z.literal("unresolved"),
    page: z.number().int().positive(),
    reason: z.string().min(1),
  }),
  z.object({
    status: z.literal("failed"),
    page: z.number().int().positive(),
    reason: z.string().min(1),
  }),
]);
export type PageOutcome = z.infer<typeof pageOutcomeSchema>;
export const conversionUsageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
    aiPages: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().nullable(),
  }),
  z.object({
    kind: z.literal("unknown"),
    requests: z.number().int().nonnegative(),
    aiPages: z.number().int().nonnegative(),
    reason: z.string().min(1),
  }),
]);
export type ConversionUsage = z.infer<typeof conversionUsageSchema>;
export const engineProvenanceSchema = z.object({
  role: z.enum(["digital", "ocr", "transcription", "layout"]),
  engine: identifier,
  version: identifier,
  model: z.string().nullable(),
});
export type EngineProvenance = z.infer<typeof engineProvenanceSchema>;
export const conversionCompletenessSchema = z.enum(["complete", "partial"]);
export type ConversionCompleteness = z.infer<
  typeof conversionCompletenessSchema
>;

export const artifactDescriptorSchema = z.object({
  id: identifier,
  role: z.enum(["markdown", "manifest", "asset"]),
  ref: attachmentRefSchema,
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});
export type ArtifactDescriptor = z.infer<typeof artifactDescriptorSchema>;
export const conversionResultSchema = z.object({
  jobId: identifier,
  renditionId: identifier,
  source: resolvedSourceSchema,
  planFingerprint: identifier,
  createdAt: timestamp,
  completeness: conversionCompletenessSchema,
  markdown: artifactDescriptorSchema,
  artifacts: z.array(artifactDescriptorSchema),
  pages: z.array(pageOutcomeSchema).min(1),
  warnings: z.array(conversionWarningSchema),
  provenance: z.array(engineProvenanceSchema),
  usage: conversionUsageSchema,
});
export type ConversionResult = z.infer<typeof conversionResultSchema>;
export const conversionResultResponseSchema = z.object({
  result: conversionResultSchema,
  markdown: z.string(),
});
export type ConversionResultResponse = z.infer<
  typeof conversionResultResponseSchema
>;

export const conversionProgressSchema = z.object({
  stage: z.enum([
    "waiting-for-bytes",
    "preflight",
    "reading",
    "rendering",
    "recognizing",
    "layout",
    "staging",
    "uploading",
    "finalizing",
  ]),
  completedPages: z.number().int().nonnegative().nullable(),
  totalPages: z.number().int().positive().nullable(),
});
export type ConversionProgress = z.infer<typeof conversionProgressSchema>;
export const conversionProblemSchema = z.object({
  code: identifier,
  message: z.string().min(1),
  retryable: z.boolean(),
  detail: z.string().min(1).optional(),
});
export type ConversionProblem = z.infer<typeof conversionProblemSchema>;
const jobFields = {
  id: identifier,
  workflowId: identifier.optional(),
  cancellable: z.boolean().optional(),
  source: resolvedSourceSchema,
  profile: conversionProfileSchema,
  plan: resolvedConversionPlanSchema,
  trigger: z.enum(["manual", "automatic", "workflow", "batch"]),
  createdAt: timestamp,
  updatedAt: timestamp,
  warnings: z.array(conversionWarningSchema),
};
export const conversionJobViewSchema = z.discriminatedUnion("status", [
  z.object({
    ...jobFields,
    status: z.literal("waiting-for-bytes"),
    progress: conversionProgressSchema,
  }),
  z.object({ ...jobFields, status: z.literal("queued") }),
  z.object({
    ...jobFields,
    status: z.literal("running"),
    progress: conversionProgressSchema,
  }),
  z.object({
    ...jobFields,
    status: z.literal("publishing"),
    progress: conversionProgressSchema,
  }),
  z.object({
    ...jobFields,
    status: z.literal("complete"),
    result: conversionResultSchema,
  }),
  z.object({
    ...jobFields,
    status: z.literal("partial"),
    result: conversionResultSchema,
  }),
  z.object({
    ...jobFields,
    status: z.literal("failed"),
    error: conversionProblemSchema,
  }),
  z.object({
    ...jobFields,
    status: z.literal("needs-attention"),
    error: conversionProblemSchema,
  }),
  z.object({
    ...jobFields,
    status: z.literal("cancelled"),
    reason: z.string(),
  }),
]);
export type ConversionJobView = z.infer<typeof conversionJobViewSchema>;
export type ConversionJobStatus = ConversionJobView["status"];
export const conversionJobsResponseSchema = z.object({
  jobs: z.array(conversionJobViewSchema),
});
export const requestConversionSchema = z
  .object({
    source: sourceSelectionSchema,
    profile: conversionProfileSchema.optional(),
    intent: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("ensure") }),
        z.object({ kind: z.literal("regenerate"), requestId: identifier }),
      ])
      .default({ kind: "ensure" }),
    executionKey: identifier.optional(),
  })
  .strict();
export type RequestConversion = z.infer<typeof requestConversionSchema>;

export const previewConversionBatchSchema = z
  .object({
    scope: conversionScopeSchema,
    limit: z.number().int().positive().max(90),
    profile: conversionProfileSchema.optional(),
  })
  .strict();
export type PreviewConversionBatch = z.infer<
  typeof previewConversionBatchSchema
>;
export const conversionBatchPreviewSchema = z.object({
  id: identifier,
  scope: conversionScopeSchema,
  expiresAt: timestamp,
  candidates: z.array(resolvedSourceSchema),
  scanned: z.number().int().nonnegative(),
  truncated: z.boolean(),
  warnings: z.array(conversionWarningSchema),
});
export type ConversionBatchPreview = z.infer<
  typeof conversionBatchPreviewSchema
>;
export const requestConversionBatchSchema = z
  .object({
    previewId: identifier,
    requestId: identifier,
  })
  .strict();
export type RequestConversionBatch = z.infer<
  typeof requestConversionBatchSchema
>;
export const conversionBatchSchema = z.object({
  id: identifier,
  scope: conversionScopeSchema,
  status: z.enum(["running", "complete", "cancelled"]),
  jobIds: z.array(identifier),
  createdAt: timestamp,
});
export type ConversionBatch = z.infer<typeof conversionBatchSchema>;

export function isFinalizedConversion(
  job: ConversionJobView,
): job is Extract<ConversionJobView, { status: "complete" | "partial" }> {
  return job.status === "complete" || job.status === "partial";
}

export function isTerminalConversion(job: ConversionJobView): boolean {
  return (
    isFinalizedConversion(job) ||
    job.status === "failed" ||
    job.status === "needs-attention" ||
    job.status === "cancelled"
  );
}
