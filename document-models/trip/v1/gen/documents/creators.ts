/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddAttachmentInputSchema,
  AddSourceInputSchema,
  RemoveAttachmentInputSchema,
  RemoveSourceInputSchema,
} from "../schema/zod.js";
import type {
  AddAttachmentInput,
  AddSourceInput,
  RemoveAttachmentInput,
  RemoveSourceInput,
} from "../types.js";
import type {
  AddAttachmentAction,
  AddSourceAction,
  RemoveAttachmentAction,
  RemoveSourceAction,
} from "./actions.js";

export const addAttachment = (input: AddAttachmentInput) =>
  createAction<AddAttachmentAction>(
    "ADD_ATTACHMENT",
    { ...input },
    undefined,
    AddAttachmentInputSchema,
    "global",
  );

export const removeAttachment = (input: RemoveAttachmentInput) =>
  createAction<RemoveAttachmentAction>(
    "REMOVE_ATTACHMENT",
    { ...input },
    undefined,
    RemoveAttachmentInputSchema,
    "global",
  );

export const addSource = (input: AddSourceInput) =>
  createAction<AddSourceAction>(
    "ADD_SOURCE",
    { ...input },
    undefined,
    AddSourceInputSchema,
    "global",
  );

export const removeSource = (input: RemoveSourceInput) =>
  createAction<RemoveSourceAction>(
    "REMOVE_SOURCE",
    { ...input },
    undefined,
    RemoveSourceInputSchema,
    "global",
  );
