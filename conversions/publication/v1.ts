// Frozen publication format. Changes to execution contracts must not change V1 readers.
import { z } from "zod";
const identifier = z.string().trim().min(1).max(512);

const attachmentRefSchema = z.templateLiteral([
  "attachment://v1:",
  z.string().regex(/^[a-f0-9]{64}$/),
]);

const conversionScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("files"), driveId: identifier }),
  z.object({
    kind: z.literal("mail"),
    driveId: identifier,
    account: identifier,
  }),
]);

const resolvedSourceFields = {
  documentId: identifier,
  scope: conversionScopeSchema,
  ref: attachmentRefSchema,
  fileName: z.string().min(1),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().nonnegative().nullable(),
};

const resolvedSourceSchema = z.discriminatedUnion("kind", [
  z.object({ ...resolvedSourceFields, kind: z.literal("file") }),
  z.object({
    ...resolvedSourceFields,
    kind: z.literal("mail"),
    attachmentId: identifier,
  }),
]);

const localOcrEngineSchema = z.enum(["tesseract", "paddleocr"]);

const ocrSelectionSchema = z.object({
  kind: z.literal("ocr"),
  engine: localOcrEngineSchema,
  languages: z.array(z.string().min(1).max(32)).min(1).max(16),
  model: z.string().min(1).optional(),
});

const resolvedModelSchema = z.object({
  provider: identifier,
  modelId: identifier,
  configurationRevision: identifier,
});

const resolvedRecognitionSchema = z.discriminatedUnion("kind", [
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

const resolvedReadingPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("digital"), readerVersion: identifier }),
  z.object({
    kind: z.literal("smart"),
    readerVersion: identifier,
    fallback: resolvedRecognitionSchema,
  }),
  z.object({ kind: z.literal("recognize"), engine: resolvedRecognitionSchema }),
]);

const resolvedConversionPlanSchema = z.object({
  contractVersion: z.literal(1),
  converterVersion: identifier,
  fingerprint: identifier,
  reading: resolvedReadingPlanSchema,
  layout: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("off") }),
    z.object({
      kind: z.literal("ai"),
      model: resolvedModelSchema,
      promptVersion: identifier,
    }),
  ]),
  pages: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("all") }),
    z.object({
      kind: z.literal("selected"),
      pages: z.array(z.number().int().positive()).min(1).max(10000),
    }),
  ]),
  output: z.object({ kind: z.literal("markdown"), pageMarkers: z.boolean() }),
});

const conversionWarningSchema = z.object({
  code: identifier,
  message: z.string().min(1),
  page: z.number().int().positive().optional(),
});

const pageOutcomeSchema = z.discriminatedUnion("status", [
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

const conversionUsageSchema = z.discriminatedUnion("kind", [
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

const engineProvenanceSchema = z.object({
  role: z.enum(["digital", "ocr", "transcription", "layout"]),
  engine: identifier,
  version: identifier,
  model: z.string().nullable(),
});

const conversionCompletenessSchema = z.enum(["complete", "partial"]);

const artifactDescriptorSchema = z.object({
  id: identifier,
  role: z.enum(["markdown", "manifest", "asset"]),
  ref: attachmentRefSchema,
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});

const doctureManifestSchema = z.object({
  kind: z.literal("docture-conversion-manifest"),
  version: z.literal(1),
  sourceFileName: z.string().min(1),
  plan: resolvedConversionPlanSchema,
  completeness: conversionCompletenessSchema,
  documentPages: z.number().int().positive(),
  pages: z.array(pageOutcomeSchema).min(1),
  provenance: z.array(engineProvenanceSchema),
  warnings: z.array(conversionWarningSchema),
  usage: conversionUsageSchema,
  markdown: artifactDescriptorSchema,
});

export const publicationManifestV1Schema = z.object({
  kind: z.literal("sektar-pdf-publication"),
  version: z.literal(1),
  generationId: z
    .string()
    .min(1)
    .max(489)
    .regex(/^[^:\r\n]+$/),
  source: resolvedSourceSchema,
  createdAt: z.iso.datetime({ offset: true }),
  output: doctureManifestSchema,
});

export {
  resolvedConversionPlanSchema as resolvedConversionPlanV1Schema,
  doctureManifestSchema as doctureManifestV1Schema,
};
