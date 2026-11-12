/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { currencyPairDocumentType } from "./document-type.js";
import { CurrencyPairStateSchema } from "./schema/zod.js";
import type { CurrencyPairDocument, CurrencyPairPHState } from "./types.js";

/** Schema for validating the header object of a CurrencyPair document */
export const CurrencyPairDocumentHeaderSchema = BaseDocumentHeaderSchema.extend(
  {
    documentType: z.literal(currencyPairDocumentType),
  },
);

/** Schema for validating the state object of a CurrencyPair document */
export const CurrencyPairPHStateSchema = BaseDocumentStateSchema.extend({
  global: CurrencyPairStateSchema(),
});

export const CurrencyPairDocumentSchema = z.object({
  header: CurrencyPairDocumentHeaderSchema,
  state: CurrencyPairPHStateSchema,
  initialState: CurrencyPairPHStateSchema,
});

/** Simple helper function to check if a state object is a CurrencyPair document state object */
export function isCurrencyPairState(
  state: unknown,
): state is CurrencyPairPHState {
  return CurrencyPairPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a CurrencyPair document state object */
export function assertIsCurrencyPairState(
  state: unknown,
): asserts state is CurrencyPairPHState {
  CurrencyPairPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a CurrencyPair document */
export function isCurrencyPairDocument(
  document: unknown,
): document is CurrencyPairDocument {
  return CurrencyPairDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a CurrencyPair document */
export function assertIsCurrencyPairDocument(
  document: unknown,
): asserts document is CurrencyPairDocument {
  CurrencyPairDocumentSchema.parse(document);
}
