// Files: the File document (sektar/file) and what the Files surfaces share —
// what a MIME type looks like on a tile, the tag palette, and the writes
// that store bytes beside a document (preprocess, reference it on the
// document, then upload: the store only accepts bytes for a ref a document
// already carries).
import {
  addDocument,
  dispatchActions,
  type useAttachments,
} from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import { actions as fileActions } from "document-models/file";
import type { BadgeTone } from "./format.js";

export const FILE_TYPE = "sektar/file";

export type AttachmentClient = NonNullable<ReturnType<typeof useAttachments>>;
export type AttachmentRefString = `attachment://v${number}:${string}`;

/* ------------------------------------------------------------- MIME types */

export type FileKind =
  | "pdf"
  | "doc"
  | "xls"
  | "img"
  | "text"
  | "html"
  | "data"
  | "audio"
  | "video"
  | "archive"
  | "file";

/** What a file is, from its MIME type, else its name. */
export function fileKind(mimeType?: string | null, fileName?: string | null): FileKind {
  const mime = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  const name = (fileName ?? "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || /^(png|jpe?g|gif|webp|svg|avif|heic)$/.test(ext)) return "img";
  if (/sheet|excel|csv/.test(mime) || /^(xlsx?|csv|ods|numbers)$/.test(ext)) return "xls";
  if (/word|opendocument\.text|rtf/.test(mime) || /^(docx?|odt|rtf|pages)$/.test(ext)) return "doc";
  if (mime === "text/html" || /^html?$/.test(ext)) return "html";
  if (/json|xml|yaml/.test(mime) || /^(json|xml|ya?ml)$/.test(ext)) return "data";
  if (mime.startsWith("text/") || /^(txt|md|log)$/.test(ext)) return "text";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (/zip|tar|gzip|compressed|7z|rar/.test(mime) || /^(zip|tar|gz|7z|rar)$/.test(ext)) return "archive";
  return "file";
}

/** The design system has tiles for pdf, doc, xls and img; the rest wear the neutral one. */
export function tileClass(kind: FileKind): string {
  return kind === "pdf" || kind === "doc" || kind === "xls" || kind === "img"
    ? `sk-file-type--${kind}`
    : "";
}

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  doc: "DOC",
  xls: "XLS",
  img: "IMG",
  text: "TXT",
  html: "HTML",
  data: "DATA",
  audio: "AUD",
  video: "VID",
  archive: "ZIP",
  file: "FILE",
};

/** Text that can be read in the browser as is. */
export function isTextual(mimeType?: string | null): boolean {
  const mime = (mimeType ?? "").toLowerCase();
  return (
    mime.startsWith("text/") ||
    /json|xml|yaml|javascript|csv|markdown/.test(mime)
  );
}

export const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(;.*)?$/i;

/** MIME types worth suggesting; any other is fine too. */
export const COMMON_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "application/json",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Roles a rendition plays; free text, these are the usual ones. */
export const RENDITION_TYPES = [
  "text",
  "ocr",
  "summary",
  "preview",
  "thumbnail",
  "pdf-export",
  "html",
  "translation",
];

export function bytes(size: number | null | undefined): string {
  if (size === null || size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------- tags */

export interface TagColor {
  value: string;
  label: string;
  tone: BadgeTone;
}

/** The tag palette: the design system's badge tones under colour names. */
export const TAG_COLORS: readonly TagColor[] = [
  { value: "forest", label: "Forest", tone: "forest" },
  { value: "sage", label: "Sage", tone: "success" },
  { value: "mint", label: "Mint", tone: "mint" },
  { value: "info", label: "Sky", tone: "info" },
  { value: "amber", label: "Amber", tone: "warning" },
  { value: "clay", label: "Clay", tone: "danger" },
  { value: "neutral", label: "Stone", tone: "outline" },
];

export function tagTone(color: string): BadgeTone {
  return TAG_COLORS.find((c) => c.value === color)?.tone ?? "outline";
}

/** A colour for a new tag that the file does not wear yet, in palette order. */
export function nextTagColor(used: readonly string[]): string {
  return TAG_COLORS.find((c) => !used.includes(c.value))?.value ?? "forest";
}

/* ----------------------------------------------------------------- writes */

const now = () => new Date().toISOString();

/** Store `file` and make it the File document's source of truth. */
export async function setSourceFile(
  client: AttachmentClient,
  documentId: string,
  file: Blob & { name?: string },
  fileName = file.name ?? "file",
): Promise<void> {
  const mimeType = file.type || undefined;
  const pre = await client.preprocess(file, { fileName, mimeType });
  await dispatchActions(
    fileActions.setAttachmentSource({
      ref: pre.ref,
      fileName,
      mimeType: mimeType ?? null,
      sizeBytes: pre.sizeBytes,
      setAt: now(),
    }),
    documentId,
  );
  await client.upload({ preprocessed: pre });
}

/** Store `file` as a rendition of the File document. */
export async function addFileRendition(
  client: AttachmentClient,
  documentId: string,
  file: Blob & { name?: string },
  meta: { type?: string | null; label?: string | null; mimeType?: string | null } = {},
): Promise<void> {
  const fileName = file.name ?? "rendition";
  const mimeType = meta.mimeType || file.type || "application/octet-stream";
  const pre = await client.preprocess(file, { fileName, mimeType });
  await dispatchActions(
    fileActions.addRendition({
      id: generateId(),
      mimeType,
      type: meta.type ?? null,
      label: meta.label ?? null,
      ref: pre.ref,
      fileName,
      sizeBytes: pre.sizeBytes,
      createdAt: now(),
    }),
    documentId,
  );
  await client.upload({ preprocessed: pre });
}

/** Add inline text content as a rendition. */
export function addTextRendition(
  documentId: string,
  input: { text: string; mimeType: string; type?: string | null; label?: string | null },
) {
  return dispatchActions(
    fileActions.addRendition({
      id: generateId(),
      mimeType: input.mimeType,
      type: input.type ?? null,
      label: input.label ?? null,
      text: input.text,
      createdAt: now(),
    }),
    documentId,
  );
}

/** Text files up to this size carry their text along as a first rendition. */
const INLINE_TEXT_MAX = 512 * 1024;

/**
 * A dropped or picked file becomes a File document in the folder: the file
 * is its source, and a text file's own text is its first rendition, so it
 * reads in the preview straight away.
 */
export async function createFileFromUpload(
  client: AttachmentClient | undefined,
  driveId: string,
  parentFolder: string | undefined,
  file: File,
): Promise<string> {
  const node = await addDocument(driveId, file.name, FILE_TYPE, parentFolder);
  await dispatchActions(fileActions.setTitle({ title: file.name }), node.id);
  if (client) await setSourceFile(client, node.id, file, file.name);
  if (isTextual(file.type) && file.size <= INLINE_TEXT_MAX) {
    await addTextRendition(node.id, {
      text: await file.text(),
      mimeType: file.type.split(";")[0] || "text/plain",
      type: "text",
      label: "Text",
    });
  }
  return node.id;
}

/** An empty File document, to fill in its editor. */
export async function createEmptyFile(
  driveId: string,
  parentFolder: string | undefined,
  name = "Untitled file",
): Promise<string> {
  const node = await addDocument(driveId, name, FILE_TYPE, parentFolder);
  return node.id;
}
