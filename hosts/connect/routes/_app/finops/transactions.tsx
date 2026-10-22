import { createFileRoute } from "@tanstack/react-router";
import type { TransactionStatus } from "document-models/bank-account";
import { useEffect, useMemo, useState } from "react";
import {
  TransactionDetail,
  TransactionStatusBadge,
} from "../../../../../editors/sektar/components/TransactionDetail.js";
import {
  accountBalance,
  categorizeTransaction,
  useAccounts,
  useContacts,
  useSektarDrive,
  useTransactions,
  type TransactionRow,
} from "../../../../../editors/sektar/kit/data.js";
import {
  ACCOUNT_KIND,
  CATEGORY,
  CATEGORY_ORDER,
  fmtDate,
  fmtShortDate,
  money,
  plural,
} from "../../../../../editors/sektar/kit/format.js";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Selector,
  SidePanel,
  Table,
  Tabs,
} from "../../../../../editors/sektar/kit/ui.js";
import { ImportPanel } from "../../-shared/forms.js";
import { matches, useSearch } from "../../-shared/search.js";
import { SetupState } from "../../-shared/setup.js";

export const Route = createFileRoute("/_app/finops/transactions")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): { open?: string; account?: string; import?: string } => ({
    ...(typeof raw.open === "string" ? { open: raw.open } : {}),
    ...(typeof raw.account === "string" ? { account: raw.account } : {}),
    // `?import=1` opens the import panel (the sidebar's promo card links here)
    ...(raw.import === "1" || raw.import === true ? { import: "1" } : {}),
  }),
  head: () => ({ meta: [{ title: "Transactions · Sektar" }] }),
  component: TransactionsPage,
});

type StatusFilter = "ALL" | TransactionStatus;

function TransactionsPage() {
  const drive = useSektarDrive();
  const accounts = useAccounts();
  const rows = useTransactions();
  const contacts = useContacts();
  const { query } = useSearch();
  const {
    open: openParam,
    import: importParam,
    account: accountParam,
  } = Route.useSearch();
  // `?account=<id>` opens on one account (the dashboard's accounts link here)
  const [accountId, setAccountId] = useState<string>(accountParam ?? "ALL");
  useEffect(() => {
    if (accountParam) setAccountId(accountParam);
  }, [accountParam]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(
    openParam ?? null,
  );
  useEffect(() => {
    if (openParam) setSelectedId(openParam);
  }, [openParam]);
  const [importing, setImporting] = useState(!!importParam);
  useEffect(() => {
    if (importParam) setImporting(true);
  }, [importParam]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      ALL: 0,
      NEW: 0,
      CATEGORIZED: 0,
      MATCHED: 0,
      EXCLUDED: 0,
    };
    for (const r of rows) {
      if (accountId !== "ALL" && r.account.header.id !== accountId) continue;
      c.ALL++;
      c[r.tx.status]++;
    }
    return c;
  }, [rows, accountId]);

  const visible = rows.filter(
    (r) =>
      (accountId === "ALL" || r.account.header.id === accountId) &&
      (status === "ALL" || r.tx.status === status) &&
      matches(
        query,
        r.tx.counterparty,
        r.tx.description,
        r.tx.reference,
        r.tx.amount,
        CATEGORY[r.tx.category].label,
      ),
  );
  const selected: TransactionRow | undefined = rows.find(
    (r) => r.tx.id === selectedId,
  );
  const contactName = (id: string | null | undefined) =>
    contacts.find((c) => c.header.id === id)?.state.global.name;

  if (!drive || accounts.length === 0)
    return <SetupState what="bank accounts" />;

  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        eyebrow="Bank & card"
        title="Transactions"
        lead={`${counts.NEW} to review · ${counts.MATCHED} matched`}
        actions={
          <Button
            variant="primary"
            icon="upload"
            onClick={() => setImporting(true)}
          >
            Import feed
          </Button>
        }
      />

      <Selector
        label="Account"
        value={accountId}
        onChange={setAccountId}
        options={[
          {
            value: "ALL",
            name: "All accounts",
            icon: "bank",
            meta: plural(accounts.length, "account"),
          },
          ...accounts.map((a) => ({
            value: a.header.id,
            name: a.state.global.name ?? "Account",
            icon:
              a.state.global.kind === "CREDIT_CARD"
                ? ("card" as const)
                : ("bank" as const),
            meta: `${money(accountBalance(a), a.state.global.currency)} · ${ACCOUNT_KIND[a.state.global.kind]}${
              a.state.global.iban ? ` …${a.state.global.iban.slice(-4)}` : ""
            }`,
          })),
        ]}
      />

      <Card compact>
        <div className="sk-mb-4">
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All", count: counts.ALL },
              { value: "NEW", label: "To review", count: counts.NEW },
              {
                value: "CATEGORIZED",
                label: "Categorised",
                count: counts.CATEGORIZED,
              },
              { value: "MATCHED", label: "Matched", count: counts.MATCHED },
              { value: "EXCLUDED", label: "Excluded", count: counts.EXCLUDED },
            ]}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState icon="transactions" title="Nothing here">
            {query
              ? `No transactions match “${query}”.`
              : "Import a bank or card statement to get started."}
          </EmptyState>
        ) : (
          <Table compact stack>
            <thead>
              <tr>
                <th>Date</th>
                <th>Counterparty</th>
                <th>Category</th>
                <th className="is-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ tx, account }) => (
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
                    <div className="sk-table__primary">{tx.counterparty}</div>
                    <div className="sk-table__secondary">
                      {[
                        tx.description,
                        accountId === "ALL" ? account.state.global.name : null,
                        contactName(tx.contactId),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {(tx.status === "MATCHED" || tx.status === "EXCLUDED") && (
                        <>
                          {" "}
                          <TransactionStatusBadge status={tx.status} />
                        </>
                      )}
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
                            account.header.id,
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
        )}
      </Card>

      {selected && (
        <SidePanel
          title={selected.tx.counterparty}
          subtitle={`${selected.account.state.global.name} · ${fmtDate(selected.tx.bookedAt)}`}
          onClose={() => setSelectedId(null)}
        >
          <TransactionDetail row={selected} />
        </SidePanel>
      )}
      {importing && (
        <ImportPanel
          drive={drive}
          onClose={() => setImporting(false)}
          onImported={() => setImporting(false)}
        />
      )}
    </div>
  );
}
