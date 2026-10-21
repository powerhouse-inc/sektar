// The Invoices page as the design system's workspace pattern, like Mail and
// Files, in three columns:
//   the list     every invoice of one side (Sales or Purchases), by date
//   the invoice  read once, top to bottom: who and what, the amount and where
//                it stands, the dates, then its lines grouped by category
//   what's open  a line, with its receipts, stepping line by line; or, with
//                no line open, the invoice itself (the copy that was sent, or
//                the PDF preview for a draft) and the invoice's own documents
// Side by side on a wide screen; one at a time under 640px of container
// width, as a push navigation. Sales or Purchases is the "inbox" choice: a
// sub-bar selector wide, a level-0 chooser opened from the list's title
// when stacked. The top bar's search filters the list; a status menu narrows it.
import { makeNodeSlug, openTarget } from "@powerhousedao/reactor-browser";
import {
  computeTotals,
  type InvoiceDirection,
  type InvoiceDocument,
  type InvoiceLine,
  type InvoiceState,
} from "document-models/invoice";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFillHeight, useNarrow } from "../../../backfills/components/measure.js";
import { counterparty, fmtDate, fmtShortDate, invoiceTotals, isOverdue, money, plural, relativeDays } from "../../kit/format.js";
import { roleLabel } from "../../kit/invoice.js";
import { LINE_HEADERS, printedLine, type PrintedLine } from "../../kit/invoice-print.js";
import { Menu } from "../../kit/menu.js";
import { Avatar, Button, cx, EmptyState, Icon, ListItem, Selector } from "../../kit/ui.js";
import { Pane, PaneSwitch, SubBar, Workspace } from "../../kit/workspace.js";
import { useDocumentLocation } from "../FilePreview.js";
import { InvoiceStatusBadge } from "../InvoiceDetail.js";
import { InvoicePrintPreview } from "./InvoicePrintPreview.js";
import { FilePreviewFrame } from "./InvoicePreview.js";
import { SendActions } from "./SendActions.js";

/** Which level a stacked workspace shows: 0 Sales or Purchases · 1 list · 2 the invoice · 3 what's open */
type Level = 0 | 1 | 2 | 3;

type View = "all" | "draft" | "open" | "overdue" | "settled";

/** The statuses the list can be narrowed to. */
const VIEWS: { value: View; label: string; pick: (s: InvoiceState, now: number) => boolean }[] = [
  { value: "all", label: "All", pick: () => true },
  { value: "draft", label: "Drafts", pick: (s) => s.status === "DRAFT" },
  { value: "open", label: "Open", pick: (s, now) => s.status === "OPEN" && !isOverdue(s, now) },
  { value: "overdue", label: "Overdue", pick: (s, now) => isOverdue(s, now) },
  { value: "settled", label: "Settled", pick: (s) => s.status === "PAID" || s.status === "VOID" },
];

const DIRECTION_NAME: Record<InvoiceDirection, string> = { OUTGOING: "Sales", INCOMING: "Purchases" };

/** The third column: the invoice itself (its PDF preview, or one of its documents by id), or a line by id. */
type Open = { kind: "invoice"; doc: string } | { kind: "line"; id: string };
/** The invoice as its PDF will print, from the print HTML */
const PDF = "pdf";

const isCurrent = (s: unknown): s is InvoiceState => typeof s === "object" && s !== null && "buyer" in s && "lines" in s;
const lineAmount = (l: InvoiceLine) => Math.round(l.quantity * l.unitPrice * 100) / 100;
/** "612 ×", "51.75 ×": how many, in front of a line. */
const qtyLabel = (q: number) => `${Number.isInteger(q) ? q : q.toFixed(2)} ×`;

/** The lines by category, in the order the categories first appear: how the invoice reads, and the order the stepper walks. */
function groupLines(lines: readonly InvoiceLine[]): { name: string; lines: { line: InvoiceLine; n: number }[]; total: number }[] {
  const out: { name: string; lines: { line: InvoiceLine; n: number }[]; total: number }[] = [];
  lines.forEach((line, i) => {
    const name = line.category?.trim() || "Other";
    let g = out.find((x) => x.name === name);
    if (!g) out.push((g = { name, lines: [], total: 0 }));
    g.lines.push({ line, n: i + 1 });
    g.total += lineAmount(line);
  });
  return out;
}

