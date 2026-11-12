/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { CurrencyPairGlobalState } from "../types.js";
import type { SetPairAction } from "./actions.js";

export interface CurrencyPairPairOperations {
  setPairOperation: (
    state: CurrencyPairGlobalState,
    action: SetPairAction,
    dispatch?: SignalDispatch,
  ) => void;
}
