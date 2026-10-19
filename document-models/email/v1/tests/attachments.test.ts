import { generateMock } from "document-model/mock";
import {
  addAttachment,
  AddAttachmentInputSchema,
  isEmailDocument,
  reducer,
  removeAttachment,
  RemoveAttachmentInputSchema,
  utils,
} from "document-models/email/v1";
import { describe, expect, it } from "vitest";

describe("AttachmentsOperations", () => {
  it("should handle addAttachment operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddAttachmentInputSchema(), {
      ref: "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    const updatedDocument = reducer(document, addAttachment(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ADD_ATTACHMENT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeAttachment operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveAttachmentInputSchema());

    const updatedDocument = reducer(document, removeAttachment(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_ATTACHMENT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
