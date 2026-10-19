/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddAliasInputSchema,
  MergeSourcesInputSchema,
  RemoveAliasInputSchema,
  SplitSourceInputSchema,
} from "../schema/zod.js";
import type {
  AddAliasInput,
  MergeSourcesInput,
  RemoveAliasInput,
  SplitSourceInput,
} from "../types.js";
import type {
  AddAliasAction,
  MergeSourcesAction,
  RemoveAliasAction,
  SplitSourceAction,
} from "./actions.js";

export const addAlias = (input: AddAliasInput) =>
  createAction<AddAliasAction>(
    "ADD_ALIAS",
    { ...input },
    undefined,
    AddAliasInputSchema,
    "global",
  );

export const removeAlias = (input: RemoveAliasInput) =>
  createAction<RemoveAliasAction>(
    "REMOVE_ALIAS",
    { ...input },
    undefined,
    RemoveAliasInputSchema,
    "global",
  );

export const mergeSources = (input: MergeSourcesInput) =>
  createAction<MergeSourcesAction>(
    "MERGE_SOURCES",
    { ...input },
    undefined,
    MergeSourcesInputSchema,
    "global",
  );

export const splitSource = (input: SplitSourceInput) =>
  createAction<SplitSourceAction>(
    "SPLIT_SOURCE",
    { ...input },
    undefined,
    SplitSourceInputSchema,
    "global",
  );
