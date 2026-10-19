import { generateMock } from "document-model/mock";
import {
  addPerson,
  AddPersonInputSchema,
  isContactDocument,
  reducer,
  removePerson,
  RemovePersonInputSchema,
  updatePerson,
  UpdatePersonInputSchema,
  utils,
} from "document-models/contact/v1";
import { describe, expect, it } from "vitest";

describe("PeopleOperations", () => {
  it("should handle addPerson operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddPersonInputSchema());

    const updatedDocument = reducer(document, addPerson(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_PERSON");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle updatePerson operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpdatePersonInputSchema());

    const updatedDocument = reducer(document, updatePerson(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPDATE_PERSON",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removePerson operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemovePersonInputSchema());

    const updatedDocument = reducer(document, removePerson(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_PERSON",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
