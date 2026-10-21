/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  SetEnabledInputSchema,
  SetLocalPathInputSchema,
  SetOptionsInputSchema,
  SetTargetInputSchema,
} from "../schema/zod.js";
import type {
  SetEnabledInput,
  SetLocalPathInput,
  SetOptionsInput,
  SetTargetInput,
} from "../types.js";
import type {
  SetEnabledAction,
  SetLocalPathAction,
  SetOptionsAction,
  SetTargetAction,
} from "./actions.js";

export const setTarget = (input: SetTargetInput) =>
  createAction<SetTargetAction>(
    "SET_TARGET",
    { ...input },
    undefined,
    SetTargetInputSchema,
    "global",
  );

export const setLocalPath = (input: SetLocalPathInput) =>
  createAction<SetLocalPathAction>(
    "SET_LOCAL_PATH",
    { ...input },
    undefined,
    SetLocalPathInputSchema,
    "global",
  );

export const setOptions = (input: SetOptionsInput) =>
  createAction<SetOptionsAction>(
    "SET_OPTIONS",
    { ...input },
    undefined,
    SetOptionsInputSchema,
    "global",
  );

export const setEnabled = (input: SetEnabledInput) =>
  createAction<SetEnabledAction>(
    "SET_ENABLED",
    { ...input },
    undefined,
    SetEnabledInputSchema,
    "global",
  );
