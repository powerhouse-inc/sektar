// Global search over the search-index processor's table. Where the business
// drive is a remote, the switchboard answers over GraphQL (the processor runs
// there); where the tab's own reactor holds it, the same query runs live on
// its database and results follow the documents as they change.
import { useRelationalQuery } from "@powerhousedao/reactor-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SEARCH_LIMIT,
  searchQuery,
  searchWords,
  SearchIndex,
  type DB,
  type SearchEntry,
} from "../../../processors/search-index/index.js";
import { useSektarDrive } from "./data.js";
import { indexGql } from "./index-gql.js";
import { useMailIndexMode } from "./mail-index.js";

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
      // the account (the hit's document) is the one document the detail loads
      return {
        to: "/finops/transactions",
        search: { open: hit.entity_id, account: hit.document_id },
      };
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

/** How long typing is left to settle before the switchboard is asked. */
const TYPING_DEBOUNCE_MS = 200;

const SEARCH_QUERY = `query ($d: String!, $q: String!, $l: Int) {
  searchIndex { search(driveId: $d, query: $q, limit: $l) {
    documentId entityId documentType kind title subtitle amount status at
  } }
}`;

interface RemoteHit {
  documentId: string;
  entityId: string;
  documentType: string;
  kind: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  status: string | null;
  at: string | null;
}

const fromRemote = (h: RemoteHit): SearchHit => ({
  document_id: h.documentId,
  entity_id: h.entityId,
  document_type: h.documentType,
  kind: h.kind,
  title: h.title,
  subtitle: h.subtitle,
  body: "",
  amount: h.amount,
  status: h.status,
  at: h.at,
});

/** The switchboard's answer for `words`, asked once typing has settled. */
function useRemoteSearch(
  base: string | null,
  driveId: string,
  words: readonly string[],
  limit: number,
) {
  const key = base && driveId && words.length ? `${base}|${driveId}|${words.join(" ")}|${limit}` : "";
  const [answer, setAnswer] = useState<{ key: string; hits: SearchHit[]; error: Error | null } | null>(null);
  useEffect(() => {
    if (!key || !base) return;
    let active = true;
    const timer = setTimeout(() => {
      indexGql<{ searchIndex: { search: RemoteHit[] } }>(base, SEARCH_QUERY, {
        d: driveId,
        q: words.join(" "),
        l: limit,
      })
        .then((data) => {
          if (active) setAnswer({ key, hits: data.searchIndex.search.map(fromRemote), error: null });
        })
        .catch((error: unknown) => {
          if (active)
            setAnswer({ key, hits: [], error: error instanceof Error ? error : new Error(String(error)) });
        });
    }, TYPING_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // words and limit are in the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = answer && answer.key === key ? answer : null;
  return { hits: current?.hits ?? [], isLoading: !!key && !current, error: current?.error ?? null };
}

/** Tokenised match: every word must appear somewhere in the row's body. */
export function useGlobalSearch(query: string, limit = SEARCH_LIMIT) {
  const drive = useSektarDrive();
  const driveId = drive?.header.id ?? "";
  const mode = useMailIndexMode(drive);
  const words = useMemo(() => searchWords(query), [query]);
  const params = useMemo(() => ({ words, limit }), [words, limit]);
  const build = useCallback(
    (
      db: Parameters<
        Parameters<typeof useRelationalQuery<DB, SearchHit, typeof params>>[2]
      >[0],
      p?: typeof params,
    ) => searchQuery(db, p?.words ?? [], p?.limit ?? SEARCH_LIMIT).compile(),
    [],
  );
  const local = useRelationalQuery<DB, SearchHit, typeof params>(
    SearchIndex,
    mode.kind === "local" ? driveId : "",
    build,
    params,
  );
  const remote = useRemoteSearch(
    mode.kind === "remote" ? mode.base : null,
    driveId,
    words,
    limit,
  );
  const hits = useMemo(() => {
    if (words.length === 0 || !driveId) return [];
    return mode.kind === "remote" ? remote.hits : (local.result?.rows ?? []);
  }, [words.length, driveId, mode.kind, remote.hits, local.result]);
  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const list = map.get(h.kind) ?? [];
      list.push(h);
      map.set(h.kind, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [hits]);
  const isLoading = mode.kind === "remote" ? remote.isLoading : local.isLoading;
  return {
    hits,
    grouped,
    isLoading: words.length > 0 && isLoading,
    error: mode.kind === "remote" ? remote.error : local.error,
    active: words.length > 0,
  };
}
