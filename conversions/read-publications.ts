import type { PHDocument } from "document-model";
import {
  attachmentRefSchema,
  type ArtifactDescriptor,
  type ConversionAttachmentRef,
} from "./contracts.js";
import {
  planPublication,
  publicationRows,
  publicationRowSignature,
  type PublicationInspection,
} from "./model-adapter.js";
import {
  PUBLICATION_MIME,
  MAX_PUBLICATION_MANIFEST_BYTES,
  MAX_PUBLICATION_MARKDOWN_BYTES,
  canonicalPublicationJson,
  parsePublicationRowId,
  publicationManifestSchema,
} from "./publication.js";

export type ReadPublicationArtifact = (input: {
  documentId: string;
  ref: ConversionAttachmentRef;
  signal?: AbortSignal;
}) => Promise<Uint8Array>;

export class InvalidPublicationArtifactError extends Error {}

type PublicationRow = ReturnType<typeof publicationRows>[number];

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function reasonOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The stored file is unavailable";
}

function supportedRow(
  row: PublicationRow,
  mimeType: string,
  maxBytes: number,
): boolean {
  return (
    attachmentRefSchema.safeParse(row.ref).success &&
    row.mimeType?.trim().toLowerCase() === mimeType &&
    typeof row.fileName === "string" &&
    row.fileName.trim() !== "" &&
    typeof row.sizeBytes === "number" &&
    Number.isSafeInteger(row.sizeBytes) &&
    row.sizeBytes >= 0 &&
    row.sizeBytes <= maxBytes
  );
}

async function inspectPair(input: {
  document: PHDocument;
  generationId: string;
  rows: PublicationRow[];
  read: ReadPublicationArtifact;
  signal?: AbortSignal;
}): Promise<PublicationInspection> {
  const { document, generationId, rows, read, signal } = input;
  signal?.throwIfAborted();
  const rowSignature = publicationRowSignature(document, generationId);
  const failure = (
    kind: "pending" | "unusable",
    reason: string,
  ): PublicationInspection => ({
    kind,
    id: generationId,
    reason,
    rowSignature,
  });
  const markdownRows = rows.filter(
    (row) => parsePublicationRowId(row.id)?.role === "markdown",
  );
  const manifestRows = rows.filter(
    (row) => parsePublicationRowId(row.id)?.role === "manifest",
  );
  const markdownRow = markdownRows.at(0);
  const manifestRow = manifestRows.at(0);
  if (
    markdownRows.length !== 1 ||
    manifestRows.length !== 1 ||
    !markdownRow ||
    !manifestRow
  ) {
    return failure(
      "unusable",
      "The conversion requires exactly one Markdown and manifest row",
    );
  }
  if (
    !supportedRow(
      manifestRow,
      PUBLICATION_MIME,
      MAX_PUBLICATION_MANIFEST_BYTES,
    ) ||
    !supportedRow(markdownRow, "text/markdown", MAX_PUBLICATION_MARKDOWN_BYTES)
  ) {
    return failure(
      "unusable",
      "The stored conversion rows have invalid metadata or exceed the read limit",
    );
  }
  const manifestRef = attachmentRefSchema.parse(manifestRow.ref);
  let manifestBytes: Uint8Array;
  try {
    manifestBytes = await read({
      documentId: document.header.id,
      ref: manifestRef,
      signal,
    });
  } catch (error) {
    signal?.throwIfAborted();
    return failure(
      error instanceof InvalidPublicationArtifactError ? "unusable" : "pending",
      reasonOf(error),
    );
  }
  signal?.throwIfAborted();
  if (
    manifestBytes.byteLength > MAX_PUBLICATION_MANIFEST_BYTES ||
    manifestBytes.byteLength !== manifestRow.sizeBytes
  ) {
    return failure(
      "unusable",
      "The stored manifest bytes do not match their size and reference",
    );
  }
  const manifestHash = await sha256(manifestBytes);
  signal?.throwIfAborted();
  if (`attachment://v1:${manifestHash}` !== manifestRef) {
    return failure(
      "unusable",
      "The stored manifest bytes do not match their reference",
    );
  }
  let parsed: ReturnType<typeof publicationManifestSchema.safeParse>;
  try {
    parsed = publicationManifestSchema.safeParse(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes),
      ),
    );
  } catch {
    return failure("unusable", "The stored manifest is not valid UTF-8 JSON");
  }
  if (!parsed.success) {
    return failure(
      "unusable",
      "The stored manifest has an unsupported or inconsistent schema",
    );
  }
  const manifest = parsed.data;
  if (manifest.generationId !== generationId) {
    return failure(
      "unusable",
      "The manifest belongs to another conversion generation",
    );
  }
  const fingerprint = await sha256(
    new TextEncoder().encode(
      canonicalPublicationJson({
        ...manifest.output.plan,
        fingerprint: undefined,
      }),
    ),
  );
  signal?.throwIfAborted();
  if (fingerprint !== manifest.output.plan.fingerprint) {
    return failure(
      "unusable",
      "The stored reading plan does not match its fingerprint",
    );
  }
  const artifact: ArtifactDescriptor = {
    id: manifestRow.id,
    role: "manifest",
    ref: manifestRef,
    fileName: manifestRow.fileName ?? "",
    mimeType: PUBLICATION_MIME,
    sizeBytes: manifestBytes.byteLength,
  };
  const plan = planPublication({
    document,
    manifest,
    manifestArtifact: artifact,
  });
  if (plan.kind !== "present") {
    return failure(
      "unusable",
      plan.kind === "conflict"
        ? plan.reason
        : "The saved conversion pair is missing",
    );
  }
  let markdownBytes: Uint8Array;
  try {
    markdownBytes = await read({
      documentId: document.header.id,
      ref: manifest.output.markdown.ref,
      signal,
    });
  } catch (error) {
    signal?.throwIfAborted();
    return failure(
      error instanceof InvalidPublicationArtifactError ? "unusable" : "pending",
      reasonOf(error),
    );
  }
  signal?.throwIfAborted();
  if (
    markdownBytes.byteLength > MAX_PUBLICATION_MARKDOWN_BYTES ||
    markdownBytes.byteLength !== markdownRow.sizeBytes
  ) {
    return failure(
      "unusable",
      "The stored Markdown bytes do not match their size and reference",
    );
  }
  const markdownHash = await sha256(markdownBytes);
  signal?.throwIfAborted();
  if (`attachment://v1:${markdownHash}` !== manifest.output.markdown.ref) {
    return failure(
      "unusable",
      "The stored Markdown bytes do not match their reference",
    );
  }
  return { kind: "ready", publication: { manifest, artifact } };
}

export async function inspectPublications(input: {
  document: PHDocument;
  read: ReadPublicationArtifact;
  signal?: AbortSignal;
}): Promise<PublicationInspection[]> {
  input.signal?.throwIfAborted();
  const groups = new Map<string, PublicationRow[]>();
  for (const row of publicationRows(input.document)) {
    const identity = parsePublicationRowId(row.id);
    if (!identity) continue;
    const rows = groups.get(identity.generationId) ?? [];
    rows.push(row);
    groups.set(identity.generationId, rows);
  }
  const pairs = [...groups];
  const inspections: PublicationInspection[] = [];
  for (let index = 0; index < pairs.length; index += 4) {
    const batch = await Promise.all(
      pairs
        .slice(index, index + 4)
        .map(([generationId, rows]) =>
          inspectPair({ ...input, generationId, rows }),
        ),
    );
    inspections.push(...batch);
  }
  return inspections;
}
