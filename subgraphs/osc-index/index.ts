import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { OscIndex } from "processors/osc-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The identifier index as an index subgraph: a location row names the
 * collection document that holds the identifier, filtered on `document_id`
 * for the caller once the drive passed. A caller who may not see a
 * collection is told the identifier is absent there, never that it exists.
 */
export const OscIndexSubgraph = defineIndexSubgraph({
  name: "osc-index",
  typeDefs: schema,
  index: (driveId, db) => OscIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "OscIndexQueries.findSource": { rows: "document", column: "document_id" },
      "OscIndexQueries.findSources": {
        rows: "document",
        column: "document_id",
      },
    },
  },
  resolvers,
  queries,
});
