import { generateMock } from "document-model/mock";
import {
  archiveContact,
  ArchiveContactInputSchema,
  isContactDocument,
  reducer,
  utils,
} from "document-models/contact/v1";
import { describe, expect, it } from "vitest";

describe("LifecycleOperations", () => {
  it("should handle archiveContact operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ArchiveContactInputSchema());

    const updatedDocument = reducer(document, archiveContact(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ARCHIVE_CONTACT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
