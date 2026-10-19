/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { bankAccountDocumentType } from "./document-type.js";
import { BankAccountStateSchema } from "./schema/zod.js";
import type { BankAccountDocument, BankAccountPHState } from "./types.js";

/** Schema for validating the header object of a BankAccount document */
export const BankAccountDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(bankAccountDocumentType),
});

/** Schema for validating the state object of a BankAccount document */
export const BankAccountPHStateSchema = BaseDocumentStateSchema.extend({
  global: BankAccountStateSchema(),
});

export const BankAccountDocumentSchema = z.object({
  header: BankAccountDocumentHeaderSchema,
  state: BankAccountPHStateSchema,
  initialState: BankAccountPHStateSchema,
});

/** Simple helper function to check if a state object is a BankAccount document state object */
export function isBankAccountState(
  state: unknown,
): state is BankAccountPHState {
  return BankAccountPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a BankAccount document state object */
export function assertIsBankAccountState(
  state: unknown,
): asserts state is BankAccountPHState {
  BankAccountPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a BankAccount document */
export function isBankAccountDocument(
  document: unknown,
): document is BankAccountDocument {
  return BankAccountDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a BankAccount document */
export function assertIsBankAccountDocument(
  document: unknown,
): asserts document is BankAccountDocument {
  BankAccountDocumentSchema.parse(document);
}
