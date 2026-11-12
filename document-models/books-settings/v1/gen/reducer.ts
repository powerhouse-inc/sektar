import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { BooksSettingsPHState } from "document-models/books-settings/v1";
import type { SetBaseCurrencyAction } from "./currency/actions.js";

import { booksSettingsCurrencyOperations } from "../src/reducers/currency.js";

import { SetBaseCurrencyInputSchema } from "./schema/zod.js";

const schemaMemo = new Map<() => unknown, unknown>();

function memoizedSchema<T>(makeSchema: () => T): T {
  let schema = schemaMemo.get(makeSchema) as T | undefined;
  if (schema === undefined) {
    schema = makeSchema();
    schemaMemo.set(makeSchema, schema);
  }
  return schema;
}

const stateReducer: StateReducer<BooksSettingsPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_BASE_CURRENCY": {
      memoizedSchema(SetBaseCurrencyInputSchema).parse(action.input);

      booksSettingsCurrencyOperations.setBaseCurrencyOperation(
        state.global,
        action as SetBaseCurrencyAction,
        dispatch,
      );

      break;
    }

    default:
      return state;
  }
};

export const reducer: Reducer<BooksSettingsPHState> =
  createReducer(stateReducer);
