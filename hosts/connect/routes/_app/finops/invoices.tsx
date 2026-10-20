import { createFileRoute } from "@tanstack/react-router";
import type {
  InvoiceDirection,
  InvoiceDocument,
} from "document-models/invoice";
import { useEffect, useState } from "react";
import {
  InvoiceDetail,
  InvoiceStatusBadge,
} from "../../../../../editors/sektar/components/InvoiceDetail.js";
import {
  useInvoices,
  useSektarDrive,
} from "../../../../../editors/sektar/kit/data.js";
import {
  fmtShortDate,
  counterparty,
  bookTotals,
  invoiceTotals,
  isOverdue,
  money,
  relativeDays,
  useNow,
  plural,
} from "../../../../../editors/sektar/kit/format.js";
import {
  Avatar,
  Button,
  PageHeader,
  Selector,
  SidePanel,
  Stat,
  cx,
} from "../../../../../editors/sektar/kit/ui.js";
import { NewInvoicePanel } from "../../-shared/forms.js";
import { matches, useSearch } from "../../-shared/search.js";
import { SetupState } from "../../-shared/setup.js";

export const Route = createFileRoute("/_app/finops/invoices")({
  validateSearch: (raw: Record<string, unknown>): { open?: string } => ({
    ...(typeof raw.open === "string" ? { open: raw.open } : {}),
  }),
  head: () => ({ meta: [{ title: "Invoices · Sektar" }] }),
  component: InvoicesBoard,
});

type Column = {
  key: string;
  label: string;
  caption: string;
  pick: (i: InvoiceDocument, now: number) => boolean;
};

const COLUMNS: Column[] = [
  {
    key: "draft",
    label: "Drafts",
    caption: "Not issued yet",
    pick: (i) => i.state.global.status === "DRAFT",
  },
  {
    key: "open",
    label: "Open",
    caption: "Awaiting payment",
    pick: (i, now) =>
      i.state.global.status === "OPEN" && !isOverdue(i.state.global, now),
  },
  {
    key: "overdue",
    label: "Overdue",
    caption: "Past the due date",
    pick: (i, now) => isOverdue(i.state.global, now),
  },
  {
    key: "paid",
    label: "Settled",
    caption: "Paid or void",
    pick: (i) =>
      i.state.global.status === "PAID" || i.state.global.status === "VOID",
  },
];

