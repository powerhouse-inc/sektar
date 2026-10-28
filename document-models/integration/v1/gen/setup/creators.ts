/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  InitializeInputSchema,
  SetAccessInputSchema,
  SetCalendarSourceInputSchema,
} from "../schema/zod.js";
import type {
  InitializeInput,
  SetAccessInput,
  SetCalendarSourceInput,
} from "../types.js";
import type {
  InitializeAction,
  SetAccessAction,
  SetCalendarSourceAction,
} from "./actions.js";

export const initialize = (input: InitializeInput) =>
  createAction<InitializeAction>(
    "INITIALIZE",
    { ...input },
    undefined,
    InitializeInputSchema,
    "global",
  );

export const setAccess = (input: SetAccessInput) =>
  createAction<SetAccessAction>(
    "SET_ACCESS",
    { ...input },
    undefined,
    SetAccessInputSchema,
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
