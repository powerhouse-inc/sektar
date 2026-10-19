/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddCollectionValueInputSchema,
  ClearCollectionInputSchema,
} from "../schema/zod.js";
import type {
  AddCollectionValueInput,
  ClearCollectionInput,
} from "../types.js";
import type {
  AddCollectionValueAction,
  ClearCollectionAction,
} from "./actions.js";

export const addCollectionValue = (input: AddCollectionValueInput) =>
  createAction<AddCollectionValueAction>(
    "ADD_COLLECTION_VALUE",
    { ...input },
    undefined,
    AddCollectionValueInputSchema,
    "global",
  );

export const clearCollection = (input: ClearCollectionInput) =>
  createAction<ClearCollectionAction>(
    "CLEAR_COLLECTION",
    { ...input },
    undefined,
    ClearCollectionInputSchema,
    "global",
  );
