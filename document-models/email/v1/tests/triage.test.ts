import { generateMock } from "document-model/mock";
import {
  addLabels,
  AddLabelsInputSchema,
  archive,
  ArchiveInputSchema,
  isEmailDocument,
  markRead,
  MarkReadInputSchema,
  markUnread,
  MarkUnreadInputSchema,
  reducer,
  removeLabels,
  RemoveLabelsInputSchema,
  setFlagged,
  SetFlaggedInputSchema,
  unarchive,
  UnarchiveInputSchema,
  utils,
} from "document-models/email/v1";
import { describe, expect, it } from "vitest";

describe("TriageOperations", () => {
  it("should handle markRead operation", () => {
    const document = utils.createDocument();
    const input = generateMock(MarkReadInputSchema());

    const updatedDocument = reducer(document, markRead(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("MARK_READ");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle markUnread operation", () => {
    const document = utils.createDocument();
    const input = generateMock(MarkUnreadInputSchema());

    const updatedDocument = reducer(document, markUnread(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "MARK_UNREAD",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setFlagged operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetFlaggedInputSchema());

    const updatedDocument = reducer(document, setFlagged(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_FLAGGED",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle archive operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ArchiveInputSchema());

    const updatedDocument = reducer(document, archive(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ARCHIVE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle unarchive operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UnarchiveInputSchema());

    const updatedDocument = reducer(document, unarchive(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("UNARCHIVE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle addLabels operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddLabelsInputSchema());

    const updatedDocument = reducer(document, addLabels(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_LABELS");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeLabels operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveLabelsInputSchema());

    const updatedDocument = reducer(document, removeLabels(input));

    expect(isEmailDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_LABELS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
