/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  CreateCollectionCursorInputSchema,
  CreateCollectionInputSchema,
  CreateDateTimeCursorInputSchema,
  CreateNumberCursorInputSchema,
  ReorderCursorsInputSchema,
  SetCursorNameInputSchema,
} from "../schema/zod.js";
import type {
  CreateCollectionCursorInput,
  CreateCollectionInput,
  CreateDateTimeCursorInput,
  CreateNumberCursorInput,
  ReorderCursorsInput,
  SetCursorNameInput,
} from "../types.js";
import type {
  CreateCollectionAction,
  CreateCollectionCursorAction,
  CreateDateTimeCursorAction,
  CreateNumberCursorAction,
  ReorderCursorsAction,
  SetCursorNameAction,
} from "./actions.js";

export const createDateTimeCursor = (input: CreateDateTimeCursorInput) =>
  createAction<CreateDateTimeCursorAction>(
    "CREATE_DATE_TIME_CURSOR",
    { ...input },
    undefined,
    CreateDateTimeCursorInputSchema,
    "global",
  );

export const createNumberCursor = (input: CreateNumberCursorInput) =>
  createAction<CreateNumberCursorAction>(
    "CREATE_NUMBER_CURSOR",
    { ...input },
    undefined,
    CreateNumberCursorInputSchema,
    "global",
  );

export const createCollectionCursor = (input: CreateCollectionCursorInput) =>
  createAction<CreateCollectionCursorAction>(
    "CREATE_COLLECTION_CURSOR",
    { ...input },
    undefined,
    CreateCollectionCursorInputSchema,
    "global",
  );

export const reorderCursors = (input: ReorderCursorsInput) =>
  createAction<ReorderCursorsAction>(
    "REORDER_CURSORS",
    { ...input },
    undefined,
    ReorderCursorsInputSchema,
    "global",
  );

export const setCursorName = (input: SetCursorNameInput) =>
  createAction<SetCursorNameAction>(
    "SET_CURSOR_NAME",
    { ...input },
    undefined,
    SetCursorNameInputSchema,
    "global",
  );

export const createCollection = (input: CreateCollectionInput) =>
  createAction<CreateCollectionAction>(
    "CREATE_COLLECTION",
    { ...input },
    undefined,
    CreateCollectionInputSchema,
    "global",
  );
