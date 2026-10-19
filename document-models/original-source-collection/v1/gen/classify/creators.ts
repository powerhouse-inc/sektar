/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  DiscardSourceInputSchema,
  SetSourceStatusInputSchema,
  SetSourceTitleInputSchema,
  TagSourceInputSchema,
  UntagSourceInputSchema,
} from "../schema/zod.js";
import type {
  DiscardSourceInput,
  SetSourceStatusInput,
  SetSourceTitleInput,
  TagSourceInput,
  UntagSourceInput,
} from "../types.js";
import type {
  DiscardSourceAction,
  SetSourceStatusAction,
  SetSourceTitleAction,
  TagSourceAction,
  UntagSourceAction,
} from "./actions.js";

export const setSourceTitle = (input: SetSourceTitleInput) =>
  createAction<SetSourceTitleAction>(
    "SET_SOURCE_TITLE",
    { ...input },
    undefined,
    SetSourceTitleInputSchema,
    "global",
  );

export const tagSource = (input: TagSourceInput) =>
  createAction<TagSourceAction>(
    "TAG_SOURCE",
    { ...input },
    undefined,
    TagSourceInputSchema,
    "global",
  );

export const untagSource = (input: UntagSourceInput) =>
  createAction<UntagSourceAction>(
    "UNTAG_SOURCE",
    { ...input },
    undefined,
    UntagSourceInputSchema,
    "global",
  );

export const setSourceStatus = (input: SetSourceStatusInput) =>
  createAction<SetSourceStatusAction>(
    "SET_SOURCE_STATUS",
    { ...input },
    undefined,
    SetSourceStatusInputSchema,
    "global",
  );

export const discardSource = (input: DiscardSourceInput) =>
  createAction<DiscardSourceAction>(
    "DISCARD_SOURCE",
    { ...input },
    undefined,
    DiscardSourceInputSchema,
    "global",
  );
