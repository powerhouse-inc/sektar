import type { EmailAttachmentsOperations } from "document-models/email/v1";
import {
  AttachmentNotFoundError,
  DuplicateAttachmentError,
  InvalidFileNameError,
} from "../../gen/attachments/error.js";

export const emailAttachmentsOperations: EmailAttachmentsOperations = {
  addAttachmentOperation(state, action) {
    const i = action.input;
    const fileName = i.fileName.trim();
    if (fileName === "")
      throw new InvalidFileNameError("An attachment needs a file name");
    if (
      state.attachments.some(
        (a) => a.id === i.id || (a.ref === i.ref && a.fileName === fileName),
      )
    )
      throw new DuplicateAttachmentError(
        `Attachment ${fileName} is already on the message`,
      );
    state.attachments.push({
      id: i.id,
      ref: i.ref,
      fileName,
      mimeType: i.mimeType ?? null,
      sizeBytes: i.sizeBytes ?? null,
      contentId: i.contentId ?? null,
      inline: i.inline ?? false,
    });
  },
  removeAttachmentOperation(state, action) {
    const index = state.attachments.findIndex((a) => a.id === action.input.id);
    if (index === -1)
      throw new AttachmentNotFoundError(
        `Attachment ${action.input.id} not found`,
      );
    state.attachments.splice(index, 1);
  },
};
