import { createFileRoute } from "@tanstack/react-router";
import type {
  ExpenseReportDocument,
  ExpenseStatus,
} from "document-models/expense-report";
import { useEffect, useState } from "react";
import {
  ExpenseDetail,
  ExpenseStatusBadge,
} from "../../../../../editors/sektar/components/ExpenseDetail.js";
import {
  useExpenseReports,
  useSektarDrive,
} from "../../../../../editors/sektar/kit/data.js";
import {
  CATEGORY,
  expenseReimbursable,
  expenseTotal,
  fmtShortDate,
  money,
  plural,
} from "../../../../../editors/sektar/kit/format.js";
import {
  Avatar,
  Badge,
  Button,
  PageHeader,
  SidePanel,
  Stat,
  cx,
} from "../../../../../editors/sektar/kit/ui.js";
import { NewExpensePanel } from "../../-shared/forms.js";
import { matches, useSearch } from "../../-shared/search.js";
import { SetupState } from "../../-shared/setup.js";

export const Route = createFileRoute("/_app/finops/expenses")({
  validateSearch: (raw: Record<string, unknown>): { open?: string } => ({
    ...(typeof raw.open === "string" ? { open: raw.open } : {}),
  }),
  head: () => ({ meta: [{ title: "Expenses · Sektar" }] }),
  component: ExpensesBoard,
});

const COLUMNS: { status: ExpenseStatus[]; label: string; caption: string }[] = [
  {
    status: ["DRAFT", "REJECTED"],
    label: "In progress",
    caption: "Drafts and returned claims",
  },
  {
    status: ["SUBMITTED"],
    label: "To approve",
    caption: "Waiting on a decision",
  },
  { status: ["APPROVED"], label: "Approved", caption: "Ready to reimburse" },
  { status: ["REIMBURSED"], label: "Reimbursed", caption: "Paid out" },
];

function ExpensesBoard() {
  const drive = useSektarDrive();
  const reports = useExpenseReports();
  const { query } = useSearch();
  const { open: openParam } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(
    openParam ?? null,
  );
  useEffect(() => {
    if (openParam) setSelectedId(openParam);
  }, [openParam]);
  const [creating, setCreating] = useState(false);

  const visible = reports
    .filter((r) =>
      matches(
        query,
        r.state.global.title,
        r.state.global.submitter.name,
        ...r.state.global.items.map((i) => i.merchant),
      ),
    )
    .sort((a, b) =>
      b.header.lastModifiedAtUtcIso.localeCompare(
        a.header.lastModifiedAtUtcIso,
      ),
    );
  const selected = reports.find((r) => r.header.id === selectedId);
  const awaiting = reports.filter((r) => r.state.global.status === "SUBMITTED");
  const approved = reports.filter((r) => r.state.global.status === "APPROVED");
  const spend90 = reports
    .flatMap((r) => r.state.global.items)
    .filter((i) => Date.parse(i.spentAt) > Date.now() - 90 * 86_400_000)
    .reduce((s, i) => s + i.amount, 0);

  if (!drive || reports.length === 0)
    return <SetupState what="expense claims" />;

  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        eyebrow="Claims & receipts"
        title="Expenses"
        lead="What the team spent, who approved it, and what is still owed to them."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreating(true)}
          >
            New claim
          </Button>
        }
      />
      <div className="sk-grid sk-grid--3">
        <Stat
          icon="wallet"
          label="Awaiting approval"
          value={money(
            awaiting.reduce((s, r) => s + expenseTotal(r.state.global), 0),
            "EUR",
            { compact: true },
          )}
          foot={plural(awaiting.length, "claim")}
        />
        <Stat
          icon="customers"
          label="Owed to the team"
          value={money(
            approved.reduce(
              (s, r) => s + expenseReimbursable(r.state.global),
              0,
            ),
            "EUR",
            { compact: true },
          )}
          foot="approved, not yet reimbursed"
        />
        <Stat
          icon="pie"
          label="Spend · 90 days"
          value={money(spend90, "EUR", { compact: true })}
          foot="across all claims"
        />
      </div>

      <div className="sk-board">
        {COLUMNS.map((col) => {
          const items = visible.filter((r) =>
            col.status.includes(r.state.global.status),
          );
          return (
            <section key={col.label} className="sk-board__col">
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
                    items.reduce((s, r) => s + expenseTotal(r.state.global), 0),
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
                items.map((r) => (
                  <ExpenseCard
                    key={r.header.id}
                    doc={r}
                    selected={r.header.id === selectedId}
                    onClick={() => setSelectedId(r.header.id)}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <SidePanel eyebrow="Expense claim" onClose={() => setSelectedId(null)}>
          <ExpenseDetail doc={selected} />
        </SidePanel>
      )}
      {creating && (
        <NewExpensePanel
          drive={drive}
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

function ExpenseCard({
  doc,
  selected,
  onClick,
}: {
  doc: ExpenseReportDocument;
  selected: boolean;
  onClick: () => void;
}) {
  const s = doc.state.global;
  const cats = [...new Set(s.items.map((i) => i.category))].slice(0, 3);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "sk-card sk-card--compact sk-card--interactive sk-stack sk-stack--2",
        selected && "is-selected",
      )}
      style={{ textAlign: "left", width: "100%" }}
    >
      <div className="sk-row sk-row--between">
        <span className="sk-weight-semibold sk-small sk-truncate">
          {s.title}
        </span>
        <ExpenseStatusBadge doc={doc} />
      </div>
      <div className="sk-row sk-row--2">
        <Avatar name={s.submitter.name} size="sm" variant="sage" />
        <span className="sk-caption">
          {s.submitter.name} · {plural(s.items.length, "receipt")} ·{" "}
          {fmtShortDate(s.items[0]?.spentAt ?? doc.header.createdAtUtcIso)}
        </span>
      </div>
      <div className="sk-row sk-row--2 sk-row--wrap">
        {cats.map((c) => (
          <Badge key={c} tone={CATEGORY[c].tone}>
            {CATEGORY[c].label}
          </Badge>
        ))}
      </div>
      <div className="sk-row sk-row--between">
        <span className="sk-numeral" style={{ fontSize: "var(--sk-text-xl)" }}>
          {money(expenseTotal(s), s.currency)}
        </span>
        <span className="sk-caption">
          {money(expenseReimbursable(s), s.currency)} to reimburse
        </span>
      </div>
    </button>
  );
}
