/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddPrecedingInvoiceInputSchema,
  RemovePrecedingInvoiceInputSchema,
  SetHeaderInputSchema,
} from "../schema/zod.js";
import type {
  AddPrecedingInvoiceInput,
  RemovePrecedingInvoiceInput,
  SetHeaderInput,
} from "../types.js";
import type {
  AddPrecedingInvoiceAction,
  RemovePrecedingInvoiceAction,
  SetHeaderAction,
} from "./actions.js";

export const setHeader = (input: SetHeaderInput) =>
  createAction<SetHeaderAction>(
    "SET_HEADER",
    { ...input },
    undefined,
    SetHeaderInputSchema,
    "global",
  );

export const addPrecedingInvoice = (input: AddPrecedingInvoiceInput) =>
  createAction<AddPrecedingInvoiceAction>(
    "ADD_PRECEDING_INVOICE",
    { ...input },
    undefined,
    AddPrecedingInvoiceInputSchema,
    "global",
  );

export const removePrecedingInvoice = (input: RemovePrecedingInvoiceInput) =>
  createAction<RemovePrecedingInvoiceAction>(
    "REMOVE_PRECEDING_INVOICE",
    { ...input },
    undefined,
    RemovePrecedingInvoiceInputSchema,
    "global",
  );
