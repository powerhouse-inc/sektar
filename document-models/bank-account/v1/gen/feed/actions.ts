/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  CategorizeTransactionInput,
  ExcludeTransactionInput,
  ImportTransactionsInput,
  MatchTransactionInput,
  UnmatchTransactionInput,
} from "../types.js";

export type ImportTransactionsAction = Action & {
  type: "IMPORT_TRANSACTIONS";
  input: ImportTransactionsInput;
};
export type CategorizeTransactionAction = Action & {
  type: "CATEGORIZE_TRANSACTION";
  input: CategorizeTransactionInput;
};
export type MatchTransactionAction = Action & {
  type: "MATCH_TRANSACTION";
  input: MatchTransactionInput;
};
export type UnmatchTransactionAction = Action & {
  type: "UNMATCH_TRANSACTION";
  input: UnmatchTransactionInput;
};
export type ExcludeTransactionAction = Action & {
  type: "EXCLUDE_TRANSACTION";
  input: ExcludeTransactionInput;
};

export type BankAccountFeedAction =
  | ImportTransactionsAction
  | CategorizeTransactionAction
  | MatchTransactionAction
  | UnmatchTransactionAction
  | ExcludeTransactionAction;
