import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import type { AccountKind } from "document-models/bank-account";
import {
  actions,
  useSelectedBankAccountDocument,
} from "document-models/bank-account";
import { useState, type CSSProperties } from "react";
import {
  TransactionDetail,
  TransactionStatusBadge,
} from "../sektar/components/TransactionDetail.js";
import { accountBalance, categorizeTransaction } from "../sektar/kit/data.js";
import {
  ACCOUNT_KIND,
  CATEGORY,
  CATEGORY_ORDER,
  fmtDate,
  fmtShortDate,
  money,
} from "../sektar/kit/format.js";
import {
  Badge,
  Button,
  Field,
  IconTile,
  Input,
  Select,
  SidePanel,
  Sprite,
  Stat,
  Table,
} from "../sektar/kit/ui.js";

/** A bank or card account as a document: identity, balance and the full feed. */
export default function Editor() {
  const [document, dispatch] = useSelectedBankAccountDocument();
  const s = document.state.global;
  const [editing, setEditing] = useState(!s.name);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: s.name ?? "",
    institution: s.institution ?? "",
    iban: s.iban ?? "",
    kind: s.kind,
    openingBalance: String(s.openingBalance),
  });
  const selected = s.transactions.find((t) => t.id === selectedId);
  const inflow = s.transactions
    .filter((t) => t.amount > 0 && t.status !== "EXCLUDED")
    .reduce((sum, t) => sum + t.amount, 0);
  const outflow = s.transactions
    .filter((t) => t.amount < 0 && t.status !== "EXCLUDED")
    .reduce((sum, t) => sum + -t.amount, 0);
  const toReview = s.transactions.filter((t) => t.status === "NEW").length;

  const save = () => {
    dispatch(
      actions.setAccountDetails({
        name: form.name.trim() || null,
        institution: form.institution.trim() || null,
        iban: form.iban.trim() || null,
        kind: form.kind,
        openingBalance: Number(form.openingBalance) || 0,
      }),
    );
    setEditing(false);
  };

  return (
    <>
      {/* Connect's toolbar keeps Connect's styling; the Sektar styles start below it. */}
      <DocumentToolbar />
      <div
        className="sk-app sk-page"
        style={{ minHeight: "100%", background: "transparent" }}
      >
        <Sprite />
        <div
          className="sk-container sk-stack sk-stack--6"
          style={{ maxWidth: 1100, paddingBlock: "var(--sk-space-6)" }}
        >
          <header className="sk-row sk-row--between sk-row--wrap sk-row--start">
            <div className="sk-row sk-row--3">
              <IconTile
                name={s.kind === "CREDIT_CARD" ? "card" : "bank"}
                size="lg"
              />
              <div className="sk-stack sk-stack--2">
                <div className="sk-eyebrow">{ACCOUNT_KIND[s.kind]}</div>
                <h1 style={{ fontSize: "var(--sk-text-3xl)" }}>
                  {s.name ?? "New account"}
                </h1>
                <p className="sk-text-secondary">
                  {[s.institution, s.iban].filter(Boolean).join(" · ") ||
                    "No bank details yet"}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              icon="settings"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Close" : "Edit account"}
            </Button>
          </header>

          {editing && (
            <div className="sk-card sk-stack sk-stack--4">
              <div className="sk-grid sk-grid--2">
                <Field label="Account name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                </Field>
                <Field label="Kind">
                  <Select
                    value={form.kind}
                    onChange={(e) =>
                      setForm({ ...form, kind: e.target.value as AccountKind })
                    }
                  >
                    {(Object.keys(ACCOUNT_KIND) as AccountKind[]).map((k) => (
                      <option key={k} value={k}>
                        {ACCOUNT_KIND[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Institution">
                  <Input
                    value={form.institution}
                    onChange={(e) =>
                      setForm({ ...form, institution: e.target.value })
                    }
                  />
                </Field>
                <Field label="IBAN / number">
                  <Input
                    value={form.iban}
                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                  />
                </Field>
                <Field
                  label={`Opening balance (${s.currency})`}
                  hint="Balance before the first imported transaction"
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={form.openingBalance}
                    onChange={(e) =>
                      setForm({ ...form, openingBalance: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="sk-row sk-row--end">
                <Button
                  variant="primary"
                  onClick={save}
                  disabled={!form.name.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          <div
            className="sk-grid sk-grid--auto"
            style={{ "--sk-grid-min": "220px" } as CSSProperties}
          >
            <Stat
              icon="bank"
              label="Balance"
              value={money(accountBalance(document), s.currency, {
                compact: true,
              })}
              foot={`opening ${money(s.openingBalance, s.currency, { compact: true })}`}
            />
            <Stat
              icon="growth"
              label="Money in"
              value={money(inflow, s.currency, { compact: true })}
              foot="all time"
            />
            <Stat
              icon="trends"
              label="Money out"
              value={money(outflow, s.currency, { compact: true })}
              foot="all time"
            />
            <Stat
              icon="transactions"
              label="To review"
              value={String(toReview)}
              foot={
                s.lastImportedAt
                  ? `last import ${fmtShortDate(s.lastImportedAt)}`
                  : "no imports yet"
              }
            />
          </div>

          <div className="sk-card">
            <Table compact>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Counterparty</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="is-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...s.transactions]
                  .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
                  .map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedId(tx.id)}
                      style={{
                        cursor: "pointer",
                        opacity: tx.status === "EXCLUDED" ? 0.55 : 1,
                      }}
                    >
                      <td
                        className="is-muted sk-nowrap"
                        title={fmtDate(tx.bookedAt)}
                      >
                        {fmtShortDate(tx.bookedAt)}
                      </td>
                      <td>
                        <div className="sk-table__primary">
                          {tx.counterparty}
                        </div>
                        <div className="sk-table__secondary">
                          {tx.description ?? tx.reference ?? ""}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {tx.status === "NEW" ? (
                          <select
                            className="sk-select sk-input--sm"
                            value={tx.category}
                            aria-label="Category"
                            onChange={(e) =>
                              void categorizeTransaction(
                                document.header.id,
                                tx.id,
                                e.target.value as keyof typeof CATEGORY,
                              )
                            }
                          >
                            {CATEGORY_ORDER.map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY[c].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={CATEGORY[tx.category].tone}>
                            {CATEGORY[tx.category].label}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <TransactionStatusBadge status={tx.status} />
                      </td>
                      <td
                        className={
                          tx.amount > 0 ? "is-num sk-amount--in" : "is-num"
                        }
                      >
                        {money(tx.amount, s.currency, { signed: true })}
                      </td>
                    </tr>
                  ))}
                {s.transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="is-muted">
                      No transactions yet. Import a feed from the Transactions
                      page.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>

        {selected && (
          <SidePanel
            title={selected.counterparty}
            subtitle={`${s.name ?? "Account"} · ${fmtDate(selected.bookedAt)}`}
            onClose={() => setSelectedId(null)}
          >
            <TransactionDetail row={{ tx: selected, account: document }} />
          </SidePanel>
        )}
      </div>
    </>
  );
}