/** What the third column opens on for an invoice: the copy that was sent, else the PDF preview. */
function invoiceView(s: InvoiceState): Open {
  const sent = s.attachments.find((a) => a.role === "ISSUED_COPY");
  return { kind: "invoice", doc: sent?.id ?? PDF };
}

export function InvoicesWorkspace({
  invoices,
  now,
  query,
  open,
  onNew,
}: {
  /** Every invoice, both directions */
  invoices: InvoiceDocument[];
  now: number;
  /** The top bar's search */
  query: (doc: InvoiceDocument) => boolean;
  /** An invoice to open (from the URL, or one just made): it is shown, in its direction */
  open?: string | null;
  onNew: (direction: InvoiceDirection) => void;
}) {
  const [direction, setDirection] = useState<InvoiceDirection>("OUTGOING");
  const [view, setView] = useState<View>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Open>({ kind: "invoice", doc: PDF });
  const [level, setLevel] = useState<Level>(1);
  const [listCollapsed, setListCollapsed] = useState(false);
  // null: decide for me, folded while the workspace is too narrow for three panes.
  const [sidePref, setSidePref] = useState<boolean | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const listBody = useRef<HTMLDivElement>(null);
  const height = useFillHeight(root, true);
  const narrow = useNarrow(root, 1000, true);
  const sideCollapsed = sidePref ?? narrow;

  const counts = useMemo(
    () => ({
      OUTGOING: invoices.filter((i) => i.state.global.direction === "OUTGOING").length,
      INCOMING: invoices.filter((i) => i.state.global.direction === "INCOMING").length,
    }),
    [invoices],
  );
  const pickView = VIEWS.find((v) => v.value === view) ?? VIEWS[0];
  const rows = useMemo(
    () =>
      invoices
        .filter((i) => i.state.global.direction === direction)
        .filter((i) => pickView.pick(i.state.global, now))
        .filter(query)
        .sort((a, b) =>
          (b.state.global.issuedAt ?? b.header.createdAtUtcIso).localeCompare(a.state.global.issuedAt ?? a.header.createdAtUtcIso),
        ),
    [invoices, direction, pickView, now, query],
  );

  const selected = invoices.find((i) => i.header.id === selectedId);
  const state = selected && isCurrent(selected.state.global) ? selected.state.global : null;
  const lines = useMemo(() => state?.lines ?? [], [state]);
  // The order the invoice reads in (by category): the stepper walks it.
  const walk = useMemo(() => groupLines(lines).flatMap((g) => g.lines.map((x) => x.line)), [lines]);
  const lineAt = opened.kind === "line" ? walk.findIndex((l) => l.id === opened.id) : -1;

  const pick = (doc: InvoiceDocument) => {
    setSelectedId(doc.header.id);
    setOpened(isCurrent(doc.state.global) ? invoiceView(doc.state.global) : { kind: "invoice", doc: PDF });
    setLevel(2);
  };

  // Opened from elsewhere (search, a contact, a new invoice): its direction too.
  const asked = open ? invoices.find((i) => i.header.id === open) : undefined;
  useEffect(() => {
    if (!asked) return;
    setDirection(asked.state.global.direction);
    setView("all");
    pick(asked);
    // once per invoice asked for, not on every change to it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked?.header.id]);

  // A line removed from the invoice takes the third column back to the invoice.
  useEffect(() => {
    if (state && opened.kind === "line" && lineAt < 0) setOpened(invoiceView(state));
  }, [state, opened, lineAt]);

  // A new direction or status starts the list at the top.
  useEffect(() => {
    if (listBody.current) listBody.current.scrollTop = 0;
  }, [direction, view]);

  const chooseDirection = (d: InvoiceDirection) => {
    setDirection(d);
    setLevel(1);
    // An invoice from the other side is not in this list: it closes.
    if (selected && selected.state.global.direction !== d) setSelectedId(null);
  };
  const openLine = (id: string) => {
    setOpened({ kind: "line", id });
    setSidePref(false);
    setLevel(3);
  };
  const step = (by: number) => {
    const next = walk[lineAt + by];
    if (next) setOpened({ kind: "line", id: next.id });
  };

  // Walking the lines with the arrow keys while one is open, unless typing.
  useEffect(() => {
    if (opened.kind !== "line") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        step(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const directionOptions = (["OUTGOING", "INCOMING"] as const).map((d) => ({
    value: d,
    name: DIRECTION_NAME[d],
    meta: plural(counts[d], d === "OUTGOING" ? "invoice" : "bill"),
    icon: d === "OUTGOING" ? ("invoice" as const) : ("cart" as const),
  }));

  return (
    <div ref={root} className="sk-invoices" style={{ height: height ? `${height}px` : undefined }}>
      {/* Sales or Purchases: a second top-bar row. Narrow, the design system
          hides it and the list's title becomes the switch to the chooser. */}
      <SubBar className="sk-subbar--wide">
        <Selector value={direction} options={directionOptions} onChange={chooseDirection} label="Direction" />
      </SubBar>

      <Workspace level={level} hasParent>
        <Pane parent title="Invoices" flush>
          <Selector value={direction} options={directionOptions} onChange={chooseDirection} label="Direction" list />
        </Pane>

        <Pane
          side="start"
          grow={0.9}
          flush
          bodyRef={listBody}
          collapsed={listCollapsed}
          onToggle={() => setListCollapsed((v) => !v)}
          count={rows.length}
          header={<PaneSwitch label={DIRECTION_NAME[direction]} ariaLabel="Choose sales or purchases" onClick={() => setLevel(0)} />}
          trailing={
            <span className="sk-row" style={{ gap: "var(--sk-space-1)", flexWrap: "nowrap" }}>
              <Menu
                label="Status"
                items={VIEWS.map((v) => ({ label: v.label, active: v.value === view, onSelect: () => setView(v.value) }))}
                trigger={(isOpen, toggle) => (
                  <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm" aria-haspopup="menu" aria-expanded={isOpen} onClick={toggle}>
                    {pickView.label}
                    <Icon name="chevron-down" size={16} mono />
                  </button>
                )}
              />
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon="plus"
                aria-label={direction === "OUTGOING" ? "New invoice" : "New bill"}
                title={direction === "OUTGOING" ? "New invoice" : "New bill"}
                onClick={() => onNew(direction)}
              />
            </span>
          }
        >
          {rows.length === 0 ? (
            <div style={{ padding: "var(--sk-space-6)" }}>
              <EmptyState icon="invoice" title="Nothing here">
                {view !== "all"
                  ? `No ${pickView.label.toLowerCase()} ${direction === "OUTGOING" ? "sales invoices" : "purchase bills"}.`
                  : "No invoice matches that search."}
              </EmptyState>
            </div>
          ) : (
            <ul className="sk-list sk-list--rich">
              {rows.map((doc) => (
                <li key={doc.header.id}>
                  <InvoiceRow doc={doc} now={now} selected={doc.header.id === selectedId} onClick={() => pick(doc)} />
                </li>
              ))}
            </ul>
          )}
        </Pane>

        <Pane
          grow={1.3}
          flush
          onBack={() => setLevel(1)}
          backLabel="Back to the list"
          // Issued: its number and where it stands. A draft is simply that.
          title={selected ? (state?.number ?? "Draft invoice") : "Invoice"}
          header={selected && state?.number && <InvoiceStatusBadge doc={selected} />}
        >
          {!selected ? (
            <div style={{ padding: "var(--sk-space-6)" }}>
              <EmptyState icon="invoice" title="Pick an invoice">
                It opens here, line by line; a line opens beside it with its receipt.
              </EmptyState>
            </div>
          ) : !state ? (
            <div style={{ padding: "var(--sk-space-6)" }}>
              <EmptyState icon="invoice" title="This invoice uses the older format">
                Open it in the invoice editor to upgrade it.
              </EmptyState>
            </div>
          ) : (
            <InvoiceRead
              doc={selected}
              state={state}
              now={now}
              activeLine={opened.kind === "line" ? opened.id : null}
              invoiceOpen={opened.kind === "invoice"}
              onLine={openLine}
              onInvoice={() => {
                setOpened(invoiceView(state));
                setSidePref(false);
                setLevel(3);
              }}
            />
          )}
        </Pane>

        <Pane
          side="end"
          grow={1}
          collapsed={sideCollapsed}
          onToggle={() => setSidePref(!sideCollapsed)}
          onBack={() => setLevel(2)}
          backLabel="Back to the invoice"
          collapsedTitle={opened.kind === "line" ? "Line" : "Preview"}
          header={
            state && opened.kind === "line" && lineAt >= 0 ? (
              <LineStepper at={lineAt} n={lines.indexOf(walk[lineAt]) + 1} count={walk.length} onStep={step} onClose={() => setOpened(invoiceView(state))} />
            ) : state ? (
              <Selector
                value={opened.kind === "invoice" ? opened.doc : PDF}
                options={[
                  { value: PDF, name: "Preview" },
                  ...state.attachments.map((a) => ({ value: a.id, name: a.fileName, meta: roleLabel(a.role) })),
                ]}
                onChange={(doc) => setOpened({ kind: "invoice", doc })}
                label="Invoice document"
              />
            ) : undefined
          }
          title={state ? undefined : "Preview"}
        >
          {selected && state ? (
            opened.kind === "line" && lineAt >= 0 ? (
              <LineView key={opened.id} documentId={selected.header.id} state={state} line={walk[lineAt]} />
            ) : (
              <InvoiceDocView documentId={selected.header.id} state={state} doc={opened.kind === "invoice" ? opened.doc : PDF} />
            )
          ) : (
            <p className="sk-small sk-text-muted">A line and its receipt open here.</p>
          )}
        </Pane>
      </Workspace>
    </div>
  );
}

/* ------------------------------------------------------------------ list */

/** A row re-renders only when its invoice or its selection changes. */
const InvoiceRow = memo(InvoiceRowImpl, (a, b) => a.doc === b.doc && a.selected === b.selected && a.now === b.now);

function InvoiceRowImpl({ doc, now, selected, onClick }: { doc: InvoiceDocument; now: number; selected: boolean; onClick: () => void }) {
  const s = doc.state.global;
  const t = invoiceTotals(s);
  const overdue = isOverdue(s, now);
  const name = counterparty(s).name ?? "No counterparty yet";
  const when =
    s.status === "OPEN"
      ? `due ${relativeDays(s.dueAt)}`
      : s.status === "PAID"
        ? `paid ${fmtShortDate(s.payments.at(-1)?.paidAt)}`
        : s.status === "DRAFT"
          ? "not issued"
          : "void";
  return (
    <ListItem
      rich
      selected={selected}
      onClick={onClick}
      // Stacked, this row leads to the invoice screen: the chevron says so.
      drill={2}
      icon={<Avatar name={name} variant={s.direction === "OUTGOING" ? "sage" : "forest"} />}
      title={<span className={cx(s.status === "VOID" && "sk-text-muted")}>{name}</span>}
      sub={[
        <span key="what" style={{ color: "var(--sk-text)" }}>
          {s.number ?? "Draft"} · {s.subject ?? s.lines[0]?.description ?? "No lines"}
        </span>,
        <span key="when" className={cx(overdue && "sk-text-danger")}>
          {s.issuedAt ? `${fmtShortDate(s.issuedAt)} · ` : ""}
          {when}
        </span>,
      ]}
      aside={
        <>
          <span className="sk-tabular">{money(s.status === "OPEN" ? t.outstanding : t.gross, s.currency)}</span>
          <InvoiceStatusBadge doc={doc} />
        </>
      }
      chevron
    />
  );
}

/* --------------------------------------------------------------- invoice */

/** Opens the invoice in its editor, where it is changed. */
function useOpenInvoice(documentId: string): (() => void) | null {
  const location = useDocumentLocation(documentId);
  if (!location) return null;
  return () =>
    openTarget({
      driveSlug: location.drive.header.slug || location.drive.header.id,
      nodeSlug: makeNodeSlug(location.node),
    });
}

/** The invoice read once: who and what, the amount and where it stands, the dates, the lines. */
function InvoiceRead({
  doc,
  state: s,
  now,
  activeLine,
  invoiceOpen,
  onLine,
  onInvoice,
}: {
  doc: InvoiceDocument;
  state: InvoiceState;
  now: number;
  activeLine: string | null;
  invoiceOpen: boolean;
  onLine: (id: string) => void;
  onInvoice: () => void;
}) {
  const open = useOpenInvoice(doc.header.id);
  const t = computeTotals(s);
  const total = t.gross + t.rounding;
  const other = counterparty(s);
  const overdue = isOverdue(s, now);
  const kind = s.kind === "CREDIT_NOTE" ? "Credit note" : s.direction === "OUTGOING" ? "Sales invoice" : "Purchase bill";
  const missing = s.lines.filter((l) => l.attachments.length === 0).length;

  const groups = useMemo(() => groupLines(s.lines), [s.lines]);
  /** The invoice's own rate from a currency into its currency (either way round as stored). */
  const rateInto = (from: string): number | null => {
    const r = s.exchangeRates.find((x) => (x.base === from && x.quote === s.currency) || (x.base === s.currency && x.quote === from));
    if (!r) return null;
    return r.base === from ? r.rate : Math.round((1 / r.rate) * 1e6) / 1e6;
  };

  const standing =
    s.status === "PAID"
      ? `Paid ${fmtDate(s.payments.at(-1)?.paidAt)}`
      : s.status === "VOID"
        ? "Void"
        : s.status === "DRAFT"
          ? "Not issued yet"
          : t.paid > 0
            ? `${money(t.paid, s.currency)} paid · ${money(invoiceTotals(s).outstanding, s.currency)} to go`
            : `Due ${relativeDays(s.dueAt)}`;

  return (
    <article className="sk-invbook">
      <header className="sk-invbook__head">
        <Avatar name={other.name ?? "?"} size="lg" variant={s.direction === "OUTGOING" ? "sage" : "forest"} />
        <div className="sk-invbook__who">
          <div className="sk-eyebrow">
            {kind} · {s.number ?? "Draft"}
          </div>
          <h2 className="sk-invbook__name">{other.name ?? "No counterparty yet"}</h2>
          {s.subject && <div className="sk-invbook__subject">{s.subject}</div>}
        </div>
      </header>

      <button type="button" className={cx("sk-invbook__total", invoiceOpen && "is-active")} onClick={onInvoice} title="See the invoice as it reads">
        <span className="sk-numeral sk-invbook__amount">{money(total, s.currency)}</span>
        <span className={cx("sk-invbook__standing", overdue && "sk-text-danger")}>{standing}</span>
        {s.vatCurrency && s.vatCurrency !== s.currency && s.exchangeRates[0] && (
          <span className="sk-invbook__rate">
            1 {s.exchangeRates[0].base} = {s.exchangeRates[0].rate} {s.exchangeRates[0].quote}
          </span>
        )}
      </button>

      <dl className="sk-invbook__facts">
        <Fact label="Issued" value={s.issuedAt ? fmtDate(s.issuedAt) : "—"} />
        <Fact label="Due" value={s.dueAt ? fmtDate(s.dueAt) : "—"} tone={overdue ? "danger" : undefined} />
        {s.period && <Fact label="Period" value={`${fmtShortDate(s.period.start)} – ${fmtShortDate(s.period.end)}`} />}
        {t.vat !== 0 && <Fact label="VAT" value={money(t.vat, s.currency)} />}
      </dl>

      <div className="sk-invbook__actions">
        <Button variant="secondary" icon="arrow-up-right" disabled={!open} onClick={open ?? undefined}>
          Open in the editor
        </Button>
        {s.direction === "OUTGOING" && <SendActions doc={doc} />}
      </div>

      <section className="sk-invbook__lines" aria-label="Lines">
        <div className="sk-invbook__lines-head">
          <span className="sk-eyebrow">{plural(s.lines.length, "line")}</span>
          {missing > 0 && (
            <span className="sk-invbook__missing">
              <span className="sk-invbook__dot" aria-hidden="true" />
              {missing} without a receipt
            </span>
          )}
        </div>
        {groups.map((g) => (
          <div key={g.name} className="sk-invbook__group">
            <div className="sk-invbook__group-head">
              <span>{g.name}</span>
              <span className="sk-tabular">{money(g.total, s.currency)}</span>
            </div>
            <ul className="sk-invbook__rows">
              {g.lines.map(({ line, n }) => (
                <li key={line.id}>
                  <LineRow line={line} n={n} currency={s.currency} rate={rateInto} active={line.id === activeLine} onOpen={() => onLine(line.id)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {s.lines.length === 0 && <p className="sk-small sk-text-muted">No lines yet.</p>}
      </section>

      {(t.vat !== 0 || t.rounding !== 0) && (
        <dl className="sk-invbook__sum">
          <Fact label="Net" value={money(t.net, s.currency)} />
          <Fact label="VAT" value={money(t.vat, s.currency)} />
          {t.rounding !== 0 && <Fact label="Rounding" value={money(t.rounding, s.currency)} />}
          <Fact label="Total" value={money(total, s.currency)} strong />
        </dl>
      )}
    </article>
  );
}

function Fact({ label, value, tone, strong }: { label: string; value: ReactNode; tone?: "danger"; strong?: boolean }) {
  return (
    <div className={cx("sk-invbook__fact", strong && "is-strong")}>
      <dt>{label}</dt>
      <dd className={cx("sk-tabular", tone === "danger" && "sk-text-danger")}>{value}</dd>
    </div>
  );
}

/** One line: what it is, where the amount came from, the amount, whether its receipt is there. */
function LineRow({
  line,
  n,
  currency,
  rate,
  active,
  onOpen,
}: {
  line: InvoiceLine;
  n: number;
  currency: string;
  /** The invoice's rate from a currency into its own, for a line that does not carry one */
  rate: (from: string) => number | null;
  active: boolean;
  onOpen: () => void;
}) {
  const original = line.original && line.original.currency !== currency ? line.original : null;
  const factor = original ? (original.rate ?? rate(original.currency)) : null;
  const receipts = line.attachments.length;
  return (
    <button
      type="button"
      className={cx("sk-invbook__line", active && "is-active")}
      onClick={onOpen}
      data-sk-drill={3}
      aria-current={active || undefined}
      aria-label={`Line ${n}: ${line.quantity} × ${line.description}`}
    >
      {/* How many, in front of what: "1 × Toggl". */}
      <span className="sk-invbook__qty" aria-hidden="true">
        {qtyLabel(line.quantity)}
      </span>
      <span className="sk-invbook__line-main">
        <span className="sk-invbook__line-desc">{line.description}</span>
        {/* More than one: what one costs, under what it is. */}
        {(line.quantity !== 1 || line.note) && (
          <span className="sk-invbook__line-meta">
            {[line.quantity !== 1 ? `Unit cost: ${money(line.unitPrice, currency)}` : null, line.note].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className="sk-invbook__line-amount">
        <span className="sk-tabular">{money(lineAmount(line), currency)}</span>
        {/* A forward-billed cost: what it was, times the rate, makes the total above. */}
        {original && (
          <span className="sk-invbook__line-from sk-tabular">
            = {money(original.amount, original.currency)}
            {factor ? ` × ${factor}` : ""}
          </span>
        )}
      </span>
      <span
        className={cx("sk-invbook__mark", receipts === 0 && "is-missing")}
        title={receipts === 0 ? "No receipt yet" : plural(receipts, "receipt")}
      >
        {receipts === 0 ? <span className="sk-invbook__dot" /> : <Icon name="check" size={16} mono />}
      </span>
      {/* Stacked, the row leads to the line's screen: the chevron says so. */}
      <Icon name="chevron-right" size={16} mono className="sk-stack-only sk-invbook__chevron" />
    </button>
  );
}

/* ----------------------------------------------------------- what's open */

/**
 * The third column's header for a line: which line, a step up or down the
 * invoice as it reads (the arrow keys do the same), back to the invoice.
 */
function LineStepper({ at, n, count, onStep, onClose }: { at: number; n: number; count: number; onStep: (by: number) => void; onClose: () => void }) {
  return (
    <div className="sk-invbook__stepper">
      <span className="sk-invbook__step">
        Line <b>{n}</b> of {count}
      </span>
      <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon" aria-label="Line above" title="Line above (↑)" disabled={at === 0} onClick={() => onStep(-1)}>
        <Icon name="chevron-down" size={16} mono className="sk-invbook__up" />
      </button>
      <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon" aria-label="Line below" title="Line below (↓)" disabled={at === count - 1} onClick={() => onStep(1)}>
        <Icon name="chevron-down" size={16} mono />
      </button>
      <span className="sk-pane__spacer" />
      <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon sk-stack-hide" aria-label="Show the invoice" title="Show the invoice" onClick={onClose}>
        <Icon name="close" size={16} mono />
      </button>
    </div>
  );
}

/** A line opened: its facts, then its receipts. */
function LineView({ documentId, state: s, line }: { documentId: string; state: InvoiceState; line: InvoiceLine }) {
  const [receipt, setReceipt] = useState(line.attachments[0]?.id ?? null);
  const shown = line.attachments.find((a) => a.id === receipt) ?? line.attachments[0];
  // The line as the PDF prints it: its headers, its cells; the currency said
  // once above the table, as the PDF says it above its lines.
  const p = printedLine(line, s.currency, { symbol: false });
  const widths = useColumnWidths(s);
  return (
    <div className="sk-invbook-line">
      <div className="sk-invbook-line__scroll">
        <div className="sk-invbook-line__currency">All amounts in {s.currency}</div>
        {/* Column widths fixed for the whole invoice (fitted to its largest
            figures): stepping from line to line, the columns stay put. */}
        {/* The description keeps at least 5em: an invoice with huge figures scrolls sideways rather than crushing it. */}
        <table className="sk-invbook-line__table" style={{ minWidth: `calc(${widths.reduce((a, b) => a + b, 0)}ch + 5em)` }}>
          <colgroup>
            <col />
            {widths.map((w, i) => (
              <col key={i} style={{ width: `${w}ch` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {LINE_HEADERS.map((h, i) => (
                <th key={h} className={cx(i > 0 && "is-num")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {p.description}
                {p.note && <div className="sk-invbook-line__note">{p.note}</div>}
              </td>
              <td className="is-num">{p.unitPrice}</td>
              <td className="is-num">{p.quantity}</td>
              <td className="is-num">{p.net}</td>
              <td className="is-num">{p.vatRate}</td>
              <td className="is-num">{p.gross}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {line.attachments.length > 1 && (
        <Selector
          value={shown?.id ?? ""}
          options={line.attachments.map((a) => ({ value: a.id, name: a.fileName, meta: roleLabel(a.role) }))}
          onChange={setReceipt}
          label="Receipt"
        />
      )}
      {shown ? (
        <FilePreviewFrame key={shown.id} documentId={documentId} attachment={shown} />
      ) : (
        <div className="sk-invbook-line__none">
          <span className="sk-invbook__dot" aria-hidden="true" />
          <div>
            <div className="sk-weight-medium">No receipt on this line yet</div>
            <div className="sk-caption">Attach one in the invoice editor; it shows here.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The open line's figure columns, in `ch`: each as wide as the widest value
 * any line of the invoice puts in it (or the longest word of its header),
 * plus room between columns. One set per invoice, so the columns hold still.
 */
function useColumnWidths(s: InvoiceState): number[] {
  return useMemo(() => {
    const rows = s.lines.map((l) => printedLine(l, s.currency, { symbol: false }));
    const cells: (keyof PrintedLine)[] = ["unitPrice", "quantity", "net", "vatRate", "gross"];
    return cells.map((key, i) => {
      const widest = Math.max(0, ...rows.map((r) => String(r[key] ?? "").length));
      const word = Math.max(...LINE_HEADERS[i + 1].split(" ").map((w) => w.length));
      // Room between columns: a figure needs a little, a header word (and the cell's padding) a little more.
      return Math.max(widest + 0.6, word + 1.2);
    });
  }, [s.lines, s.currency]);
}

/** The invoice itself: its PDF preview (from the print HTML), or one of its own documents. */
function InvoiceDocView({ documentId, state: s, doc }: { documentId: string; state: InvoiceState; doc: string }) {
  const attachment = s.attachments.find((a) => a.id === doc);
  if (attachment) return <FilePreviewFrame key={attachment.id} documentId={documentId} attachment={attachment} />;
  return <InvoicePrintPreview state={s} />;
}
