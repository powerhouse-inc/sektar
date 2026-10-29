import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { IntegrationIndex } from "processors/integration-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The integration index as an index subgraph: an integration, queue or
 * connection row is one document, filtered on `document_id` for the caller
 * once the drive passed.
 */
export const IntegrationIndexSubgraph = defineIndexSubgraph({
  name: "integration-index",
  typeDefs: schema,
  index: (driveId, db) => IntegrationIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "IntegrationIndexQueries.integrations": { rows: "document", column: "document_id" },
      "IntegrationIndexQueries.queues": { rows: "document", column: "document_id" },
      "IntegrationIndexQueries.connections": { rows: "document", column: "document_id" },
      // the request's own headers, nothing from the index
      "IntegrationIndexQueries.onScreen": { public: true },
    },
  },
  resolvers,
  queries,
});
