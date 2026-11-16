import { z } from "zod";
import {
  attachmentRefSchema,
  conversionLimitsSchema,
  conversionResultSchema,
  resolvedConversionPlanSchema,
  resolvedSourceSchema,
} from "../../../conversions/contracts.js";

export const preparePdfInputSchema = z.object({
  request: z.unknown(),
  workflowId: z.string().min(1).optional(),
  runId: z.string().min(1),
});
export type PreparePdfInput = z.infer<typeof preparePdfInputSchema>;

export const readyPdfSchema = z
  .object({
    kind: z.literal("ready"),
    source: resolvedSourceSchema,
    plan: resolvedConversionPlanSchema,
    limits: conversionLimitsSchema,
    generationId: z.string().min(1).max(512),
    createdAt: z.iso.datetime({ offset: true }),
    file: attachmentRefSchema,
    reuse: conversionResultSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.file !== value.source.ref) {
      context.addIssue({
        code: "custom",
        message: "The prepared PDF must match its pinned source",
        path: ["file"],
      });
    }
    if (
      value.reuse &&
      (value.reuse.source.documentId !== value.source.documentId ||
        value.reuse.source.kind !== value.source.kind ||
        value.reuse.source.ref !== value.source.ref ||
        value.reuse.planFingerprint !== value.plan.fingerprint ||
        (value.source.kind === "mail" &&
          value.reuse.source.kind === "mail" &&
          value.reuse.source.attachmentId !== value.source.attachmentId))
    ) {
      context.addIssue({
        code: "custom",
        message: "The saved Markdown belongs to another source or plan",
        path: ["reuse"],
      });
    }
  });
export type ReadyPdf = z.infer<typeof readyPdfSchema>;

export const preparedPdfSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("skip"), reason: z.string().min(1) }),
  readyPdfSchema,
]);
export type PreparedPdf = z.infer<typeof preparedPdfSchema>;

export const validatePdfInputSchema = z.object({
  prepared: readyPdfSchema,
  workflowId: z.string().min(1).optional(),
  runId: z.string().min(1),
});
export type ValidatePdfInput = z.infer<typeof validatePdfInputSchema>;

export const validPdfSchema = z.object({ valid: z.literal(true) });

/**
 * A step refused or failed for a reason the person converting can act on.
 * Its message is shown as the conversion's error (conversions/host/run-view.ts);
 * any other error a step throws is kept as a technical detail.
 */
export class SektarPdfRefusal extends Error {
  override readonly name = "SektarPdfRefusal";
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const conversionGatewayReplySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ok"), value: z.unknown() }),
  z.object({
    kind: z.literal("error"),
    code: z.string(),
    message: z.string(),
    detail: z.string().optional(),
  }),
]);

export const publishedPdfSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("skip"), reason: z.string().min(1) }),
  z.object({ kind: z.literal("reused"), result: conversionResultSchema }),
  z.object({ kind: z.literal("published"), result: conversionResultSchema }),
]);
export type PublishedPdf = z.infer<typeof publishedPdfSchema>;
