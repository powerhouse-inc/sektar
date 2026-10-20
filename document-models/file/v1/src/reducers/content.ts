import type { FileContentOperations } from "document-models/file/v1";
import {
  InvalidSourceDocumentTypeError,
  InvalidSourceFileNameError,
} from "../../gen/content/error.js";

export const fileContentOperations: FileContentOperations = {
  setTitleOperation(state, action) {
    const t = action.input.title?.trim();
    state.title = t ? t : null;
  },
  setDescriptionOperation(state, action) {
    const d = action.input.description?.trim();
    state.description = d ? d : null;
  },
  setAttachmentSourceOperation(state, action) {
    const fileName = action.input.fileName.trim();
    if (!fileName)
      throw new InvalidSourceFileNameError("The file name is empty");
    state.source = {
      kind: "ATTACHMENT",
      ref: action.input.ref,
      fileName,
      mimeType: action.input.mimeType?.trim() || null,
      sizeBytes: action.input.sizeBytes ?? null,
      documentId: null,
      documentType: null,
      documentName: null,
      setAt: action.input.setAt,
    };
    if (!state.title) state.title = fileName;
  },
  setDocumentSourceOperation(state, action) {
    const documentType = action.input.documentType.trim();
    if (!documentType)
      throw new InvalidSourceDocumentTypeError("The document type is empty");
    const documentName = action.input.documentName?.trim() || null;
    state.source = {
      kind: "DOCUMENT",
      ref: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      documentId: action.input.documentId,
      documentType,
      documentName,
      setAt: action.input.setAt,
    };
    if (!state.title && documentName) state.title = documentName;
  },
  clearSourceOperation(state, action) {
    state.source = null;
  },
};
