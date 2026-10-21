import type { FileDiskOperations } from "document-models/file/v1";
import {
  InvalidPlaceholderError,
  NoDiskVersionError,
  PlaceholderTargetError,
  PreviousVersionIdTakenError,
} from "../../gen/disk/error.js";

export const fileDiskOperations: FileDiskOperations = {
  setPlaceholderOperation(state, action) {
    const i = action.input;
    const relativePath = i.relativePath.trim();
    const fileName = i.fileName.trim();
    if (!relativePath || !fileName)
      throw new InvalidPlaceholderError(
        "A placeholder needs the path and the file name",
      );
    const placeholderKind = (kind: string | undefined) =>
      kind === "FILE_PLACEHOLDER" || kind === "DOCUMENT_PLACEHOLDER";
    if (i.change === "CREATE") {
      if (state.source && !placeholderKind(state.source.kind))
        throw new PlaceholderTargetError(
          "A File that has a source is updated or deleted from disk, not created",
        );
    } else if (!state.source || placeholderKind(state.source.kind)) {
      throw new PlaceholderTargetError(
        "Only a File with a source can be updated or deleted from disk",
      );
    }
    const placeholder = {
      change: i.change,
      target: i.target,
      mappingId: i.mappingId,
      relativePath,
      fileName,
      mimeType: i.mimeType?.trim() || null,
      sizeBytes: i.sizeBytes ?? null,
      hash: i.hash ?? null,
      modifiedAt: i.modifiedAt ?? null,
      documentId: i.documentId ?? null,
      documentType: i.documentType ?? null,
      documentName: i.documentName ?? null,
      foundAt: i.foundAt,
    };
    if (i.change === "CREATE") {
      state.source = {
        kind:
          i.target === "DOCUMENT" ? "DOCUMENT_PLACEHOLDER" : "FILE_PLACEHOLDER",
        ref: null,
        fileName,
        mimeType: placeholder.mimeType,
        sizeBytes: placeholder.sizeBytes,
        documentId: placeholder.documentId,
        documentType: placeholder.documentType,
        documentName: placeholder.documentName,
        setAt: i.foundAt,
      };
      if (!state.title) state.title = fileName;
    }
    state.placeholder = placeholder;
  },
  clearPlaceholderOperation(state, action) {
    state.placeholder = null;
  },
  applyDiskVersionOperation(state, action) {
    const i = action.input;
    const pending = state.placeholder;
    if (!pending || pending.target !== "FILE" || pending.change === "DELETE")
      throw new NoDiskVersionError(
        "There is no file created or updated on disk to pull",
      );
    const fileName = i.fileName.trim();
    if (!fileName) throw new NoDiskVersionError("The file name is empty");
    const previous = state.source;
    const keep = previous && previous.kind === "ATTACHMENT" && previous.ref;
    if (keep && state.renditions.some((r) => r.id === i.previousId))
      throw new PreviousVersionIdTakenError(
        `A rendition with id ${i.previousId} exists already`,
      );
    if (keep) {
      state.renditions.push({
        id: i.previousId,
        mimeType: previous.mimeType || "application/octet-stream",
        type: "previous-version",
        label: `Version of ${previous.setAt.slice(0, 10)}`,
        ref: previous.ref,
        fileName: previous.fileName,
        sizeBytes: previous.sizeBytes,
        text: null,
        createdAt: i.setAt,
      });
    }
    state.source = {
      kind: "ATTACHMENT",
      ref: i.ref,
      fileName,
      mimeType: i.mimeType?.trim() || null,
      sizeBytes: i.sizeBytes ?? null,
      documentId: null,
      documentType: null,
      documentName: null,
      setAt: i.setAt,
    };
    if (!state.title) state.title = fileName;
    state.placeholder = null;
  },
};
