/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddRenditionInputSchema,
  RemoveRenditionInputSchema,
  UpdateRenditionInputSchema,
} from "../schema/zod.js";
import type {
  AddRenditionInput,
  RemoveRenditionInput,
  UpdateRenditionInput,
} from "../types.js";
import type {
  AddRenditionAction,
  RemoveRenditionAction,
  UpdateRenditionAction,
} from "./actions.js";

export const addRendition = (input: AddRenditionInput) =>
  createAction<AddRenditionAction>(
    "ADD_RENDITION",
    { ...input },
    undefined,
    AddRenditionInputSchema,
    "global",
  );

export const updateRendition = (input: UpdateRenditionInput) =>
  createAction<UpdateRenditionAction>(
    "UPDATE_RENDITION",
    { ...input },
    undefined,
    UpdateRenditionInputSchema,
    "global",
  );

export const removeRendition = (input: RemoveRenditionInput) =>
  createAction<RemoveRenditionAction>(
    "REMOVE_RENDITION",
    { ...input },
    undefined,
    RemoveRenditionInputSchema,
    "global",
  );
