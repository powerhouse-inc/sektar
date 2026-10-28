/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddDateRangeBackfillInput,
  SetBackfillEnabledInput,
} from "../types.js";

export type SetBackfillEnabledAction = Action & {
  type: "SET_BACKFILL_ENABLED";
  input: SetBackfillEnabledInput;
};
export type AddDateRangeBackfillAction = Action & {
  type: "ADD_DATE_RANGE_BACKFILL";
  input: AddDateRangeBackfillInput;
};

export type IntegrationBackfillAction =
  | SetBackfillEnabledAction
  | AddDateRangeBackfillAction;
