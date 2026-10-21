// The invoice, edited: the details pane (parties, what it is, lines,
// currency, VAT, payment, documents) beside a preview pane that shows the
// invoice as the customer reads it, what Peppol would still ask for, and any
// attached document. Stacked under 800px of width, the preview is a level
// deeper. A draft is edited in place; once issued, what was invoiced is
// fixed, while payments and documents stay open.
import { makeNodeSlug, openTarget, upgradeDocument } from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import {
  actions,
  computeTotals,
  type InvoiceAction,
  type InvoiceDocument,
  type InvoiceState,
  type PaymentMethod,
} from "document-models/invoice";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFillHeight, useNarrow } from "../../../backfills/components/measure.js";
import { duplicateInvoice, useInvoices } from "../../kit/data.js";
import { counterparty, fmtDate, fromDateInput, INVOICE_STATUS, isOverdue, money, PAYMENT_METHOD, relativeDays, toDateInput } from "../../kit/format.js";
import { CHECK_TONE, invoiceChecks, invoiceDocuments, nextNumber, termsDays, type Check } from "../../kit/invoice.js";
import { Menu } from "../../kit/menu.js";
import { Alert, Badge, Button, cx, EmptyState, Field, Input, Modal, Select, Selector } from "../../kit/ui.js";
import { Pane, Workspace } from "../../kit/workspace.js";
import { FilePreviewFrame } from "./InvoicePreview.js";
import { InvoicePrintPreview } from "./InvoicePrintPreview.js";
import { AttachmentSection, CurrencySection, DetailsSection, NotesSection, PaymentSection, VatSection } from "./InvoiceSections.js";
import { LineList } from "./LineEditor.js";
import { PartyCards } from "./PartyEditor.js";
import { SendActions } from "./SendActions.js";
import { Section } from "./fields.js";
import { useDocumentLocation } from "../FilePreview.js";

type Dispatch = (action: InvoiceAction | InvoiceAction[]) => void;

/** What the preview pane shows: the invoice, the checks, or one attached document. */
type PreviewKey = "invoice" | "checks" | `doc:${string}`;

/** A v1 invoice has one counterparty and no seller: it needs the upgrade first. */
function isCurrent(state: unknown): state is InvoiceState {
  return typeof state === "object" && state !== null && "buyer" in state && "seller" in state;
}

export function InvoiceWorkspace({ doc, dispatch }: { doc: InvoiceDocument; dispatch: Dispatch }) {
  if (!isCurrent(doc.state.global)) return <UpgradeNotice doc={doc} />;
  return <Editor doc={doc} dispatch={dispatch} />;
}

function UpgradeNotice({ doc }: { doc: InvoiceDocument }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="sk-inv-upgrade">
      <EmptyState
        icon="invoice"
        title="This invoice uses the older format"
        action={
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              upgradeDocument(doc.header.id, 2)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Upgrading…" : "Upgrade the invoice"}
          </Button>
        }
      >
        The new format adds the seller, VAT categories and their legal mentions, exchange rates, re-billed costs and
        documents. Upgrading keeps everything the invoice has.
      </EmptyState>
      {error && <p className="sk-small sk-text-danger">{error}</p>}
    </div>
  );
}

