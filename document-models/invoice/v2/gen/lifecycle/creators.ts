/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  IssueInvoiceInputSchema,
  RecordPaymentInputSchema,
  RemovePaymentInputSchema,
  VoidInvoiceInputSchema,
} from "../schema/zod.js";
import type {
  IssueInvoiceInput,
  RecordPaymentInput,
  RemovePaymentInput,
  VoidInvoiceInput,
} from "../types.js";
import type {
  IssueInvoiceAction,
  RecordPaymentAction,
  RemovePaymentAction,
  VoidInvoiceAction,
} from "./actions.js";

export const issueInvoice = (input: IssueInvoiceInput) =>
  createAction<IssueInvoiceAction>(
    "ISSUE_INVOICE",
    { ...input },
    undefined,
    IssueInvoiceInputSchema,
    "global",
  );

export const recordPayment = (input: RecordPaymentInput) =>
  createAction<RecordPaymentAction>(
    "RECORD_PAYMENT",
    { ...input },
    undefined,
    RecordPaymentInputSchema,
    "global",
  );

export const removePayment = (input: RemovePaymentInput) =>
  createAction<RemovePaymentAction>(
    "REMOVE_PAYMENT",
    { ...input },
    undefined,
    RemovePaymentInputSchema,
    "global",
  );

export const voidInvoice = (input: VoidInvoiceInput) =>
  createAction<VoidInvoiceAction>(
    "VOID_INVOICE",
    { ...input },
    undefined,
    VoidInvoiceInputSchema,
    "global",
  );
