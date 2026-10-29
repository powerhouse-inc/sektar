/**
 * Reading the search index.
 *
 * Read-only by design: the index says what the books hold, never changes
 * them. Access is declared in index.ts and applied by the subgraph wrapper:
 * every query goes through `restrict`.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import {
  SEARCH_LIMIT,
  SEARCH_LIMIT_MAX,
  searchQuery,
  searchWords,
  type SearchIndex,
} from "processors/search-index";

type Db = SearchIndex["query"];

interface SearchArgs {
  driveId: string;
  query: string;
  limit?: number | null;
}

async function search({ db, args, restrict }: IndexQuery<Db, SearchArgs>) {
  const words = searchWords(args.query);
  if (words.length === 0) return [];
  const limit = Math.min(Math.max(args.limit ?? SEARCH_LIMIT, 1), SEARCH_LIMIT_MAX);
  const rows = await restrict(searchQuery(db, words, limit)).execute();
  return rows.map((r) => ({
    documentId: r.document_id,
    entityId: r.entity_id,
    documentType: r.document_type,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle,
    amount: r.amount,
    status: r.status,
    at: r.at,
  }));
}

export const resolvers = {
  Query: {
    searchIndex: () => ({}),
  },
};

export const queries = {
  "SearchIndexQueries.search": search,
};
