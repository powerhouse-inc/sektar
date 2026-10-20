import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import { useSelectedInvoiceDocument } from "document-models/invoice";
import { InvoiceWorkspace } from "../sektar/components/invoice/InvoiceWorkspace.js";
import { Sprite } from "../sektar/kit/ui.js";

/**
 * The invoice as a document: Connect's toolbar on top, then the design
 * system's workspace: the invoice's details beside a preview of the invoice
 * as the customer reads it, its Peppol checks and its documents.
 */
export default function Editor() {
  const [document, dispatch] = useSelectedInvoiceDocument();
  return (
    <>
      <DocumentToolbar />
      <div className="sk-app sk-inv-app" style={{ background: "transparent" }}>
        <Sprite />
        <InvoiceWorkspace doc={document} dispatch={dispatch} />
      </div>
    </>
  );
}