function Editor({ doc, dispatch }: { doc: InvoiceDocument; dispatch: Dispatch }) {
  const s = doc.state.global;
  const [preview, setPreview] = useState<PreviewKey>("invoice");
  const [level, setLevel] = useState(1);
  const [previewPref, setPreviewPref] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<"issue" | "pay" | "void" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const height = useFillHeight(root, true);
  const narrow = useNarrow(root, 900, true);
  const stacked = useNarrow(root, 800, true);
  // Beside a drive tree the two panes are too narrow for the invoice: the
  // preview starts folded there, a click away.
  const compact = useNarrow(root, 1080, true);
  const previewCollapsed = !stacked && (previewPref ?? compact);
  const checks = useMemo(() => invoiceChecks(s), [s]);
  const all = useMemo(() => invoiceDocuments(s), [s]);

  // A removed document takes the preview back to the invoice.
  useEffect(() => {
    if (preview.startsWith("doc:") && !all.some((a) => `doc:${a.attachment.id}` === preview)) setPreview("invoice");
  }, [preview, all]);

  /** Back to the details, scrolled to a section: only the details pane scrolls. */
  const goTo = (section: Check["section"]) => {
    setLevel(1);
    requestAnimationFrame(() => {
      const target = document.getElementById(`inv-${section}`);
      const pane = target?.closest(".sk-pane__body");
      if (!target || !pane) return;
      const top = pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8;
      pane.scrollTo({ top, behavior: "smooth" });
    });
  };

  const show = (key: PreviewKey) => {
    setPreview(key);
    setPreviewPref(false);
    setLevel(2);
  };

  const t = computeTotals(s);
  const options = [
    { value: "invoice", name: s.kind === "CREDIT_NOTE" ? "Credit note" : "Invoice", meta: money(t.gross + t.rounding, s.currency), icon: "invoice" as const },
    {
      value: "checks",
      name: "Checks",
      meta: checks.length ? `${checks.filter((c) => c.level !== "info").length || checks.length} to look at` : "Ready for Peppol",
      icon: "check-circle" as const,
    },
    ...all.map(({ attachment: a, line }) => ({
      value: `doc:${a.id}`,
      name: a.fileName,
      meta: line ? `Line ${line}` : "Invoice",
      icon: "upload" as const,
    })),
  ];

  const active = preview.startsWith("doc:") ? preview.slice(4) : null;
  const shown = active ? all.find((x) => x.attachment.id === active)?.attachment : undefined;

  return (
    <div ref={root} className={cx("sk-file-view sk-inv-view", narrow && "is-narrow")} style={{ height: height ? `${height}px` : undefined }}>
      <Workspace level={level}>
        <Pane grow={1.25} title={<Heading state={s} />} header={<HeaderMenu doc={doc} onVoid={() => setDialog("void")} />}>
          <Details
            doc={doc}
            dispatch={dispatch}
            checks={checks}
            activeDocument={active}
            onShow={show}
            onDialog={setDialog}
            showPreview={stacked || previewCollapsed}
          />
        </Pane>
        <Pane
          side="end"
          grow={1}
          collapsed={previewCollapsed}
          onToggle={() => setPreviewPref(!previewCollapsed)}
          onBack={() => setLevel(1)}
          backLabel="Back to the invoice"
          collapsedTitle="Preview"
          header={<Selector value={preview} options={options} onChange={(v) => setPreview(v as PreviewKey)} label="Preview" />}
        >
          {preview === "invoice" && <InvoicePrintPreview state={s} />}
          {preview === "checks" && <ChecksPanel checks={checks} onGo={(section) => goTo(section)} />}
          {shown && <FilePreviewFrame documentId={doc.header.id} attachment={shown} />}
        </Pane>
      </Workspace>
      {dialog === "issue" && <IssueDialog doc={doc} checks={checks} onClose={() => setDialog(null)} dispatch={dispatch} onChecks={() => { setDialog(null); show("checks"); }} />}
      {dialog === "pay" && <PaymentDialog state={s} onClose={() => setDialog(null)} dispatch={dispatch} />}
      {dialog === "void" && <VoidDialog onClose={() => setDialog(null)} dispatch={dispatch} />}
    </div>
  );
}

function StatusBadge({ state }: { state: InvoiceState }) {
  if (isOverdue(state)) return <Badge tone="danger" dot>Overdue</Badge>;
  const { label, tone } = INVOICE_STATUS[state.status];
  return (
    <Badge tone={tone} dot={state.status === "OPEN"}>
      {label}
    </Badge>
  );
}

function Heading({ state }: { state: InvoiceState }) {
  return (
    <span className="sk-file-heading">
      <span className="sk-eyebrow">
        {state.kind === "CREDIT_NOTE" ? "Credit note" : state.direction === "OUTGOING" ? "Sales invoice" : "Supplier bill"}
      </span>
      <StatusBadge state={state} />
    </span>
  );
}

