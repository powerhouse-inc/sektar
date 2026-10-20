// What sending an invoice takes: the invoice printed (or saved as PDF), and
// the receipts behind its forward-billed lines bundled in one zip.
import { useAttachments } from "@powerhousedao/reactor-browser";
import type { InvoiceDocument } from "document-models/invoice";
import { useState } from "react";
import { downloadInvoiceBundle, printInvoice } from "../../kit/invoice-print.js";
import { Button } from "../../kit/ui.js";

export function SendActions({ doc, size }: { doc: InvoiceDocument; size?: "sm" }) {
  const client = useAttachments();
  const s = doc.state.global;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const files =
    s.lines.reduce((n, l) => n + l.attachments.length, 0) +
    s.attachments.filter((a) => a.role !== "ISSUED_COPY" && a.role !== "SOURCE").length;
  return (
    <>
      <Button
        variant="secondary"
        size={size}
        icon="invoice"
        title={s.status === "DRAFT" ? "Print the draft (marked DRAFT), or save it as a PDF" : "Print the invoice, or save it as a PDF to send"}
        onClick={() => void printInvoice(doc)}
      >
        Print
      </Button>
      {files > 0 && (
        <Button
          variant="ghost"
          size={size}
          icon="download"
          disabled={!client || busy}
          title="Every receipt and supporting document behind the invoice, in one zip"
          onClick={() => {
            if (!client) return;
            setBusy(true);
            setError(null);
            downloadInvoiceBundle(doc, client)
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Bundling…" : `Receipts (${files}) .zip`}
        </Button>
      )}
      {error && <span className="sk-small sk-text-danger">{error}</span>}
    </>
  );
}
