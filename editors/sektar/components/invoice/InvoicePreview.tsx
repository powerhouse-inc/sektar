// One attached document in the preview pane: its bytes (PDF, image, text),
// the document it links to, or the link itself; then what it is.
import type { InvoiceAttachment } from "document-models/invoice";
import { bytes } from "../../kit/files.js";
import { fmtDate } from "../../kit/format.js";
import { roleLabel } from "../../kit/invoice.js";
import { Badge, Icon } from "../../kit/ui.js";
import { LinkedDocumentPreview, StoredFilePreview } from "../FilePreview.js";

export function FilePreviewFrame({
  documentId,
  attachment: a,
  named,
}: {
  documentId: string;
  attachment: InvoiceAttachment;
  /** A picker above already names the file: what it is takes the file name's place in the toolbar */
  named?: boolean;
}) {
  const role = <Badge tone="outline">{roleLabel(a.role)}</Badge>;
  const details = [a.description, a.mimeType, bytes(a.sizeBytes), `added ${fmtDate(a.addedAt)}`].filter(Boolean).join(" · ");
  // Named by a picker: the role in the toolbar (where the name was), the details still at the bottom.
  const toolbarRole = named && a.ref;
  return (
    <div className="sk-inv-docview">
      {a.ref ? (
        <StoredFilePreview documentId={documentId} file={{ ref: a.ref, fileName: a.fileName, mimeType: a.mimeType }} label={toolbarRole ? role : undefined} />
      ) : a.documentId ? (
        <LinkedDocumentPreview documentId={a.documentId} documentType={null} documentName={a.fileName} />
      ) : a.url ? (
        <a className="sk-file-choice" href={a.url} target="_blank" rel="noreferrer">
          <span className="sk-icon-tile">
            <Icon name="arrow-up-right" />
          </span>
          <span className="sk-file-choice__body">
            <span className="sk-file-choice__title">{a.fileName}</span>
            <span className="sk-caption">{a.url}</span>
          </span>
        </a>
      ) : null}
      <div className="sk-inv-docview__about">
        {!toolbarRole && role}
        <span className="sk-caption">{details}</span>
      </div>
    </div>
  );
}
