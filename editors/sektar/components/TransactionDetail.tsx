// One bank/card transaction with the bookkeeping controls: categorise, link
// a contact, match to an open invoice or approved claim, or exclude it.
//
// The writes dispatch on the account document by id, without loading it.
// The Transactions board shows the transaction from the finance index
// (`useTransactionDetail`), the bank-account editor from its open document;
// `onChanged` tells the board what a write changed, so its rows follow
// before the index catches up. The contact picker and the match candidates
// come from the index too.
import type {
  AccountKind,
  MatchKind,
  TransactionCategory,
  TransactionStatus,
} from "document-models/bank-account";
import {
  categorizeTransaction,
  excludeTransaction,
  matchTransaction,
  recordPayment,
  unmatchTransaction,
} from "../kit/data.js";
import {
  categoryOf,
  useContactOptions,
  useMatchCandidates,
  useTransactionDetail,
} from "../kit/finance-index.js";
import {
  CATEGORY,
  CATEGORY_ORDER,
  fmtDate,
  money,
  TX_STATUS,
} from "../kit/format.js";
import { Badge, Button, Dl, Field, Icon, Select } from "../kit/ui.js";

/** What the detail shows of a transaction: an index row or the document's own. */
export interface TransactionView {
  id: string;
  bookedAt: string;
  counterparty: string;
  description?: string | null;
  reference?: string | null;
  category: TransactionCategory;
  status: TransactionStatus;
  amount: number;
  contactId?: string | null;
  matchedDocumentId?: string | null;
  matchedKind?: MatchKind | null;
}

/** What the detail shows of the account that holds it. */
export interface AccountView {
  id: string;
  name?: string | null;
  currency: string;
  kind: AccountKind;
}

export function TransactionStatusBadge({
  status,
}: {
  status: TransactionStatus;
}) {
  const { label, tone } = TX_STATUS[status];
  return (
    <Badge tone={tone} dot={status === "NEW"}>
      {label}
    </Badge>
  );
}

/** What a write changed on the transaction, in the finance index's row vocabulary. */
export interface TransactionChange {
  status?: TransactionStatus;
  category?: TransactionCategory;
  contactId?: string | null;
  matchedDocumentId?: string | null;
  matchedKind?: MatchKind | null;
}

/** The status the reducer leaves after a categorise (feed.ts). */
export function statusAfterCategorise(status: TransactionStatus): TransactionStatus {
  return status === "NEW" ? "CATEGORIZED" : status;
}

/** The status the reducer leaves after an unmatch or an include (feed.ts). */
function statusUnsettled(category: TransactionCategory): TransactionStatus {
  return category === "UNCATEGORIZED" ? "NEW" : "CATEGORIZED";
}

/** A candidate's kind as the match action takes it. */
const candidateKind = (kind: string): MatchKind =>
  kind === "EXPENSE" ? "EXPENSE" : "INVOICE";

export function TransactionDetail({
  tx,
  account,
  matchedLabel,
  onChanged,
}: {
  tx: TransactionView;
  account: AccountView;
  /**
   * What the transaction is matched to, as the index names it. Left out
   * (the bank-account editor), the detail asks the index itself.
   */
  matchedLabel?: string | null;
  /** Called after each write with what it changed. */
  onChanged?: (change: TransactionChange) => void;
}) {
  const changed = (change: TransactionChange) => onChanged?.(change);
  const accountId = account.id;
  const currency = account.currency;
  const contacts = useContactOptions();
  const contact = contacts.find((c) => c.id === tx.contactId);
  const indexed = useTransactionDetail(
    matchedLabel === undefined && tx.matchedDocumentId ? tx.id : null,
  );

  // Candidates: open invoices in the same direction as the money, approved
  // or submitted claims for outflows, closest amount first (the index
  // sorts them); asked only while there is something to match.
  const matchable = tx.status !== "MATCHED" && tx.status !== "EXCLUDED";
  const candidates = useMatchCandidates(matchable ? tx.amount : null) ?? [];

  const matched = tx.matchedDocumentId
    ? (matchedLabel ??
      indexed.row?.matchedLabel ??
      (tx.matchedKind === "INVOICE" ? "Invoice" : "Expense claim"))
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
          onClick={() => {
            const exclude = tx.status !== "EXCLUDED";
            void excludeTransaction(accountId, tx.id, exclude);
            changed(
              exclude
                ? { status: "EXCLUDED", matchedDocumentId: null, matchedKind: null }
                : { status: statusUnsettled(tx.category) },
            );
          }}
        >
          {tx.status === "EXCLUDED" ? "Include again" : "Exclude"}
        </Button>
      </div>

      <Dl
        rows={[
          { label: "Booked", value: fmtDate(tx.bookedAt) },
          { label: "Counterparty", value: tx.counterparty },
          { label: "Description", value: tx.description ?? "—" },
          { label: "Account", value: account.name ?? "—" },
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
              onChange={(e) => {
                const category = e.target.value as TransactionCategory;
                void categorizeTransaction(accountId, tx.id, category);
                changed({ category, status: statusAfterCategorise(tx.status) });
              }}
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
                const next = contacts.find((c) => c.id === e.target.value);
                const category =
                  tx.category === "UNCATEGORIZED" && next
                    ? categoryOf(next.defaultCategory)
                    : tx.category;
                const contactId = e.target.value || null;
                void categorizeTransaction(
                  accountId,
                  tx.id,
                  category,
                  contactId,
                );
                changed({
                  category,
                  contactId,
                  status: statusAfterCategorise(tx.status),
                });
              }}
            >
              <option value="">— none —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
            onClick={() => {
              void unmatchTransaction(accountId, tx.id);
              changed({
                status: statusUnsettled(tx.category),
                matchedDocumentId: null,
                matchedKind: null,
              });
            }}
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
                            account.kind === "CREDIT_CARD"
                              ? "CARD"
                              : "BANK_TRANSFER",
                            { paidAt: tx.bookedAt, transactionId: tx.id },
                          );
                        }
                        const kind = candidateKind(c.kind);
                        await matchTransaction(accountId, tx.id, c.id, kind);
                        changed({
                          status: "MATCHED",
                          matchedDocumentId: c.id,
                          matchedKind: kind,
                        });
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
          Default category for {contact.name}:{" "}
          {CATEGORY[categoryOf(contact.defaultCategory)].label}
        </div>
      )}
    </div>
  );
}
