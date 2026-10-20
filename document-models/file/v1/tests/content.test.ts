import { generateMock } from "document-model/mock";
import {
  clearSource,
  ClearSourceInputSchema,
  isFileDocument,
  reducer,
  setAttachmentSource,
  SetAttachmentSourceInputSchema,
  setDescription,
  SetDescriptionInputSchema,
  setDocumentSource,
  SetDocumentSourceInputSchema,
  setTitle,
  SetTitleInputSchema,
  utils,
} from "document-models/file/v1";
import { describe, expect, it } from "vitest";

describe("ContentOperations", () => {
  it("should handle setTitle operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTitleInputSchema());

    const updatedDocument = reducer(document, setTitle(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("SET_TITLE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setDescription operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetDescriptionInputSchema());

    const updatedDocument = reducer(document, setDescription(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_DESCRIPTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setAttachmentSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetAttachmentSourceInputSchema(), {
      ref: "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      setAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, setAttachmentSource(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_ATTACHMENT_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setDocumentSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetDocumentSourceInputSchema(), {
      setAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, setDocumentSource(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_DOCUMENT_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle clearSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ClearSourceInputSchema());

    const updatedDocument = reducer(document, clearSource(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CLEAR_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
