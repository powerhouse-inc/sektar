// V2 records the rendering dependencies used to produce the page images.
import { z } from "zod";
import {
  resolvedConversionPlanV1Schema,
  doctureManifestV1Schema,
  publicationManifestV1Schema,
} from "./v1.js";

export const resolvedConversionPlanV2Schema =
  resolvedConversionPlanV1Schema.extend({
    contractVersion: z.literal(2),
    renderer: z.object({
      pdfjsVersion: z.string().min(1).max(512),
      rasterizerVersion: z.string().min(1).max(512).nullable(),
    }),
  });
export const doctureManifestV2Schema = doctureManifestV1Schema.extend({
  version: z.literal(2),
  plan: resolvedConversionPlanV2Schema,
});
export const publicationManifestV2Schema = publicationManifestV1Schema.extend({
  version: z.literal(2),
  output: doctureManifestV2Schema,
});
