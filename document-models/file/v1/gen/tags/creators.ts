/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddTagInputSchema,
  RemoveTagInputSchema,
  UpdateTagInputSchema,
} from "../schema/zod.js";
import type { AddTagInput, RemoveTagInput, UpdateTagInput } from "../types.js";
import type {
  AddTagAction,
  RemoveTagAction,
  UpdateTagAction,
} from "./actions.js";

export const addTag = (input: AddTagInput) =>
  createAction<AddTagAction>(
    "ADD_TAG",
    { ...input },
    undefined,
    AddTagInputSchema,
    "global",
  );

export const updateTag = (input: UpdateTagInput) =>
  createAction<UpdateTagAction>(
    "UPDATE_TAG",
    { ...input },
    undefined,
    UpdateTagInputSchema,
    "global",
  );

export const removeTag = (input: RemoveTagInput) =>
  createAction<RemoveTagAction>(
    "REMOVE_TAG",
    { ...input },
    undefined,
    RemoveTagInputSchema,
    "global",
  );
