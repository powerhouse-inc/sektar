/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { BooksSettingsGlobalState } from "../types.js";
import type { SetBaseCurrencyAction } from "./actions.js";

export interface BooksSettingsCurrencyOperations {
  setBaseCurrencyOperation: (
    state: BooksSettingsGlobalState,
    action: SetBaseCurrencyAction,
    dispatch?: SignalDispatch,
  ) => void;
}
