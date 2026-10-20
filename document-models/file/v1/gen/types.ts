/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { FileAction } from "./actions.js";
import type { FileState as FileGlobalState } from "./schema/types.js";

type FileLocalState = Record<PropertyKey, never>;

type FilePHState = PHBaseState & {
  global: FileGlobalState;
  local: FileLocalState;
};
type FileDocument = PHDocument<FilePHState>;

export * from "./schema/types.js";

export type {
  FileAction,
  FileDocument,
  FileGlobalState,
  FileLocalState,
  FilePHState,
};
