import { generateMock } from "document-model/mock";
import {
  addLine,
  AddLineInputSchema,
  isInvoiceDocument,
  reducer,
  removeLine,
  RemoveLineInputSchema,
  updateLine,
  UpdateLineInputSchema,
  utils,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

describe("LinesOperations", () => {
  it("should handle addLine operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddLineInputSchema());

    const updatedDocument = reducer(document, addLine(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_LINE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle updateLine operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpdateLineInputSchema());

    const updatedDocument = reducer(document, updateLine(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPDATE_LINE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeLine operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveLineInputSchema());

    const updatedDocument = reducer(document, removeLine(input));

    expect(isInvoiceDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_LINE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
