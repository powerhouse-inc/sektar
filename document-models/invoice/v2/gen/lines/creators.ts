/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddLineInputSchema,
  MoveLineInputSchema,
  RemoveLineInputSchema,
  UpdateLineInputSchema,
} from "../schema/zod.js";
import type {
  AddLineInput,
  MoveLineInput,
  RemoveLineInput,
  UpdateLineInput,
} from "../types.js";
import type {
  AddLineAction,
  MoveLineAction,
  RemoveLineAction,
  UpdateLineAction,
} from "./actions.js";

export const addLine = (input: AddLineInput) =>
  createAction<AddLineAction>(
    "ADD_LINE",
    { ...input },
    undefined,
    AddLineInputSchema,
    "global",
  );

export const updateLine = (input: UpdateLineInput) =>
  createAction<UpdateLineAction>(
    "UPDATE_LINE",
    { ...input },
    undefined,
    UpdateLineInputSchema,
    "global",
  );

export const removeLine = (input: RemoveLineInput) =>
  createAction<RemoveLineAction>(
    "REMOVE_LINE",
    { ...input },
    undefined,
    RemoveLineInputSchema,
    "global",
  );

export const moveLine = (input: MoveLineInput) =>
  createAction<MoveLineAction>(
    "MOVE_LINE",
    { ...input },
    undefined,
    MoveLineInputSchema,
    "global",
  );
