/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  InitializeInputSchema,
  SetAccessInputSchema,
  SetCalendarSourceInputSchema,
  SetEmailSourceInputSchema,
  SetTransactionsSourceInputSchema,
} from "../schema/zod.js";
import type {
  InitializeInput,
  SetAccessInput,
  SetCalendarSourceInput,
  SetEmailSourceInput,
  SetTransactionsSourceInput,
} from "../types.js";
import type {
  InitializeAction,
  SetAccessAction,
  SetCalendarSourceAction,
  SetEmailSourceAction,
  SetTransactionsSourceAction,
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

export const setEmailSource = (input: SetEmailSourceInput) =>
  createAction<SetEmailSourceAction>(
    "SET_EMAIL_SOURCE",
    { ...input },
    undefined,
    SetEmailSourceInputSchema,
    "global",
  );

export const setTransactionsSource = (input: SetTransactionsSourceInput) =>
  createAction<SetTransactionsSourceAction>(
    "SET_TRANSACTIONS_SOURCE",
    { ...input },
    undefined,
    SetTransactionsSourceInputSchema,
    "global",
  );
