import type { FileRenditionsOperations } from "document-models/file/v1";
import {
  DuplicateRenditionError,
  InvalidRenditionMimeTypeError,
  InvalidUpdatedMimeTypeError,
  RenditionContentError,
  RenditionNotFoundError,
  UnknownRenditionError,
} from "../../gen/renditions/error.js";

export const fileRenditionsOperations: FileRenditionsOperations = {
  addRenditionOperation(state, action) {
    const i = action.input;
    if (state.renditions.some((r) => r.id === i.id))
      throw new DuplicateRenditionError(
        `A rendition with id ${i.id} exists already`,
      );
    const mimeType = i.mimeType.trim().toLowerCase();
    if (
      !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(;.*)?$/i.test(
        mimeType,
      )
    )
      throw new InvalidRenditionMimeTypeError(
        `"${i.mimeType}" is not a MIME type`,
      );
    const hasRef = Boolean(i.ref);
    const hasText = i.text !== undefined && i.text !== null;
    if (hasRef === hasText)
      throw new RenditionContentError(
        "A rendition carries either stored content (ref) or inline text, exactly one",
      );
    state.renditions.push({
      id: i.id,
      mimeType,
      type: i.type?.trim() || null,
      label: i.label?.trim() || null,
      ref: i.ref ?? null,
      fileName: i.fileName?.trim() || null,
      sizeBytes: i.sizeBytes ?? null,
      text: i.text ?? null,
      createdAt: i.createdAt,
    });
  },
  updateRenditionOperation(state, action) {
    const i = action.input;
    const r = state.renditions.find((x) => x.id === i.id);
    if (!r) throw new UnknownRenditionError(`No rendition with id ${i.id}`);
    if (i.mimeType !== undefined && i.mimeType !== null) {
      const mimeType = i.mimeType.trim().toLowerCase();
      if (
        !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(;.*)?$/i.test(
          mimeType,
        )
      )
        throw new InvalidUpdatedMimeTypeError(
          `"${i.mimeType}" is not a MIME type`,
        );
      r.mimeType = mimeType;
    }
    if (i.type !== undefined) r.type = i.type?.trim() || null;
    if (i.label !== undefined) r.label = i.label?.trim() || null;
  },
  removeRenditionOperation(state, action) {
    const at = state.renditions.findIndex((r) => r.id === action.input.id);
    if (at < 0)
      throw new RenditionNotFoundError(
        `No rendition with id ${action.input.id}`,
      );
    state.renditions.splice(at, 1);
  },
};
