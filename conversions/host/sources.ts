import type { PHDocument } from "document-model";
import { isEmailDocument } from "document-models/email";
import { isFileDocument } from "document-models/file";
import {
  attachmentRefSchema,
  type ConversionScope,
  type ResolvedSource,
  type SourceSelection,
} from "../contracts.js";
import { ConversionRefusal } from "./problems.js";

export const FILE_DOCUMENT_TYPE = "sektar/file";
export const EMAIL_DOCUMENT_TYPE = "sektar/email";
const PDF = "application/pdf";

export function isPdf(mimeType: string | null | undefined, fileName: string | null | undefined): boolean {
  const type = mimeType?.split(";")[0]?.trim().toLowerCase();
  if (type === PDF || type === "application/x-pdf") return true;
  const named = (fileName ?? "").toLowerCase().endsWith(".pdf");
  return named && (!type || type === "application/octet-stream" || type === "binary/octet-stream");
}

export function normalizeAccount(address: string | null | undefined): string {
  return (address ?? "").trim().toLowerCase() || "unknown-account";
}

function checkExpected(selection: SourceSelection, ref: string): void {
  if (selection.expectedRef !== undefined && selection.expectedRef !== ref) {
    throw new ConversionRefusal(
      409,
      "source-changed",
      "This PDF changed since it was shown. Convert the current version.",
      false,
    );
  }
}

function parseRef(ref: string | null | undefined): ResolvedSource["ref"] {
  const parsed = attachmentRefSchema.safeParse(ref);
  if (!parsed.success) throw new ConversionRefusal(422, "unsupported-reference", "This file is stored in a way Sektar can't convert yet.", false);
  return parsed.data;
}

export function scopeOf(document: PHDocument, driveId: string): ConversionScope {
  if (isEmailDocument(document)) return { kind: "mail", driveId, account: normalizeAccount(document.state.global.account.address) };
  return { kind: "files", driveId };
}

/**
 * The stored PDF a selection names in `document`, as the document is now.
 * Throws a refusal the caller can show; never guesses another attachment.
 */
export function resolveSource(document: PHDocument, selection: SourceSelection, scope: ConversionScope): ResolvedSource {
  if (document.header.id !== selection.documentId) {
    throw new ConversionRefusal(404, "not-found", "This document doesn't exist anymore.", false);
  }
  if (selection.kind === "file") {
    if (!isFileDocument(document)) throw new ConversionRefusal(422, "not-a-file", "Only PDF files can be converted to Markdown.", false);
    const source = document.state.global.source;
    if (!source) throw new ConversionRefusal(422, "no-source", "This file has no stored content to convert.", false);
    switch (source.kind) {
      case "DOCUMENT":
        throw new ConversionRefusal(422, "linked-document", "This file links to another document, so there is no PDF to convert.", false);
      case "FILE_PLACEHOLDER":
      case "DOCUMENT_PLACEHOLDER":
        throw new ConversionRefusal(422, "placeholder", "This file is on disk but not in Sektar yet. Pull it, then convert.", false);
      case "ATTACHMENT":
        break;
      default: {
        const unhandled: never = source.kind;
        throw new ConversionRefusal(422, "unknown-source", "Sektar can't convert this kind of file yet.", false, `Unknown source kind ${String(unhandled)}.`);
      }
    }
    const fileName = source.fileName || document.header.name || "document.pdf";
    if (!isPdf(source.mimeType, fileName)) throw new ConversionRefusal(422, "not-pdf", "Only PDF files can be converted to Markdown.", false);
    const ref = parseRef(source.ref);
    checkExpected(selection, ref);
    return { kind: "file", documentId: document.header.id, scope, ref, fileName, mimeType: PDF, sizeBytes: source.sizeBytes ?? null };
  }
  if (!isEmailDocument(document)) throw new ConversionRefusal(422, "not-an-email", "Only PDF attachments can be converted to Markdown.", false);
  const attachment = document.state.global.attachments.find((candidate) => candidate.id === selection.attachmentId);
  if (!attachment) throw new ConversionRefusal(404, "no-attachment", "This attachment isn't on the email anymore.", false);
  if (!isPdf(attachment.mimeType, attachment.fileName)) throw new ConversionRefusal(422, "not-pdf", "Only PDF attachments can be converted to Markdown.", false);
  const ref = parseRef(attachment.ref);
  checkExpected(selection, ref);
  return {
    kind: "mail",
    documentId: document.header.id,
    attachmentId: attachment.id,
    scope,
    ref,
    fileName: attachment.fileName,
    mimeType: PDF,
    sizeBytes: attachment.sizeBytes ?? null,
  };
}

export function pdfSelectionsOf(document: PHDocument): SourceSelection[] {
  if (isFileDocument(document)) {
    const source = document.state.global.source;
    return source?.kind === "ATTACHMENT" && isPdf(source.mimeType, source.fileName || document.header.name)
      ? [{ kind: "file", documentId: document.header.id }]
      : [];
  }
  if (isEmailDocument(document)) {
    return document.state.global.attachments
      .filter((attachment) => isPdf(attachment.mimeType, attachment.fileName))
      .map((attachment) => ({ kind: "mail", documentId: document.header.id, attachmentId: attachment.id }));
  }
  return [];
}
