import type { PHDocument } from "document-model";
import {
  actions as fileActions,
  isFileDocument,
  type FileAction,
} from "document-models/file";
import {
  actions as emailActions,
  isEmailDocument,
  type EmailAction,
} from "document-models/email";
import {
  artifactDescriptorSchema,
  type ArtifactDescriptor,
  type ConversionAttachmentRef,
  type ConversionCompleteness,
  type ConversionResult,
  type SourceSelection,
} from "./contracts.js";
import {
  PUBLICATION_MIME,
  parsePublicationRowId,
  publicationManifestSchema,
  publicationRowId,
  type PublicationManifest,
} from "./publication.js";

export type ConversionDocumentAction = FileAction | EmailAction;
export type StoredPublication = {
  manifest: PublicationManifest;
  artifact: ArtifactDescriptor;
};
export type PublicationInspection =
  | { kind: "ready"; publication: StoredPublication }
  | {
      kind: "pending" | "unusable";
      id: string;
      reason: string;
      rowSignature?: string;
    };

type PublicationPlan =
  | { kind: "present" }
  | { kind: "append"; actions: ConversionDocumentAction[] }
  | { kind: "conflict"; reason: string };

export function publicationRows(document: PHDocument) {
  if (isFileDocument(document)) return document.state.global.renditions;
  if (isEmailDocument(document)) return document.state.global.attachments;
  return [];
}

