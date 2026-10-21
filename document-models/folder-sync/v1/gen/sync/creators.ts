/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RequestPullInputSchema,
  RequestSyncInputSchema,
} from "../schema/zod.js";
import type { RequestPullInput, RequestSyncInput } from "../types.js";
import type { RequestPullAction, RequestSyncAction } from "./actions.js";

export const requestSync = (input: RequestSyncInput) =>
  createAction<RequestSyncAction>(
    "REQUEST_SYNC",
    { ...input },
    undefined,
    RequestSyncInputSchema,
    "global",
  );

export const requestPull = (input: RequestPullInput) =>
  createAction<RequestPullAction>(
    "REQUEST_PULL",
    { ...input },
    undefined,
    RequestPullInputSchema,
    "global",
  );
