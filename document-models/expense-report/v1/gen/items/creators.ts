/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddItemInputSchema,
  RemoveItemInputSchema,
  SetReportDetailsInputSchema,
  UpdateItemInputSchema,
} from "../schema/zod.js";
import type {
  AddItemInput,
  RemoveItemInput,
  SetReportDetailsInput,
  UpdateItemInput,
} from "../types.js";
import type {
  AddItemAction,
  RemoveItemAction,
  SetReportDetailsAction,
  UpdateItemAction,
} from "./actions.js";

export const setReportDetails = (input: SetReportDetailsInput) =>
  createAction<SetReportDetailsAction>(
    "SET_REPORT_DETAILS",
    { ...input },
    undefined,
    SetReportDetailsInputSchema,
    "global",
  );

export const addItem = (input: AddItemInput) =>
  createAction<AddItemAction>(
    "ADD_ITEM",
    { ...input },
    undefined,
    AddItemInputSchema,
    "global",
  );

export const updateItem = (input: UpdateItemInput) =>
  createAction<UpdateItemAction>(
    "UPDATE_ITEM",
    { ...input },
    undefined,
    UpdateItemInputSchema,
    "global",
  );

export const removeItem = (input: RemoveItemInput) =>
  createAction<RemoveItemAction>(
    "REMOVE_ITEM",
    { ...input },
    undefined,
    RemoveItemInputSchema,
    "global",
  );
