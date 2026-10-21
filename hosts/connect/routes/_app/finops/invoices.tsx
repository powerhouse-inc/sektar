import { createFileRoute } from "@tanstack/react-router";
import type { InvoiceDirection, InvoiceDocument } from "document-models/invoice";
import { useCallback, useState } from "react";
import { InvoicesWorkspace } from "../../../../../editors/sektar/components/invoice/InvoicesWorkspace.js";
import { useInvoices, useSektarDrive } from "../../../../../editors/sektar/kit/data.js";
import { counterparty, invoiceTotals, useNow } from "../../../../../editors/sektar/kit/format.js";
import { NewInvoicePanel } from "../../-shared/forms.js";
import { matches, useSearch } from "../../-shared/search.js";
import { SetupState } from "../../-shared/setup.js";

export const Route = createFileRoute("/_app/finops/invoices")({
  validateSearch: (raw: Record<string, unknown>): { open?: string } => ({
    ...(typeof raw.open === "string" ? { open: raw.open } : {}),
  }),
  head: () => ({ meta: [{ title: "Invoices · Sektar" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const drive = useSektarDrive();
  const invoices = useInvoices();
  const now = useNow();
  const { query } = useSearch();
  const { open: openParam } = Route.useSearch();
  const [created, setCreated] = useState<string | null>(null);
  const [creating, setCreating] = useState<InvoiceDirection | null>(null);

  const search = useCallback(
    (i: InvoiceDocument) => {
      const s = i.state.global;
      return matches(query, s.number, counterparty(s).name, s.subject, s.references.buyerReference, invoiceTotals(s).gross);
    },
    [query],
  );

  if (!drive || invoices.length === 0) return <SetupState what="invoices" />;

  return (
    <>
      <InvoicesWorkspace invoices={invoices} now={now} query={search} open={created ?? openParam ?? null} onNew={setCreating} />
      {creating && (
        <NewInvoicePanel
          drive={drive}
          direction={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            setCreated(id);
          }}
        />
      )}
    </>
  );
}
