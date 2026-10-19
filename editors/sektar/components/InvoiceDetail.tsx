// One invoice, in full: header, lines, totals, payments and the lifecycle
// actions. Shared by the invoices board (in a side panel) and the invoice
// document editor (full page). Writes go through kit/data.
import type { InvoiceDocument, PaymentMethod } from "document-models/invoice";
import { useState } from "react";
import {
  addInvoiceLine,
  issueInvoice,
  nextInvoiceNumber,
  recordPayment,
  removeInvoiceLine,
  setInvoiceDetails,
  useContacts,
  useInvoices,
  voidInvoice,
} from "../kit/data.js";
import {
  fmtDate,
  fromDateInput,
  INVOICE_DIRECTION,
  INVOICE_STATUS,
  invoiceTotals,
  isOverdue,
  money,
  PAYMENT_METHOD,
  relativeDays,
  toDateInput,
  plural,
} from "../kit/format.js";
import {
  Avatar,
  Badge,
  Button,
  DetailHeader,
  Feed,
  Field,
  Input,
  MetaStrip,
  Modal,
  Select,
  Table,
  Textarea,
} from "../kit/ui.js";

export function InvoiceStatusBadge({ doc }: { doc: InvoiceDocument }) {
  const s = doc.state.global;
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

export function InvoiceDetail({ doc }: { doc: InvoiceDocument }) {
  const s = doc.state.global;
  const id = doc.header.id;
  const totals = invoiceTotals(s);
  const invoices = useInvoices();
  const contacts = useContacts();
  const contact = contacts.find(
    (c) => c.header.id === s.counterparty.contactId,
  );
  const editable = s.status === "DRAFT";
  const [dialog, setDialog] = useState<"issue" | "pay" | "void" | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    void fn().finally(() => {
      setBusy(false);
      setDialog(null);
    });
  };

  return (
    <div className="sk-stack sk-stack--6">
      <DetailHeader
        media={
          <Avatar
            name={s.counterparty.name}
            size="lg"
            variant={s.direction === "OUTGOING" ? "sage" : "forest"}
          />
        }
        name={s.number ?? "Draft invoice"}
        sub={
          <>
            <b>{money(totals.gross, s.currency)}</b> ·{" "}
            {s.counterparty.name ?? "No counterparty yet"}
          </>
        }
        tags={
          <>
            <Badge tone="forest">{INVOICE_DIRECTION[s.direction].label}</Badge>
            <InvoiceStatusBadge doc={doc} />
          </>
        }
        actions={
          <>
          {s.status === "DRAFT" && (
            <Button
              variant="primary"
              icon="arrow-right"
              disabled={busy || s.lines.length === 0}
              onClick={() => setDialog("issue")}
            >
              {s.direction === "OUTGOING" ? "Issue invoice" : "Approve bill"}
            </Button>
          )}
          {s.status === "OPEN" && (
            <Button
              variant="primary"
              icon="check"
              disabled={busy}
              onClick={() => setDialog("pay")}
            >
              Record payment
            </Button>
          )}
          {(s.status === "DRAFT" || s.status === "OPEN") && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDialog("void")}
            >
              Void
            </Button>
          )}
          </>
        }
      />

      <MetaStrip
        items={[
          { label: "Issued", value: fmtDate(s.issuedAt), icon: "calendar" },
          {
            label: "Due",
            value: s.dueAt
              ? `${fmtDate(s.dueAt)} · ${relativeDays(s.dueAt)}`
              : "—",
            icon: "bell",
          },
          { label: "Reference", value: s.reference ?? "—" },
          {
            label: "Terms",
            value: contact
              ? plural(contact.state.global.paymentTermsDays, "day")
              : s.currency,
          },
        ]}
      />

      <div className="sk-grid sk-grid--2">
        <div className="sk-card sk-card--subtle sk-card--compact">
          <div className="sk-eyebrow sk-mb-2">
            {s.direction === "OUTGOING" ? "Bill to" : "From"}
          </div>
          <div className="sk-weight-semibold">{s.counterparty.name ?? "—"}</div>
          {s.counterparty.address && (
            <div className="sk-small sk-text-secondary">
              {s.counterparty.address}
            </div>
          )}
          {s.counterparty.email && (
            <div className="sk-small sk-text-muted">{s.counterparty.email}</div>
          )}
          {s.counterparty.vatId && (
            <div className="sk-caption">VAT {s.counterparty.vatId}</div>
          )}
        </div>
        <div className="sk-card sk-card--subtle sk-card--compact">
          <div className="sk-eyebrow sk-mb-2">Activity</div>
          <Feed
            items={[
              {
                key: "created",
                icon: "invoice",
                text: <b>Drafted</b>,
                sub: INVOICE_DIRECTION[s.direction].label,
                time: fmtDate(doc.header.createdAtUtcIso),
              },
              ...(s.issuedAt
                ? [
                    {
                      key: "issued",
                      icon: "arrow-right" as const,
                      text: (
                        <>
                          <b>Issued</b> as {s.number}
                        </>
                      ),
                      sub: s.dueAt ? `Due ${fmtDate(s.dueAt)}` : undefined,
                      time: fmtDate(s.issuedAt),
                    },
                  ]
                : []),
              ...s.payments.map((p) => ({
                key: p.id,
                icon: "check-circle" as const,
                text: (
                  <>
                    <b>{money(p.amount, s.currency)}</b> received ·{" "}
                    {PAYMENT_METHOD[p.method]}
                  </>
                ),
                sub: p.transactionId ? "Matched to the bank feed" : undefined,
                time: fmtDate(p.paidAt),
              })),
              ...(s.voidReason
                ? [
                    {
                      key: "void",
                      icon: "close" as const,
                      text: (
                        <>
                          <b>Voided</b> · {s.voidReason}
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      <Table compact>
        <thead>
          <tr>
            <th>Description</th>
            <th className="is-num">Qty</th>
            <th className="is-num">Unit</th>
            <th className="is-num">VAT</th>
            <th className="is-num">Amount</th>
            {editable && <th />}
          </tr>
        </thead>
        <tbody>
          {s.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td className="is-num">{line.quantity}</td>
              <td className="is-num">{money(line.unitPrice, s.currency)}</td>
              <td className="is-num is-muted">{line.vatRate}%</td>
              <td className="is-num">
                {money(line.quantity * line.unitPrice, s.currency)}
              </td>
              {editable && (
                <td className="is-num">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon="close"
                    aria-label="Remove line"
                    onClick={() => void removeInvoiceLine(id, line.id)}
                  />
                </td>
              )}
            </tr>
          ))}
          {s.lines.length === 0 && (
            <tr>
              <td colSpan={editable ? 6 : 5} className="is-muted">
                No lines yet.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={editable ? 5 : 4} className="is-num is-muted">
              Net
            </td>
            <td className="is-num">{money(totals.net, s.currency)}</td>
          </tr>
          <tr>
            <td colSpan={editable ? 5 : 4} className="is-num is-muted">
              VAT
            </td>
            <td className="is-num">{money(totals.vat, s.currency)}</td>
          </tr>
          <tr>
            <td
              colSpan={editable ? 5 : 4}
              className="is-num sk-weight-semibold"
            >
              Total
            </td>
            <td
              className="is-num sk-weight-semibold sk-numeral"
              style={{ fontSize: "var(--sk-text-lg)" }}
            >
              {money(totals.gross, s.currency)}
            </td>
          </tr>
          {s.payments.length > 0 && (
            <tr>
              <td colSpan={editable ? 5 : 4} className="is-num is-muted">
                Outstanding
              </td>
              <td className="is-num">
                {money(totals.outstanding, s.currency)}
              </td>
            </tr>
          )}
        </tfoot>
      </Table>

      {editable && <AddLineForm invoiceId={id} currency={s.currency} />}

      {s.payments.length > 0 && (
        <section className="sk-stack sk-stack--2">
          <div className="sk-eyebrow">Payments</div>
          <ul className="sk-list sk-list--divided">
            {s.payments.map((p) => (
              <li key={p.id} className="sk-list-item">
                <span className="sk-list-item__body">
                  <span className="sk-list-item__title">
                    {PAYMENT_METHOD[p.method]}
                  </span>
                  <span className="sk-list-item__meta">
                    {fmtDate(p.paidAt)}
                    {p.transactionId ? " · matched to bank" : ""}
                  </span>
                </span>
                <span className="sk-list-item__value sk-amount--in">
                  {money(p.amount, s.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NotesField
        invoiceId={id}
        notes={s.notes}
        locked={s.status === "PAID" || s.status === "VOID"}
      />
      {s.voidReason && (
        <div className="sk-alert">
          <div>
            <div className="sk-alert__title">Voided</div>
            {s.voidReason}
          </div>
        </div>
      )}

      {dialog === "issue" && (
        <IssueDialog
          suggestedNumber={nextInvoiceNumber(invoices, s.direction)}
          existingNumber={s.number}
          defaultDue={s.dueAt}
          termsDays={contact?.state.global.paymentTermsDays ?? 30}
          busy={busy}
          onClose={() => setDialog(null)}
          onIssue={(number, dueAt) =>
            run(() => issueInvoice(id, number, dueAt))
          }
        />
      )}
      {dialog === "pay" && (
        <PaymentDialog
          outstanding={totals.outstanding}
          currency={s.currency}
          busy={busy}
          onClose={() => setDialog(null)}
          onPay={(amount, method, paidAt) =>
            run(() => recordPayment(id, amount, method, { paidAt }))
          }
        />
      )}
      {dialog === "void" && (
        <VoidDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onVoid={(reason) => run(() => voidInvoice(id, reason))}
        />
      )}
    </div>
  );
}

function AddLineForm({
  invoiceId,
  currency,
}: {
  invoiceId: string;
  currency: string;
}) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [vatRate, setVatRate] = useState("21");
  const valid = description.trim() && Number(quantity) > 0 && unitPrice !== "";
  return (
    <form
      className="sk-row sk-row--2 sk-row--wrap sk-row--start"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void addInvoiceLine(invoiceId, {
          description: description.trim(),
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          vatRate: Number(vatRate),
        });
        setDescription("");
        setUnitPrice("");
      }}
    >
      <Field label="Line" className="sk-grow">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was delivered"
        />
      </Field>
      <Field label="Qty" style={{ width: 72 }}>
        <Input
          type="number"
          min={0.01}
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </Field>
      <Field label={`Unit (${currency})`} style={{ width: 120 }}>
        <Input
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          placeholder="0.00"
        />
      </Field>
      <Field label="VAT" style={{ width: 90 }}>
        <Select value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
          <option value="21">21%</option>
          <option value="9">9%</option>
          <option value="0">0%</option>
        </Select>
      </Field>
      <div style={{ paddingTop: 26 }}>
        <Button variant="soft" icon="plus" disabled={!valid}>
          Add
        </Button>
      </div>
    </form>
  );
}

function NotesField({
  invoiceId,
  notes,
  locked,
}: {
  invoiceId: string;
  notes?: string | null;
  locked: boolean;
}) {
  const [value, setValue] = useState(notes ?? "");
  if (locked)
    return notes ? <p className="sk-small sk-text-secondary">{notes}</p> : null;
  return (
    <Field label="Notes" hint="Shown on the document">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== (notes ?? ""))
            void setInvoiceDetails(invoiceId, { notes: value || null });
        }}
        placeholder="Payment details, thanks, scope…"
      />
    </Field>
  );
}

function IssueDialog({
  suggestedNumber,
  existingNumber,
  defaultDue,
  termsDays,
  busy,
  onClose,
  onIssue,
}: {
  suggestedNumber: string;
  existingNumber?: string | null;
  defaultDue?: string | null;
  termsDays: number;
  busy: boolean;
  onClose: () => void;
  onIssue: (number: string, dueAt: string) => void;
}) {
  const [number, setNumber] = useState(existingNumber ?? suggestedNumber);
  const [due, setDue] = useState(
    toDateInput(defaultDue) ||
      toDateInput(new Date(Date.now() + termsDays * 86_400_000).toISOString()),
  );
  return (
    <Modal
      title="Issue this invoice?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button
            variant="primary"
            disabled={busy || !number || !due}
            onClick={() => onIssue(number, fromDateInput(due))}
          >
            Issue
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3">
        <p className="sk-text-secondary">
          Lines lock once issued. The number and due date go on the document.
        </p>
        <Field label="Number" required>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <Field label="Due date" required hint={`${termsDays}-day terms`}>
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function PaymentDialog({
  outstanding,
  currency,
  busy,
  onClose,
  onPay,
}: {
  outstanding: number;
  currency: string;
  busy: boolean;
  onClose: () => void;
  onPay: (amount: number, method: PaymentMethod, paidAt: string) => void;
}) {
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paidAt, setPaidAt] = useState(toDateInput(new Date().toISOString()));
  return (
    <Modal
      title="Record a payment"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || Number(amount) <= 0}
            onClick={() => onPay(Number(amount), method, fromDateInput(paidAt))}
          >
            Record {money(Number(amount) || 0, currency)}
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3">
        <Field
          label={`Amount (${currency})`}
          required
          hint={`Outstanding ${money(outstanding, currency)}`}
        >
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Method">
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paid on">
          <Input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function VoidDialog({
  busy,
  onClose,
  onVoid,
}: {
  busy: boolean;
  onClose: () => void;
  onVoid: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Void this invoice?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={busy || !reason.trim()}
            onClick={() => onVoid(reason.trim())}
          >
            Void invoice
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3">
        <p className="sk-text-secondary">
          A void invoice stays in the records with its reason and cannot be
          reopened.
        </p>
        <Field label="Reason" required>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Re-issued with a different scope…"
          />
        </Field>
      </div>
    </Modal>
  );
}
