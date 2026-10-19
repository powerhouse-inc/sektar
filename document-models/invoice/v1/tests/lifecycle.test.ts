import { generateMock } from "document-model/mock";
import {
  isInvoiceDocument,
  issueInvoice,
  IssueInvoiceInputSchema,
  recordPayment,
  RecordPaymentInputSchema,
  reducer,
  utils,
  voidInvoice,
  VoidInvoiceInputSchema,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

describe("LifecycleOperations", () => {
  it("should handle issueInvoice operation", () => {
    const document = utils.createDocument();
    const input = generateMock(IssueInvoiceInputSchema(), {
      issuedAt: "2024-01-01T00:00:00.000Z",
      dueAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, issueInvoice(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ISSUE_INVOICE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle recordPayment operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RecordPaymentInputSchema(), {
      paidAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, recordPayment(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "RECORD_PAYMENT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle voidInvoice operation", () => {
    const document = utils.createDocument();
    const input = generateMock(VoidInvoiceInputSchema());

    const updatedDocument = reducer(document, voidInvoice(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "VOID_INVOICE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
