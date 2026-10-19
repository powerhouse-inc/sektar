import {
  categorizeTransaction,
  excludeTransaction,
  importTransactions,
  matchTransaction,
  reducer,
  setAccountDetails,
  unmatchTransaction,
  utils,
  type BankAccountDocument,
} from "document-models/bank-account/v1";
import { describe, expect, it } from "vitest";

const T = "2026-10-01T09:00:00.000Z";
const lastError = (doc: BankAccountDocument) =>
  doc.operations.global.at(-1)?.error;

function account(): BankAccountDocument {
  let doc = reducer(
    utils.createDocument(),
    setAccountDetails({
      name: "Business Current",
      institution: "ING",
      iban: "NL18",
      kind: "CURRENT",
      currency: "EUR",
      openingBalance: 1000,
    }),
  );
  doc = reducer(
    doc,
    importTransactions({
      batchId: "b1",
      importedAt: T,
      transactions: [
        {
          id: "t1",
          bookedAt: T,
          amount: -2450,
          counterparty: "WeWork",
          description: "Office",
          reference: "WW-1",
        },
        {
          id: "t2",
          bookedAt: T,
          amount: 15730,
          counterparty: "Acme",
          description: null,
          reference: null,
        },
      ],
    }),
  );
  return doc;
}

describe("bank account feed", () => {
  it("imports, categorises, matches, unmatches and excludes", () => {
    let doc = account();
    let s = doc.state.global;
    expect(s.name).toBe("Business Current");
    expect(s.lastImportedAt).toBe(T);
    expect(
      s.transactions.map((t) => [t.status, t.category, t.importBatch]),
    ).toEqual([
      ["NEW", "UNCATEGORIZED", "b1"],
      ["NEW", "UNCATEGORIZED", "b1"],
    ]);
    expect(s.transactions[1].description).toBeNull();

    doc = reducer(
      doc,
      categorizeTransaction({
        id: "t1",
        category: "RENT",
        contactId: "c-wework",
      }),
    );
    doc = reducer(doc, categorizeTransaction({ id: "t2", category: "SALES" }));
    s = doc.state.global;
    expect(s.transactions[0]).toMatchObject({
      status: "CATEGORIZED",
      category: "RENT",
      contactId: "c-wework",
    });
    expect(s.transactions[1]).toMatchObject({
      status: "CATEGORIZED",
      category: "SALES",
      contactId: null,
    });

    doc = reducer(
      doc,
      matchTransaction({ id: "t2", documentId: "inv-42", kind: "INVOICE" }),
    );
    expect(doc.state.global.transactions[1]).toMatchObject({
      status: "MATCHED",
      matchedDocumentId: "inv-42",
      matchedKind: "INVOICE",
    });
    // re-categorising a matched transaction keeps it matched
    doc = reducer(doc, categorizeTransaction({ id: "t2", category: "OTHER" }));
    expect(doc.state.global.transactions[1].status).toBe("MATCHED");
    doc = reducer(doc, unmatchTransaction({ id: "t2" }));
    expect(doc.state.global.transactions[1]).toMatchObject({
      status: "CATEGORIZED",
      matchedDocumentId: null,
      matchedKind: null,
    });
    doc = reducer(
      doc,
      categorizeTransaction({ id: "t2", category: "UNCATEGORIZED" }),
    );
    doc = reducer(doc, unmatchTransaction({ id: "t2" }));
    expect(doc.state.global.transactions[1].status).toBe("NEW");

    doc = reducer(
      doc,
      matchTransaction({ id: "t1", documentId: "bill-1", kind: "INVOICE" }),
    );
    doc = reducer(doc, excludeTransaction({ id: "t1", excluded: true }));
    expect(doc.state.global.transactions[0]).toMatchObject({
      status: "EXCLUDED",
      matchedDocumentId: null,
    });
    doc = reducer(
      doc,
      matchTransaction({ id: "t1", documentId: "bill-1", kind: "INVOICE" }),
    );
    expect(lastError(doc)).toBe("An excluded transaction cannot be matched");
    doc = reducer(doc, excludeTransaction({ id: "t1", excluded: false }));
    expect(doc.state.global.transactions[0].status).toBe("CATEGORIZED");
    doc = reducer(doc, excludeTransaction({ id: "t2", excluded: true }));
    doc = reducer(doc, excludeTransaction({ id: "t2", excluded: false }));
    expect(doc.state.global.transactions[1].status).toBe("NEW");
  });

  it("refuses duplicates, empty batches, unknown ids and currency changes", () => {
    let doc = account();
    doc = reducer(
      doc,
      importTransactions({ batchId: "b2", importedAt: T, transactions: [] }),
    );
    expect(lastError(doc)).toBe("Nothing to import");
    doc = reducer(
      doc,
      importTransactions({
        batchId: "b2",
        importedAt: T,
        transactions: [
          {
            id: "t3",
            bookedAt: T,
            amount: 1,
            counterparty: "X",
            reference: "WW-1",
          },
        ],
      }),
    );
    expect(lastError(doc)).toBe("Transaction WW-1 was imported before");
    expect(doc.state.global.transactions).toHaveLength(2);
    doc = reducer(
      doc,
      importTransactions({
        batchId: "b2",
        importedAt: T,
        transactions: [
          {
            id: "t3",
            bookedAt: T,
            amount: 1,
            counterparty: "X",
            reference: "NEW-1",
          },
          {
            id: "t4",
            bookedAt: T,
            amount: 1,
            counterparty: "Y",
            reference: "NEW-1",
          },
        ],
      }),
    );
    expect(lastError(doc)).toBe("Transaction NEW-1 was imported before");
    for (const action of [
      categorizeTransaction({ id: "nope", category: "OTHER" }),
      matchTransaction({ id: "nope", documentId: "d", kind: "EXPENSE" }),
      unmatchTransaction({ id: "nope" }),
      excludeTransaction({ id: "nope", excluded: true }),
    ]) {
      doc = reducer(doc, action);
      expect(lastError(doc)).toBe("Transaction nope not found");
    }
    doc = reducer(doc, setAccountDetails({ currency: "USD" }));
    expect(lastError(doc)).toBe(
      "The currency cannot change once transactions exist",
    );
    doc = reducer(
      doc,
      setAccountDetails({ currency: "EUR", name: "Main", openingBalance: 5 }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global).toMatchObject({
      currency: "EUR",
      name: "Main",
      openingBalance: 5,
    });
    const fresh = reducer(
      utils.createDocument(),
      setAccountDetails({ currency: "USD", kind: "CREDIT_CARD" }),
    );
    expect(fresh.state.global).toMatchObject({
      currency: "USD",
      kind: "CREDIT_CARD",
    });
  });
});
