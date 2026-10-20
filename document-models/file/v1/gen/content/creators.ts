/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  ClearSourceInputSchema,
  SetAttachmentSourceInputSchema,
  SetDescriptionInputSchema,
  SetDocumentSourceInputSchema,
  SetTitleInputSchema,
} from "../schema/zod.js";
import type {
  ClearSourceInput,
  SetAttachmentSourceInput,
  SetDescriptionInput,
  SetDocumentSourceInput,
  SetTitleInput,
} from "../types.js";
import type {
  ClearSourceAction,
  SetAttachmentSourceAction,
  SetDescriptionAction,
  SetDocumentSourceAction,
  SetTitleAction,
} from "./actions.js";

export const setTitle = (input: SetTitleInput) =>
  createAction<SetTitleAction>(
    "SET_TITLE",
    { ...input },
    undefined,
    SetTitleInputSchema,
    "global",
  );

export const setDescription = (input: SetDescriptionInput) =>
  createAction<SetDescriptionAction>(
    "SET_DESCRIPTION",
    { ...input },
    undefined,
    SetDescriptionInputSchema,
    "global",
  );

export const setAttachmentSource = (input: SetAttachmentSourceInput) =>
  createAction<SetAttachmentSourceAction>(
    "SET_ATTACHMENT_SOURCE",
    { ...input },
    undefined,
    SetAttachmentSourceInputSchema,
    "global",
  );

export const setDocumentSource = (input: SetDocumentSourceInput) =>
  createAction<SetDocumentSourceAction>(
    "SET_DOCUMENT_SOURCE",
    { ...input },
    undefined,
    SetDocumentSourceInputSchema,
    "global",
  );

export const clearSource = (input: ClearSourceInput) =>
  createAction<ClearSourceAction>(
    "CLEAR_SOURCE",
    { ...input },
    undefined,
    ClearSourceInputSchema,
    "global",
  );
