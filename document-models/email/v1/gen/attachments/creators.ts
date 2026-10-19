/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddAttachmentInputSchema,
  RemoveAttachmentInputSchema,
} from "../schema/zod.js";
import type { AddAttachmentInput, RemoveAttachmentInput } from "../types.js";
import type { AddAttachmentAction, RemoveAttachmentAction } from "./actions.js";

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
