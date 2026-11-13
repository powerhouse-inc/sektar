/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  CorrectCurrencyInputSchema,
  RecordBankBalanceInputSchema,
  SetAccountDetailsInputSchema,
} from "../schema/zod.js";
import type {
  CorrectCurrencyInput,
  RecordBankBalanceInput,
  SetAccountDetailsInput,
} from "../types.js";
import type {
  CorrectCurrencyAction,
  RecordBankBalanceAction,
  SetAccountDetailsAction,
} from "./actions.js";

export const setAccountDetails = (input: SetAccountDetailsInput) =>
  createAction<SetAccountDetailsAction>(
    "SET_ACCOUNT_DETAILS",
    { ...input },
    undefined,
    SetAccountDetailsInputSchema,
    "global",
  );

export const correctCurrency = (input: CorrectCurrencyInput) =>
  createAction<CorrectCurrencyAction>(
    "CORRECT_CURRENCY",
    { ...input },
    undefined,
    CorrectCurrencyInputSchema,
    "global",
  );

export const recordBankBalance = (input: RecordBankBalanceInput) =>
  createAction<RecordBankBalanceAction>(
    "RECORD_BANK_BALANCE",
    { ...input },
    undefined,
    RecordBankBalanceInputSchema,
    "global",
  );
