/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  SetLiveEnabledInputSchema,
  SetLiveIntervalInputSchema,
} from "../schema/zod.js";
import type { SetLiveEnabledInput, SetLiveIntervalInput } from "../types.js";
import type { SetLiveEnabledAction, SetLiveIntervalAction } from "./actions.js";

export const setLiveEnabled = (input: SetLiveEnabledInput) =>
  createAction<SetLiveEnabledAction>(
    "SET_LIVE_ENABLED",
    { ...input },
    undefined,
    SetLiveEnabledInputSchema,
    "global",
  );

export const setLiveInterval = (input: SetLiveIntervalInput) =>
  createAction<SetLiveIntervalAction>(
    "SET_LIVE_INTERVAL",
    { ...input },
    undefined,
    SetLiveIntervalInputSchema,
    "global",
  );
