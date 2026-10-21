/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  ApplyDiskVersionInputSchema,
  ClearPlaceholderInputSchema,
  SetPlaceholderInputSchema,
} from "../schema/zod.js";
import type {
  ApplyDiskVersionInput,
  ClearPlaceholderInput,
  SetPlaceholderInput,
} from "../types.js";
import type {
  ApplyDiskVersionAction,
  ClearPlaceholderAction,
  SetPlaceholderAction,
} from "./actions.js";

export const setPlaceholder = (input: SetPlaceholderInput) =>
  createAction<SetPlaceholderAction>(
    "SET_PLACEHOLDER",
    { ...input },
    undefined,
    SetPlaceholderInputSchema,
    "global",
  );

export const clearPlaceholder = (input: ClearPlaceholderInput) =>
  createAction<ClearPlaceholderAction>(
    "CLEAR_PLACEHOLDER",
    { ...input },
    undefined,
    ClearPlaceholderInputSchema,
    "global",
  );

export const applyDiskVersion = (input: ApplyDiskVersionInput) =>
  createAction<ApplyDiskVersionAction>(
    "APPLY_DISK_VERSION",
    { ...input },
    undefined,
    ApplyDiskVersionInputSchema,
    "global",
  );
