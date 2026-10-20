/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { fileDocumentType } from "./document-type.js";
import { FileStateSchema } from "./schema/zod.js";
import type { FileDocument, FilePHState } from "./types.js";

/** Schema for validating the header object of a File document */
export const FileDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(fileDocumentType),
});

/** Schema for validating the state object of a File document */
export const FilePHStateSchema = BaseDocumentStateSchema.extend({
  global: FileStateSchema(),
});

export const FileDocumentSchema = z.object({
  header: FileDocumentHeaderSchema,
  state: FilePHStateSchema,
  initialState: FilePHStateSchema,
});

/** Simple helper function to check if a state object is a File document state object */
export function isFileState(state: unknown): state is FilePHState {
  return FilePHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a File document state object */
export function assertIsFileState(
  state: unknown,
): asserts state is FilePHState {
  FilePHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a File document */
export function isFileDocument(document: unknown): document is FileDocument {
  return FileDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a File document */
export function assertIsFileDocument(
  document: unknown,
): asserts document is FileDocument {
  FileDocumentSchema.parse(document);
}
