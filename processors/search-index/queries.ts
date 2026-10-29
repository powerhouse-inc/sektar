// The top bar's search as a query over the index. Shared by the subgraph (the
// switchboard answers Connect over GraphQL) and by a tab whose own reactor runs
// the processor (a live query), so both match a query the same way.
// The declarations name kysely's builder types (these queries return them):
// importing the package lets tsc refer to "kysely", not to a path into .pnpm.
import type {} from "kysely";
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { DB } from "./schema.js";

/** What both a namespaced query builder and a Kysely instance offer. */
export type SearchQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

/** Hits per search by default; the subgraph caps a request at SEARCH_LIMIT_MAX. */
export const SEARCH_LIMIT = 40;
export const SEARCH_LIMIT_MAX = 200;

/** The words of a query: lower-cased, at most six, LIKE wildcards dropped. */
export function searchWords(query: string | null | undefined): string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim().replace(/[%_]/g, ""))
    .filter(Boolean)
    .slice(0, 6);
}

/** Tokenised match, newest first: every word must appear in the row's body. */
export function searchQuery(
  db: SearchQueryBuilder,
  words: readonly string[],
  limit: number,
) {
  let q = db.selectFrom("search_entries").selectAll();
  for (const w of words) q = q.where("body", "like", `%${w}%`);
  return q.orderBy("at", "desc").limit(limit);
}
