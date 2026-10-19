import { generateMock } from "document-model/mock";
import {
  categorizeTransaction,
  CategorizeTransactionInputSchema,
  excludeTransaction,
  ExcludeTransactionInputSchema,
  importTransactions,
  ImportTransactionsInputSchema,
  isBankAccountDocument,
  matchTransaction,
  MatchTransactionInputSchema,
  reducer,
  unmatchTransaction,
  UnmatchTransactionInputSchema,
  utils,
} from "document-models/bank-account/v1";
import { describe, expect, it } from "vitest";

describe("FeedOperations", () => {
  it("should handle importTransactions operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ImportTransactionsInputSchema());

    const updatedDocument = reducer(document, importTransactions(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "IMPORT_TRANSACTIONS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle categorizeTransaction operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CategorizeTransactionInputSchema());

    const updatedDocument = reducer(document, categorizeTransaction(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CATEGORIZE_TRANSACTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle matchTransaction operation", () => {
    const document = utils.createDocument();
    const input = generateMock(MatchTransactionInputSchema());

    const updatedDocument = reducer(document, matchTransaction(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "MATCH_TRANSACTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle unmatchTransaction operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UnmatchTransactionInputSchema());

    const updatedDocument = reducer(document, unmatchTransaction(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UNMATCH_TRANSACTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle excludeTransaction operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ExcludeTransactionInputSchema());

    const updatedDocument = reducer(document, excludeTransaction(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "EXCLUDE_TRANSACTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
