/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { booksSettingsDocumentType } from "./document-type.js";
import { BooksSettingsStateSchema } from "./schema/zod.js";
import type { BooksSettingsDocument, BooksSettingsPHState } from "./types.js";

/** Schema for validating the header object of a BooksSettings document */
export const BooksSettingsDocumentHeaderSchema =
  BaseDocumentHeaderSchema.extend({
    documentType: z.literal(booksSettingsDocumentType),
  });

/** Schema for validating the state object of a BooksSettings document */
export const BooksSettingsPHStateSchema = BaseDocumentStateSchema.extend({
  global: BooksSettingsStateSchema(),
});

export const BooksSettingsDocumentSchema = z.object({
  header: BooksSettingsDocumentHeaderSchema,
  state: BooksSettingsPHStateSchema,
  initialState: BooksSettingsPHStateSchema,
});

/** Simple helper function to check if a state object is a BooksSettings document state object */
export function isBooksSettingsState(
  state: unknown,
): state is BooksSettingsPHState {
  return BooksSettingsPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a BooksSettings document state object */
export function assertIsBooksSettingsState(
  state: unknown,
): asserts state is BooksSettingsPHState {
  BooksSettingsPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a BooksSettings document */
export function isBooksSettingsDocument(
  document: unknown,
): document is BooksSettingsDocument {
  return BooksSettingsDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a BooksSettings document */
export function assertIsBooksSettingsDocument(
  document: unknown,
): asserts document is BooksSettingsDocument {
  BooksSettingsDocumentSchema.parse(document);
}
