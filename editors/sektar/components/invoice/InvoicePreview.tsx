// One attached document in the preview pane: what it is, then its bytes
// (PDF, image, text), the document it links to, or the link itself.
import type { InvoiceAttachment } from "document-models/invoice";
import { bytes } from "../../kit/files.js";
import { fmtDate } from "../../kit/format.js";
import { roleLabel } from "../../kit/invoice.js";
import { Badge, Icon } from "../../kit/ui.js";
import { LinkedDocumentPreview, StoredFilePreview } from "../FilePreview.js";

export function FilePreviewFrame({ documentId, attachment: a }: { documentId: string; attachment: InvoiceAttachment }) {
  return (
    <div className="sk-inv-docview">
      <div className="sk-inv-docview__about">
        <Badge tone="outline">{roleLabel(a.role)}</Badge>
        <span className="sk-caption">
          {[a.description, a.mimeType, bytes(a.sizeBytes), `added ${fmtDate(a.addedAt)}`].filter(Boolean).join(" · ")}
        </span>
      </div>
      {a.ref ? (
        <StoredFilePreview documentId={documentId} file={{ ref: a.ref, fileName: a.fileName, mimeType: a.mimeType }} />
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
    </div>
  );
}
