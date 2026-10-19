/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  CaptureMessageInputSchema,
  SetAccountInputSchema,
  SetNotesInputSchema,
} from "../schema/zod.js";
import type {
  CaptureMessageInput,
  SetAccountInput,
  SetNotesInput,
} from "../types.js";
import type {
  CaptureMessageAction,
  SetAccountAction,
  SetNotesAction,
} from "./actions.js";

export const setAccount = (input: SetAccountInput) =>
  createAction<SetAccountAction>(
    "SET_ACCOUNT",
    { ...input },
    undefined,
    SetAccountInputSchema,
    "global",
  );

export const captureMessage = (input: CaptureMessageInput) =>
  createAction<CaptureMessageAction>(
    "CAPTURE_MESSAGE",
    { ...input },
    undefined,
    CaptureMessageInputSchema,
    "global",
  );

export const setNotes = (input: SetNotesInput) =>
  createAction<SetNotesAction>(
    "SET_NOTES",
    { ...input },
    undefined,
    SetNotesInputSchema,
    "global",
  );
