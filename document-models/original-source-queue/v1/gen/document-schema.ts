/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { originalSourceQueueDocumentType } from "./document-type.js";
import { OriginalSourceQueueStateSchema } from "./schema/zod.js";
import type {
  OriginalSourceQueueDocument,
  OriginalSourceQueuePHState,
} from "./types.js";

/** Schema for validating the header object of a OriginalSourceQueue document */
export const OriginalSourceQueueDocumentHeaderSchema =
  BaseDocumentHeaderSchema.extend({
    documentType: z.literal(originalSourceQueueDocumentType),
  });

/** Schema for validating the state object of a OriginalSourceQueue document */
export const OriginalSourceQueuePHStateSchema = BaseDocumentStateSchema.extend({
  global: OriginalSourceQueueStateSchema(),
});

export const OriginalSourceQueueDocumentSchema = z.object({
  header: OriginalSourceQueueDocumentHeaderSchema,
  state: OriginalSourceQueuePHStateSchema,
  initialState: OriginalSourceQueuePHStateSchema,
});

/** Simple helper function to check if a state object is a OriginalSourceQueue document state object */
export function isOriginalSourceQueueState(
  state: unknown,
): state is OriginalSourceQueuePHState {
  return OriginalSourceQueuePHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a OriginalSourceQueue document state object */
export function assertIsOriginalSourceQueueState(
  state: unknown,
): asserts state is OriginalSourceQueuePHState {
  OriginalSourceQueuePHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a OriginalSourceQueue document */
export function isOriginalSourceQueueDocument(
  document: unknown,
): document is OriginalSourceQueueDocument {
  return OriginalSourceQueueDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a OriginalSourceQueue document */
export function assertIsOriginalSourceQueueDocument(
  document: unknown,
): asserts document is OriginalSourceQueueDocument {
  OriginalSourceQueueDocumentSchema.parse(document);
}
