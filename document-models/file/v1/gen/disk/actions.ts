/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  ApplyDiskVersionInput,
  ClearPlaceholderInput,
  SetPlaceholderInput,
} from "../types.js";

export type SetPlaceholderAction = Action & {
  type: "SET_PLACEHOLDER";
  input: SetPlaceholderInput;
};
export type ClearPlaceholderAction = Action & {
  type: "CLEAR_PLACEHOLDER";
  input: ClearPlaceholderInput;
};
export type ApplyDiskVersionAction = Action & {
  type: "APPLY_DISK_VERSION";
  input: ApplyDiskVersionInput;
};

export type FileDiskAction =
  | SetPlaceholderAction
  | ClearPlaceholderAction
  | ApplyDiskVersionAction;
