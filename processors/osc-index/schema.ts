/**
 * The identifier index.
 *
 * "Have I captured this already?" is a question across documents, and reading
 * one collection cannot answer it. Scanning every collection per lookup is
 * worse than useless at backfill scale, so the answer comes from here.
 *
 * One row per identifier per collection. An identifier belongs to at most one
 * source WITHIN a collection — that is the model's invariant — but two
 * separate backfills may legitimately have captured the same object, so the
 * primary key is the pair.
 */
export interface OscIdentifier {
  /** Namespaced, exactly as the source carries it: "gmail:18f3a". */
  identifier: string;
  /** The collection holding it. The reason this table exists. */
  document_id: string;
  /**
   * The LIVE source it resolves to. An identifier belonging to a folded
   * source points at whatever absorbed it, so a lookup under an old id finds
   * the record that is actually current rather than a tombstone.
   */
  source_id: string;
  /** True when this identifier is an alias rather than the canonical id. */
  is_alias: boolean;
  status: string;
  title: string | null;
  captured_at: string;
  last_seen_at: string;
  collection_title: string | null;
}

export interface DB {
  osc_identifier: OscIdentifier;
}
