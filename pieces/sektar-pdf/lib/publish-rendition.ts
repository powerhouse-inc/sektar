import { createHash } from "node:crypto";
import type { Operation, PHDocument } from "document-model";
import {
  createAction,
  Property,
  type FilesService,
  type IndexQueryMethods,
} from "@powerhousedao/pieces-framework";
import { isEmailDocument } from "document-models/email";
import { isFileDocument } from "document-models/file";
import {
  attachmentRefSchema,
  type ArtifactDescriptor,
  type ResolvedSource,
} from "../../../conversions/contracts.js";
import {
  planPublication,
  resultOfPublication,
  type ConversionDocumentAction,
  type StoredPublication,
} from "../../../conversions/model-adapter.js";
import {
  encodePublication,
  MAX_PUBLICATION_MANIFEST_BYTES,
  MAX_PUBLICATION_MARKDOWN_BYTES,
  PUBLICATION_MIME,
  publicationManifestSchema,
  publicationRowId,
  type PublicationManifest,
} from "../../../conversions/publication.js";
import {
  doctureConversionOutputSchema,
  doctureManifestSchema,
  NO_MODEL_USAGE,
  type DoctureConversionOutput,
  type DoctureManifest,
} from "../../docture/lib/contracts.js";
import {
  preparedPdfSchema,
  SektarPdfRefusal,
  validPdfSchema,
  validatePdfInputSchema,
  type PublishedPdf,
  type ReadyPdf,
} from "./contracts.js";
import { readConversionGateway } from "./gateway.js";

export type PdfPublisher = IndexQueryMethods & {
  get(documentId: string): Promise<PHDocument>;
  execute(
    documentId: string,
    branch: string,
    actions: ConversionDocumentAction[],
  ): Promise<PHDocument>;
  getOperations(
    documentId: string,
    view: { branch: string; scopes: string[] },
    filter: { sinceRevision: number },
    paging: { cursor: string; limit: number },
  ): Promise<{ results: Operation[] }>;
};
export type PdfArtifactStore = Pick<FilesService, "upload">;
export type StoredPdfFile = { data: Buffer };
export type PublishPdfInput = {
  prepared: unknown;
  conversion?: unknown;
  markdownFile?: StoredPdfFile;
  manifestFile?: StoredPdfFile;
  workflowId?: string;
  runId: string;
};

function refOf(data: Uint8Array): string {
  return `attachment://v1:${createHash("sha256").update(data).digest("hex")}`;
}

function verifyFile(
  artifact: ArtifactDescriptor,
  file: StoredPdfFile | undefined,
): Buffer {
  if (!file)
    throw new Error(
      `The stored ${artifact.role} file is required to verify publication`,
    );
  if (
    refOf(file.data) !== artifact.ref ||
    file.data.byteLength !== artifact.sizeBytes
  ) {
    throw new Error(
      `The stored ${artifact.role} file does not match the conversion output`,
    );
  }
  return file.data;
}

function manifestOf(output: DoctureConversionOutput): ArtifactDescriptor {
  const manifest = output.artifacts.find(
    (artifact) => artifact.role === "manifest",
  );
  if (!manifest || output.artifacts.length !== 1) {
    throw new Error(
      "Publication requires one manifest and no unverified additional artifacts",
    );
  }
  if (output.markdown.role !== "markdown") {
    throw new Error("The converted file must be a Markdown artifact");
  }
  return manifest;
}