function InvoicesBoard() {
  const drive = useSektarDrive();
  const invoices = useInvoices();
  const now = useNow();
  const { query } = useSearch();
  const [direction, setDirection] = useState<InvoiceDirection>("OUTGOING");
  const { open: openParam } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(
    openParam ?? null,
  );
  useEffect(() => {
    if (openParam) setSelectedId(openParam);
  }, [openParam]);
  const [creating, setCreating] = useState(false);

  const mine = invoices
    .filter((i) => i.state.global.direction === direction)
    .filter((i) =>
      matches(
        query,
        i.state.global.number,
        counterparty(i.state.global).name,
        i.state.global.subject,
        i.state.global.references.buyerReference,
        invoiceTotals(i.state.global).gross,
      ),
    )
    .sort((a, b) =>
      (b.state.global.issuedAt ?? b.header.createdAtUtcIso).localeCompare(
        a.state.global.issuedAt ?? a.header.createdAtUtcIso,
      ),
    );
  const selected = invoices.find((i) => i.header.id === selectedId);
  const open = mine.filter((i) => i.state.global.status === "OPEN");
  const outstanding = open.reduce(
    (s, i) => s + bookTotals(i.state.global).outstanding,
    0,
  );
  const overdue = mine.filter((i) => isOverdue(i.state.global, now));
  const paid90 = mine
    .filter(
      (i) =>
        i.state.global.status === "PAID" &&
        i.state.global.payments.some(
          (p) => Date.parse(p.paidAt) > now - 90 * 86_400_000,
        ),
    )
    .reduce((s, i) => s + bookTotals(i.state.global).paid, 0);

  if (!drive || invoices.length === 0) return <SetupState what="invoices" />;

  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        eyebrow={direction === "OUTGOING" ? "Receivables" : "Payables"}
        title="Invoices"
        lead={
          direction === "OUTGOING"
            ? "What customers owe you, and what they paid."
            : "What you owe suppliers, and what you paid."
        }
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreating(true)}
          >
            {direction === "OUTGOING" ? "New invoice" : "New bill"}
          </Button>
        }
      />

      <Selector
        label="Direction"
        value={direction}
        onChange={setDirection}
        options={[
          {
            value: "OUTGOING",
            name: "Sales",
            icon: "invoice",
            meta: plural(
              invoices.filter((i) => i.state.global.direction === "OUTGOING")
                .length,
              "invoice",
            ),
          },
          {
            value: "INCOMING",
            name: "Purchases",
            icon: "cart",
            meta: plural(
              invoices.filter((i) => i.state.global.direction === "INCOMING")
                .length,
              "bill",
            ),
          },
        ]}
      />

      <div className="sk-grid sk-grid--3">
        <Stat
          icon="invoice"
          label={direction === "OUTGOING" ? "Outstanding" : "To pay"}
          value={money(outstanding, "EUR", { compact: true })}
          foot={`${open.length} open`}
        />
        <Stat
          icon="bell"
          label="Overdue"
          value={money(
            overdue.reduce(
              (s, i) => s + bookTotals(i.state.global).outstanding,
              0,
            ),
            "EUR",
            { compact: true },
          )}
          foot={overdue.length ? `${overdue.length} past due` : "all on time"}
        />
        <Stat
          icon="growth"
          label={
            direction === "OUTGOING" ? "Collected · 90 days" : "Paid · 90 days"
          }
          value={money(paid90, "EUR", { compact: true })}
          foot={`${mine.filter((i) => i.state.global.status === "PAID").length} settled`}
        />
      </div>

      <div className="sk-board">
        {COLUMNS.map((col) => {
          const items = mine.filter((i) => col.pick(i, now));
          return (
            <section key={col.key} className="sk-board__col">
              <header className="sk-board__head">
                <div>
                  <div className="sk-weight-semibold">
                    {col.label}{" "}
                    <span className="sk-text-muted sk-weight-regular">
                      {items.length}
                    </span>
                  </div>
                  <div className="sk-caption">{col.caption}</div>
                </div>
                <div className="sk-caption sk-tabular">
                  {money(
                    items.reduce(
                      (s, i) => s + bookTotals(i.state.global).gross,
                      0,
                    ),
                    "EUR",
                    { compact: true },
                  )}
                </div>
              </header>
              {items.length === 0 ? (
                <div
                  className="sk-empty"
                  style={{ padding: "var(--sk-space-6)" }}
                >
                  <span className="sk-caption">Nothing here</span>
                </div>
              ) : (
                items.map((inv) => (
                  <InvoiceCard
                    key={inv.header.id}
                    doc={inv}
                    selected={inv.header.id === selectedId}
                    onClick={() => setSelectedId(inv.header.id)}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <SidePanel
          eyebrow={
            selected.state.global.direction === "OUTGOING"
              ? "Sales invoice"
              : "Purchase bill"
          }
          onClose={() => setSelectedId(null)}
        >
          <InvoiceDetail doc={selected} />
        </SidePanel>
      )}
      {creating && (
        <NewInvoicePanel
          drive={drive}
          direction={direction}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function InvoiceCard({
  doc,
  selected,
  onClick,
}: {
  doc: InvoiceDocument;
  selected: boolean;
  onClick: () => void;
}) {
  const s = doc.state.global;
  const t = invoiceTotals(s);
  const overdue = isOverdue(s);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "sk-card sk-card--compact sk-card--interactive sk-stack sk-stack--2",
        selected && "is-selected",
      )}
      style={{
        textAlign: "left",
        width: "100%",
        opacity: s.status === "VOID" ? 0.6 : 1,
      }}
    >
      <div className="sk-row sk-row--between">
        <span className="sk-weight-semibold sk-small">
          {s.number ?? "Draft"}
        </span>
        <InvoiceStatusBadge doc={doc} />
      </div>
      <div className="sk-row sk-row--2">
        <Avatar
          name={counterparty(s).name}
          size="sm"
          variant={s.direction === "OUTGOING" ? "sage" : "forest"}
        />
        <span className="sk-truncate sk-weight-medium">
          {counterparty(s).name}
        </span>
      </div>
      <div className="sk-caption sk-truncate">
        {s.lines[0]?.description ?? "No lines"}
        {s.lines.length > 1 ? ` +${s.lines.length - 1}` : ""}
      </div>
      <div className="sk-row sk-row--between">
        <span className="sk-numeral" style={{ fontSize: "var(--sk-text-xl)" }}>
          {money(s.status === "OPEN" ? t.outstanding : t.gross, s.currency)}
        </span>
        <span className={cx("sk-caption", overdue && "sk-text-danger")}>
          {s.status === "OPEN"
            ? `due ${relativeDays(s.dueAt)}`
            : s.status === "PAID"
              ? `paid ${fmtShortDate(s.payments.at(-1)?.paidAt)}`
              : s.status === "DRAFT"
                ? "draft"
                : "void"}
        </span>
      </div>
    </button>
  );
}
