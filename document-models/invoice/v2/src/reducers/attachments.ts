import type { InvoiceAttachmentsOperations } from "document-models/invoice/v2";
import {
  AttachmentLineNotFoundError,
  AttachmentNotFoundError,
  AttachmentsClosedError,
  InvalidAttachmentError,
} from "../../gen/attachments/error.js";
import { allAttachments, locateAttachment, text } from "../rules.js";

// Attachments stay open after issuing: the receipts behind forward-billed
// costs often arrive later than the invoice.
export const invoiceAttachmentsOperations: InvoiceAttachmentsOperations = {
  addAttachmentOperation(state, action) {
    const i = action.input;
    if (state.status === "VOID")
      throw new AttachmentsClosedError("A void invoice takes no attachments");
    const line = i.lineId
      ? state.lines.find((l) => l.id === i.lineId)
      : undefined;
    if (i.lineId && !line)
      throw new AttachmentLineNotFoundError("No such line");
    if (allAttachments(state).some((a) => a.id === i.id))
      throw new InvalidAttachmentError("The attachment id is already used");
    const fileName = i.fileName.trim();
    const mimeType = i.mimeType.trim().toLowerCase();
    if (!fileName || !mimeType)
      throw new InvalidAttachmentError(
        "An attachment needs a file name and a type",
      );
    if (!i.ref && !i.url && !i.documentId)
      throw new InvalidAttachmentError(
        "An attachment needs stored bytes, a URL or a document",
      );
    const attachment = {
      id: i.id,
      role: i.role,
      fileName,
      mimeType,
      ref: i.ref ?? null,
      sizeBytes: i.sizeBytes ?? null,
      description: text(i.description),
      url: i.url ?? null,
      documentId: i.documentId ?? null,
      addedAt: i.addedAt,
    };
    (line ? line.attachments : state.attachments).push(attachment);
  },
  updateAttachmentOperation(state, action) {
    const i = action.input;
    if (state.status === "VOID")
      throw new AttachmentsClosedError("A void invoice takes no attachments");
    const at = locateAttachment(state, i.id);
    if (!at) throw new AttachmentNotFoundError("No such attachment");
    const attachment = at.list[at.index];
    if (i.role) attachment.role = i.role;
    if (i.fileName)
      attachment.fileName = i.fileName.trim() || attachment.fileName;
    if (i.description !== undefined)
      attachment.description = text(i.description);
    if (i.url !== undefined) attachment.url = i.url ?? null;
    if (i.documentId !== undefined)
      attachment.documentId = i.documentId ?? null;
  },
  removeAttachmentOperation(state, action) {
    if (state.status === "VOID")
      throw new AttachmentsClosedError("A void invoice takes no attachments");
    const at = locateAttachment(state, action.input.id);
    if (!at) throw new AttachmentNotFoundError("No such attachment");
    at.list.splice(at.index, 1);
  },
  moveAttachmentOperation(state, action) {
    const i = action.input;
    if (state.status === "VOID")
      throw new AttachmentsClosedError("A void invoice takes no attachments");
    const at = locateAttachment(state, i.id);
    if (!at) throw new AttachmentNotFoundError("No such attachment");
    const line = i.lineId
      ? state.lines.find((l) => l.id === i.lineId)
      : undefined;
    if (i.lineId && !line)
      throw new AttachmentLineNotFoundError("No such line");
    const [attachment] = at.list.splice(at.index, 1);
    (line ? line.attachments : state.attachments).push(attachment);
  },
};
