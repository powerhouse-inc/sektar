/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { ReportErrorInputSchema } from "../schema/zod.js";
import type { ReportErrorInput } from "../types.js";
import type { ReportErrorAction } from "./actions.js";

export const reportError = (input: ReportErrorInput) =>
  createAction<ReportErrorAction>(
    "REPORT_ERROR",
    { ...input },
    undefined,
    ReportErrorInputSchema,
    "global",
  );
