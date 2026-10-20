/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddAttachmentInputSchema,
  MoveAttachmentInputSchema,
  RemoveAttachmentInputSchema,
  UpdateAttachmentInputSchema,
} from "../schema/zod.js";
import type {
  AddAttachmentInput,
  MoveAttachmentInput,
  RemoveAttachmentInput,
  UpdateAttachmentInput,
} from "../types.js";
import type {
  AddAttachmentAction,
  MoveAttachmentAction,
  RemoveAttachmentAction,
  UpdateAttachmentAction,
} from "./actions.js";

export const addAttachment = (input: AddAttachmentInput) =>
  createAction<AddAttachmentAction>(
    "ADD_ATTACHMENT",
    { ...input },
    undefined,
    AddAttachmentInputSchema,
    "global",
  );

export const updateAttachment = (input: UpdateAttachmentInput) =>
  createAction<UpdateAttachmentAction>(
    "UPDATE_ATTACHMENT",
    { ...input },
    undefined,
    UpdateAttachmentInputSchema,
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

export const moveAttachment = (input: MoveAttachmentInput) =>
  createAction<MoveAttachmentAction>(
    "MOVE_ATTACHMENT",
    { ...input },
    undefined,
    MoveAttachmentInputSchema,
    "global",
  );