function verifyOutput(
  prepared: ReadyPdf,
  output: DoctureConversionOutput,
  input: PublishPdfInput,
): DoctureManifest {
  if (JSON.stringify(output.plan) !== JSON.stringify(prepared.plan)) {
    throw new Error(
      "The conversion used a different reading plan from the prepared PDF",
    );
  }
  const manifest = manifestOf(output);
  verifyFile(output.markdown, input.markdownFile);
  const data = verifyFile(manifest, input.manifestFile);
  const stored = doctureManifestSchema.parse(JSON.parse(data.toString("utf8")));
  const expected = doctureManifestSchema.parse({
    ...output,
    usage: NO_MODEL_USAGE,
    kind: "docture-conversion-manifest",
    version: output.plan.contractVersion,
    sourceFileName: stored.sourceFileName,
  });
  if (JSON.stringify(stored) !== JSON.stringify(expected)) {
    throw new Error(
      "The stored manifest does not describe the conversion output",
    );
  }
  return stored;
}

async function storePublication(
  files: PdfArtifactStore,
  manifest: PublicationManifest,
): Promise<StoredPublication> {
  if (manifest.output.markdown.sizeBytes > MAX_PUBLICATION_MARKDOWN_BYTES) {
    throw new SektarPdfRefusal(
      "markdown-too-large",
      "The Markdown is larger than the 50 MB Sektar can save. Convert fewer pages at a time.",
    );
  }
  const data = Buffer.from(encodePublication(manifest));
  if (data.byteLength > MAX_PUBLICATION_MANIFEST_BYTES) {
    throw new SektarPdfRefusal(
      "details-too-large",
      "The conversion details are larger than the 2 MB Sektar can save. Convert fewer pages at a time.",
    );
  }
  const fileName = `pdf-conversion.${manifest.generationId}.json`;
  const uploaded = await files.upload({ fileName, data });
  const ref = attachmentRefSchema.safeParse(uploaded.id);
  if (!ref.success || ref.data !== refOf(data)) {
    throw new Error(
      "The workflow stored the conversion details under a reference that does not match their contents",
    );
  }
  return {
    manifest,
    artifact: {
      id: publicationRowId(manifest.generationId, "manifest"),
      role: "manifest",
      ref: ref.data,
      fileName,
      mimeType: PUBLICATION_MIME,
      sizeBytes: data.byteLength,
    },
  };
}

/** Whether `document` still stores the exact PDF the conversion read, where it read it. */
function holdsSource(document: PHDocument, source: ResolvedSource): boolean {
  if (source.kind === "file") {
    return (
      isFileDocument(document) &&
      document.state.global.source?.kind === "ATTACHMENT" &&
      document.state.global.source.ref === source.ref
    );
  }
  return (
    isEmailDocument(document) &&
    document.state.global.attachments.some(
      (attachment) =>
        attachment.id === source.attachmentId && attachment.ref === source.ref,
    )
  );
}

function planIn(document: PHDocument, publication: StoredPublication) {
  return planPublication({
    document,
    manifest: publication.manifest,
    manifestArtifact: publication.artifact,
  });
}

/** Reactor reads carry no operation history, so the submitted actions' outcomes come from the log. */
async function failuresOf(
  reactor: PdfPublisher,
  before: PHDocument,
  actions: ConversionDocumentAction[],
): Promise<string[]> {
  const submitted = new Set(actions.map((action) => action.id));
  const appended = await reactor.getOperations(
    before.header.id,
    { branch: "main", scopes: ["global"] },
    { sinceRevision: before.header.revision.global },
    { cursor: "", limit: 100 },
  );
  return appended.results.flatMap((operation) => {
    const reason = operation.deniedReason ?? operation.error;
    return submitted.has(operation.action.id) && reason !== undefined
      ? [reason]
      : [];
  });
}

async function appendPair(
  reactor: PdfPublisher,
  before: PHDocument,
  publication: StoredPublication,
  actions: ConversionDocumentAction[],
): Promise<PHDocument> {
  const { source } = publication.manifest;
  if (!holdsSource(before, source)) {
    throw new SektarPdfRefusal(
      "source-changed",
      "The PDF was replaced before its Markdown was saved. Convert the current version.",
    );
  }
  const written = await reactor.execute(source.documentId, "main", actions);
  const saved = planIn(written, publication);
  // A failed action does not roll back its sibling, so only the resulting pair
  // decides. An identical pair saved first by a retry of this run also counts.
  if (saved.kind !== "present") {
    const reason =
      saved.kind === "conflict"
        ? saved.reason
        : "The converted Markdown was not saved.";
    throw new Error(
      [reason, ...(await failuresOf(reactor, before, actions))].join(" "),
    );
  }
  return reactor.get(source.documentId);
}

