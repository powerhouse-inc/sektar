/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { originalSourceCollectionDocumentType } from "./document-type.js";
import { OriginalSourceCollectionStateSchema } from "./schema/zod.js";
import type {
  OriginalSourceCollectionDocument,
  OriginalSourceCollectionPHState,
} from "./types.js";

/** Schema for validating the header object of a OriginalSourceCollection document */
export const OriginalSourceCollectionDocumentHeaderSchema =
  BaseDocumentHeaderSchema.extend({
    documentType: z.literal(originalSourceCollectionDocumentType),
  });

/** Schema for validating the state object of a OriginalSourceCollection document */
export const OriginalSourceCollectionPHStateSchema =
  BaseDocumentStateSchema.extend({
    global: OriginalSourceCollectionStateSchema(),
  });

export const OriginalSourceCollectionDocumentSchema = z.object({
  header: OriginalSourceCollectionDocumentHeaderSchema,
  state: OriginalSourceCollectionPHStateSchema,
  initialState: OriginalSourceCollectionPHStateSchema,
});

/** Simple helper function to check if a state object is a OriginalSourceCollection document state object */
export function isOriginalSourceCollectionState(
  state: unknown,
): state is OriginalSourceCollectionPHState {
  return OriginalSourceCollectionPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a OriginalSourceCollection document state object */
export function assertIsOriginalSourceCollectionState(
  state: unknown,
): asserts state is OriginalSourceCollectionPHState {
  OriginalSourceCollectionPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a OriginalSourceCollection document */
export function isOriginalSourceCollectionDocument(
  document: unknown,
): document is OriginalSourceCollectionDocument {
  return OriginalSourceCollectionDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a OriginalSourceCollection document */
export function assertIsOriginalSourceCollectionDocument(
  document: unknown,
): asserts document is OriginalSourceCollectionDocument {
  OriginalSourceCollectionDocumentSchema.parse(document);
}
