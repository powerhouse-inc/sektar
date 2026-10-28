/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { integrationDocumentType } from "./document-type.js";
import { IntegrationStateSchema } from "./schema/zod.js";
import type { IntegrationDocument, IntegrationPHState } from "./types.js";

/** Schema for validating the header object of a Integration document */
export const IntegrationDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(integrationDocumentType),
});

/** Schema for validating the state object of a Integration document */
export const IntegrationPHStateSchema = BaseDocumentStateSchema.extend({
  global: IntegrationStateSchema(),
});

export const IntegrationDocumentSchema = z.object({
  header: IntegrationDocumentHeaderSchema,
  state: IntegrationPHStateSchema,
  initialState: IntegrationPHStateSchema,
});

/** Simple helper function to check if a state object is a Integration document state object */
export function isIntegrationState(
  state: unknown,
): state is IntegrationPHState {
  return IntegrationPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a Integration document state object */
export function assertIsIntegrationState(
  state: unknown,
): asserts state is IntegrationPHState {
  IntegrationPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a Integration document */
export function isIntegrationDocument(
  document: unknown,
): document is IntegrationDocument {
  return IntegrationDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a Integration document */
export function assertIsIntegrationDocument(
  document: unknown,
): asserts document is IntegrationDocument {
  IntegrationDocumentSchema.parse(document);
}
