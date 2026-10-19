import {
  addItem,
  approveReport,
  reducer,
  reimburseReport,
  rejectReport,
  removeItem,
  setReportDetails,
  submitReport,
  updateItem,
  utils,
  type ExpenseReportDocument,
} from "document-models/expense-report/v1";
import { describe, expect, it } from "vitest";

const T = "2026-10-10T09:00:00.000Z";
const lastError = (doc: ExpenseReportDocument) =>
  doc.operations.global.at(-1)?.error;

function claim(): ExpenseReportDocument {
  let doc = reducer(
    utils.createDocument(),
    setReportDetails({
      title: "Berlin trip",
      submitterName: "Sara",
      submitterEmail: "sara@x.io",
      currency: "EUR",
    }),
  );
  doc = reducer(
    doc,
    addItem({
      id: "i1",
      spentAt: T,
      merchant: "DB",
      category: "TRAVEL",
      amount: 189,
      vatAmount: 12,
      paidWith: "PERSONAL",
      note: "train",
      receiptName: "db.pdf",
    }),
  );
  doc = reducer(
    doc,
    addItem({
      id: "i2",
      spentAt: T,
      merchant: "Hotel",
      category: "TRAVEL",
      amount: 312,
      paidWith: "COMPANY_CARD",
    }),
  );
  return doc;
}

describe("expense claim flow", () => {
  it("builds a claim, gets rejected, resubmits, is approved and reimbursed", () => {
    let doc = claim();
    expect(doc.state.global.items[1]).toMatchObject({
      vatAmount: 0,
      note: null,
      receiptName: null,
      contactId: null,
    });
    doc = reducer(
      doc,
      updateItem({
        id: "i2",
        amount: 320,
        merchant: "Hotel Oderberger",
        category: "OTHER",
        vatAmount: 20,
        paidWith: "CASH",
        receiptName: "h.pdf",
        note: "2 nights",
        contactId: "c1",
        spentAt: "2026-10-11T09:00:00.000Z",
      }),
    );
    expect(doc.state.global.items[1]).toMatchObject({
      amount: 320,
      merchant: "Hotel Oderberger",
      category: "OTHER",
      vatAmount: 20,
      paidWith: "CASH",
      receiptName: "h.pdf",
      note: "2 nights",
      contactId: "c1",
    });
    doc = reducer(doc, removeItem({ id: "i1" }));
    expect(doc.state.global.items.map((i) => i.id)).toEqual(["i2"]);

    doc = reducer(doc, submitReport({ submittedAt: T }));
    expect(doc.state.global.status).toBe("SUBMITTED");
    doc = reducer(
      doc,
      rejectReport({
        decidedAt: T,
        decidedBy: "Jane",
        note: "Missing receipt",
      }),
    );
    expect(doc.state.global).toMatchObject({
      status: "REJECTED",
      decidedBy: "Jane",
      decisionNote: "Missing receipt",
    });
    // rejected claims are editable again
    doc = reducer(
      doc,
      addItem({
        id: "i3",
        spentAt: T,
        merchant: "Cafe",
        category: "TRAVEL",
        amount: 20,
        paidWith: "PERSONAL",
      }),
    );
    expect(lastError(doc)).toBeUndefined();
    doc = reducer(doc, setReportDetails({ title: "Berlin trip (fixed)" }));
    doc = reducer(doc, submitReport({ submittedAt: T }));
    expect(doc.state.global).toMatchObject({
      status: "SUBMITTED",
      decidedAt: null,
      decidedBy: null,
      decisionNote: null,
      title: "Berlin trip (fixed)",
    });
    doc = reducer(doc, approveReport({ decidedAt: T, decidedBy: "Jane" }));
    expect(doc.state.global).toMatchObject({
      status: "APPROVED",
      decisionNote: null,
    });
    doc = reducer(
      doc,
      reimburseReport({ reimbursedAt: T, transactionId: "tx-9" }),
    );
    expect(doc.state.global).toMatchObject({
      status: "REIMBURSED",
      reimbursementTransactionId: "tx-9",
    });
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
  });

  it("guards every transition and validates items", () => {
    let doc = reducer(utils.createDocument(), submitReport({ submittedAt: T }));
    expect(lastError(doc)).toBe("Add at least one expense before submitting");
    doc = reducer(
      doc,
      addItem({
        id: "z",
        spentAt: T,
        merchant: "X",
        category: "OTHER",
        amount: 0,
        paidWith: "CASH",
      }),
    );
    expect(lastError(doc)).toBe("An expense must be positive");
    doc = reducer(doc, updateItem({ id: "missing", amount: 1 }));
    expect(lastError(doc)).toBe("Item missing not found");
    doc = reducer(doc, removeItem({ id: "missing" }));
    expect(lastError(doc)).toBe("Item missing not found");
    doc = reducer(doc, approveReport({ decidedAt: T, decidedBy: "Jane" }));
    expect(lastError(doc)).toBe("Only a submitted report can be approved");
    doc = reducer(
      doc,
      rejectReport({ decidedAt: T, decidedBy: "Jane", note: "no" }),
    );
    expect(lastError(doc)).toBe("Only a submitted report can be rejected");
    doc = reducer(doc, reimburseReport({ reimbursedAt: T }));
    expect(lastError(doc)).toBe("Only an approved report can be reimbursed");

    doc = claim();
    doc = reducer(
      doc,
      addItem({
        id: "i0",
        spentAt: T,
        merchant: "Null VAT",
        category: "OTHER",
        amount: 1,
        vatAmount: null,
        paidWith: "CASH",
      }),
    );
    expect(doc.state.global.items.at(-1)?.vatAmount).toBe(0);
    doc = reducer(
      doc,
      updateItem({
        id: "i1",
        spentAt: null,
        merchant: null,
        category: null,
        amount: null,
        vatAmount: null,
        paidWith: null,
      }),
    );
    expect(doc.state.global.items[0]).toMatchObject({
      merchant: "DB",
      category: "TRAVEL",
      amount: 189,
      vatAmount: 12,
      paidWith: "PERSONAL",
    });
    doc = reducer(
      doc,
      updateItem({ id: "i1", receiptName: null, note: null, contactId: null }),
    );
    expect(doc.state.global.items[0]).toMatchObject({
      receiptName: null,
      note: null,
      contactId: null,
    });
    doc = reducer(doc, updateItem({ id: "i1", amount: -5 }));
    expect(lastError(doc)).toBe("An expense must be positive");
    doc = reducer(doc, submitReport({ submittedAt: T }));
    for (const action of [
      setReportDetails({ title: "late" }),
      addItem({
        id: "i9",
        spentAt: T,
        merchant: "X",
        category: "OTHER",
        amount: 1,
        paidWith: "CASH",
      }),
      updateItem({ id: "i1", amount: 1 }),
      removeItem({ id: "i1" }),
    ]) {
      doc = reducer(doc, action);
      expect(lastError(doc)).toBe("The report is submitted");
    }
    doc = reducer(doc, submitReport({ submittedAt: T }));
    expect(lastError(doc)).toBe("The report is already submitted");
    doc = reducer(
      doc,
      approveReport({ decidedAt: T, decidedBy: "Jane", note: "ok" }),
    );
    doc = reducer(doc, reimburseReport({ reimbursedAt: T }));
    expect(doc.state.global.reimbursementTransactionId).toBeNull();
  });
});
