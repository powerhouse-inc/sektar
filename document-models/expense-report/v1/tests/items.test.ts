import { generateMock } from "document-model/mock";
import {
  addItem,
  AddItemInputSchema,
  isExpenseReportDocument,
  reducer,
  removeItem,
  RemoveItemInputSchema,
  setReportDetails,
  SetReportDetailsInputSchema,
  updateItem,
  UpdateItemInputSchema,
  utils,
} from "document-models/expense-report/v1";
import { describe, expect, it } from "vitest";

describe("ItemsOperations", () => {
  it("should handle setReportDetails operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetReportDetailsInputSchema());

    const updatedDocument = reducer(document, setReportDetails(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_REPORT_DETAILS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle addItem operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddItemInputSchema(), {
      spentAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, addItem(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_ITEM");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle updateItem operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpdateItemInputSchema(), {
      spentAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, updateItem(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPDATE_ITEM",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeItem operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveItemInputSchema());

    const updatedDocument = reducer(document, removeItem(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_ITEM",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
