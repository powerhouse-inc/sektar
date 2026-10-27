import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { FinanceIndex } from "processors/finance-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The finance index as an index subgraph: an invoice row and an account row
 * are one document each (`document_id`); a transaction row derives from its
 * bank account document (`account_id`). Every query, the counts and the
 * dashboard included, is filtered for the caller once the drive passed, so
 * a total never counts a document the caller could not open.
 */
export const FinanceIndexSubgraph = defineIndexSubgraph({
  name: "finance-index",
  typeDefs: schema,
  index: (driveId, db) => FinanceIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "FinanceIndexQueries.invoices": {
        rows: "document",
        column: "document_id",
      },
      "FinanceIndexQueries.invoiceCounts": {
        rows: "derived",
        column: "document_id",
      },
      "FinanceIndexQueries.accounts": {
        rows: "document",
        column: "document_id",
      },
      "FinanceIndexQueries.transactions": {
        rows: "document",
        column: "account_id",
      },
      "FinanceIndexQueries.transactionCounts": {
        rows: "derived",
        column: "account_id",
      },
      // The dashboard spans invoices, accounts and transactions; its handler
      // names each query's column itself.
      "FinanceIndexQueries.dashboard": {
        rows: "derived",
        column: "document_id",
      },
    },
  },
  resolvers,
  queries,
});
