import { generateMock } from "document-model/mock";
import {
  isInvoiceDocument,
  reducer,
  setInvoiceDetails,
  SetInvoiceDetailsInputSchema,
  utils,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

describe("DetailsOperations", () => {
  it("should handle setInvoiceDetails operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetInvoiceDetailsInputSchema(), {
      dueAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, setInvoiceDetails(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_INVOICE_DETAILS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
