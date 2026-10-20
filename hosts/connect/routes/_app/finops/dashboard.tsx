import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  accountBalance,
  useAccounts,
  useContacts,
  useExpenseReports,
  useInvoices,
  useSektarDrive,
  useTransactions,
} from "../../../../../editors/sektar/kit/data.js";
import {
  ACCOUNT_KIND,
  CATEGORY,
  expenseTotal,
  fmtMonth,
  fmtShortDate,
  counterparty,
  bookTotals,
  invoiceTotals,
  isOverdue,
  money,
  relativeDays,
  plural,
} from "../../../../../editors/sektar/kit/format.js";
import { COMPANY } from "../../../../../editors/sektar/kit/seed.js";
import {
  ActionTile,
  Badge,
  Bars,
  Button,
  Card,
  Donut,
  HeroCard,
  IconTile,
  Legend,
  ListItem,
  PageHeader,
  ProgressRow,
  Ring,
  Stat,
  Table,
} from "../../../../../editors/sektar/kit/ui.js";
import artDark from "../../../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-dark.svg";
import artLight from "../../../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-light.svg";
import hero from "../../../../../icons/sektar_background_2048x1152.webp";
import {
  ImportPanel,
  NewContactPanel,
  NewExpensePanel,
  NewInvoicePanel,
} from "../../-shared/forms.js";
import { SetupState } from "../../-shared/setup.js";

