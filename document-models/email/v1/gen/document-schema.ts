/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { emailDocumentType } from "./document-type.js";
import { EmailStateSchema } from "./schema/zod.js";
import type { EmailDocument, EmailPHState } from "./types.js";

/** Schema for validating the header object of a Email document */
export const EmailDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(emailDocumentType),
});

/** Schema for validating the state object of a Email document */
export const EmailPHStateSchema = BaseDocumentStateSchema.extend({
  global: EmailStateSchema(),
});

export const EmailDocumentSchema = z.object({
  header: EmailDocumentHeaderSchema,
  state: EmailPHStateSchema,
  initialState: EmailPHStateSchema,
});

/** Simple helper function to check if a state object is a Email document state object */
export function isEmailState(state: unknown): state is EmailPHState {
  return EmailPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a Email document state object */
export function assertIsEmailState(
  state: unknown,
): asserts state is EmailPHState {
  EmailPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a Email document */
export function isEmailDocument(document: unknown): document is EmailDocument {
  return EmailDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a Email document */
export function assertIsEmailDocument(
  document: unknown,
): asserts document is EmailDocument {
  EmailDocumentSchema.parse(document);
}
