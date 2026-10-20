/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddTransportInputSchema,
  RemoveTransportInputSchema,
  UpdateTransportInputSchema,
} from "../schema/zod.js";
import type {
  AddTransportInput,
  RemoveTransportInput,
  UpdateTransportInput,
} from "../types.js";
import type {
  AddTransportAction,
  RemoveTransportAction,
  UpdateTransportAction,
} from "./actions.js";

export const addTransport = (input: AddTransportInput) =>
  createAction<AddTransportAction>(
    "ADD_TRANSPORT",
    { ...input },
    undefined,
    AddTransportInputSchema,
    "global",
  );

export const updateTransport = (input: UpdateTransportInput) =>
  createAction<UpdateTransportAction>(
    "UPDATE_TRANSPORT",
    { ...input },
    undefined,
    UpdateTransportInputSchema,
    "global",
  );

export const removeTransport = (input: RemoveTransportInput) =>
  createAction<RemoveTransportAction>(
    "REMOVE_TRANSPORT",
    { ...input },
    undefined,
    RemoveTransportInputSchema,
    "global",
  );
