import { useIntegrationDocumentsInSelectedDrive } from "document-models/integration";
import { useEffect, useMemo, useState } from "react";
import { useSektarDrive } from "../../sektar/kit/data.js";
import { useAccountRows } from "../../sektar/kit/finance-index.js";
import {
  KIND_COPY,
  type BankAccountChoice,
  type CreateChoices,
} from "../../sektar/kit/integrations.js";
import { Alert, Button, Field, Select, Switch } from "../../sektar/kit/ui.js";
import {
  blockOptions,
  runtimeConnections,
  useWorkflowRuntimeUrl,
  type BlockRef,
  type RuntimeConnection,
} from "../../sektar/kit/workflow-runtime.js";

const DISTYRA_CONNECTOR = "@powerhousedao/distyra-piece#distyra-piece";
const DISTYRA = {
  pieceName: "@powerhousedao/distyra-piece",
  pieceVersion: "1.0.0",
};
const PULL: BlockRef = {
  ...DISTYRA,
  name: "get-latest-transactions",
  kind: "action",
};
const LIST_ACCOUNTS: BlockRef = {
  ...DISTYRA,
  name: "list-accounts",
  kind: "action",
};

type Patch = (p: Partial<CreateChoices>) => void;

/** "KBC (BE · personal · 123)" → "KBC" */
export function bankNameOf(label: string): string {
  return label.split(" (")[0]?.trim() || label;
}

/**
 * Connect, for bank transactions: which Distyra connection (the API key on
 * this computer) and which of its bank connections. Listing bank connections
 * does not reach the bank.
 */
