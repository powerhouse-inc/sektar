/** One row per searchable thing: a document, or a transaction inside an account. */
export interface SearchEntry {
  /** The owning document; rows go with the document when it is deleted. */
  document_id: string;
  /** "doc" for the document itself, the transaction id for feed rows. */
  entity_id: string;
  document_type: string;
  /** invoice | contact | expense | account | transaction */
  kind: string;
  title: string;
  subtitle: string | null;
  /** Everything searchable, lower-cased and space-joined. */
  body: string;
  amount: number | null;
  status: string | null;
  /** ISO timestamp used for ordering (issued/spent/booked/updated). */
  at: string | null;
}

export interface DB {
  search_entries: SearchEntry;
}
