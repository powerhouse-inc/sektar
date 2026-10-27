import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { EmailIndex } from "processors/email-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The mailbox index as an index subgraph: a message row is one document,
 * the per-mailbox counts derive from message rows. Both are filtered on
 * `document_id` for the caller once the drive passed, so a count never
 * includes a message the caller could not open.
 */
export const EmailIndexSubgraph = defineIndexSubgraph({
  name: "email-index",
  typeDefs: schema,
  index: (driveId, db) => EmailIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "EmailIndexQueries.messages": { rows: "document", column: "document_id" },
      "EmailIndexQueries.accounts": { rows: "derived", column: "document_id" },
    },
  },
  resolvers,
  queries,
});