export function publicationRowSignature(
  document: PHDocument,
  generationId: string,
): string {
  return JSON.stringify(
    publicationRows(document)
      .filter(
        (row) => parsePublicationRowId(row.id)?.generationId === generationId,
      )
      .map((row) => ({
        id: row.id,
        ref: row.ref,
        fileName: row.fileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        ...("text" in row
          ? { text: row.text, type: row.type, createdAt: row.createdAt }
          : { inline: row.inline, contentId: row.contentId }),
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );
}

export function planPublication(input: {
  document: PHDocument;
  manifest: PublicationManifest;
  manifestArtifact: ArtifactDescriptor;
}): PublicationPlan {
  const parsedManifest = publicationManifestSchema.safeParse(input.manifest);
  const parsedArtifact = artifactDescriptorSchema.safeParse(
    input.manifestArtifact,
  );
  const conflict = (reason: string): PublicationPlan => ({
    kind: "conflict",
    reason: `${reason} Convert again to save a new result.`,
  });
  if (!parsedManifest.success || !parsedArtifact.success) {
    return conflict("The publication metadata is invalid.");
  }
  const manifest = parsedManifest.data;
  const artifact = parsedArtifact.data;
  const { document } = input;
  if (
    manifest.source.documentId !== document.header.id ||
    (manifest.source.kind === "file" && !isFileDocument(document)) ||
    (manifest.source.kind === "mail" && !isEmailDocument(document))
  ) {
    return conflict("The publication belongs to another document.");
  }
  if (
    artifact.role !== "manifest" ||
    artifact.mimeType.trim().toLowerCase() !== PUBLICATION_MIME ||
    artifact.fileName.trim() === "" ||
    artifact.sizeBytes === 0
  ) {
    return conflict("The stored manifest does not match the publication.");
  }
  const rows = [
    {
      id: publicationRowId(manifest.generationId, "markdown"),
      ref: manifest.output.markdown.ref,
      mimeType: "text/markdown",
      type: "markdown",
      fileName: `pdf-conversion.${manifest.generationId}.md`,
      sizeBytes: manifest.output.markdown.sizeBytes,
    },
    {
      id: publicationRowId(manifest.generationId, "manifest"),
      ref: artifact.ref,
      mimeType: PUBLICATION_MIME,
      type: "conversion-manifest",
      fileName: `pdf-conversion.${manifest.generationId}.json`,
      sizeBytes: artifact.sizeBytes,
    },
  ];
  const existing = publicationRows(document).filter((row) =>
    rows.some((expected) => expected.id === row.id),
  );
  if (existing.length > 0) {
    if (existing.length !== rows.length) {
      return conflict("Only part of this conversion remains on the document.");
    }
    for (const expected of rows) {
      const matches = existing.filter((row) => row.id === expected.id);
      const stored = matches.at(0);
      if (
        matches.length !== 1 ||
        !stored ||
        stored.ref !== expected.ref ||
        stored.fileName?.trim() !== expected.fileName ||
        stored.mimeType?.trim().toLowerCase() !== expected.mimeType ||
        stored.sizeBytes !== expected.sizeBytes ||
        ("text" in stored
          ? stored.text !== null ||
            stored.type?.trim() !== expected.type ||
            stored.createdAt !== manifest.createdAt
          : stored.inline !== false || (stored.contentId ?? null) !== null)
      ) {
        return conflict("A saved row differs from this conversion.");
      }
    }
    return { kind: "present" };
  }
  if (isFileDocument(document)) {
    return {
      kind: "append",
      actions: rows.map((row) =>
        fileActions.addRendition({
          ...row,
          createdAt: manifest.createdAt,
        }),
      ),
    };
  }
  if (isEmailDocument(document)) {
    if (
      document.state.global.attachments.some((stored) =>
        rows.some(
          (expected) =>
            stored.ref === expected.ref &&
            stored.fileName.trim() === expected.fileName,
        ),
      )
    ) {
      return conflict(
        "An attachment already uses this conversion's stored name.",
      );
    }
    return {
      kind: "append",
      actions: rows.map(({ type: _type, ...row }) =>
        emailActions.addAttachment({
          ...row,
          inline: false,
          contentId: null,
        }),
      ),
    };
  }
  return conflict("This document cannot store a PDF conversion.");
}

export type ConversionRenditionView = {
  id: string;
  jobId: string;
  status: "ready";
  completeness: ConversionCompleteness;
  sourceRef: ConversionAttachmentRef;
  ref: ConversionAttachmentRef;
  manifestRef: ConversionAttachmentRef;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  planFingerprint: string;
  pageCount: number;
  readPages: number;
  blankPages: number;
  unresolvedPages: number;
  failedPages: number;
  warnings: string[];
  methods: string[];
  model: string | null;
  stale: boolean;
  current: boolean;
  publication: PublicationManifest;
};

function isPdf(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const type = mimeType?.split(";")[0]?.trim().toLowerCase();
  if (type === "application/pdf" || type === "application/x-pdf") return true;
  return (
    (fileName ?? "").toLowerCase().endsWith(".pdf") &&
    (!type ||
      type === "application/octet-stream" ||
      type === "binary/octet-stream")
  );
}

function currentSourceRef(
  document: PHDocument,
  source: SourceSelection,
): string | null {
  if (source.kind === "file" && isFileDocument(document)) {
    const stored = document.state.global.source;
    return stored?.kind === "ATTACHMENT" &&
      isPdf(stored.mimeType, stored.fileName || document.header.name)
      ? (stored.ref ?? null)
      : null;
  }
  if (source.kind === "mail" && isEmailDocument(document)) {
    const stored = document.state.global.attachments.find(
      (row) => row.id === source.attachmentId,
    );
    return stored && isPdf(stored.mimeType, stored.fileName)
      ? stored.ref
      : null;
  }
  return null;
}

export function listConversionRenditions(
  document: PHDocument,
  source: SourceSelection,
  inspections: readonly PublicationInspection[],
): ConversionRenditionView[] {
  if (
    document.header.id !== source.documentId ||
    (source.kind === "file" && !isFileDocument(document)) ||
    (source.kind === "mail" && !isEmailDocument(document))
  ) {
    return [];
  }
  const ref = currentSourceRef(document, source);
  const views: ConversionRenditionView[] = [];
  const settled = new Set<string>();
  for (const inspection of inspections) {
    if (inspection.kind !== "ready") {
      if (
        inspection.kind === "unusable" &&
        inspection.rowSignature ===
          publicationRowSignature(document, inspection.id)
      ) {
        settled.add(inspection.id);
      }
      continue;
    }
    const { manifest, artifact } = inspection.publication;
    if (
      planPublication({ document, manifest, manifestArtifact: artifact })
        .kind !== "present"
    ) {
      continue;
    }
    settled.add(manifest.generationId);
    if (
      manifest.source.kind !== source.kind ||
      (manifest.source.kind === "mail" &&
        source.kind === "mail" &&
        manifest.source.attachmentId !== source.attachmentId)
    ) {
      continue;
    }
    const output = manifest.output;
    views.push({
      id: publicationRowId(manifest.generationId, "markdown"),
      jobId: manifest.generationId,
      status: "ready",
      completeness: output.completeness,
      sourceRef: manifest.source.ref,
      ref: output.markdown.ref,
      manifestRef: artifact.ref,
      fileName: output.markdown.fileName,
      sizeBytes: output.markdown.sizeBytes,
      createdAt: manifest.createdAt,
      planFingerprint: output.plan.fingerprint,
      pageCount: output.pages.length,
      readPages: output.pages.filter((page) => page.status === "read").length,
      blankPages: output.pages.filter((page) => page.status === "blank").length,
      unresolvedPages: output.pages.filter(
        (page) => page.status === "unresolved",
      ).length,
      failedPages: output.pages.filter((page) => page.status === "failed")
        .length,
      warnings: output.warnings.map((warning) => warning.message),
      methods: output.provenance.map(
        (engine) => `${engine.role}:${engine.engine}@${engine.version}`,
      ),
      model:
        output.provenance
          .map((engine) => engine.model)
          .filter((model) => model !== null)
          .join(", ") || null,
      stale: manifest.source.ref !== ref,
      current: false,
      publication: manifest,
    });
  }
  const groups = new Map<string, Set<string>>();
  for (const row of publicationRows(document)) {
    const parsed = parsePublicationRowId(row.id);
    if (!parsed) continue;
    const roles = groups.get(parsed.generationId) ?? new Set<string>();
    roles.add(parsed.role);
    groups.set(parsed.generationId, roles);
  }
  const pending = [...groups].some(
    ([id, roles]) => roles.size === 2 && !settled.has(id),
  );
  views.sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0),
  );
  const eligible = views.filter((view) => !view.stale).reverse();
  const selected =
    eligible.find((view) => view.completeness === "complete") ??
    (pending ? undefined : eligible[0]);
  if (selected) selected.current = true;
  return views;
}

export function getCurrentConversionRendition(
  document: PHDocument,
  source: SourceSelection,
  inspections: readonly PublicationInspection[],
): ConversionRenditionView | undefined {
  return listConversionRenditions(document, source, inspections).find(
    (rendition) => rendition.current,
  );
}

export function resultOfPublication({
  manifest,
  artifact,
}: StoredPublication): ConversionResult {
  const output = manifest.output;
  return {
    jobId: manifest.generationId,
    renditionId: publicationRowId(manifest.generationId, "markdown"),
    source: manifest.source,
    planFingerprint: output.plan.fingerprint,
    createdAt: manifest.createdAt,
    completeness: output.completeness,
    markdown: output.markdown,
    artifacts: [
      {
        ...artifact,
        id: publicationRowId(manifest.generationId, "manifest"),
        fileName: `pdf-conversion.${manifest.generationId}.json`,
        mimeType: PUBLICATION_MIME,
      },
    ],
    pages: output.pages,
    warnings: output.warnings,
    provenance: output.provenance,
    usage: output.usage,
  };
}
