/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { RequestPullInput, RequestSyncInput } from "../types.js";

export type RequestSyncAction = Action & {
  type: "REQUEST_SYNC";
  input: RequestSyncInput;
};
export type RequestPullAction = Action & {
  type: "REQUEST_PULL";
  input: RequestPullInput;
};

export type FolderSyncSyncAction = RequestSyncAction | RequestPullAction;
