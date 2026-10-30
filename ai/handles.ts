// Short handles for stored files. A model cannot copy a 64-character hash: it
// gets a few characters right and invents the rest. So the tools hand out
// handles such as file-3, and code turns them back into the real reference,
// which is never shown to the model nor taken from it.
//
// The table lives in this tab's memory, as the chat does. A handle it does not
// know is an error that sends the model back to the list, never an empty file.
import type { AttachmentRefString } from "../editors/sektar/kit/files.js";

/** A stored file's reference, exactly: the store's hashes are SHA-256 in hex. */
const REF = /^attachment:\/\/v\d+:[0-9a-f]{64}$/;

export function isFileRef(value: string): value is AttachmentRefString {
  return REF.test(value);
}

/** What a tool's answer must not carry: a reference, or a hash on its own. */
const RAW_REF = /attachment:\/\/\S*|\b[0-9a-fA-F]{64,}\b/g;

/** `text` with any reference taken out, for the errors that reach the model. */
export function withoutRefs(text: string): string {
  return text.replace(RAW_REF, "[a file reference]");
}

export interface HandledFile {
  /** The document that holds it, which is what authorizes a download. */
  documentId: string | null;
  ref: AttachmentRefString;
  /** Null when only the reference is known, as on a mail row. */
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

const HANDLE = /^file-\d+$/;

const filesByHandle = new Map<string, HandledFile>();
const handlesByFile = new Map<string, string>();

const fileKey = (documentId: string | null, ref: string) =>
  `${documentId ?? ""}\n${ref}`;

/**
 * The file's handle: the same ref on the same document keeps the one it has,
 * and what this call knows of it is added to what was known.
 */
export function handleFor(file: HandledFile): string {
  if (!isFileRef(file.ref)) {
    throw new Error("A stored file's reference is damaged, so it has no handle.");
  }
  const key = fileKey(file.documentId, file.ref);
  const handle = handlesByFile.get(key) ?? `file-${filesByHandle.size + 1}`;
  const known = filesByHandle.get(handle);
  filesByHandle.set(handle, {
    ...file,
    fileName: file.fileName ?? known?.fileName ?? null,
    mimeType: file.mimeType ?? known?.mimeType ?? null,
    sizeBytes: file.sizeBytes ?? known?.sizeBytes ?? null,
  });
  handlesByFile.set(key, handle);
  return handle;
}

/** The file behind a handle, or an error saying how to get a good one. */
export function fileForHandle(handle: string): HandledFile {
  const file = filesByHandle.get(handle);
  if (file) return file;
  const named = HANDLE.test(handle) ? handle : "That";
  throw new Error(
    `${named} is not a file handle this chat knows. Handles look like file-3 and come from sektarListAttachments, sektarSearchMail or sektarSaveChatImage: list the document's files again and use the handle from that answer. Never type a file reference or make up a handle.`,
  );
}

/** Empties the table, for the tests. */
export function forgetHandles(): void {
  filesByHandle.clear();
  handlesByFile.clear();
}
