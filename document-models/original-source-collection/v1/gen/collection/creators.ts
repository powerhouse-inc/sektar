/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  DiscardCollectionInputSchema,
  RestoreCollectionInputSchema,
  SetDescriptionInputSchema,
  SetProvenanceInputSchema,
  SetTitleInputSchema,
} from "../schema/zod.js";
import type {
  DiscardCollectionInput,
  RestoreCollectionInput,
  SetDescriptionInput,
  SetProvenanceInput,
  SetTitleInput,
} from "../types.js";
import type {
  DiscardCollectionAction,
  RestoreCollectionAction,
  SetDescriptionAction,
  SetProvenanceAction,
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

export const setProvenance = (input: SetProvenanceInput) =>
  createAction<SetProvenanceAction>(
    "SET_PROVENANCE",
    { ...input },
    undefined,
    SetProvenanceInputSchema,
    "global",
  );

export const discardCollection = (input: DiscardCollectionInput) =>
  createAction<DiscardCollectionAction>(
    "DISCARD_COLLECTION",
    { ...input },
    undefined,
    DiscardCollectionInputSchema,
    "global",
  );

export const restoreCollection = (input: RestoreCollectionInput) =>
  createAction<RestoreCollectionAction>(
    "RESTORE_COLLECTION",
    { ...input },
    undefined,
    RestoreCollectionInputSchema,
    "global",
  );
