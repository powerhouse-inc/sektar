/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { RequestSyncInputSchema } from "../schema/zod.js";
import type { RequestSyncInput } from "../types.js";
import type { RequestSyncAction } from "./actions.js";

export const requestSync = (input: RequestSyncInput) =>
  createAction<RequestSyncAction>(
    "REQUEST_SYNC",
    { ...input },
    undefined,
    RequestSyncInputSchema,
    "global",
  );
