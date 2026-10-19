import { generateMock } from "document-model/mock";
import {
  captureMessage,
  CaptureMessageInputSchema,
  isEmailDocument,
  reducer,
  setAccount,
  SetAccountInputSchema,
  setNotes,
  SetNotesInputSchema,
  utils,
} from "document-models/email/v1";
import { describe, expect, it } from "vitest";

describe("MessageOperations", () => {
  it("should handle setAccount operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetAccountInputSchema());

    const updatedDocument = reducer(document, setAccount(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_ACCOUNT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle captureMessage operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CaptureMessageInputSchema(), {
      sentAt: "2024-01-01T00:00:00.000Z",
      receivedAt: "2024-01-01T00:00:00.000Z",
      capturedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, captureMessage(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CAPTURE_MESSAGE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setNotes operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetNotesInputSchema());

    const updatedDocument = reducer(document, setNotes(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("SET_NOTES");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
