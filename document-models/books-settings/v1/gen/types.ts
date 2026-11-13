/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { BooksSettingsAction } from "./actions.js";
import type { BooksSettingsState as BooksSettingsGlobalState } from "./schema/types.js";

type BooksSettingsLocalState = Record<PropertyKey, never>;

type BooksSettingsPHState = PHBaseState & {
  global: BooksSettingsGlobalState;
  local: BooksSettingsLocalState;
};
type BooksSettingsDocument = PHDocument<BooksSettingsPHState>;

export * from "./schema/types.js";

export type {
  BooksSettingsAction,
  BooksSettingsDocument,
  BooksSettingsGlobalState,
  BooksSettingsLocalState,
  BooksSettingsPHState,
};