export function BankConnect({
  choices,
  patch,
}: {
  choices: CreateChoices;
  patch: Patch;
}) {
  const url = useWorkflowRuntimeUrl();
  // Bank connections another integration already brings in
  const integrations = useIntegrationDocumentsInSelectedDrive() ?? [];
  const taken = new Set(
    integrations
      .filter((d) => !d.state.global.intent.archived)
      .map(
        (d) =>
          (d.state.global.intent.source as { bankConnectionId?: string } | null)
            ?.bankConnectionId,
      )
      .filter(Boolean),
  );
  const [keys, setKeys] = useState<RuntimeConnection[] | null>(null);
  const [banks, setBanks] = useState<{ label: string; value: string }[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    runtimeConnections(url)
      .then((all) => {
        if (stopped) return;
        const distyra = all.filter((c) => c.connectorId === DISTYRA_CONNECTOR);
        setKeys(distyra);
        if (!choices.connectionId && distyra.length === 1) {
          patch({ connectionId: distyra[0].id });
        }
      })
      .catch((e: unknown) => !stopped && setError(String(e)));
    return () => {
      stopped = true;
    };
    // once per runtime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!choices.connectionId) return;
    let stopped = false;
    setBanks(null);
    blockOptions(url, PULL, "connectionId", {}, choices.connectionId)
      .then((r) => {
        if (stopped) return;
        if (r.disabled && r.placeholder) setError(r.placeholder);
        setBanks(
          r.options.map((o) => ({ label: o.label, value: String(o.value) })),
        );
      })
      .catch((e: unknown) => !stopped && setError(String(e)));
    return () => {
      stopped = true;
    };
  }, [url, choices.connectionId]);

  return (
    <div className="sk-stack sk-stack--4">
      <Field label="Distyra connection">
        <Select
          value={choices.connectionId ?? ""}
          onChange={(e) =>
            patch({
              connectionId: e.target.value,
              bankConnectionId: undefined,
              accounts: [],
            })
          }
          disabled={!keys || keys.length === 0}
        >
          <option value="" disabled>
            {keys === null
              ? "Loading…"
              : keys.length === 0
                ? "No Distyra connection on this computer"
                : "Pick one"}
          </option>
          {(keys ?? []).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name || k.accountLabel || k.id}
              {k.status !== "OK" ? " (not working)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {choices.connectionId && (
        <Field label="Bank">
          <Select
            value={choices.bankConnectionId ?? ""}
            onChange={(e) => {
              const picked = banks?.find((b) => b.value === e.target.value);
              const bankName = picked ? bankNameOf(picked.label) : undefined;
              patch({
                bankConnectionId: e.target.value,
                bankName,
                accounts: [],
                // Named after the bank unless the person named it already
                ...(bankName &&
                (!choices.name || choices.name === choices.bankName)
                  ? { name: bankName }
                  : {}),
              });
            }}
            disabled={!banks || banks.length === 0}
          >
            <option value="" disabled>
              {banks === null
                ? "Loading…"
                : banks.length === 0
                  ? "No active bank connections"
                  : "Pick a bank"}
            </option>
            {(banks ?? []).map((b) => (
              <option
                key={b.value}
                value={b.value}
                disabled={taken.has(b.value)}
              >
                {b.label}
                {taken.has(b.value) ? " (already connected)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && (
        <Alert tone="danger" title="Could not ask Distyra">
          {error}
        </Alert>
      )}
    </div>
  );
}

const KIND_OF: Record<string, string> = {
  SVGS: "SAVINGS",
  CARD: "CREDIT_CARD",
};

/** Turns a picked Distyra account into a choice, matched to a Sektar bank account when one is clearly it. */
export function accountChoice(
  picked: {
    accountId: string;
    accountKey: string;
    name: string | null;
    currency: string | null;
    ibanMasked: string | null;
    kind: string | null;
  },
  sektar: { id: string; ibanLast4?: string | null; currency?: string | null }[],
): BankAccountChoice {
  const last4 = (picked.ibanMasked ?? "").replace(/\D/g, "").slice(-4);
  const match = last4
    ? sektar.find(
        (a) =>
          a.ibanLast4 === last4 &&
          (a.currency ?? "").toUpperCase() ===
            (picked.currency ?? "").toUpperCase(),
      )
    : undefined;
  const label = [picked.name ?? "Account", picked.currency, picked.ibanMasked]
    .filter(Boolean)
    .join(" · ");
  return {
    accountId: picked.accountId,
    accountKey: picked.accountKey,
    label,
    bankAccountId: match?.id ?? null,
    name: [picked.name ?? "Account", picked.currency].filter(Boolean).join(" "),
    currency: picked.currency,
    ibanMasked: picked.ibanMasked,
    kind: picked.kind ? (KIND_OF[picked.kind] ?? "CURRENT") : "CURRENT",
  };
}

/**
 * Which accounts, for bank transactions: the bank's accounts (listing them
 * reaches the bank, one of its four fetches a day, so only on request), each
 * onto a Sektar bank account or a new one; and how often to check.
 */
export function BankAccounts({
  choices,
  patch,
}: {
  choices: CreateChoices;
  patch: Patch;
}) {
  const url = useWorkflowRuntimeUrl();
  const drive = useSektarDrive();
  const rows = useAccountRows(drive);
  const [listed, setListed] = useState<BankAccountChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = KIND_COPY.TRANSACTIONS!;
  const picked = useMemo(
    () => new Set((choices.accounts ?? []).map((a) => a.accountId)),
    [choices.accounts],
  );

  const load = async () => {
    if (!choices.connectionId || !choices.bankConnectionId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await blockOptions(
        url,
        LIST_ACCOUNTS,
        "account",
        { connectionId: choices.bankConnectionId },
        choices.connectionId,
      );
      if (r.disabled && r.placeholder) setError(r.placeholder);
      const all = r.options.map((o) =>
        accountChoice(
          JSON.parse(String(o.value)) as Parameters<typeof accountChoice>[0],
          rows,
        ),
      );
      setListed(all);
      patch({ accounts: all });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const update = (
    accountId: string,
    change: Partial<BankAccountChoice> | null,
  ) => {
    const current = choices.accounts ?? [];
    if (change === null) {
      patch({ accounts: current.filter((a) => a.accountId !== accountId) });
      return;
    }
    const base =
      current.find((a) => a.accountId === accountId) ??
      listed?.find((a) => a.accountId === accountId);
    if (!base) return;
    patch({
      accounts: [
        ...current.filter((a) => a.accountId !== accountId),
        { ...base, ...change },
      ],
    });
  };
  const interval = `${choices.every.value}-${choices.every.unit}`;

  return (
    <div className="sk-stack sk-stack--4">
      {listed === null ? (
        <div className="sk-intg-row">
          <div>
            <div className="sk-integration__label">
              {choices.bankName ?? "Your bank"}
            </div>
            <div className="sk-integration__meta">
              Listing the accounts asks the bank, which counts as one of its
              four fetches today.
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={busy}
          >
            {busy ? "Asking the bank…" : "List accounts"}
          </Button>
        </div>
      ) : (
        listed.map((a) => {
          const on = picked.has(a.accountId);
          const choice =
            choices.accounts?.find((x) => x.accountId === a.accountId) ?? a;
          return (
            <div key={a.accountId} className="sk-intg-row">
              <label className="sk-check" style={{ minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    update(a.accountId, e.target.checked ? {} : null)
                  }
                />{" "}
                {a.label}
              </label>
              {on && (
                <Select
                  value={choice.bankAccountId ?? ""}
                  onChange={(e) =>
                    update(a.accountId, {
                      bankAccountId: e.target.value || null,
                    })
                  }
                  aria-label={`Bank account in Sektar for ${a.label}`}
                  style={{ maxWidth: 260 }}
                >
                  <option value="">New bank account</option>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          );
        })
      )}
      {error && (
        <Alert tone="danger" title="Could not list the accounts">
          {error}
        </Alert>
      )}
      <div className="sk-intg-row">
        <div>
          <div className="sk-integration__label">Changes as they happen</div>
          <div className="sk-integration__meta">{copy.liveMeta}</div>
        </div>
        <Switch
          checked={choices.live}
          onChange={(live) => patch({ live })}
          label="Live updates"
        />
      </div>
      {choices.live && (
        <Field label="Check every">
          <Select
            value={interval}
            onChange={(e) => {
              const found = copy.intervals?.find(
                (i) => `${i.value}-${i.unit}` === e.target.value,
              );
              if (found)
                patch({ every: { value: found.value, unit: found.unit } });
            }}
            style={{ maxWidth: 240 }}
          >
            {(copy.intervals ?? []).map((i) => (
              <option
                key={`${i.value}-${i.unit}`}
                value={`${i.value}-${i.unit}`}
              >
                {i.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}
