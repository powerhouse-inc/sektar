/**
 * The key index.
 *
 * "Does a document for this key already exist, and which one?" is a question
 * across documents, and the only alternative to this table is reading every
 * document of the type with its state — which, at a thousand emails, is a
 * hundred megabytes of bodies per lookup and what took the switchboard down.
 *
 * One row per key per document. A document normally carries one key, but a
 * key may legitimately have been captured twice (two backfills over the same
 * mailbox), so the primary key is the pair and a lookup returns every hit.
 */
export interface KeyRow {
  document_type: string;
  /** Namespaced, exactly as the document carries it: "gmail:18f3a". */
  key: string;
  /** The document holding it. The reason this table exists. */
  document_id: string;
}

export interface DB {
  key_index: KeyRow;
}