function HeaderMenu({ doc, onVoid }: { doc: InvoiceDocument; onVoid: () => void }) {
  const s = doc.state.global;
  const location = useDocumentLocation(doc.header.id);
  const [busy, setBusy] = useState(false);
  const copy = (credit: boolean) => {
    if (!location) return;
    setBusy(true);
    void duplicateInvoice(location.drive.header.id, location.node.parentFolder, doc, { credit })
      .then((node) =>
        openTarget({ driveSlug: location.drive.header.slug || location.drive.header.id, nodeSlug: makeNodeSlug(node) }),
      )
      .finally(() => setBusy(false));
  };
  return (
    <>
      <span className="sk-pane__spacer" />
      <Menu
        label="Invoice actions"
        align="end"
        items={[
          { label: "Duplicate as a new draft", disabled: !location || busy, onSelect: () => copy(false) },
          {
            label: "Credit this invoice",
            disabled: !location || busy || s.kind === "CREDIT_NOTE" || s.status === "DRAFT",
            onSelect: () => copy(true),
          },
          {
            label: s.status === "DRAFT" ? "Void the draft" : "Void the invoice",
            danger: true,
            section: "Status",
            disabled: s.status === "PAID" || s.status === "VOID",
            onSelect: onVoid,
          },
          ...(s.status === "PAID"
            ? [{ label: "Paid: remove a payment under Payment to reopen", disabled: true, onSelect: () => undefined }]
            : []),
        ]}
        trigger={(open, toggle) => (
          <button type="button" className="sk-more" aria-haspopup="menu" aria-expanded={open} aria-label="Invoice actions" onClick={toggle}>
            <span />
          </button>
        )}
      />
    </>
  );
}

/* -------------------------------------------------------------- details */

