/**
 * Distyra transactions to a Sektar bank account's IMPORT_TRANSACTIONS input.
 *
 * Pure, so a test can show exactly which rows a pull would add. The model
 * refuses a whole import when any reference in it was imported before, so
 * every row carries a stable reference and rows already on the account are
 * left out here rather than refused there:
 *
 * - `distyra:<account>:<entry_reference>` when the bank sent an entry
 *   reference, which is unique and stable for the account;
 * - otherwise `distyra:<account>:h:<hash of date, amount, descriptor and
 *   occurrence>`, since a `transaction_id` may change between fetches. The
 *   occurrence number keeps two identical entries on the same day apart.
 *
 * `<account>` is the account_key when one is given, which survives the
 * holder re-authorizing the connection; account_id does not.
 */
import { createHash } from "node:crypto";
import type { DistyraTransaction } from "../common/types.js";

export interface ImportedRow {
  id: string;
  bookedAt: string;
  amount: number;
  counterparty: string;
  description: string | null;
  reference: string;
}

export interface ImportPlan {
  rows: ImportedRow[];
  counts: {
    received: number;
    otherAccount: number;
    notBooked: number;
    undated: number;
    known: number;
    toImport: number;
  };
  /** Earliest and latest booking day among the rows imported. */
  span: { from: string | null; to: string | null };
}

function clean(text: string | null | undefined): string | null {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

/** The stable reference for a row; `seen` counts identical rows already met. */
export function referenceOf(
  tx: DistyraTransaction,
  account: string,
  seen: Map<string, number>,
): string {
  if (tx.id_source === "entry_reference" && tx.id) {
    return `distyra:${account}:${tx.id}`;
  }
  const basis = [tx.date ?? "", String(tx.amount ?? ""), tx.descriptor].join("\u0000");
  const n = seen.get(basis) ?? 0;
  seen.set(basis, n + 1);
  const hash = createHash("sha1").update(`${basis}\u0000${String(n)}`).digest("hex").slice(0, 16);
  return `distyra:${account}:h:${hash}`;
}

export function planImport(
  transactions: unknown,
  options: {
    accountId: string;
    accountKey?: string;
    knownReferences: ReadonlySet<string>;
    newId: () => string;
  },
): ImportPlan {
  // Untyped on the way in: a Json prop holds whatever the expression gave.
  const list: DistyraTransaction[] = (Array.isArray(transactions) ? (transactions as unknown[]) : []).filter(
    (entry): entry is DistyraTransaction => typeof entry === "object" && entry !== null,
  );
  const account = options.accountKey?.trim() || options.accountId;
  const counts = { received: list.length, otherAccount: 0, notBooked: 0, undated: 0, known: 0, toImport: 0 };
  const seen = new Map<string, number>();
  const batch = new Set<string>();
  const rows: ImportedRow[] = [];
  for (const tx of list) {
    if (tx.account_id !== options.accountId) {
      counts.otherAccount += 1;
      continue;
    }
    // Only BOOK is booked; a ledger posts nothing else.
    if (tx.status !== null && tx.status !== "BOOK") {
      counts.notBooked += 1;
      continue;
    }
    if (!tx.date || typeof tx.amount !== "number") {
      counts.undated += 1;
      continue;
    }
    const reference = referenceOf(tx, account, seen);
    if (options.knownReferences.has(reference) || batch.has(reference)) {
      counts.known += 1;
      continue;
    }
    batch.add(reference);
    const remittance = Array.isArray(tx.remittance_information)
      ? tx.remittance_information.join(" ")
      : "";
    rows.push({
      id: options.newId(),
      bookedAt: `${tx.date}T00:00:00.000Z`,
      amount: tx.amount,
      counterparty: clean(tx.counterparty_name) ?? clean(tx.descriptor) ?? "Unknown",
      description:
        clean(tx.structured_reference?.formatted) ??
        clean(remittance) ??
        clean(tx.bank_code_description),
      reference,
    });
  }
  counts.toImport = rows.length;
  const days = rows.map((r) => r.bookedAt.slice(0, 10)).sort();
  return {
    rows,
    counts,
    span: { from: days[0] ?? null, to: days[days.length - 1] ?? null },
  };
}
