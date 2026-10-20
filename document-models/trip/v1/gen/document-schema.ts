/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { tripDocumentType } from "./document-type.js";
import { TripStateSchema } from "./schema/zod.js";
import type { TripDocument, TripPHState } from "./types.js";

/** Schema for validating the header object of a Trip document */
export const TripDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(tripDocumentType),
});

/** Schema for validating the state object of a Trip document */
export const TripPHStateSchema = BaseDocumentStateSchema.extend({
  global: TripStateSchema(),
});

export const TripDocumentSchema = z.object({
  header: TripDocumentHeaderSchema,
  state: TripPHStateSchema,
  initialState: TripPHStateSchema,
});

/** Simple helper function to check if a state object is a Trip document state object */
export function isTripState(state: unknown): state is TripPHState {
  return TripPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a Trip document state object */
export function assertIsTripState(
  state: unknown,
): asserts state is TripPHState {
  TripPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a Trip document */
export function isTripDocument(document: unknown): document is TripDocument {
  return TripDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a Trip document */
export function assertIsTripDocument(
  document: unknown,
): asserts document is TripDocument {
  TripDocumentSchema.parse(document);
}
