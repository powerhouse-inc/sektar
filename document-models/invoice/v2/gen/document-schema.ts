/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
  normalizeDocumentModelVersion,
} from "document-model";
import { z } from "zod";
import { InvoicePHStateSchema as InvoicePHStateSchemaV1 } from "../../v1/gen/document-schema.js";
import { invoiceDocumentType } from "./document-type.js";
import { InvoiceStateSchema } from "./schema/zod.js";
import type { InvoiceDocument, InvoicePHState } from "./types.js";

/** Schema for validating the header object of a Invoice document */
export const InvoiceDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(invoiceDocumentType),
});

/** Schema for validating the state object of a Invoice document */
export const InvoicePHStateSchema = BaseDocumentStateSchema.extend({
  global: InvoiceStateSchema(),
});

export const InvoiceDocumentSchema = z.object({
  header: InvoiceDocumentHeaderSchema,
  state: InvoicePHStateSchema,
  initialState: InvoicePHStateSchema,
});

const InvoicePHStateSchemasByVersion: Record<number, z.ZodType> = {
  1: InvoicePHStateSchemaV1,
  2: InvoicePHStateSchema,
};

const InvoiceDocumentSchemasByVersion: Record<number, z.ZodType> = {
  1: z.object({
    header: InvoiceDocumentHeaderSchema,
    state: InvoicePHStateSchemaV1,
    initialState: InvoicePHStateSchemaV1,
  }),
  2: InvoiceDocumentSchema,
};

/** The document model version stamped in a state's document scope. States stamped with 0 or nothing predate versioning and are treated as version 1. */
function stampedDocumentModelVersion(state: unknown): number {
  if (typeof state !== "object" || state === null) return 1;
  const documentScope = (state as { document?: unknown }).document;
  if (typeof documentScope !== "object" || documentScope === null) return 1;
  const version = (documentScope as { version?: unknown }).version;
  return normalizeDocumentModelVersion(
    typeof version === "number" ? version : undefined,
  );
}

function resolveInvoicePHStateSchema(state: unknown): z.ZodType {
  const schema =
    InvoicePHStateSchemasByVersion[stampedDocumentModelVersion(state)];
  return schema ?? InvoicePHStateSchema;
}

function resolveInvoiceDocumentSchema(document: unknown): z.ZodType {
  const state =
    typeof document === "object" && document !== null
      ? (document as { state?: unknown }).state
      : undefined;
  const schema =
    InvoiceDocumentSchemasByVersion[stampedDocumentModelVersion(state)];
  return schema ?? InvoiceDocumentSchema;
}

/** Simple helper function to check if a state object is a Invoice document state object. Validates against the schema of the version the state is stamped with. */
export function isInvoiceState(state: unknown): state is InvoicePHState {
  return resolveInvoicePHStateSchema(state).safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a Invoice document state object. Validates against the schema of the version the state is stamped with. */
export function assertIsInvoiceState(
  state: unknown,
): asserts state is InvoicePHState {
  resolveInvoicePHStateSchema(state).parse(state);
}

/** Simple helper function to check if a document is a Invoice document. Validates against the schema of the version the document is stamped with, so documents on older versions remain valid until they are upgraded. */
export function isInvoiceDocument(
  document: unknown,
): document is InvoiceDocument {
  return resolveInvoiceDocumentSchema(document).safeParse(document).success;
}

/** Simple helper function to assert that a document is a Invoice document. Validates against the schema of the version the document is stamped with, so documents on older versions remain valid until they are upgraded. */
export function assertIsInvoiceDocument(
  document: unknown,
): asserts document is InvoiceDocument {
  resolveInvoiceDocumentSchema(document).parse(document);
}
