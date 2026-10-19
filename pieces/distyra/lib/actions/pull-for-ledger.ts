import { randomUUID } from "node:crypto";
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { distyraAuth } from "../auth.js";
import { pullProps, runPull } from "../common/pull.js";
import type { DistyraTransaction } from "../common/types.js";

/**
 * The ledger's TransactionStatus enum. Listed here rather than imported so the
 * piece stays a plain API client with no dependency on the document model.
 */
const STATUS_CODES = [
  "BOOK",
  "PDNG",
  "CNCL",
  "HOLD",
  "RJCT",
  "SCHD",
  "OTHR",
] as const;
type LedgerStatus = (typeof STATUS_CODES)[number];

/**
 * One row shaped for the Transaction Ledger's PulledTransactionInput. The
 * ledger is a GraphQL document model, so its field names are camelCase and its
 * enums uppercase — neither of which is what the bank API sends.
 */
export type LedgerRow = {
  id: string;
  externalId: string;
  idSource?: "ENTRY_REFERENCE" | "TRANSACTION_ID";
  accountId: string;
  date?: string;
  bookingDate?: string;
  valueDate?: string;
  amount?: number;
  currency?: string;
  creditDebit?: "CRDT" | "DBIT";
  status?: LedgerStatus;
  descriptor: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  counterpartyBban?: string;
  remittanceInformation?: string[];
  structuredReference?: {
    scheme: string;
    reference: string;
    formatted: string;
  };
  mcc?: string;
  bankCodeDescription?: string;
  isoCode?: { family: string; subFamily?: string };
  enrichmentSkipped?: boolean;
};

/** Exactly the ledger's RecordPullInput, ready to hand to Dispatch actions. */
type RecordPullInput = {
  connectionId: string;
  pulledAt: string;
  dateFrom?: string;
  dateTo?: string;
  nextCursor?: string;
  historyComplete: boolean;
  truncated: boolean;
  truncatedAccountIds: string[];
  accountsFetched?: number;
  transactions: LedgerRow[];
};

/**
 * Drop nulls: the ledger treats an absent field and a null one alike.
 * NonNullable matters here — without it T infers as `string | null` from the
 * argument and the null rides straight through the return type.
 */
function orUndefined<T>(
  value: T | null | undefined,
): NonNullable<T> | undefined {
  return value ?? undefined;
}

/**
 * `id_source` is the one field where the bank's casing and the ledger's enum
 * disagree: Distyra sends `entry_reference`, the enum is `ENTRY_REFERENCE`.
 */
export function toIdSource(
  value: string | null,
): "ENTRY_REFERENCE" | "TRANSACTION_ID" | undefined {
  if (value === "entry_reference") return "ENTRY_REFERENCE";
  if (value === "transaction_id") return "TRANSACTION_ID";
  return undefined;
}

/**
 * Drop a status the ledger's enum does not have. The reducer then falls back to
 * OTHR, which is what an unrecognised status means; passing it through instead
 * would fail validation and lose the whole pull.
 */
export function toStatus(value: string | null): LedgerStatus | undefined {
  return STATUS_CODES.find((code) => code === value);
}

export function toLedgerRow(tx: DistyraTransaction): LedgerRow {
  return {
    // A fresh OID per run. RECORD_PULL matches on externalId and only uses
    // this when the row is genuinely new, so re-running costs nothing.
    id: randomUUID(),
    externalId: tx.id ?? "",
    idSource: toIdSource(tx.id_source),
    accountId: tx.account_id,
    date: orUndefined(tx.date),
    bookingDate: orUndefined(tx.booking_date),
    valueDate: orUndefined(tx.value_date),
    // Nullish, not truthy: an amount of exactly 0 is a real entry.
    amount: tx.amount ?? undefined,
    currency: orUndefined(tx.currency),
    creditDebit: orUndefined(tx.credit_debit),
    status: toStatus(tx.status),
    descriptor: tx.descriptor,
    counterpartyName: orUndefined(tx.counterparty_name),
    counterpartyIban: orUndefined(tx.counterparty_iban),
    counterpartyBban: orUndefined(tx.counterparty_bban),
    remittanceInformation: tx.remittance_information,
    structuredReference: tx.structured_reference ?? undefined,
    mcc: orUndefined(tx.mcc),
    bankCodeDescription: orUndefined(tx.bank_code_description),
    isoCode: tx.bank_code_iso_pair
      ? {
          family: tx.bank_code_iso_pair.family,
          subFamily: orUndefined(tx.bank_code_iso_pair.subFamily),
        }
      : undefined,
    enrichmentSkipped: tx.enrichment_skipped,
  };
}

