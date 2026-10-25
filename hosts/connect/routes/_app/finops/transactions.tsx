import { createFileRoute } from "@tanstack/react-router";
import { useDocumentsByIds } from "@powerhousedao/reactor-browser";
import { isContactDocument } from "document-models/contact";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  statusAfterCategorise,
  TransactionDetail,
  TransactionStatusBadge,
  useAccountTransaction,
} from "../../../../../editors/sektar/components/TransactionDetail.js";
import {
  categorizeTransaction,
  useSektarDrive,
} from "../../../../../editors/sektar/kit/data.js";
import {
  accountKindOf,
  categoryOf,
  FINANCE_PAGE,
  txStatusOf,
  useAccountIndex,
  useTransactionList,
  type TransactionRow,
  type TransactionStatusView,
} from "../../../../../editors/sektar/kit/finance-index.js";
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
import { useSearch } from "../../-shared/search.js";
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

type StatusFilter = TransactionStatusView;

const NO_ROWS: (TransactionRow | undefined)[] = [];

function TransactionsPage() {
  const drive = useSektarDrive();
  const accountIndex = useAccountIndex(drive);
  const accounts = accountIndex ?? [];
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
  // The open transaction and the account that holds it: the one document the detail loads.
  const [selected, setSelected] = useState<{
    id: string;
    accountId: string | null;
  } | null>(
    openParam ? { id: openParam, accountId: accountParam ?? null } : null,
  );
  useEffect(() => {
    if (openParam)
      setSelected({ id: openParam, accountId: accountParam ?? null });
  }, [openParam, accountParam]);
  const [importing, setImporting] = useState(!!importParam);
  useEffect(() => {
    if (importParam) setImporting(true);
  }, [importParam]);

  const list = useTransactionList({
    accountId: accountId === "ALL" ? null : accountId,
    status,
    query,
  });
  const counts = list.counts ?? {
    all: 0,
    new: 0,
    categorised: 0,
    matched: 0,
    excluded: 0,
  };

  // The table grows a page at a time as its end scrolls into view; a row
  // whose page has not arrived yet is a placeholder.
  const filterKey = JSON.stringify([accountId, status, query]);
  const [shown, setShown] = useState({ key: filterKey, count: FINANCE_PAGE });
  const shownCount = shown.key === filterKey ? shown.count : FINANCE_PAGE;
  const rowCount = Math.min(list.total, shownCount);
  const { ensure } = list;
  useEffect(() => {
    if (rowCount > 0) ensure(0, rowCount);
  }, [ensure, rowCount, list.version]);
  const sentinel = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || rowCount >= list.total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown({ key: filterKey, count: shownCount + FINANCE_PAGE });
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filterKey, shownCount, rowCount, list.total]);

  const rows: (TransactionRow | undefined)[] = rowCount
    ? Array.from({ length: rowCount }, (_, i) => list.rowAt(i))
    : NO_ROWS;

  // `?open=` without `?account=`: the account comes from the row once its page is here.
  const selectedAccountId =
    selected?.accountId ??
    rows.find((r) => r?.id === selected?.id)?.accountId ??
    null;
  const open = useAccountTransaction(selectedAccountId, selected?.id);

  // Only the contacts the loaded rows point at, not the whole address book.
  const contactIds = useMemo(
    () => [...new Set(rows.map((r) => r?.contactId).filter((id): id is string => !!id))],
    [rows],
  );
  const contactDocs = useDocumentsByIds(contactIds).filter(isContactDocument);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name;
  const contactName = (id: string | null | undefined) =>
    contactDocs.find((c) => c.header.id === id)?.state.global.name;

  if (!drive || (accountIndex !== undefined && accountIndex.length === 0))
    return <SetupState what="bank accounts" />;

  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        eyebrow="Bank & card"
        title="Transactions"
        lead={`${counts.new} to review · ${counts.matched} matched`}
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
            value: a.id,
            name: a.name ?? "Account",
            icon:
              a.kind === "CREDIT_CARD" ? ("card" as const) : ("bank" as const),
            meta: `${money(a.balance, a.currency)} · ${ACCOUNT_KIND[accountKindOf(a.kind)]}${
              a.ibanLast4 ? ` …${a.ibanLast4}` : ""
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
              { value: "ALL", label: "All", count: counts.all },
              { value: "NEW", label: "To review", count: counts.new },
              {
                value: "CATEGORIZED",
                label: "Categorised",
                count: counts.categorised,
              },
              { value: "MATCHED", label: "Matched", count: counts.matched },
              { value: "EXCLUDED", label: "Excluded", count: counts.excluded },
            ]}
          />
        </div>
        {!list.loaded ? (
          <div className="sk-small sk-text-muted">Loading transactions…</div>
        ) : list.total === 0 && !list.stale ? (
          <EmptyState icon="transactions" title="Nothing here">
            {list.error
              ? `The transactions could not be loaded: ${list.error}`
              : query
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
            <tbody style={{ opacity: list.stale ? 0.6 : 1 }}>
              {rows.map((tx, i) =>
                tx ? (
                  <TransactionTableRow
                    key={tx.id}
                    tx={tx}
                    accountName={
                      accountId === "ALL" ? accountName(tx.accountId) : null
                    }
                    contactName={contactName(tx.contactId)}
                    onOpen={() =>
                      setSelected({ id: tx.id, accountId: tx.accountId })
                    }
                    onCategorise={(category) => {
                      void categorizeTransaction(tx.accountId, tx.id, category);
                      list.patch(tx.id, {
                        category,
                        status: statusAfterCategorise(txStatusOf(tx.status)),
                      });
                    }}
                  />
                ) : (
                  <tr key={`pending-${i}`} aria-hidden>
                    <td colSpan={4} className="is-muted">
                      &nbsp;
                    </td>
                  </tr>
                ),
              )}
              {rowCount < list.total && (
                <tr ref={sentinel}>
                  <td colSpan={4} className="is-muted sk-small">
                    Loading more…
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>

      {selected && open && (
        <SidePanel
          title={open.tx.counterparty}
          subtitle={`${open.account.state.global.name} · ${fmtDate(open.tx.bookedAt)}`}
          onClose={() => setSelected(null)}
        >
          <TransactionDetail
            row={open}
            onChanged={(change) => list.patch(open.tx.id, change)}
          />
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

function TransactionTableRow({
  tx,
  accountName,
  contactName,
  onOpen,
  onCategorise,
}: {
  tx: TransactionRow;
  /** Shown when the table lists every account; null when it lists one. */
  accountName: string | null | undefined;
  contactName: string | null | undefined;
  onOpen: () => void;
  onCategorise: (category: ReturnType<typeof categoryOf>) => void;
}) {
  const status = txStatusOf(tx.status);
  const category = categoryOf(tx.category);
  return (
    <tr
      onClick={onOpen}
      style={{
        cursor: "pointer",
        opacity: status === "EXCLUDED" ? 0.55 : 1,
      }}
    >
      <td className="is-muted sk-nowrap" title={fmtDate(tx.bookedAt)}>
        {fmtShortDate(tx.bookedAt)}
      </td>
      <td>
        <div className="sk-table__primary">{tx.counterparty}</div>
        <div className="sk-table__secondary">
          {[tx.description, accountName, contactName]
            .filter(Boolean)
            .join(" · ")}
          {(status === "MATCHED" || status === "EXCLUDED") && (
            <>
              {" "}
              <TransactionStatusBadge status={status} />
            </>
          )}
        </div>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {status === "NEW" ? (
          <select
            className="sk-select sk-input--sm"
            value={category}
            aria-label="Category"
            onChange={(e) => onCategorise(categoryOf(e.target.value))}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c].label}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={CATEGORY[category].tone}>
            {CATEGORY[category].label}
          </Badge>
        )}
      </td>
      <td className={tx.amount > 0 ? "is-num sk-amount--in" : "is-num"}>
        {money(tx.amount, tx.currency, { signed: true })}
      </td>
    </tr>
  );
}
