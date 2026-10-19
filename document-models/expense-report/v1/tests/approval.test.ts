import { generateMock } from "document-model/mock";
import {
  approveReport,
  ApproveReportInputSchema,
  isExpenseReportDocument,
  reducer,
  reimburseReport,
  ReimburseReportInputSchema,
  rejectReport,
  RejectReportInputSchema,
  submitReport,
  SubmitReportInputSchema,
  utils,
} from "document-models/expense-report/v1";
import { describe, expect, it } from "vitest";

describe("ApprovalOperations", () => {
  it("should handle submitReport operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SubmitReportInputSchema(), {
      submittedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, submitReport(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SUBMIT_REPORT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle approveReport operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ApproveReportInputSchema(), {
      decidedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, approveReport(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "APPROVE_REPORT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle rejectReport operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RejectReportInputSchema(), {
      decidedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, rejectReport(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REJECT_REPORT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle reimburseReport operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ReimburseReportInputSchema(), {
      reimbursedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, reimburseReport(input));

    expect(isExpenseReportDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REIMBURSE_REPORT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
