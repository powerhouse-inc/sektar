/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { BankAccountGlobalState } from "../types.js";
import type {
  CategorizeTransactionAction,
  ExcludeTransactionAction,
  ImportTransactionsAction,
  MatchTransactionAction,
  UnmatchTransactionAction,
} from "./actions.js";

export interface BankAccountFeedOperations {
  importTransactionsOperation: (
    state: BankAccountGlobalState,
    action: ImportTransactionsAction,
    dispatch?: SignalDispatch,
  ) => void;
  categorizeTransactionOperation: (
    state: BankAccountGlobalState,
    action: CategorizeTransactionAction,
    dispatch?: SignalDispatch,
  ) => void;
  matchTransactionOperation: (
    state: BankAccountGlobalState,
    action: MatchTransactionAction,
    dispatch?: SignalDispatch,
  ) => void;
  unmatchTransactionOperation: (
    state: BankAccountGlobalState,
    action: UnmatchTransactionAction,
    dispatch?: SignalDispatch,
  ) => void;
  excludeTransactionOperation: (
    state: BankAccountGlobalState,
    action: ExcludeTransactionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
