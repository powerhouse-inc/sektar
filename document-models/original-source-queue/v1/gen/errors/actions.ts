/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { ReportErrorInput } from "../types.js";

export type ReportErrorAction = Action & {
  type: "REPORT_ERROR";
  input: ReportErrorInput;
};

export type OriginalSourceQueueErrorsAction = ReportErrorAction;
