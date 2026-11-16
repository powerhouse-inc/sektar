import { z } from "zod";
import { publicationManifestV1Schema } from "./publication/v1.js";
import { publicationManifestV2Schema } from "./publication/v2.js";
import { canonicalJson } from "./canonical-json.js";
import { parsePublicationRowId as parseRowId } from "./publication-id.js";

export const PUBLICATION_MIME = "application/vnd.sektar.pdf-publication+json";
export const MAX_PUBLICATION_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAX_PUBLICATION_MARKDOWN_BYTES = 50 * 1024 * 1024;

const generationIdSchema = z
  .string()
  .min(1)
  .max(489)
  .regex(/^[^:\r\n]+$/);
export type PublicationRole = "markdown" | "manifest";
export const parsePublicationRowId: (id: unknown) => {
  generationId: string;
  role: PublicationRole;
} | null = parseRowId;

export function publicationRowId(
  generationId: string,
  role: PublicationRole,
): string {
  return `sektar-pdf:v1:${generationIdSchema.parse(generationId)}:${role}`;
}

export const publicationManifestSchema = z
  .discriminatedUnion("version", [
    publicationManifestV1Schema,
    publicationManifestV2Schema,
  ])
  .superRefine(({ source, output }, context) => {
    function invalid(message: string): void {
      context.addIssue({ code: "custom", message });
    }
    if (
      (source.kind === "file" && source.scope.kind !== "files") ||
      (source.kind === "mail" && source.scope.kind !== "mail") ||
      (source.kind === "mail" && parsePublicationRowId(source.attachmentId))
    ) {
      invalid("The publication source does not identify an original PDF");
    }
    if (
      output.markdown.role !== "markdown" ||
      output.markdown.mimeType.trim().toLowerCase() !== "text/markdown" ||
      output.markdown.fileName.trim() === ""
    ) {
      invalid("The publication requires a stored Markdown artifact");
    }
    if (!/^[a-f0-9]{64}$/.test(output.plan.fingerprint)) {
      invalid("The publication plan requires a SHA-256 fingerprint");
    }
    const pageNumbers = output.pages.map((page) => page.page);
    if (
      pageNumbers.some(
        (page, index) =>
          page > output.documentPages ||
          (index > 0 && page <= pageNumbers[index - 1]),
      )
    ) {
      invalid("Page outcomes must be unique, ascending and within the PDF");
    }
    const requested = output.plan.pages;
    if (requested.kind === "all") {
      if (
        output.pages.length !== output.documentPages ||
        pageNumbers.some((page, index) => page !== index + 1)
      ) {
        invalid("Page outcomes do not cover the requested PDF pages");
      }
    } else {
      const selected = [...new Set(requested.pages)].sort((a, b) => a - b);
      if (
        selected.length !== pageNumbers.length ||
        selected.some((page, index) => page !== pageNumbers[index])
      ) {
        invalid("Page outcomes do not cover the selected pages");
      }
    }
    const incomplete = output.pages.some(
      (page) => page.status === "failed" || page.status === "unresolved",
    );
    if ((output.completeness === "partial") !== incomplete) {
      invalid("Completeness does not match the page outcomes");
    }
    if (
      output.warnings.some(
        (warning) =>
          warning.page !== undefined && warning.page > output.documentPages,
      )
    ) {
      invalid("A conversion warning names a page outside the PDF");
    }
  });
export type PublicationManifest = z.infer<typeof publicationManifestSchema>;

export const canonicalPublicationJson = canonicalJson;

export function encodePublication(manifest: PublicationManifest): Uint8Array {
  return new TextEncoder().encode(
    `${canonicalPublicationJson(publicationManifestSchema.parse(manifest))}\n`,
  );
}
