/**
 * The file itself, beside the record it arrived with.
 *
 * For most of what lands in a collection — an invoice, a statement — the
 * attachment IS the content, and the message around it is just how it got
 * here. So it gets a pane rather than a download link.
 *
 * The bytes are only readable because the document records the ref: the
 * attachment port refuses a download the document does not reference. That
 * is the same rule that leaves 81 files in the store unreachable.
 */
import type { OscAttachment } from "document-models/original-source-collection";
import {
  useAttachmentPreview,
  useAttachments,
} from "@powerhousedao/reactor-browser";
import { BTN, CHECKER, bytes, mayBeTransparent } from "./lib.js";

/**
 * What we can show inline.
 *
 * The store's own mime type wins over the one recorded on the source. A flow
 * captures whatever the source system claimed, and source systems are often
 * wrong — a capture labelled application/pdf whose bytes are a PNG renders
 * as garbage in an iframe, which looks like a broken viewer rather than a
 * mislabelled file.
 */
function kindOf(file: OscAttachment, actual?: string): "image" | "pdf" | "other" {
  const mime = (actual ?? file.mimeType ?? "").toLowerCase();
  const name = file.fileName.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "other";
}

export function AttachmentPane({
  documentId,
  file,
  onClose,
}: {
  documentId: string;
  /** Null when nothing is selected — the pane stays, so the layout does. */
  file: OscAttachment | null;
  onClose?: () => void;
}) {
  const client = useAttachments();
  // One attachment is previewed at a time, so this is a single hook rather
  // than one per row — which would be a hook in a loop.
  // `ref: undefined` keeps the hook order stable while nothing is chosen.
  const preview = useAttachmentPreview({ documentId, ref: file?.ref });
  const kind = file ? kindOf(file, preview.header?.mimeType) : "other";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {file?.fileName ?? "No file selected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {file
              ? [
                  preview.header?.mimeType ?? file.mimeType,
                  bytes(preview.header?.sizeBytes ?? file.sizeBytes),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Pick one from Files"}
            {file &&
              preview.header?.mimeType &&
              file.mimeType &&
              preview.header.mimeType !== file.mimeType && (
                // Worth saying out loud: the capture recorded one thing and
                // the bytes are another.
                <span className="ml-1 text-amber-600">
                  (captured as {file.mimeType})
                </span>
              )}
          </p>
        </div>

        {file && preview.url && (
          <a
            className={BTN}
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            title="Open the file in a new tab"
          >
            Open ↗
          </a>
        )}
        {file && client && (
          <button
            type="button"
            className={BTN}
            onClick={() => {
              void client.saveAttachment(
                { documentId, ref: file.ref },
                { fileName: file.fileName },
              );
            }}
          >
            Download
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className={BTN}
            title="Hide the preview and give the width back to the record"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-background p-3">
        {!file && (
          <p className="text-xs text-muted-foreground">
            Nothing to show. Choose a file under Files on the record, and it
            opens here.
          </p>
        )}

        {file && !client && (
          <p className="text-xs text-muted-foreground">
            This drive lives in the browser, so there is no attachment store
            behind it and the file cannot be fetched.
          </p>
        )}

        {file && client && preview.loading && (
          <p className="text-xs text-muted-foreground">
            Fetching… attempt {preview.attempt} of {preview.maxAttempts}
            {preview.lastError ? ` · ${preview.lastError.message}` : ""}
          </p>
        )}

        {file && client && preview.error && !preview.loading && (
          <p className="text-xs text-destructive">
            Could not load this file: {preview.error.message}
          </p>
        )}

        {file && preview.url && kind === "image" && (
          // The checkerboard sits directly behind the image rather than
          // filling the pane, so its edges are visible too — which is the
          // other half of knowing what you are looking at.
          <div
            className="mx-auto w-fit rounded-md border border-border"
            style={
              mayBeTransparent(
                preview.header?.mimeType ?? file.mimeType,
                file.fileName,
              )
                ? CHECKER
                : undefined
            }
          >
            <img
              src={preview.url}
              alt={file.fileName}
              className="block max-w-full rounded-md"
            />
          </div>
        )}

        {file && preview.url && kind === "pdf" && (
          <iframe
            src={preview.url}
            title={file.fileName}
            className="h-full min-h-[24rem] w-full rounded-md border border-border"
          />
        )}

        {file && preview.url && kind === "other" && (
          // Guessing at a renderer for an unknown type would show something
          // wrong; offering the two things that always work does not.
          <p className="text-xs text-muted-foreground">
            No inline preview for{" "}
            {preview.header?.mimeType ?? file.mimeType ?? "this file type"}. Open it
            in a new tab or download it.
          </p>
        )}
      </div>
    </div>
  );
}
