import type { BankAccountFeedOperations } from "document-models/bank-account/v1";
import {
  DuplicateTransactionError,
  EmptyImportError,
  TransactionExcludedError,
  TransactionNotFoundError,
} from "../../gen/feed/error.js";

export const bankAccountFeedOperations: BankAccountFeedOperations = {
  importTransactionsOperation(state, action) {
    if (action.input.transactions.length === 0)
      throw new EmptyImportError("Nothing to import");
    const known = new Set(
      state.transactions.map((t) => t.reference).filter((r) => r !== null),
    );
    for (const t of action.input.transactions) {
      if (t.reference && known.has(t.reference)) {
        throw new DuplicateTransactionError(
          `Transaction ${t.reference} was imported before`,
        );
      }
      if (t.reference) known.add(t.reference);
      state.transactions.push({
        id: t.id,
        bookedAt: t.bookedAt,
        amount: t.amount,
        counterparty: t.counterparty,
        description: t.description || null,
        reference: t.reference || null,
        category: "UNCATEGORIZED",
        contactId: null,
        matchedDocumentId: null,
        matchedKind: null,
        status: "NEW",
        importBatch: action.input.batchId,
      });
    }
    state.lastImportedAt = action.input.importedAt;
  },
  categorizeTransactionOperation(state, action) {
    const tx = state.transactions.find((t) => t.id === action.input.id);
    if (!tx)
      throw new TransactionNotFoundError(
        `Transaction ${action.input.id} not found`,
      );
    tx.category = action.input.category;
    if (action.input.contactId !== undefined)
      tx.contactId = action.input.contactId;
    if (tx.status === "NEW") tx.status = "CATEGORIZED";
  },
  matchTransactionOperation(state, action) {
    const tx = state.transactions.find((t) => t.id === action.input.id);
    if (!tx)
      throw new TransactionNotFoundError(
        `Transaction ${action.input.id} not found`,
      );
    if (tx.status === "EXCLUDED")
      throw new TransactionExcludedError(
        "An excluded transaction cannot be matched",
      );
    tx.matchedDocumentId = action.input.documentId;
    tx.matchedKind = action.input.kind;
    tx.status = "MATCHED";
  },
  unmatchTransactionOperation(state, action) {
    const tx = state.transactions.find((t) => t.id === action.input.id);
    if (!tx)
      throw new TransactionNotFoundError(
        `Transaction ${action.input.id} not found`,
      );
    tx.matchedDocumentId = null;
    tx.matchedKind = null;
    tx.status = tx.category === "UNCATEGORIZED" ? "NEW" : "CATEGORIZED";
  },
  excludeTransactionOperation(state, action) {
    const tx = state.transactions.find((t) => t.id === action.input.id);
    if (!tx)
      throw new TransactionNotFoundError(
        `Transaction ${action.input.id} not found`,
      );
    if (action.input.excluded) {
      tx.matchedDocumentId = null;
      tx.matchedKind = null;
      tx.status = "EXCLUDED";
    } else {
      tx.status = tx.category === "UNCATEGORIZED" ? "NEW" : "CATEGORIZED";
    }
  },
};
