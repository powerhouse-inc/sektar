// The assistant's way to the stored files: which ones a document holds, what a
// file shows, and storing an image attached to the chat. Bytes go through the
// same attachment client the screens use, named by the document that holds the
// ref, which is what authorizes a download. A file that could not be loaded
// always throws: the agent feeds the error to the model, so it cannot pass for
// an empty file.
import {
  getAttachmentClient,
  getPHStore,
} from "@powerhousedao/reactor-browser";
import type { PhAiChatImage } from "@powerhousedao/shared/document-model";
import { fileKind, type AttachmentRefString } from "../editors/sektar/kit/files.js";
import { uniqueAttachments } from "../editors/sektar/kit/mail.js";
import { clip, compact } from "./read.js";

/** PDF pages shown to the model per file. */
export const PDF_PAGES_SHOWN = 5;

/** Larger files are not fetched: a tab holds them in memory to read them. */
const MAX_READ_BYTES = 50 * 1024 * 1024;

const UNKNOWN = "Treat its content as unknown.";

const REF = /^attachment:\/\/v\d+:/;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function attachmentClient() {
  const client = getAttachmentClient();
  if (!client) {
    throw new Error(
      `Stored files are not available in this session. ${UNKNOWN}`,
    );
  }
  return client;
}

/* ------------------------------------------------- what a document holds */

export interface HeldAttachment {
  ref: AttachmentRefString;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  inline: boolean;
  /** Where in the document it sits, such as lines.0.attachments.1. */
  at: string;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Every stored file in a document's state, wherever its model keeps them:
 * anything with an attachment ref, which covers a message's files, a File's
 * source and renditions, and an invoice's attachments and those of its lines.
 */
export function attachmentsIn(state: unknown): HeldAttachment[] {
  const found: HeldAttachment[] = [];
  const walk = (value: unknown, at: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, at ? `${at}.${index}` : `${index}`));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entry = value as Record<string, unknown>;
    if (typeof entry.ref === "string" && REF.test(entry.ref)) {
      found.push({
        ref: entry.ref as AttachmentRefString,
        fileName: text(entry.fileName) ?? text(entry.name) ?? "attachment",
        mimeType: text(entry.mimeType),
        sizeBytes: typeof entry.sizeBytes === "number" ? entry.sizeBytes : null,
        inline: entry.inline === true,
        at,
      });
    }
    for (const [key, child] of Object.entries(entry)) {
      walk(child, at ? `${at}.${key}` : key);
    }
  };
  walk(state, "");
  return uniqueAttachments(found);
}

/** The document's stored files, for the model to read or attach elsewhere. */
export async function readDocumentAttachments(
  documentId: string,
  signal?: AbortSignal,
) {
  const client = getPHStore()?.reactorClient;
  if (!client) {
    throw new Error(
      `Documents are not available in this session, so ${documentId} could not be read. ${UNKNOWN}`,
    );
  }
  let document;
  try {
    document = await client.get(documentId, undefined, signal);
  } catch (error) {
    throw new Error(
      `Document ${documentId} could not be read: ${messageOf(error)}. ${UNKNOWN}`,
      { cause: error },
    );
  }
  const { global } = document.state as { global?: unknown };
  return {
    document: compact({
      id: document.header.id,
      type: document.header.documentType,
      name: clip(document.header.name, 120),
    }),
    rows: attachmentsIn(global).map((file) =>
      compact({
        ref: file.ref,
        fileName: clip(file.fileName, 120),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        inline: file.inline || null,
        at: file.at,
      }),
    ),
  };
}

/* -------------------------------------------------------- showing a file */

/** An image for the model, as the chat holds one. */
interface ShownImage {
  dataUrl: string;
  mediaType: string;
}

/** A result with images, as an MCP tool returns one: the agent shows them. */
export function withImages(value: object, images: readonly ShownImage[]) {
  return {
    content: [
      { type: "text", text: JSON.stringify(value) },
      ...images.map((image) => ({
        type: "image",
        data: image.dataUrl.slice(image.dataUrl.indexOf(",") + 1),
        mimeType: image.mediaType,
      })),
    ],
    structuredContent: value,
  };
}

const IMAGE_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** The type the chat can carry this image under, if it can. */
function chatImageType(
  mimeType: string,
  fileName: string,
  chatTypes: readonly string[],
): string | undefined {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (chatTypes.includes(mime)) return mime;
  if (mime === "image/jpg") return "image/jpeg";
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  // Mail often stores a picture as an octet stream under a proper file name.
  return mime.startsWith("image/")
    ? undefined
    : IMAGE_TYPE_BY_EXTENSION[extension];
}

async function readBytes(
  body: ReadableStream<Uint8Array>,
  expected: number,
): Promise<Blob> {
  const blob = await new Response(body).blob();
  if (blob.size === 0) throw new Error("the file came back empty");
  if (expected > 0 && blob.size !== expected) {
    throw new Error(`only ${blob.size} of ${expected} bytes arrived`);
  }
  return blob;
}

