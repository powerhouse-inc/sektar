/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddLabelsInputSchema,
  ArchiveInputSchema,
  MarkReadInputSchema,
  MarkUnreadInputSchema,
  RemoveLabelsInputSchema,
  SetFlaggedInputSchema,
  UnarchiveInputSchema,
} from "../schema/zod.js";
import type {
  AddLabelsInput,
  ArchiveInput,
  MarkReadInput,
  MarkUnreadInput,
  RemoveLabelsInput,
  SetFlaggedInput,
  UnarchiveInput,
} from "../types.js";
import type {
  AddLabelsAction,
  ArchiveAction,
  MarkReadAction,
  MarkUnreadAction,
  RemoveLabelsAction,
  SetFlaggedAction,
  UnarchiveAction,
} from "./actions.js";

export const markRead = (input: MarkReadInput) =>
  createAction<MarkReadAction>(
    "MARK_READ",
    { ...input },
    undefined,
    MarkReadInputSchema,
    "global",
  );

export const markUnread = (input: MarkUnreadInput) =>
  createAction<MarkUnreadAction>(
    "MARK_UNREAD",
    { ...input },
    undefined,
    MarkUnreadInputSchema,
    "global",
  );

export const setFlagged = (input: SetFlaggedInput) =>
  createAction<SetFlaggedAction>(
    "SET_FLAGGED",
    { ...input },
    undefined,
    SetFlaggedInputSchema,
    "global",
  );

export const archive = (input: ArchiveInput) =>
  createAction<ArchiveAction>(
    "ARCHIVE",
    { ...input },
    undefined,
    ArchiveInputSchema,
    "global",
  );

export const unarchive = (input: UnarchiveInput) =>
  createAction<UnarchiveAction>(
    "UNARCHIVE",
    { ...input },
    undefined,
    UnarchiveInputSchema,
    "global",
  );

export const addLabels = (input: AddLabelsInput) =>
  createAction<AddLabelsAction>(
    "ADD_LABELS",
    { ...input },
    undefined,
    AddLabelsInputSchema,
    "global",
  );

export const removeLabels = (input: RemoveLabelsInput) =>
  createAction<RemoveLabelsAction>(
    "REMOVE_LABELS",
    { ...input },
    undefined,
    RemoveLabelsInputSchema,
    "global",
  );
