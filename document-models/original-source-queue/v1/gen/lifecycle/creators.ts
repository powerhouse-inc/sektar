/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  PauseInputSchema,
  ResetInputSchema,
  StartInputSchema,
  TerminateInputSchema,
  UnpauseInputSchema,
} from "../schema/zod.js";
import type {
  PauseInput,
  ResetInput,
  StartInput,
  TerminateInput,
  UnpauseInput,
} from "../types.js";
import type {
  PauseAction,
  ResetAction,
  StartAction,
  TerminateAction,
  UnpauseAction,
} from "./actions.js";

export const start = (input: StartInput) =>
  createAction<StartAction>(
    "START",
    { ...input },
    undefined,
    StartInputSchema,
    "global",
  );

export const pause = (input: PauseInput) =>
  createAction<PauseAction>(
    "PAUSE",
    { ...input },
    undefined,
    PauseInputSchema,
    "global",
  );

export const unpause = (input: UnpauseInput) =>
  createAction<UnpauseAction>(
    "UNPAUSE",
    { ...input },
    undefined,
    UnpauseInputSchema,
    "global",
  );

export const reset = (input: ResetInput) =>
  createAction<ResetAction>(
    "RESET",
    { ...input },
    undefined,
    ResetInputSchema,
    "global",
  );

export const terminate = (input: TerminateInput) =>
  createAction<TerminateAction>(
    "TERMINATE",
    { ...input },
    undefined,
    TerminateInputSchema,
    "global",
  );