export async function publishPdf({
  reactor,
  files,
  input,
}: {
  reactor: PdfPublisher;
  files: PdfArtifactStore;
  input: PublishPdfInput;
}): Promise<PublishedPdf> {
  const prepared = preparedPdfSchema.parse(input.prepared);
  if (prepared.kind === "skip") return prepared;
  const validation = validatePdfInputSchema.parse({
    prepared,
    workflowId: input.workflowId,
    runId: input.runId,
  });
  const validate = async () => {
    validPdfSchema.parse(
      await readConversionGateway(reactor, "validate", validation),
    );
  };
  await validate();
  if (prepared.reuse) return { kind: "reused", result: prepared.reuse };
  const output = doctureConversionOutputSchema.parse(input.conversion);
  const publication = await storePublication(
    files,
    publicationManifestSchema.parse({
      kind: "sektar-pdf-publication",
      version: output.plan.contractVersion,
      generationId: prepared.generationId,
      source: prepared.source,
      createdAt: prepared.createdAt,
      output: verifyOutput(prepared, output, input),
    }),
  );
  await validate();
  const before = await reactor.get(prepared.source.documentId);
  const plan = planIn(before, publication);
  if (plan.kind === "conflict") throw new Error(plan.reason);
  const latest =
    plan.kind === "present"
      ? before
      : await appendPair(reactor, before, publication, plan.actions);
  // Another client can remove rows after the write, so only a pair still in
  // the latest read is reported as saved.
  const kept = planIn(latest, publication);
  if (kept.kind === "conflict") throw new Error(kept.reason);
  if (kept.kind !== "present") {
    throw new SektarPdfRefusal(
      "markdown-removed",
      "The saved Markdown was removed before the conversion finished. Convert again to save a new result.",
    );
  }
  // Nothing makes the write conditional on the source, so a replacement can
  // land after the checks. The pair stays with the PDF it describes.
  if (!holdsSource(latest, prepared.source)) {
    throw new SektarPdfRefusal(
      "source-changed",
      "The PDF was replaced while its Markdown was being saved. The saved Markdown belongs to the earlier PDF. Convert the current version to read it.",
    );
  }
  return { kind: "published", result: resultOfPublication(publication) };
}

export const publishRenditionAction = createAction({
  name: "publish-rendition",
  displayName: "Publish Sektar Markdown",
  description:
    "Verifies Docture's stored files and attaches the Markdown to the exact File or Email PDF resolved earlier. A changed PDF is refused.",
  requireAuth: false,
  requireReactor: "write",
  props: {
    prepared: Property.Json({ displayName: "Resolved PDF", required: true }),
    conversion: Property.Json({
      displayName: "Docture output",
      required: false,
    }),
    markdownFile: Property.File({
      displayName: "Stored Markdown",
      description: "The Markdown reference from Docture's output.",
      required: false,
    }),
    manifestFile: Property.File({
      displayName: "Stored manifest",
      description: "The manifest reference from Docture's other files.",
      required: false,
    }),
  },
  outputSchema: {
    fields: [
      {
        key: "kind",
        label: "Outcome",
        description: "published, reused or skip",
      },
      { key: "result", label: "Saved conversion" },
      { key: "reason", label: "Reason for skipping" },
    ],
  },
  async run(context) {
    return publishPdf({
      reactor: context.reactor,
      files: context.files,
      input: {
        ...context.propsValue,
        workflowId: context.flows.current.id,
        runId: context.run.id,
      },
    });
  },
});
