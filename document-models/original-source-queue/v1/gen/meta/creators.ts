/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  SetCursorDescriptionInputSchema,
  SetDescriptionInputSchema,
} from "../schema/zod.js";
import type {
  SetCursorDescriptionInput,
  SetDescriptionInput,
} from "../types.js";
import type {
  SetCursorDescriptionAction,
  SetDescriptionAction,
} from "./actions.js";

export const setDescription = (input: SetDescriptionInput) =>
  createAction<SetDescriptionAction>(
    "SET_DESCRIPTION",
    { ...input },
    undefined,
    SetDescriptionInputSchema,
    "global",
  );

export const setCursorDescription = (input: SetCursorDescriptionInput) =>
  createAction<SetCursorDescriptionAction>(
    "SET_CURSOR_DESCRIPTION",
    { ...input },
    undefined,
    SetCursorDescriptionInputSchema,
    "global",
  );
