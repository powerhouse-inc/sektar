/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  InitializeInputSchema,
  SetCalendarSourceInputSchema,
} from "../schema/zod.js";
import type { InitializeInput, SetCalendarSourceInput } from "../types.js";
import type { InitializeAction, SetCalendarSourceAction } from "./actions.js";

export const initialize = (input: InitializeInput) =>
  createAction<InitializeAction>(
    "INITIALIZE",
    { ...input },
    undefined,
    InitializeInputSchema,
    "global",
  );

export const setCalendarSource = (input: SetCalendarSourceInput) =>
  createAction<SetCalendarSourceAction>(
    "SET_CALENDAR_SOURCE",
    { ...input },
    undefined,
    SetCalendarSourceInputSchema,
    "global",
  );