export const Route = createFileRoute("/_app/finops/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Sektar" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const drive = useSektarDrive();
  const accounts = useAccounts();
  const invoices = useInvoices();
  const reports = useExpenseReports();
  const contacts = useContacts();
  const rows = useTransactions();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<
    "invoice" | "expense" | "contact" | "import" | null
  >(null);

  const stats = useMemo(() => {
    const now = Date.now();
    const cash = accounts
      .filter((a) => a.state.global.kind !== "CREDIT_CARD")
      .reduce((s, a) => s + accountBalance(a), 0);
    const card = accounts
      .filter((a) => a.state.global.kind === "CREDIT_CARD")
      .reduce((s, a) => s + accountBalance(a), 0);
    const receivable = invoices
      .filter(
        (i) =>
          i.state.global.direction === "OUTGOING" &&
          i.state.global.status === "OPEN",
      )
      .reduce((s, i) => s + bookTotals(i.state.global).outstanding, 0);
    const payable = invoices
      .filter(
        (i) =>
          i.state.global.direction === "INCOMING" &&
          i.state.global.status === "OPEN",
      )
      .reduce((s, i) => s + bookTotals(i.state.global).outstanding, 0);
    const overdue = invoices.filter((i) => isOverdue(i.state.global, now));
    const toReview = rows.filter((r) => r.tx.status === "NEW").length;
    const awaiting = reports.filter(
      (r) => r.state.global.status === "SUBMITTED",
    );
    // money in / out per month over the last six months, excluding transfers
    const months: { key: string; label: string; in: number; out: number }[] =
      [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now);
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - m);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: fmtMonth(d.toISOString()),
        in: 0,
        out: 0,
      });
    }
    for (const { tx } of rows) {
      if (tx.status === "EXCLUDED" || tx.category === "TRANSFER") continue;
      const bucket = months.find((x) => x.key === tx.bookedAt.slice(0, 7));
      if (!bucket) continue;
      if (tx.amount > 0) bucket.in += tx.amount;
      else bucket.out += -tx.amount;
    }
    const thisMonth = months[months.length - 1];
    const lastMonth = months[months.length - 2];
    const pct = (a: number, b: number) =>
      b > 0 ? Math.round(((a - b) / b) * 100) : 0;
    // spend by category: card + current outflows, last 90 days
    const spend = new Map<string, number>();
    for (const { tx } of rows) {
      if (
        tx.amount >= 0 ||
        tx.status === "EXCLUDED" ||
        tx.category === "TRANSFER" ||
        tx.category === "PAYROLL" ||
        tx.category === "TAX"
      )
        continue;
      if (Date.parse(tx.bookedAt) < now - 90 * 86_400_000) continue;
      spend.set(tx.category, (spend.get(tx.category) ?? 0) + -tx.amount);
    }
    const spendSlices = [...spend.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const categorised = rows.filter((r) => r.tx.status !== "NEW").length;
    const readiness = rows.length
      ? Math.round((categorised / rows.length) * 100)
      : 0;
    const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 100);
    const issued = invoices.filter((i) => i.state.global.status !== "DRAFT");
    const readinessRows = [
      { label: "Transactions categorised", value: pctOf(categorised, rows.length) },
      {
        label: "Payments matched to invoices",
        value: pctOf(
          rows.filter((r) => r.tx.status === "MATCHED").length,
          rows.filter((r) => r.tx.category === "SALES").length,
        ),
      },
      {
        label: "Invoices issued",
        value: pctOf(issued.length, invoices.length),
      },
      {
        label: "Claims decided",
        value: pctOf(
          reports.filter((r) =>
            ["APPROVED", "REIMBURSED", "REJECTED"].includes(r.state.global.status),
          ).length,
          reports.length,
        ),
      },
    ];
    return {
      cash,
      card,
      receivable,
      payable,
      overdue,
      toReview,
      awaiting,
      months,
      thisMonth,
      lastMonth,
      pct,
      spendSlices,
      readiness,
      readinessRows,
    };
  }, [accounts, invoices, reports, rows]);

  if (
    !drive ||
    (accounts.length === 0 && invoices.length === 0 && contacts.length === 0)
  ) {
    return <SetupState what="books" />;
  }

  const attention = [
    ...stats.overdue.map((i) => ({
      key: i.header.id,
      icon: "invoice" as const,
      title: `${i.state.global.number} is overdue`,
      meta: `${counterparty(i.state.global).name ?? ""} · due ${relativeDays(i.state.global.dueAt)}`,
      value: money(invoiceTotals(i.state.global).outstanding, i.state.global.currency),
      to: "/finops/invoices" as const,
    })),
    ...(stats.toReview > 0
      ? [
          {
            key: "review",
            icon: "transactions" as const,
            title: `${plural(stats.toReview, "transaction")} to review`,
            meta: "Uncategorised bank and card activity",
            value: "",
            to: "/finops/transactions" as const,
          },
        ]
      : []),
    ...stats.awaiting.map((r) => ({
      key: r.header.id,
      icon: "wallet" as const,
      title: `${r.state.global.title} awaits approval`,
      meta: r.state.global.submitter.name ?? "",
      value: money(expenseTotal(r.state.global)),
      to: "/finops/expenses" as const,
    })),
  ];

  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        display
        title={`${greeting()}, ${COMPANY.owner.split(" ")[0]}.`}
        lead={`Here's what's happening with ${COMPANY.name} today.`}
        art={{ light: artLight, dark: artDark }}
        actions={
          <Button variant="secondary" icon="calendar">
            This month
          </Button>
        }
      />

      <div className="sk-dash-grid">
        <div className="c3">
          <Stat
            icon="bank"
            label="Cash position"
            value={money(stats.cash, "EUR", { compact: true })}
            foot={`across ${plural(
              accounts.filter((a) => a.state.global.kind !== "CREDIT_CARD")
                .length,
              "account",
            )}`}
            spark={stats.months.map((m) => m.in - m.out)}
          />
        </div>
        <div className="c3">
          <Stat
            icon="growth"
            label="Money in this month"
            value={money(stats.thisMonth.in, "EUR", { compact: true })}
            delta={stats.pct(stats.thisMonth.in, stats.lastMonth.in)}
            foot="vs. last month"
            spark={stats.months.map((m) => m.in)}
          />
        </div>
        <div className="c3">
          <Stat
            icon="invoice"
            label="Outstanding receivables"
            value={money(stats.receivable, "EUR", { compact: true })}
            foot={
              stats.overdue.length
                ? `${stats.overdue.length} overdue`
                : "nothing overdue"
            }
          />
        </div>
        <div className="c3">
          <Stat
            icon="card"
            label="Bills & card to pay"
            value={money(stats.payable + -stats.card, "EUR", { compact: true })}
            foot={`${money(-stats.card)} on card`}
          />
        </div>

        <div className="c6">
          <Card
            title="Cash flow"
            actions={
              <Legend
                items={[
                  { label: "Money in" },
                  { label: "Money out", color: "var(--sk-chart-3)" },
                ]}
              />
            }
          >
            <Bars
              axis
              ticks={4}
              format={(v) => money(v, "EUR", { compact: true })}
              groups={stats.months.map((m) => ({
                label: m.label,
                values: [Math.round(m.in), Math.round(m.out)],
              }))}
            />
          </Card>
        </div>
        <div className="c3">
          <Card
            title="Accounts"
            actions={
              <Button
                variant="link"
                size="sm"
                onClick={() => void navigate({ to: "/finops/transactions" })}
              >
                View all
              </Button>
            }
          >
            <ul className="sk-list sk-list--divided">
              {accounts.map((a) => (
                <li key={a.header.id}>
                  <ListItem
                    icon={
                      <IconTile
                        name={
                          a.state.global.kind === "CREDIT_CARD"
                            ? "card"
                            : "bank"
                        }
                        size="sm"
                      />
                    }
                    title={a.state.global.name}
                    meta={`${ACCOUNT_KIND[a.state.global.kind]} · ${a.state.global.institution ?? ""}`}
                    value={
                      <span className="sk-tabular sk-weight-medium">
                        {money(accountBalance(a), a.state.global.currency)}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="c3 sk-stack">
          <HeroCard
            image={hero}
            style={{ minHeight: 150, padding: "var(--sk-space-5)" }}
          >
            <h2 style={{ fontSize: "var(--sk-text-xl)", color: "inherit" }}>
              Help businesses grow with clarity.
            </h2>
          </HeroCard>
          <div className="sk-action-grid">
            <ActionTile
              icon="invoice"
              label="Create invoice"
              onClick={() => setPanel("invoice")}
            />
            <ActionTile
              icon="wallet"
              label="Add expense"
              onClick={() => setPanel("expense")}
            />
            <ActionTile
              icon="upload"
              label="Import feed"
              onClick={() => setPanel("import")}
            />
            <ActionTile
              icon="customers"
              label="New contact"
              onClick={() => setPanel("contact")}
            />
          </div>
        </div>

        <div className="c6">
          <Card
            title="Recent transactions"
            actions={
              <Button
                variant="link"
                size="sm"
                onClick={() => void navigate({ to: "/finops/transactions" })}
              >
                All transactions
              </Button>
            }
          >
            <Table compact stack>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="is-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 7).map(({ tx, account }) => (
                  <tr key={tx.id}>
                    <td className="is-muted sk-nowrap">
                      {fmtShortDate(tx.bookedAt)}
                    </td>
                    <td>
                      <div className="sk-table__primary">{tx.counterparty}</div>
                      <div className="sk-table__secondary">
                        {tx.description ?? account.state.global.name}
                      </div>
                    </td>
                    <td>
                      <Badge tone={CATEGORY[tx.category].tone}>
                        {CATEGORY[tx.category].label}
                      </Badge>
                    </td>
                    <td
                      className={
                        tx.amount > 0 ? "is-num sk-amount--in" : "is-num"
                      }
                    >
                      {money(tx.amount, account.state.global.currency, {
                        signed: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
        <div className="c3">
          <Card title="Spend by category">
            <div
              className="sk-stack sk-stack--4"
              style={{ alignItems: "center" }}
            >
              <Donut
                slices={stats.spendSlices.map(([, v]) => ({ value: v }))}
                value={money(
                  stats.spendSlices.reduce((s, [, v]) => s + v, 0),
                  "EUR",
                  { compact: true },
                )}
                label="last 90 days"
              />
              <Legend
                items={stats.spendSlices.map(([c, v]) => ({
                  label: CATEGORY[c as keyof typeof CATEGORY].label,
                  value: money(v, "EUR", { compact: true }),
                }))}
              />
            </div>
          </Card>
        </div>
        <div className="c3">
          <Card title="Books readiness">
            <div className="sk-stack sk-stack--4">
              <div className="sk-row sk-row--4">
                <Ring small value={stats.readiness} />
                <p className="sk-small sk-text-secondary">
                  {stats.toReview === 0
                    ? "Every transaction is categorised. You're on track."
                    : `${plural(stats.toReview, "transaction")} still ${
                    stats.toReview === 1 ? "needs" : "need"
                  } a category before the VAT return.`}
                </p>
              </div>
              <div className="sk-stack sk-stack--3">
                {stats.readinessRows.map((r) => (
                  <div key={r.label}>
                    <div className="sk-caption sk-mb-1">{r.label}</div>
                    <ProgressRow value={r.value} />
                  </div>
                ))}
              </div>
              <Button
                variant="primary"
                block
                icon="arrow-right"
                onClick={() => void navigate({ to: "/finops/transactions" })}
              >
                Review transactions
              </Button>
            </div>
          </Card>
        </div>

        {attention.length > 0 && (
          <div className="c12">
            <Card
              title="Needs attention"
              actions={
                <Badge tone="warning" pill>
                  {attention.length}
                </Badge>
              }
            >
              <ul className="sk-list sk-list--rich">
                {attention.map((a) => (
                  <li key={a.key}>
                    <ListItem
                      rich
                      icon={<IconTile name={a.icon} size="sm" />}
                      title={a.title}
                      sub={a.meta}
                      aside={a.value ? <span>{a.value}</span> : undefined}
                      chevron
                      onClick={() => void navigate({ to: a.to })}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      {panel === "invoice" && (
        <NewInvoicePanel
          drive={drive}
          direction="OUTGOING"
          onClose={() => setPanel(null)}
          onCreated={() => {
            setPanel(null);
            void navigate({ to: "/finops/invoices" });
          }}
        />
      )}
      {panel === "expense" && (
        <NewExpensePanel
          drive={drive}
          onClose={() => setPanel(null)}
          onCreated={() => {
            setPanel(null);
            void navigate({ to: "/finops/expenses" });
          }}
        />
      )}
      {panel === "contact" && (
        <NewContactPanel
          drive={drive}
          onClose={() => setPanel(null)}
          onCreated={() => {
            setPanel(null);
            void navigate({ to: "/finops/contacts" });
          }}
        />
      )}
      {panel === "import" && (
        <ImportPanel
          drive={drive}
          onClose={() => setPanel(null)}
          onImported={() => {
            setPanel(null);
            void navigate({ to: "/finops/transactions" });
          }}
        />
      )}
    </div>
  );
}
