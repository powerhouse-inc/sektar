import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { KeyIndex } from "processors/key-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The key index as an index subgraph: every row is one document, so the
 * host's readable-documents filter applies to `document_id` once the drive
 * passed. Declared here; the wrapper applies it around every handler.
 */
export const KeyIndexSubgraph = defineIndexSubgraph({
  name: "key-index",
  typeDefs: schema,
  index: (driveId, db) => KeyIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "KeyIndexQueries.find": { rows: "document", column: "document_id" },
    },
  },
  resolvers,
  queries,
});
