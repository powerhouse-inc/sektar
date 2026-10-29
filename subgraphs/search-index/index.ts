import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { SearchIndex } from "processors/search-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The top bar's search as an index subgraph: a hit is one document's row (a
 * transaction's row belongs to its account), filtered on `document_id` for
 * the caller once the drive passed.
 */
export const SearchIndexSubgraph = defineIndexSubgraph({
  name: "search-index",
  typeDefs: schema,
  index: (driveId, db) => SearchIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "SearchIndexQueries.search": { rows: "document", column: "document_id" },
    },
  },
  resolvers,
  queries,
});
