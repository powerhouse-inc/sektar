import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { FinanceIndex } from "processors/finance-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The finance index as an index subgraph: an invoice, account, claim or
 * contact row is one document each (`document_id`); a transaction row
 * derives from its bank account document (`account_id`), a receipt row from
 * its claim (`report_id`). Every query, the counts and the
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
      "FinanceIndexQueries.invoiceNumbers": {
        rows: "document",
        column: "document_id",
      },
      // Computed over the numbers the caller may read.
      "FinanceIndexQueries.nextInvoiceNumber": {
        rows: "derived",
        column: "document_id",
      },
      "FinanceIndexQueries.latestOurParty": {
        rows: "document",
        column: "document_id",
      },
      "FinanceIndexQueries.expenses": {
        rows: "document",
        column: "document_id",
      },
      "FinanceIndexQueries.expenseCounts": {
        rows: "derived",
        column: "document_id",
      },
      // A receipt row derives from its claim.
      "FinanceIndexQueries.spend90d": {
        rows: "derived",
        column: "report_id",
      },
      // A contact row is the contact; its aggregates (invoices, transactions)
      // are narrowed by the handler on their own columns.
      "FinanceIndexQueries.contacts": {
        rows: "document",
        column: "contact_index.document_id",
      },
      "FinanceIndexQueries.contactCounts": {
        rows: "derived",
        column: "document_id",
      },
      "FinanceIndexQueries.contact": {
        rows: "document",
        column: "contact_index.document_id",
      },
      "FinanceIndexQueries.contactNames": {
        rows: "document",
        column: "document_id",
      },
      // The transaction, its account and what it is matched to: the handler
      // names each query's column.
      "FinanceIndexQueries.transaction": {
        rows: "document",
        column: "account_id",
      },
      "FinanceIndexQueries.matchCandidates": {
        rows: "derived",
        column: "document_id",
      },
      "FinanceIndexQueries.counts": {
        rows: "derived",
        column: "document_id",
      },
    },
  },
  resolvers,
  queries,
});