function Details({
  doc,
  dispatch,
  checks,
  activeDocument,
  onShow,
  onDialog,
  showPreview,
}: {
  doc: InvoiceDocument;
  dispatch: Dispatch;
  checks: Check[];
  activeDocument: string | null;
  onShow: (key: PreviewKey) => void;
  onDialog: (d: "issue" | "pay" | "void") => void;
  /** The preview is not beside the details: offer it */
  showPreview: boolean;
}) {
  const s = doc.state.global;
  const locked = s.status !== "DRAFT";
  const closed = s.status === "PAID" || s.status === "VOID";
  const t = computeTotals(s);
  const other = counterparty(s);
  const flags = (section: Check["section"]) => checks.filter((c) => c.section === section && c.level !== "info").length;
  const errors = checks.filter((c) => c.level === "error");
  const sellerFlag = checks.some((c) => c.section === "parties" && c.level !== "info" && /seller/i.test(c.text));
  const buyerFlag = checks.some((c) => c.section === "parties" && c.level !== "info" && /buyer/i.test(c.text));
  const credit = s.kind === "CREDIT_NOTE";
  const title = s.number
    ? `${credit ? "Credit note" : s.direction === "OUTGOING" ? "Invoice" : "Bill"} ${s.number}`
    : credit
      ? "Draft credit note"
      : s.direction === "OUTGOING"
        ? "Draft invoice"
        : "Draft bill";

  return (
    <div className="sk-file-details sk-inv-details">
      <header className="sk-inv-hero">
        <h1 className="sk-inv-title">{title}</h1>
        <p className="sk-inv-sub">
          {other.name ? <>{s.direction === "OUTGOING" ? "To" : "From"} <b>{other.name}</b></> : <span className="sk-text-muted">No {s.direction === "OUTGOING" ? "customer" : "supplier"} yet</span>}
          {s.subject && <> · {s.subject}</>}
        </p>
        <div className="sk-inv-figures">
          <Figure label={credit ? "Credit" : "Total"} value={money(t.gross + t.rounding, s.currency)} strong />
          {s.vatCurrency && t.vatInVatCurrency !== null && <Figure label={`VAT in ${s.vatCurrency}`} value={money(t.vatInVatCurrency, s.vatCurrency)} />}
          {s.status !== "DRAFT" && <Figure label="Paid" value={money(t.paid, s.currency)} />}
          {s.status === "OPEN" && <Figure label="Due" value={money(Math.max(0, t.due), s.currency)} />}
          {s.dueAt && s.status === "OPEN" && <Figure label="Due date" value={`${fmtDate(s.dueAt)} · ${relativeDays(s.dueAt)}`} />}
          {s.issuedAt && <Figure label="Issued" value={fmtDate(s.issuedAt)} />}
        </div>
        <div className="sk-inv-cta">
          {s.status === "DRAFT" && (
            <Button variant="primary" icon="arrow-right" disabled={s.lines.length === 0} onClick={() => onDialog("issue")}>
              {s.direction === "OUTGOING" ? (credit ? "Issue the credit note" : "Issue the invoice") : "Approve the bill"}
            </Button>
          )}
          {s.status === "OPEN" && (
            <Button variant="primary" icon="check" onClick={() => onDialog("pay")}>
              Record a payment
            </Button>
          )}
          {s.direction === "OUTGOING" && <SendActions doc={doc} />}
          {showPreview && (
            <Button variant="secondary" icon="invoice" onClick={() => onShow("invoice")}>
              Preview
            </Button>
          )}
          {checks.length > 0 && (
            <button type="button" className={cx("sk-inv-checkchip", errors.length ? "is-error" : "is-ok")} onClick={() => onShow("checks")}>
              {errors.length
                ? `${errors.length} to fix for Peppol`
                : `${checks.filter((c) => c.level === "warning").length || "No"} warning${checks.filter((c) => c.level === "warning").length === 1 ? "" : "s"}`}
            </button>
          )}
          {checks.length === 0 && <span className="sk-inv-checkchip is-ok">Ready for Peppol</span>}
        </div>
        {s.status === "VOID" && (
          <Alert tone="warning" title="Void">
            {s.voidReason ?? "This invoice was voided."}
          </Alert>
        )}
        {locked && !closed && (
          <p className="sk-caption sk-inv-lockline">
            Issued: what was invoiced is fixed. Payments, the due date, notes and documents can still change.
          </p>
        )}
      </header>

      <Section id="parties" title="Parties" flags={flags("parties")}>
        <PartyCards state={s} dispatch={dispatch} locked={locked} flagged={{ seller: sellerFlag, buyer: buyerFlag }} />
      </Section>

      <Section id="details" title="Details" caption="What the invoice is for, its dates and references" flags={flags("details")}>
        <DetailsSection state={s} dispatch={dispatch} locked={locked} closed={closed} />
      </Section>

      <Section id="lines" title="Lines" count={s.lines.length} caption="What is invoiced; re-billed costs carry their receipts" flags={flags("lines")}>
        <LineList
          state={s}
          documentId={doc.header.id}
          dispatch={dispatch}
          locked={locked}
          attachmentsOpen={s.status !== "VOID"}
          activeAttachment={activeDocument}
          onShowAttachment={(id) => onShow(`doc:${id}`)}
        />
        <Totals state={s} />
      </Section>

      <Section id="currency" title="Currency" caption="The invoice currency, and the rates for costs and VAT in other currencies" flags={flags("currency")}>
        <CurrencySection state={s} dispatch={dispatch} locked={locked} />
      </Section>

      <Section id="vat" title="VAT" caption="The breakdown per category, and why a line carries no VAT" flags={flags("vat")}>
        <VatSection state={s} dispatch={dispatch} locked={locked} />
      </Section>

      <Section id="payment" title="Payment" caption="How to pay, and what has been paid" flags={flags("payment")}>
        <PaymentSection state={s} dispatch={dispatch} locked={locked} closed={closed} onRecord={() => onDialog("pay")} />
      </Section>

      <Section id="attachments" title="Documents" count={s.attachments.length} caption="The invoice as sent, its original, supporting material" flags={flags("attachments")}>
        <AttachmentSection
          state={s}
          documentId={doc.header.id}
          dispatch={dispatch}
          open={s.status !== "VOID"}
          active={activeDocument}
          onShow={(id) => onShow(`doc:${id}`)}
        />
      </Section>

      <Section id="notes" title="Notes">
        <NotesSection state={s} dispatch={dispatch} closed={closed} />
      </Section>

      <dl className="sk-file-meta">
        <div>
          <dt>Created</dt>
          <dd>{new Date(doc.header.createdAtUtcIso).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Modified</dt>
          <dd>{new Date(doc.header.lastModifiedAtUtcIso).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Document</dt>
          <dd className="sk-font-mono">{doc.header.id}</dd>
        </div>
      </dl>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cx("sk-inv-figure", strong && "is-strong")}>
      <span className="sk-inv-figure__label">{label}</span>
      <span className="sk-inv-figure__value">{value}</span>
    </div>
  );
}

function Totals({ state }: { state: InvoiceState }) {
  const t = computeTotals(state);
  if (state.lines.length === 0) return null;
  const cur = state.currency;
  return (
    <dl className="sk-inv-totals">
      <div>
        <dt>Excl. VAT</dt>
        <dd>{money(t.net, cur)}</dd>
      </div>
      <div>
        <dt>VAT</dt>
        <dd>{money(t.vat, cur)}</dd>
      </div>
      {t.rounding !== 0 && (
        <div>
          <dt>Rounding</dt>
          <dd>{money(t.rounding, cur)}</dd>
        </div>
      )}
      <div className="is-strong">
        <dt>Total</dt>
        <dd>{money(t.gross + t.rounding, cur)}</dd>
      </div>
    </dl>
  );
}

/* --------------------------------------------------------------- checks */

function ChecksPanel({ checks, onGo }: { checks: Check[]; onGo: (section: Check["section"]) => void }) {
  if (checks.length === 0)
    return (
      <EmptyState
        icon="check-circle"
        title="Ready for Peppol"
      >
        Everything EN 16931 and Peppol BIS Billing 3.0 ask for is on the invoice.
      </EmptyState>
    );
  const order: Check["level"][] = ["error", "warning", "info"];
  const titles = { error: "To fix", warning: "To look at", info: "Recommended" };
  return (
    <div className="sk-inv-checks">
      <p className="sk-small sk-text-secondary">
        Checked against EN 16931 and Peppol BIS Billing 3.0, the format Belgian businesses exchange invoices in. Fixes go in the section named on each line.
      </p>
      {order.map((level) => {
        const items = checks.filter((c) => c.level === level);
        if (!items.length) return null;
        return (
          <section key={level} className="sk-inv-checks__group">
            <h3 className="sk-file-section__title">
              {titles[level]} <span className="sk-pane__count">{items.length}</span>
            </h3>
            <ul className="sk-inv-checks__list">
              {items.map((c) => (
                <li key={c.text} className={`sk-inv-check sk-inv-check--${c.level}`}>
                  <Badge tone={CHECK_TONE[c.level]}>{SECTION_LABEL[c.section]}</Badge>
                  <span>{c.text}</span>
                  <button
                    type="button"
                    className="sk-btn sk-btn--link sk-btn--sm"
                    onClick={() => onGo(c.section)}
                  >
                    Go there
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const SECTION_LABEL: Record<Check["section"], string> = {
  parties: "Parties",
  details: "Details",
  currency: "Currency",
  lines: "Lines",
  vat: "VAT",
  payment: "Payment",
  attachments: "Documents",
};

/* -------------------------------------------------------------- dialogs */

function IssueDialog({
  doc,
  checks,
  onClose,
  onChecks,
  dispatch,
}: {
  doc: InvoiceDocument;
  checks: Check[];
  onClose: () => void;
  onChecks: () => void;
  dispatch: Dispatch;
}) {
  const s = doc.state.global;
  const invoices = useInvoices();
  const today = toDateInput(new Date().toISOString());
  const [number, setNumber] = useState(() => (s.direction === "OUTGOING" ? nextNumber(invoices.filter((i) => i.header.id !== doc.header.id), s.direction) : ""));
  const [issued, setIssued] = useState(today);
  const days = termsDays(s.paymentTerms) ?? 30;
  const [due, setDue] = useState(() => toDateInput(s.dueAt) || toDateInput(new Date(Date.now() + days * 86_400_000).toISOString()));
  const taken = invoices.some((i) => i.header.id !== doc.header.id && i.state.global.direction === s.direction && i.state.global.number === number.trim());
  const errors = checks.filter((c) => c.level === "error");
  const incoming = s.direction === "INCOMING";
  return (
    <Modal
      title={incoming ? "Approve the bill" : s.kind === "CREDIT_NOTE" ? "Issue the credit note" : "Issue the invoice"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!number.trim() || !issued || taken}
            onClick={() => {
              dispatch(actions.issueInvoice({ number: number.trim(), issuedAt: fromDateInput(issued), dueAt: due ? fromDateInput(due) : null }));
              onClose();
            }}
          >
            {incoming ? "Approve" : "Issue"}
          </Button>
        </>
      }
    >
      <div className="sk-inv-form">
        <Field label={incoming ? "Their invoice number" : "Number"} required error={taken ? "Already used by another invoice" : undefined} hint={incoming ? undefined : "The next in your sequence"} className="sk-inv-form__wide">
          <Input value={number} onChange={(e) => setNumber(e.target.value)} autoFocus />
        </Field>
        <Field label="Issue date">
          <Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
        </Field>
        <Field label="Due date" hint={s.paymentTerms ?? `${days} days`}>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <p className="sk-small sk-text-secondary sk-inv-form__wide">
          Once issued, the parties, lines, currency and VAT are fixed. Payments, notes and documents can still be added.
        </p>
        {errors.length > 0 && (
          <div className="sk-inv-form__wide">
            <Alert tone="warning" title={`${errors.length} thing${errors.length === 1 ? "" : "s"} Peppol would refuse`}>
              <ul className="sk-inv-issue-list">
                {errors.slice(0, 4).map((c) => (
                  <li key={c.text}>{c.text}</li>
                ))}
              </ul>
              <Button size="sm" variant="link" onClick={onChecks}>
                See all checks
              </Button>
            </Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PaymentDialog({ state, onClose, dispatch }: { state: InvoiceState; onClose: () => void; dispatch: Dispatch }) {
  const due = Math.max(0, computeTotals(state).due);
  const [amount, setAmount] = useState(due ? String(due) : "");
  const [date, setDate] = useState(toDateInput(new Date().toISOString()));
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [tx, setTx] = useState("");
  const n = Number(amount.replace(",", "."));
  const ok = Number.isFinite(n) && n > 0 && !!date;
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
            disabled={!ok}
            onClick={() => {
              dispatch(actions.recordPayment({ id: generateId(), paidAt: fromDateInput(date), amount: n, method, transactionId: tx.trim() || null }));
              onClose();
            }}
          >
            Record {ok ? money(n, state.currency) : ""}
          </Button>
        </>
      }
    >
      <div className="sk-inv-form">
        <Field label={`Amount (${state.currency})`} hint={`${money(due, state.currency)} is due`}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Paid on">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bank reference" hint="The transaction it matches, if you know it">
          <Input value={tx} onChange={(e) => setTx(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function VoidDialog({ onClose, dispatch }: { onClose: () => void; dispatch: Dispatch }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Void the invoice"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={() => {
              dispatch(actions.voidInvoice({ reason: reason.trim() }));
              onClose();
            }}
          >
            Void
          </Button>
        </>
      }
    >
      <Field label="Why" hint="Kept with the invoice; an issued invoice that was sent is usually credited instead">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Sent twice, wrong customer…" />
      </Field>
    </Modal>
  );
}
