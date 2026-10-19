// Global search over the search-index processor's table. The processor runs in
// the tab's in-process reactor (and on the switchboard), so the index is local
// and live: results update as documents change, no server round trip.
import { useRelationalQuery } from "@powerhousedao/reactor-browser";
import { useCallback, useMemo } from "react";
import { SearchIndex } from "../../../processors/search-index/processor.js";
import type {
  DB,
  SearchEntry,
} from "../../../processors/search-index/schema.js";
import { useSektarDrive } from "./data.js";

export type SearchHit = SearchEntry;

/** Where a hit opens: the board that shows it, with the record selected. */
export function hitTarget(hit: SearchHit): {
  to: string;
  search: Record<string, string>;
} {
  switch (hit.kind) {
    case "invoice":
      return { to: "/finops/invoices", search: { open: hit.document_id } };
    case "expense":
      return { to: "/finops/expenses", search: { open: hit.document_id } };
    case "contact":
      return { to: "/finops/contacts", search: { open: hit.document_id } };
    case "transaction":
      return { to: "/finops/transactions", search: { open: hit.entity_id } };
    default:
      return {
        to: "/finops/transactions",
        search: { account: hit.document_id },
      };
  }
}

export const KIND_LABEL: Record<string, string> = {
  invoice: "Invoices",
  contact: "Contacts",
  expense: "Expense claims",
  account: "Accounts",
  transaction: "Transactions",
};

/** Tokenised match: every word must appear somewhere in the row's body. */
export function useGlobalSearch(query: string, limit = 40) {
  const drive = useSektarDrive();
  const driveId = drive?.header.id ?? "";
  const words = useMemo(
    () =>
      query
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 6),
    [query],
  );
  const params = useMemo(() => ({ words, limit }), [words, limit]);
  const build = useCallback(
    (
      db: Parameters<
        Parameters<typeof useRelationalQuery<DB, SearchHit, typeof params>>[2]
      >[0],
      p?: typeof params,
    ) => {
      let q = db.selectFrom("search_entries").selectAll();
      for (const w of p?.words ?? [])
        q = q.where("body", "like", `%${w.replace(/[%_]/g, "")}%`);
      return q
        .orderBy("at", "desc")
        .limit(p?.limit ?? 40)
        .compile();
    },
    [],
  );
  const { result, isLoading, error } = useRelationalQuery<
    DB,
    SearchHit,
    typeof params
  >(SearchIndex, driveId, build, params);
  const hits = useMemo(
    () => (words.length === 0 || !driveId ? [] : (result?.rows ?? [])),
    [result, words.length, driveId],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const list = map.get(h.kind) ?? [];
      list.push(h);
      map.set(h.kind, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [hits]);
  return {
    hits,
    grouped,
    isLoading: words.length > 0 && isLoading,
    error,
    active: words.length > 0,
  };
}
