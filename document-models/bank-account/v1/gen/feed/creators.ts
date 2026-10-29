/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  CategorizeTransactionInputSchema,
  ExcludeTransactionInputSchema,
  ImportTransactionsInputSchema,
  MatchTransactionInputSchema,
  RemovePendingTransactionsInputSchema,
  UnmatchTransactionInputSchema,
} from "../schema/zod.js";
import type {
  CategorizeTransactionInput,
  ExcludeTransactionInput,
  ImportTransactionsInput,
  MatchTransactionInput,
  RemovePendingTransactionsInput,
  UnmatchTransactionInput,
} from "../types.js";
import type {
  CategorizeTransactionAction,
  ExcludeTransactionAction,
  ImportTransactionsAction,
  MatchTransactionAction,
  RemovePendingTransactionsAction,
  UnmatchTransactionAction,
} from "./actions.js";

export const importTransactions = (input: ImportTransactionsInput) =>
  createAction<ImportTransactionsAction>(
    "IMPORT_TRANSACTIONS",
    { ...input },
    undefined,
    ImportTransactionsInputSchema,
    "global",
  );

export const categorizeTransaction = (input: CategorizeTransactionInput) =>
  createAction<CategorizeTransactionAction>(
    "CATEGORIZE_TRANSACTION",
    { ...input },
    undefined,
    CategorizeTransactionInputSchema,
    "global",
  );

export const matchTransaction = (input: MatchTransactionInput) =>
  createAction<MatchTransactionAction>(
    "MATCH_TRANSACTION",
    { ...input },
    undefined,
    MatchTransactionInputSchema,
    "global",
  );

export const unmatchTransaction = (input: UnmatchTransactionInput) =>
  createAction<UnmatchTransactionAction>(
    "UNMATCH_TRANSACTION",
    { ...input },
    undefined,
    UnmatchTransactionInputSchema,
    "global",
  );

export const excludeTransaction = (input: ExcludeTransactionInput) =>
  createAction<ExcludeTransactionAction>(
    "EXCLUDE_TRANSACTION",
    { ...input },
    undefined,
    ExcludeTransactionInputSchema,
    "global",
  );

export const removePendingTransactions = (
  input: RemovePendingTransactionsInput,
) =>
  createAction<RemovePendingTransactionsAction>(
    "REMOVE_PENDING_TRANSACTIONS",
    { ...input },
    undefined,
    RemovePendingTransactionsInputSchema,
    "global",
  );
