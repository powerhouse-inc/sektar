import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  correctAccountCurrency,
  setBookCurrency,
  setManualRate,
  useSektarDrive,
} from "../../../../../editors/sektar/kit/data.js";
import {
  useAccountRows,
  useBookSettings,
  useCurrencyBooks,
  type AccountRow,
  type CurrencyPairRow,
} from "../../../../../editors/sektar/kit/finance-index.js";
import { fmtDate, money } from "../../../../../editors/sektar/kit/format.js";
import { CURRENCIES, parseNumber } from "../../../../../editors/sektar/kit/invoice.js";
import { pairsNeeded } from "../../../../../processors/rate-keeper/rates.js";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
} from "../../../../../editors/sektar/kit/ui.js";

// A tab of the settings page: the main currency of the books, and the
// exchange rates that convert every other currency into it.
export const Route = createFileRoute("/_app/settings/currency")({
  staticData: { settings: { label: "Currency", order: 50 } },
  component: CurrencySettings,
});

/** Up to six significant decimals: a rate is not money. */
const fmtRate = (rate: number) =>
  new Intl.NumberFormat("en-IE", { maximumFractionDigits: 6 }).format(rate);

function CurrencySettings() {
  const drive = useSektarDrive();
  const settings = useBookSettings(drive);
  const books = useCurrencyBooks(drive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accounts = useAccountRows(drive);

  if (!drive || !settings || !books) {
    return <p className="sk-small sk-text-muted">Loading the books…</p>;
  }
  const bookCurrency = settings.bookCurrency;
  const options = [...new Set([bookCurrency, ...CURRENCIES, ...books.inUse.map((c) => c.currency)])];
  const pairs = books.pairs.filter((p) => p.quote === bookCurrency);
  const missing = pairsNeeded(bookCurrency, books.inUse, books.pairs);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    void work()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="sk-stack sk-stack--6">
      <Card title="Main currency">
        <div className="sk-stack sk-stack--4">
          <p className="sk-small sk-text-secondary">
            Every total in Sektar is shown in this currency. Accounts, invoices
            and claims keep their own; only the totals are converted.
          </p>
          <Field label="Main currency" style={{ maxWidth: 240 }}>
            <Select
              value={bookCurrency}
              disabled={busy}
              onChange={(e) => {
                const currency = e.target.value;
                run(async () => {
                  await setBookCurrency(drive, settings.documentId, currency);
                });
              }}
            >
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Exchange rates">
        <div className="sk-stack sk-stack--4">
          <p className="sk-small sk-text-secondary">
            Daily rates from the European Central Bank, fetched automatically
            for every currency your accounts, invoices and claims use. Balances
            use the latest rate; money in and out uses the rate of the day it
            was booked.
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          {missing.length > 0 && (
            <Alert tone="warning" title={`No rates yet for ${missing.join(", ")}`}>
              Amounts in {missing.length === 1 ? "this currency" : "these currencies"} are
              left out of the totals until a rate arrives. That takes a moment
              and needs a connection; a currency no central bank quotes needs a
              rate set by hand.
            </Alert>
          )}
          {pairs.length === 0 && missing.length === 0 ? (
            <EmptyState icon="growth" title="Nothing to convert">
              Everything in the books is in {bookCurrency}.
            </EmptyState>
          ) : (
            <ul className="sk-list sk-list--divided">
              {pairs.map((p) => (
                <PairItem key={p.id} pair={p} />
              ))}
            </ul>
          )}
        </div>
      </Card>

      {accounts.length > 0 && (
        <Card title="Account currencies">
          <div className="sk-stack sk-stack--4">
            <p className="sk-small sk-text-secondary">
              The currency each account is in, as the bank reported it. If an
              account shows the wrong one (a bank that reports none is filed in
              EUR), correct it here: the amounts stay exactly as they are, and
              the totals convert them from the right currency.
            </p>
            <ul className="sk-list sk-list--divided">
              {accounts.map((a) => (
                <AccountCurrencyItem key={a.id} account={a} options={options} />
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

function AccountCurrencyItem({
  account,
  options,
}: {
  account: AccountRow;
  options: string[];
}) {
  // The currency picked and not yet confirmed: a correction changes what
  // every amount of the account means, so it is never one stray click.
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = options.includes(account.currency)
    ? options
    : [account.currency, ...options];

  const confirm = () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    void correctAccountCurrency(account.id, picked)
      .then(() => setPicked(null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <li className="sk-stack sk-stack--3" style={{ padding: "var(--sk-space-3) 0" }}>
      <div className="sk-row sk-row--4" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="sk-weight-medium">{account.name ?? "Account"}</div>
          <div className="sk-caption sk-tabular">
            {[account.institution, money(account.balance, account.currency)]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <Select
          aria-label={`Currency of ${account.name ?? "the account"}`}
          style={{ width: 120 }}
          value={picked ?? account.currency}
          disabled={busy}
          onChange={(e) =>
            setPicked(e.target.value === account.currency ? null : e.target.value)
          }
        >
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      {picked && (
        <Alert
          tone="warning"
          title={`Change this account from ${account.currency} to ${picked}?`}
          actions={
            <div className="sk-row sk-row--2">
              <Button variant="primary" size="sm" disabled={busy} onClick={confirm}>
                Change to {picked}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPicked(null)}>
                Cancel
              </Button>
            </div>
          }
        >
          Its balance will read {money(account.balance, picked)} instead of{" "}
          {money(account.balance, account.currency)}. Nothing is converted: use
          this only when the account was filed under the wrong currency.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </li>
  );
}

function PairItem({ pair }: { pair: CurrencyPairRow }) {
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    const value = parseNumber(rate);
    if (value === null || value <= 0) {
      setError("Enter a rate above zero");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError("Pick a day");
      return;
    }
    setBusy(true);
    setError(null);
    void setManualRate(pair.id, day, value)
      .then(() => {
        setEditing(false);
        setRate("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <li className="sk-stack sk-stack--3" style={{ padding: "var(--sk-space-3) 0" }}>
      <div className="sk-row sk-row--4" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="sk-weight-medium sk-tabular">
            {pair.lastRate === null
              ? `${pair.base} to ${pair.quote}`
              : `1 ${pair.base} = ${fmtRate(pair.lastRate)} ${pair.quote}`}
          </div>
          <div className="sk-caption">
            {pair.lastDay
              ? `${fmtDate(pair.lastDay)} · ${pair.lastSource ?? "Unknown source"} · ${String(pair.rateCount)} days`
              : "No rate yet"}
          </div>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Set a rate
          </Button>
        )}
      </div>
      {editing && (
        <div className="sk-row sk-row--3" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Day">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label={`1 ${pair.base} in ${pair.quote}`} error={error ?? undefined}>
            <Input
              inputMode="decimal"
              value={rate}
              placeholder="0.90"
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Button variant="primary" size="sm" disabled={busy} onClick={save}>
            Save
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}
