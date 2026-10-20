// One bank/card transaction with the bookkeeping controls: categorise, link
// a contact, match to an open invoice or approved claim, or exclude it.
import type { TransactionCategory } from "document-models/bank-account";
import { useMemo } from "react";
import {
  categorizeTransaction,
  excludeTransaction,
  matchTransaction,
  recordPayment,
  unmatchTransaction,
  useContacts,
  useExpenseReports,
  useInvoices,
  type TransactionRow,
} from "../kit/data.js";
import {
  CATEGORY,
  CATEGORY_ORDER,
  expenseReimbursable,
  fmtDate,
  counterparty,
  invoiceTotals,
  money,
  TX_STATUS,
} from "../kit/format.js";
import { Badge, Button, Dl, Field, Icon, Select } from "../kit/ui.js";

export function TransactionStatusBadge({
  status,
}: {
  status: TransactionRow["tx"]["status"];
}) {
  const { label, tone } = TX_STATUS[status];
  return (
    <Badge tone={tone} dot={status === "NEW"}>
      {label}
    </Badge>
  );
}

export function TransactionDetail({ row }: { row: TransactionRow }) {
  const { tx, account } = row;
  const accountId = account.header.id;
  const currency = account.state.global.currency;
  const contacts = useContacts().filter(
    (c) => c.state.global.status === "ACTIVE",
  );
  const invoices = useInvoices();
  const reports = useExpenseReports();
  const contact = contacts.find((c) => c.header.id === tx.contactId);

  // Candidates: open invoices in the same direction as the money, approved
  // claims for outflows. Sorted by how close the amount is.
  const candidates = useMemo(() => {
    const amount = Math.abs(tx.amount);
    const inv = invoices
      .filter((i) => i.state.global.status === "OPEN")
      .filter((i) =>
        tx.amount > 0
          ? i.state.global.direction === "OUTGOING"
          : i.state.global.direction === "INCOMING",
      )
      .map((i) => {
        const t = invoiceTotals(i.state.global);
        return {
          kind: "INVOICE" as const,
          id: i.header.id,
          label: `${i.state.global.number ?? "Draft"} · ${counterparty(i.state.global).name ?? ""}`,
          amount: t.outstanding,
          distance: Math.abs(t.outstanding - amount),
        };
      });
    const exp =
      tx.amount < 0
        ? reports
            .filter(
              (r) =>
                r.state.global.status === "APPROVED" ||
                r.state.global.status === "SUBMITTED",
            )
            .map((r) => ({
              kind: "EXPENSE" as const,
              id: r.header.id,
              label: `${r.state.global.title ?? "Claim"} · ${r.state.global.submitter.name ?? ""}`,
              amount: expenseReimbursable(r.state.global),
              distance: Math.abs(expenseReimbursable(r.state.global) - amount),
            }))
        : [];
    return [...inv, ...exp].sort((a, b) => a.distance - b.distance).slice(0, 8);
  }, [invoices, reports, tx.amount]);

  const matched = tx.matchedDocumentId
    ? tx.matchedKind === "INVOICE"
      ? (invoices.find((i) => i.header.id === tx.matchedDocumentId)?.state
          .global.number ?? "Invoice")
      : (reports.find((r) => r.header.id === tx.matchedDocumentId)?.state.global
          .title ?? "Expense claim")
    : null;

  return (
    <div className="sk-stack sk-stack--6">
      <div className="sk-row sk-row--between sk-row--start">
        <div className="sk-stack sk-stack--2">
          <div
            className={
              tx.amount > 0 ? "sk-numeral sk-amount--in" : "sk-numeral"
            }
            style={{ fontSize: "var(--sk-text-4xl)" }}
          >
            {money(tx.amount, currency, { signed: true })}
          </div>
          <div className="sk-row sk-row--2">
            <TransactionStatusBadge status={tx.status} />
            <Badge tone={CATEGORY[tx.category].tone}>
              {CATEGORY[tx.category].label}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void excludeTransaction(accountId, tx.id, tx.status !== "EXCLUDED")
          }
        >
          {tx.status === "EXCLUDED" ? "Include again" : "Exclude"}
        </Button>
      </div>

      <Dl
        rows={[
          { label: "Booked", value: fmtDate(tx.bookedAt) },
          { label: "Counterparty", value: tx.counterparty },
          { label: "Description", value: tx.description ?? "—" },
          { label: "Account", value: account.state.global.name ?? "—" },
          {
            label: "Bank reference",
            value: (
              <span className="sk-font-mono sk-small">
                {tx.reference ?? "—"}
              </span>
            ),
          },
        ]}
      />

      {tx.status !== "EXCLUDED" && (
        <div className="sk-grid sk-grid--2">
          <Field label="Category">
            <Select
              value={tx.category}
              onChange={(e) =>
                void categorizeTransaction(
                  accountId,
                  tx.id,
                  e.target.value as TransactionCategory,
                )
              }
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contact">
            <Select
              value={tx.contactId ?? ""}
              onChange={(e) => {
                const next = contacts.find(
                  (c) => c.header.id === e.target.value,
                );
                const category =
                  tx.category === "UNCATEGORIZED" && next
                    ? next.state.global.defaultCategory
                    : tx.category;
                void categorizeTransaction(
                  accountId,
                  tx.id,
                  category,
                  e.target.value || null,
                );
              }}
            >
              <option value="">— none —</option>
              {contacts.map((c) => (
                <option key={c.header.id} value={c.header.id}>
                  {c.state.global.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {tx.status === "MATCHED" && (
        <div className="sk-alert sk-alert--success">
          <Icon name="check-circle" size={20} />
          <div className="sk-grow">
            <div className="sk-alert__title">Matched to {matched}</div>
            {tx.matchedKind === "INVOICE"
              ? "The payment is recorded on the invoice."
              : "Linked to the expense claim."}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void unmatchTransaction(accountId, tx.id)}
          >
            Unmatch
          </Button>
        </div>
      )}

      {tx.status !== "MATCHED" && tx.status !== "EXCLUDED" && (
        <section className="sk-stack sk-stack--2">
          <div className="sk-eyebrow">Match to</div>
          {candidates.length === 0 ? (
            <div className="sk-small sk-text-muted">
              No open {tx.amount > 0 ? "sales invoices" : "bills or claims"} to
              match.
            </div>
          ) : (
            <ul className="sk-list sk-list--divided">
              {candidates.map((c) => (
                <li key={c.id} className="sk-list-item">
                  <span className="sk-list-item__body">
                    <span className="sk-list-item__title">{c.label}</span>
                    <span className="sk-list-item__meta">
                      {c.kind === "INVOICE" ? "Open invoice" : "Expense claim"}{" "}
                      · {money(c.amount, currency)}{" "}
                      {c.distance < 0.01 && "· exact"}
                    </span>
                  </span>
                  <Button
                    variant={c.distance < 0.01 ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        if (c.kind === "INVOICE") {
                          await recordPayment(
                            c.id,
                            Math.min(Math.abs(tx.amount), c.amount),
                            account.state.global.kind === "CREDIT_CARD"
                              ? "CARD"
                              : "BANK_TRANSFER",
                            { paidAt: tx.bookedAt, transactionId: tx.id },
                          );
                        }
                        await matchTransaction(accountId, tx.id, c.id, c.kind);
                      })();
                    }}
                  >
                    Match
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {contact && (
        <div className="sk-caption">
          Default category for {contact.state.global.name}:{" "}
          {CATEGORY[contact.state.global.defaultCategory].label}
        </div>
      )}
    </div>
  );
}
