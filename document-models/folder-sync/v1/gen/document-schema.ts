/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { folderSyncDocumentType } from "./document-type.js";
import { FolderSyncStateSchema } from "./schema/zod.js";
import type { FolderSyncDocument, FolderSyncPHState } from "./types.js";

/** Schema for validating the header object of a FolderSync document */
export const FolderSyncDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(folderSyncDocumentType),
});

/** Schema for validating the state object of a FolderSync document */
export const FolderSyncPHStateSchema = BaseDocumentStateSchema.extend({
  global: FolderSyncStateSchema(),
});

export const FolderSyncDocumentSchema = z.object({
  header: FolderSyncDocumentHeaderSchema,
  state: FolderSyncPHStateSchema,
  initialState: FolderSyncPHStateSchema,
});

/** Simple helper function to check if a state object is a FolderSync document state object */
export function isFolderSyncState(state: unknown): state is FolderSyncPHState {
  return FolderSyncPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a FolderSync document state object */
export function assertIsFolderSyncState(
  state: unknown,
): asserts state is FolderSyncPHState {
  FolderSyncPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a FolderSync document */
export function isFolderSyncDocument(
  document: unknown,
): document is FolderSyncDocument {
  return FolderSyncDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a FolderSync document */
export function assertIsFolderSyncDocument(
  document: unknown,
): asserts document is FolderSyncDocument {
  FolderSyncDocumentSchema.parse(document);
}
