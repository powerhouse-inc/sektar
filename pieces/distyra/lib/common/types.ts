// Response shapes for the Connect endpoints this piece calls, transcribed from
// the published OpenAPI spec (https://api.distyra.com/openapi.json, v1.6.0).
// Everything the bank may omit is nullable there, so it is nullable here too:
// the API never invents a value it was not sent.

/** One normalized entry as Distyra returns it. */
export type DistyraTransaction = {
  /** Which account on the connection this entry belongs to. Always present. */
  account_id: string;
  /**
   * The bank's own reference: `entry_reference` when it sends one, else
   * `transaction_id`. Only safe to deduplicate on when `id_source` is
   * `entry_reference`; otherwise match on date + amount + descriptor.
   */
  id: string | null;
  id_source: "entry_reference" | "transaction_id" | null;
  entry_reference: string | null;
  transaction_id: string | null;
  /** YYYY-MM-DD. Booking date, falling back to value then transaction date. */
  date: string | null;
  booking_date: string | null;
  value_date: string | null;
  transaction_date: string | null;
  /**
   * Major units, never rescaled (EUR 22.40 is `22.4`). Signed from
   * `credit_debit`: negative is money out, positive is money in.
   */
  amount: number | null;
  /** ISO 4217. */
  currency: string | null;
  /** Raw text enrichment reads: counterparty name, else the remittance text. */
  descriptor: string;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  counterparty_bban: string | null;
  /** The payment communication lines as sent; empty when the bank sent none. */
  remittance_information: string[];
  reference_number: string | null;
  reference_number_scheme: string | null;
  /** A reference whose check digits validate, for matching against invoices. */
  structured_reference: {
    scheme: string;
    reference: string;
    formatted: string;
  } | null;
  credit_debit: "CRDT" | "DBIT" | null;
  /** Only `BOOK` means booked. Post to a ledger on `BOOK` alone. */
  status: "BOOK" | "PDNG" | "CNCL" | "HOLD" | "RJCT" | "SCHD" | "OTHR" | null;
  /** Exactly `status === "PDNG"`. Not the inverse of booked. */
  pending: boolean;
  mcc: string | null;
  bank_code_description: string | null;
  bank_code_codes: string[];
  bank_code_iso_pair: { family: string; subFamily: string | null } | null;
  /** With enrich=true on an all-history pull: older than `enriched_from`. */
  enrichment_skipped?: true;
  /** Enrichment adds further fields; they pass through untouched. */
  [key: string]: unknown;
};

/**
 * The body of GET /v1/connect/connections/{id}/transactions, as it arrives.
 * The spec marks no top-level field required, so `transactions` is optional
 * here; the action normalizes it before returning `DistyraTransactionsResult`.
 */
export type DistyraTransactionsResponse = {
  transactions?: DistyraTransaction[];
  /** Start of the window read; null when an all-history pull found nothing. */
  date_from: string | null;
  date_to: string | null;
  /** Present only when this pull asked the bank for all the history it has. */
  history?: "all";
  enriched_from?: string | null;
  enrichment_skipped_count?: number;
  accounts_fetched?: number;
  /**
   * Present only when the answer is partial: our page ceiling was hit, so
   * there are more transactions in this window than were returned.
   */
  truncated?: true;
  truncated_accounts?: string[];
  /** Pass as `since` next time. The boundary day overlaps: dedupe by id. */
  next_cursor: string | null;
};

/** What the action returns: the response, with `transactions` guaranteed. */
export type DistyraTransactionsResult = DistyraTransactionsResponse & {
  transactions: DistyraTransaction[];
};

/** One row of GET /v1/connect/connections. */
export type DistyraConnection = {
  id: string;
  external_ref: string | null;
  applicant_ref: string | null;
  mode: "own" | "applicant" | "end_user";
  aspsp_name: string | null;
  country: string | null;
  psu_type: "business" | "personal";
  status: "pending" | "active" | "expired" | "revoked" | "error";
  consent_expires_at: string | null;
  created_at: string;
};

/** The body of GET /v1/connect/connections. */
export type DistyraConnectionsResponse = {
  connections: DistyraConnection[];
  next_cursor: string | null;
};
