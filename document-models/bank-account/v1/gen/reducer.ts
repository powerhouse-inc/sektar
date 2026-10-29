import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { BankAccountPHState } from "document-models/bank-account/v1";
import type { SetAccountDetailsAction } from "./account/actions.js";
import type {
  CategorizeTransactionAction,
  ExcludeTransactionAction,
  ImportTransactionsAction,
  MatchTransactionAction,
  RemovePendingTransactionsAction,
  UnmatchTransactionAction,
} from "./feed/actions.js";

import { bankAccountAccountOperations } from "../src/reducers/account.js";
import { bankAccountFeedOperations } from "../src/reducers/feed.js";

import {
  CategorizeTransactionInputSchema,
  ExcludeTransactionInputSchema,
  ImportTransactionsInputSchema,
  MatchTransactionInputSchema,
  RemovePendingTransactionsInputSchema,
  SetAccountDetailsInputSchema,
  UnmatchTransactionInputSchema,
} from "./schema/zod.js";

const schemaMemo = new Map<() => unknown, unknown>();

function memoizedSchema<T>(makeSchema: () => T): T {
  let schema = schemaMemo.get(makeSchema) as T | undefined;
  if (schema === undefined) {
    schema = makeSchema();
    schemaMemo.set(makeSchema, schema);
  }
  return schema;
}

const stateReducer: StateReducer<BankAccountPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_ACCOUNT_DETAILS": {
      memoizedSchema(SetAccountDetailsInputSchema).parse(action.input);

      bankAccountAccountOperations.setAccountDetailsOperation(
        state.global,
        action as SetAccountDetailsAction,
        dispatch,
      );

      break;
    }

    case "IMPORT_TRANSACTIONS": {
      memoizedSchema(ImportTransactionsInputSchema).parse(action.input);

      bankAccountFeedOperations.importTransactionsOperation(
        state.global,
        action as ImportTransactionsAction,
        dispatch,
      );

      break;
    }

    case "CATEGORIZE_TRANSACTION": {
      memoizedSchema(CategorizeTransactionInputSchema).parse(action.input);

      bankAccountFeedOperations.categorizeTransactionOperation(
        state.global,
        action as CategorizeTransactionAction,
        dispatch,
      );

      break;
    }

    case "MATCH_TRANSACTION": {
      memoizedSchema(MatchTransactionInputSchema).parse(action.input);

      bankAccountFeedOperations.matchTransactionOperation(
        state.global,
        action as MatchTransactionAction,
        dispatch,
      );

      break;
    }

    case "UNMATCH_TRANSACTION": {
      memoizedSchema(UnmatchTransactionInputSchema).parse(action.input);

      bankAccountFeedOperations.unmatchTransactionOperation(
        state.global,
        action as UnmatchTransactionAction,
        dispatch,
      );

      break;
    }

    case "EXCLUDE_TRANSACTION": {
      memoizedSchema(ExcludeTransactionInputSchema).parse(action.input);

      bankAccountFeedOperations.excludeTransactionOperation(
        state.global,
        action as ExcludeTransactionAction,
        dispatch,
      );

      break;
    }

    case "REMOVE_PENDING_TRANSACTIONS": {
      memoizedSchema(RemovePendingTransactionsInputSchema).parse(action.input);

      bankAccountFeedOperations.removePendingTransactionsOperation(
        state.global,
        action as RemovePendingTransactionsAction,
        dispatch,
      );

      break;
    }

    default:
      return state;
  }
};

export const reducer: Reducer<BankAccountPHState> = createReducer(stateReducer);
