/**
 * What Docture's Convert PDF to Markdown step takes beyond its form and what
 * it hands on. Pure and Zod-only, so a flow that pins a plan or reads the
 * output can parse it without loading the converter.
 */
import { z } from "zod";
import { doctureManifestV1Schema } from "../../../conversions/publication/v1.js";
import { doctureManifestV2Schema } from "../../../conversions/publication/v2.js";
import {
  artifactDescriptorSchema,
  conversionCompletenessSchema,
  conversionLimitsSchema,
  conversionUsageSchema,
  conversionWarningSchema,
  engineProvenanceSchema,
  pageOutcomeSchema,
  resolvedConversionPlanSchema,
} from "../../../conversions/contracts.js";

/** The limits one step converts under. */
export const doctureLimitsSchema = conversionLimitsSchema.pick({
  maxBytes: true,
  maxPages: true,
  maxDurationMs: true,
});
export type DoctureLimits = z.infer<typeof doctureLimitsSchema>;

/** What a step converts under when it names no limits. */
export const DEFAULT_DOCTURE_LIMITS: DoctureLimits = {
  maxBytes: 50 * 1024 * 1024,
  maxPages: 500,
  maxDurationMs: 30 * 60 * 1000,
};

/** The step's "Limits" input: any subset, each within the host's ceiling. */
export const doctureLimitsInputSchema = z
  .object({
    maxBytes: z
      .number()
      .int()
      .positive()
      .max(200 * 1024 * 1024),
    maxPages: z.number().int().positive().max(2000),
    maxDurationMs: z
      .number()
      .int()
      .positive()
      .max(2 * 60 * 60 * 1000),
  })
  .partial()
  .strip();

export const DOCTURE_MANIFEST_KIND = "docture-conversion-manifest";

/** The manifest file the step stores beside the Markdown. */
export const doctureManifestSchema = z.discriminatedUnion("version", [
  doctureManifestV1Schema,
  doctureManifestV2Schema,
]);
export type DoctureManifest = z.infer<typeof doctureManifestSchema>;

/** What the step hands to the steps after it. Large content is stored, never inline. */
export const doctureConversionOutputSchema = z.object({
  /** The stored Markdown. */
  markdown: artifactDescriptorSchema,
  /** Every other stored file: the manifest. */
  artifacts: z.array(artifactDescriptorSchema),
  completeness: conversionCompletenessSchema,
  /** One outcome per requested page, ascending. */
  pages: z.array(pageOutcomeSchema).min(1),
  warnings: z.array(conversionWarningSchema),
  provenance: z.array(engineProvenanceSchema),
  usage: conversionUsageSchema,
  /** The plan the PDF was read with, pinned to the installed engines. */
  plan: resolvedConversionPlanSchema,
  documentPages: z.number().int().positive(),
});
export type DoctureConversionOutput = z.infer<
  typeof doctureConversionOutputSchema
>;
