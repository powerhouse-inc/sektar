import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { CurrencyPairPHState } from "document-models/currency-pair/v1";
import type { SetPairAction } from "./pair/actions.js";
import type {
  RecordRatesAction,
  RemoveRateAction,
  SetManualRateAction,
} from "./rates/actions.js";

import { currencyPairPairOperations } from "../src/reducers/pair.js";
import { currencyPairRatesOperations } from "../src/reducers/rates.js";

import {
  RecordRatesInputSchema,
  RemoveRateInputSchema,
  SetManualRateInputSchema,
  SetPairInputSchema,
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

const stateReducer: StateReducer<CurrencyPairPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_PAIR": {
      memoizedSchema(SetPairInputSchema).parse(action.input);

      currencyPairPairOperations.setPairOperation(
        state.global,
        action as SetPairAction,
        dispatch,
      );

      break;
    }

    case "RECORD_RATES": {
      memoizedSchema(RecordRatesInputSchema).parse(action.input);

      currencyPairRatesOperations.recordRatesOperation(
        state.global,
        action as RecordRatesAction,
        dispatch,
      );

      break;
    }

    case "SET_MANUAL_RATE": {
      memoizedSchema(SetManualRateInputSchema).parse(action.input);

      currencyPairRatesOperations.setManualRateOperation(
        state.global,
        action as SetManualRateAction,
        dispatch,
      );

      break;
    }

    case "REMOVE_RATE": {
      memoizedSchema(RemoveRateInputSchema).parse(action.input);

      currencyPairRatesOperations.removeRateOperation(
        state.global,
        action as RemoveRateAction,
        dispatch,
      );

      break;
    }

    default:
      return state;
  }
};

export const reducer: Reducer<CurrencyPairPHState> =
  createReducer(stateReducer);