export interface ReadAttachmentInput {
  documentId: string;
  ref: string;
  fileName?: string;
  mimeType?: string;
}

/**
 * Loads a file by reference and shows it to the model: an image as it is, a PDF
 * as images of its first pages. Anything else comes back as a statement that it
 * cannot be read; a failed load throws.
 */
export async function readAttachment(
  input: ReadAttachmentInput,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!REF.test(input.ref)) {
    throw new Error(
      `"${input.ref}" is not a file reference. References start with attachment:// and come from sektarListAttachments or sektarSearchMail.`,
    );
  }
  const client = attachmentClient();
  const failed = (error: unknown) =>
    new Error(
      `The file could not be loaded: ${messageOf(error)}. ${UNKNOWN} If it was attached moments ago, try again shortly; otherwise check the reference and the document that holds it.`,
      { cause: error },
    );

  let response;
  try {
    response = await client.download({
      documentId: input.documentId,
      ref: input.ref as AttachmentRefString,
      signal,
    });
  } catch (error) {
    throw failed(error);
  }
  const { header, body } = response;
  const fileName = input.fileName ?? header.fileName;
  const mimeType = input.mimeType ?? header.mimeType;
  const file = { fileName, mimeType, sizeBytes: header.sizeBytes };
  const unread = (reason: string) => {
    void body.cancel().catch(() => undefined);
    return { ...file, read: false, note: `${reason} Say so; do not guess what it holds.` };
  };

  const kind = fileKind(mimeType, fileName);
  const { CHAT_IMAGE_TYPES, readChatImage } = await import(
    "@powerhousedao/reactor-browser/ai"
  );
  const imageType =
    kind === "img"
      ? chatImageType(mimeType, fileName, CHAT_IMAGE_TYPES)
      : undefined;
  if (kind !== "pdf" && !imageType) {
    return unread(
      `This ${mimeType || "file"} cannot be read here: only images (PNG, JPEG, WebP, GIF) and PDFs can.`,
    );
  }
  if (header.sizeBytes > MAX_READ_BYTES) {
    return unread(
      `This file is ${Math.round(header.sizeBytes / (1024 * 1024))} MB, too large to read here.`,
    );
  }

  let blob: Blob;
  try {
    blob = await readBytes(body, header.sizeBytes);
  } catch (error) {
    throw failed(error);
  }
  if (imageType) {
    const image = await readChatImage(
      new File([blob], fileName, { type: imageType }),
    );
    return withImages({ ...file, read: true }, [image]);
  }

  const { renderPdfPages } = await import("./pdf-pages.js");
  let rendered;
  try {
    rendered = await renderPdfPages(blob, PDF_PAGES_SHOWN, signal);
  } catch (error) {
    throw new Error(`The PDF could not be read: ${messageOf(error)}. ${UNKNOWN}`, {
      cause: error,
    });
  }
  const { total, pages } = rendered;
  return withImages(
    {
      ...file,
      read: true,
      pages: total,
      pagesShown: pages.length,
      ...(total > pages.length
        ? {
            cutOff: true,
            note: `Showing the first ${pages.length} of ${total} pages. The rest were not read, so say so if the answer could be on them.`,
          }
        : {}),
    },
    pages,
  );
}

/* --------------------------------------------- storing a chat attachment */

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function imageBytes(image: PhAiChatImage): Blob {
  const base64 = image.dataUrl.slice(image.dataUrl.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: image.mediaType });
}

export interface SaveChatImageInput {
  handle: string;
  documentId?: string;
  fileName?: string;
}

/** Stores an image attached to this chat and says how to reference it. */
export async function saveChatImage(
  input: SaveChatImageInput,
  images: readonly PhAiChatImage[] = [],
  signal?: AbortSignal,
) {
  const image = images.find((candidate) => candidate.handle === input.handle);
  if (!image) {
    throw new Error(
      images.length > 0
        ? `This chat has no image ${input.handle}. Its images are ${images.map((i) => i.handle).join(", ")}.`
        : `This chat has no image ${input.handle}: no image was attached to it.`,
    );
  }
  const client = attachmentClient();
  const file = imageBytes(image);
  const fileName =
    input.fileName?.trim() ||
    image.name ||
    `${image.handle}.${EXTENSION_BY_TYPE[image.mediaType] ?? "img"}`;
  let result;
  try {
    result = await client.upload({
      file,
      fileName,
      mimeType: image.mediaType,
      documentId: input.documentId,
      signal,
    });
  } catch (error) {
    throw new Error(
      `The image was not saved: ${messageOf(error)}. Nothing was stored, so say so.`,
      { cause: error },
    );
  }
  return {
    ref: result.ref,
    fileName,
    mimeType: image.mediaType,
    sizeBytes: file.size,
    note: "Stored, but on no document yet. Put this reference on one with addActions, or the user will not see it anywhere.",
  };
}
