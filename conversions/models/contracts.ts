import { z } from "zod";
import {
  conversionProfileSchema,
  conversionSettingsSchema,
  putConversionSettingsSchema,
} from "../contracts.js";

export const modelReadinessSchema = z.object({
  files: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      bytes: z.number().nonnegative(),
      ready: z.boolean(),
    }),
  ),
  totalBytes: z.number().nonnegative(),
  missingBytes: z.number().nonnegative(),
  ready: z.boolean(),
});
export type ModelReadiness = z.infer<typeof modelReadinessSchema>;
export const modelProgressSchema = z.object({
  phase: z.enum([
    "queued",
    "downloading",
    "verifying",
    "applying",
    "complete",
    "failed",
  ]),
  transferredBytes: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
  readyFiles: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  file: z.string().nullable(),
});
export type ModelProgress = z.infer<typeof modelProgressSchema>;
export const preparationIntentSchema = z.object({
  kind: z.literal("settings"),
  settings: putConversionSettingsSchema.omit({
    workflowGrant: true,
    requestId: true,
  }),
});
export type PreparationIntent = z.infer<typeof preparationIntentSchema>;
export const modelPreparationSchema = z.object({
  kind: z.literal("preparation"),
  id: z.string(),
  intent: preparationIntentSchema,
  progress: modelProgressSchema,
  updatedAt: z.string(),
  error: z
    .object({ code: z.string(), message: z.string(), retryable: z.boolean() })
    .nullable(),
  result: z
    .object({
      kind: z.literal("settings"),
      settings: conversionSettingsSchema,
    })
    .nullable(),
});
export type ModelPreparation = z.infer<typeof modelPreparationSchema>;
export const saveSettingsResponseSchema = z.union([
  conversionSettingsSchema,
  modelPreparationSchema,
]);
export const inspectModelsSchema = z
  .object({ profile: conversionProfileSchema })
  .strict();
export const preparationListSchema = z.object({
  preparations: z.array(modelPreparationSchema),
});
export const preparationActive = (preparation: ModelPreparation) =>
  !["complete", "failed"].includes(preparation.progress.phase);
