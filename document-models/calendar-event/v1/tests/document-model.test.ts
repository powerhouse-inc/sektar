/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsCalendarEventDocument,
  assertIsCalendarEventState,
  calendarEventDocumentType,
  initialGlobalState,
  initialLocalState,
  isCalendarEventDocument,
  isCalendarEventState,
  utils,
} from "document-models/calendar-event/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("CalendarEvent Document Model", () => {
  it("should create a new CalendarEvent document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(calendarEventDocumentType);
  });

  it("should create a new CalendarEvent document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isCalendarEventDocument(document)).toBe(true);
    expect(isCalendarEventState(document.state)).toBe(true);
  });
  it("should reject a document that is not a CalendarEvent document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsCalendarEventDocument(wrongDocumentType)).toThrow();
      expect(isCalendarEventDocument(wrongDocumentType)).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
    }
  });
  const wrongState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongState.state.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isCalendarEventState(wrongState.state)).toBe(false);
    expect(assertIsCalendarEventState(wrongState.state)).toThrow();
    expect(isCalendarEventDocument(wrongState)).toBe(false);
    expect(assertIsCalendarEventDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isCalendarEventState(wrongInitialState.state)).toBe(false);
    expect(assertIsCalendarEventState(wrongInitialState.state)).toThrow();
    expect(isCalendarEventDocument(wrongInitialState)).toBe(false);
    expect(assertIsCalendarEventDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isCalendarEventDocument(missingIdInHeader)).toBe(false);
    expect(assertIsCalendarEventDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isCalendarEventDocument(missingNameInHeader)).toBe(false);
    expect(assertIsCalendarEventDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isCalendarEventDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsCalendarEventDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isCalendarEventDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsCalendarEventDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
