// One invoice at a glance, for the side panels of the Invoices and Contacts
// boards: who, how much, where it stands, and the invoice as the customer
// reads it. Editing happens in the invoice editor, one click away.
import { makeNodeSlug, openTarget } from "@powerhousedao/reactor-browser";
import { computeTotals, type InvoiceDocument, type InvoiceState } from "document-models/invoice";
import { SEKTAR_DRIVE_SLUG } from "../kit/data.js";
import type { InvoiceRow } from "../kit/finance-index.js";
import { counterparty, fmtDate, INVOICE_STATUS, isOverdue, money, relativeDays } from "../kit/format.js";
import { invoiceChecks } from "../kit/invoice.js";
import { Avatar, Badge, Button, DetailHeader, EmptyState, MetaStrip } from "../kit/ui.js";
import { InvoicePaper } from "./invoice/InvoicePaper.js";
import { useDocumentLocation } from "./FilePreview.js";
import { SendActions } from "./invoice/SendActions.js";

const isCurrent = (state: unknown): state is InvoiceState =>
  typeof state === "object" && state !== null && "buyer" in state;

export function InvoiceStatusBadge({ doc }: { doc: InvoiceDocument }) {
  const s = doc.state.global;
  if (!isCurrent(s)) return <Badge tone="outline">Older format</Badge>;
  if (isOverdue(s))
    return (
      <Badge tone="danger" dot>
        Overdue
      </Badge>
    );
  const { label, tone } = INVOICE_STATUS[s.status];
  return (
    <Badge tone={tone} dot={s.status === "OPEN"}>
      {label}
    </Badge>
  );
}

/** Where an invoice stands, from its index row: as `InvoiceStatusBadge` says it from the document. */
export function InvoiceRowStatusBadge({ row }: { row: InvoiceRow }) {
  if (row.overdue)
    return (
      <Badge tone="danger" dot>
        Overdue
      </Badge>
    );
  const known = row.status in INVOICE_STATUS ? INVOICE_STATUS[row.status as keyof typeof INVOICE_STATUS] : null;
  if (!known) return <Badge tone="outline">{row.status}</Badge>;
  return (
    <Badge tone={known.tone} dot={row.status === "OPEN"}>
      {known.label}
    </Badge>
  );
}

export function InvoiceDetail({ doc }: { doc: InvoiceDocument }) {
  const location = useDocumentLocation(doc.header.id, SEKTAR_DRIVE_SLUG);
  const open = () =>
    location &&
    openTarget({
      driveSlug: location.drive.header.slug || location.drive.header.id,
      nodeSlug: makeNodeSlug(location.node),
    });
  const s = doc.state.global;
  if (!isCurrent(s))
    return (
      <EmptyState
        icon="invoice"
        title="This invoice uses the older format"
        action={
          <Button variant="primary" disabled={!location} onClick={open}>
            Open it to upgrade
          </Button>
        }
      >
        The invoice editor upgrades it in one click.
      </EmptyState>
    );
  const t = computeTotals(s);
  const other = counterparty(s);
  const errors = invoiceChecks(s).filter((c) => c.level === "error").length;
  return (
    <div className="sk-stack sk-stack--6">
      <DetailHeader
        media={<Avatar name={other.name} size="lg" variant={s.direction === "OUTGOING" ? "sage" : "forest"} />}
        name={s.number ?? (s.kind === "CREDIT_NOTE" ? "Draft credit note" : "Draft invoice")}
        sub={
          <>
            <b>{money(t.gross + t.rounding, s.currency)}</b> · {other.name ?? "No counterparty yet"}
          </>
        }
        tags={
          <>
            {s.kind === "CREDIT_NOTE" && <Badge tone="forest">Credit note</Badge>}
            <InvoiceStatusBadge doc={doc} />
            {errors > 0 && s.direction === "OUTGOING" && <Badge tone="warning">{errors} to fix for Peppol</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="primary" icon="arrow-up-right" disabled={!location} onClick={open}>
              Open the invoice
            </Button>
            {s.direction === "OUTGOING" && <SendActions doc={doc} />}
          </>
        }
      />
      <MetaStrip
        items={[
          { label: "Issued", value: fmtDate(s.issuedAt), icon: "calendar" },
          {
            label: "Due",
            value: s.dueAt ? `${fmtDate(s.dueAt)}${s.status === "OPEN" ? ` · ${relativeDays(s.dueAt)}` : ""}` : "—",
            icon: "bell",
          },
          { label: "Paid", value: money(t.paid, s.currency) },
          {
            label: "Documents",
            value: String(s.attachments.length + s.lines.reduce((n, l) => n + l.attachments.length, 0)),
          },
        ]}
      />
      <InvoicePaper state={s} className="sk-inv-paper--compact" />
    </div>
  );
}
