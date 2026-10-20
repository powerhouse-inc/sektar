import type { TripDocumentsOperations } from "document-models/trip/v1";
import {
  DuplicateItemIdError,
  ItemNotFoundError,
} from "../../gen/documents/error.js";
import { itemExists } from "../items.js";

export const tripDocumentsOperations: TripDocumentsOperations = {
  addAttachmentOperation(state, action) {
    const i = action.input;
    if (state.attachments.some((a) => a.id === i.id))
      throw new DuplicateItemIdError(`Attachment ${i.id} exists`);
    if (i.itemId && !itemExists(state, i.itemId))
      throw new ItemNotFoundError(`No item ${i.itemId}`);
    state.attachments.push({
      id: i.id,
      itemId: i.itemId ?? null,
      role: i.role,
      fileName: i.fileName,
      mimeType: i.mimeType ?? null,
      ref: i.ref ?? null,
      sizeBytes: i.sizeBytes ?? null,
      documentId: i.documentId ?? null,
      addedAt: i.addedAt,
    });
  },
  removeAttachmentOperation(state, action) {
    const at = state.attachments.findIndex((a) => a.id === action.input.id);
    if (at < 0) throw new ItemNotFoundError(`No attachment ${action.input.id}`);
    state.attachments.splice(at, 1);
  },
  addSourceOperation(state, action) {
    const i = action.input;
    if (state.sources.some((s) => s.id === i.id))
      throw new DuplicateItemIdError(`Source ${i.id} exists`);
    state.sources.push({
      id: i.id,
      kind: i.kind,
      documentId: i.documentId ?? null,
      lineId: i.lineId ?? null,
      label: i.label ?? null,
      at: i.at ?? null,
    });
  },
  removeSourceOperation(state, action) {
    const at = state.sources.findIndex((s) => s.id === action.input.id);
    if (at < 0) throw new ItemNotFoundError(`No source ${action.input.id}`);
    state.sources.splice(at, 1);
  },
};
