/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { IntegrationPHState } from "document-models/integration/v1";

import { integrationBackfillOperations } from "../src/reducers/backfill.js";
import { integrationLiveOperations } from "../src/reducers/live.js";
import { integrationSetupOperations } from "../src/reducers/setup.js";

import {
  AddDateRangeBackfillInputSchema,
  InitializeInputSchema,
  SetBackfillEnabledInputSchema,
  SetCalendarSourceInputSchema,
  SetLiveEnabledInputSchema,
  SetLiveIntervalInputSchema,
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

const stateReducer: StateReducer<IntegrationPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "INITIALIZE": {
      memoizedSchema(InitializeInputSchema).parse(action.input);

      integrationSetupOperations.initializeOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_CALENDAR_SOURCE": {
      memoizedSchema(SetCalendarSourceInputSchema).parse(action.input);

      integrationSetupOperations.setCalendarSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_LIVE_ENABLED": {
      memoizedSchema(SetLiveEnabledInputSchema).parse(action.input);

      integrationLiveOperations.setLiveEnabledOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_LIVE_INTERVAL": {
      memoizedSchema(SetLiveIntervalInputSchema).parse(action.input);

      integrationLiveOperations.setLiveIntervalOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_BACKFILL_ENABLED": {
      memoizedSchema(SetBackfillEnabledInputSchema).parse(action.input);

      integrationBackfillOperations.setBackfillEnabledOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_DATE_RANGE_BACKFILL": {
      memoizedSchema(AddDateRangeBackfillInputSchema).parse(action.input);

      integrationBackfillOperations.addDateRangeBackfillOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    default:
      return state;
  }
};

export const reducer: Reducer<IntegrationPHState> = createReducer(stateReducer);
