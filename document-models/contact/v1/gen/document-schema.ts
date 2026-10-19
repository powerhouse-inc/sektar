/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { contactDocumentType } from "./document-type.js";
import { ContactStateSchema } from "./schema/zod.js";
import type { ContactDocument, ContactPHState } from "./types.js";

/** Schema for validating the header object of a Contact document */
export const ContactDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(contactDocumentType),
});

/** Schema for validating the state object of a Contact document */
export const ContactPHStateSchema = BaseDocumentStateSchema.extend({
  global: ContactStateSchema(),
});

export const ContactDocumentSchema = z.object({
  header: ContactDocumentHeaderSchema,
  state: ContactPHStateSchema,
  initialState: ContactPHStateSchema,
});

/** Simple helper function to check if a state object is a Contact document state object */
export function isContactState(state: unknown): state is ContactPHState {
  return ContactPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a Contact document state object */
export function assertIsContactState(
  state: unknown,
): asserts state is ContactPHState {
  ContactPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a Contact document */
export function isContactDocument(
  document: unknown,
): document is ContactDocument {
  return ContactDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a Contact document */
export function assertIsContactDocument(
  document: unknown,
): asserts document is ContactDocument {
  ContactDocumentSchema.parse(document);
}
