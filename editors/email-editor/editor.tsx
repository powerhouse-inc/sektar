import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import { useSelectedEmailDocument } from "document-models/email";
import { useState } from "react";
import type { EmailAttachment } from "document-models/email";
import {
  AttachmentPreview,
  EmailActions,
  EmailDetail,
} from "../sektar/components/EmailDetail.js";
import { Sprite } from "../sektar/kit/ui.js";

/** The email as a document: Connect's toolbar on top, the message below, its attachments beside it. */
export default function Editor() {
  const [document] = useSelectedEmailDocument();
  const [file, setFile] = useState<EmailAttachment | null>(null);
  return (
    <>
      <DocumentToolbar />
      <div
        className="sk-app sk-page"
        style={{ minHeight: "100%", background: "transparent" }}
      >
        <Sprite />
        <div
          className="sk-container sk-stack sk-stack--6"
          style={{ maxWidth: 1100, paddingBlock: "var(--sk-space-6)" }}
        >
          <div className={file ? "sk-grid sk-grid--2" : undefined}>
            <div className="sk-card">
              <EmailDetail
                doc={document}
                selectedRef={file?.ref}
                onPickAttachment={(a) =>
                  setFile((cur) => (cur?.ref === a.ref ? null : a))
                }
                actions={<EmailActions doc={document} />}
              />
            </div>
            {file && (
              <div className="sk-card">
                <div className="sk-card__header">
                  <h3 className="sk-card__title">{file.fileName}</h3>
                </div>
                <AttachmentPreview
                  key={file.ref}
                  documentId={document.header.id}
                  file={file}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