export const distyraPullForLedgerAction = createAction({
  auth: distyraAuth,
  name: "pull-for-ledger",
  displayName: "Pull Transactions for a Ledger",
  description:
    "Fetch transactions and return them already shaped as the Transaction Ledger's RECORD_PULL input: camelCase fields, uppercase enums and a fresh OID per row. Feed the whole output straight into the Reactor piece's Dispatch actions step.",
  props: {
    ...pullProps,
    expectedConnectionId: Property.ShortText({
      displayName: "Ledger's current connection id",
      description:
        "Point this at the ledger's own connectionId, e.g. {{steps.ledger.output.state.connectionId}}. When it disagrees with the connection being pulled, this step fails instead of handing over a payload the ledger will reject. Worth setting: the ledger's own guard runs inside a reducer, so its refusal never reaches the workflow and the dispatch step reports success having written nothing.",
      required: false,
      advanced: true,
    }),
    ledgerConnectionId: Property.ShortText({
      displayName: "Ledger connection id",
      description:
        "Written into the payload as RECORD_PULL's connectionId, which guards the ledger against a second bank being synced into it. Defaults to the Distyra connection selected above.",
      required: false,
      advanced: true,
    }),
  },
  errorHandlingOptions: {
    // Off by default: every attempt spends one of the bank's four unattended
    // fetches per connection per day.
    retryOnFailure: { defaultValue: false },
    continueOnFailure: { defaultValue: false },
  },
  async run(context) {
    const props = context.propsValue;
    const ledgerConnection =
      props.ledgerConnectionId?.trim() || props.connectionId;

    // Checked before the pull, so a mismatch costs no bank fetch. "null" and
    // "undefined" arrive from an expression over a ledger that has not adopted
    // a connection yet, which is not a mismatch.
    const expected = props.expectedConnectionId?.trim();
    if (
      expected &&
      expected !== "null" &&
      expected !== "undefined" &&
      expected !== ledgerConnection
    ) {
      throw new Error(
        `This ledger already mirrors connection ${expected}, but the step is pulling ${ledgerConnection}. A ledger tracks one connection: its sync cursor belongs to that connection alone. Point this step at a ledger for ${ledgerConnection}, or clear the other one first.`,
      );
    }

    const response = await runPull(context.auth.props, props);
    const transactions = response.transactions ?? [];

    // A row with no bank reference has nothing to deduplicate on, so it would
    // be re-added on every pull. Dropping it is better than growing the ledger
    // without bound; the count is reported so the loss is never silent.
    const usable = transactions.filter((tx) => Boolean(tx.id));

    const payload: RecordPullInput = {
      connectionId: ledgerConnection,
      pulledAt: new Date().toISOString(),
      dateFrom: orUndefined(response.date_from),
      dateTo: orUndefined(response.date_to),
      nextCursor: orUndefined(response.next_cursor),
      // `history: "all"` means the bank was asked for everything it has; a
      // truncated answer stopped at the page ceiling and proves nothing.
      historyComplete:
        response.history === "all" && response.truncated !== true,
      truncated: response.truncated === true,
      truncatedAccountIds: response.truncated_accounts ?? [],
      accountsFetched: response.accounts_fetched,
      transactions: usable.map(toLedgerRow),
    };

    return {
      /**
       * Drop this straight into the Dispatch actions step's "Action list
       * (JSON)" field. Its "Input" field cannot take a whole payload from an
       * expression: that one is a dynamic form built field-by-field from the
       * action's schema, so an expression has nowhere to land. This list does.
       */
      dispatchActions: [{ type: "RECORD_PULL", input: payload }],
      // The same payload on its own, for a step that wants just the input.
      recordPull: payload,
      transactionCount: payload.transactions.length,
      skippedWithoutReference: transactions.length - usable.length,
      truncated: payload.truncated,
      nextCursor: payload.nextCursor ?? null,
    };
  },
});
