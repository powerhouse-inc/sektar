/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { TripPHState } from "document-models/trip/v1";

import { tripDocumentsOperations } from "../src/reducers/documents.js";
import { tripExtrasOperations } from "../src/reducers/extras.js";
import { tripMealsOperations } from "../src/reducers/meals.js";
import { tripStaysOperations } from "../src/reducers/stays.js";
import { tripTransportOperations } from "../src/reducers/transport.js";
import { tripTripOperations } from "../src/reducers/trip.js";

import {
  AddAttachmentInputSchema,
  AddDestinationInputSchema,
  AddExtraInputSchema,
  AddMealInputSchema,
  AddSourceInputSchema,
  AddStayInputSchema,
  AddTransportInputSchema,
  RemoveAttachmentInputSchema,
  RemoveDestinationInputSchema,
  RemoveExtraInputSchema,
  RemoveMealInputSchema,
  RemoveSourceInputSchema,
  RemoveStayInputSchema,
  RemoveTransportInputSchema,
  SetBillingInputSchema,
  SetDetailsInputSchema,
  SetStatusInputSchema,
  SetTravelerInputSchema,
  UpdateDestinationInputSchema,
  UpdateExtraInputSchema,
  UpdateMealInputSchema,
  UpdateStayInputSchema,
  UpdateTransportInputSchema,
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

const stateReducer: StateReducer<TripPHState> = (state, action, dispatch) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_DETAILS": {
      memoizedSchema(SetDetailsInputSchema).parse(action.input);

      tripTripOperations.setDetailsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_STATUS": {
      memoizedSchema(SetStatusInputSchema).parse(action.input);

      tripTripOperations.setStatusOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_TRAVELER": {
      memoizedSchema(SetTravelerInputSchema).parse(action.input);

      tripTripOperations.setTravelerOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_BILLING": {
      memoizedSchema(SetBillingInputSchema).parse(action.input);

      tripTripOperations.setBillingOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_DESTINATION": {
      memoizedSchema(AddDestinationInputSchema).parse(action.input);

      tripTripOperations.addDestinationOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_DESTINATION": {
      memoizedSchema(UpdateDestinationInputSchema).parse(action.input);

      tripTripOperations.updateDestinationOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_DESTINATION": {
      memoizedSchema(RemoveDestinationInputSchema).parse(action.input);

      tripTripOperations.removeDestinationOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_TRANSPORT": {
      memoizedSchema(AddTransportInputSchema).parse(action.input);

      tripTransportOperations.addTransportOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_TRANSPORT": {
      memoizedSchema(UpdateTransportInputSchema).parse(action.input);

      tripTransportOperations.updateTransportOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_TRANSPORT": {
      memoizedSchema(RemoveTransportInputSchema).parse(action.input);

      tripTransportOperations.removeTransportOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_STAY": {
      memoizedSchema(AddStayInputSchema).parse(action.input);

      tripStaysOperations.addStayOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_STAY": {
      memoizedSchema(UpdateStayInputSchema).parse(action.input);

      tripStaysOperations.updateStayOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_STAY": {
      memoizedSchema(RemoveStayInputSchema).parse(action.input);

      tripStaysOperations.removeStayOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_MEAL": {
      memoizedSchema(AddMealInputSchema).parse(action.input);

      tripMealsOperations.addMealOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_MEAL": {
      memoizedSchema(UpdateMealInputSchema).parse(action.input);

      tripMealsOperations.updateMealOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_MEAL": {
      memoizedSchema(RemoveMealInputSchema).parse(action.input);

      tripMealsOperations.removeMealOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_EXTRA": {
      memoizedSchema(AddExtraInputSchema).parse(action.input);

      tripExtrasOperations.addExtraOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_EXTRA": {
      memoizedSchema(UpdateExtraInputSchema).parse(action.input);

      tripExtrasOperations.updateExtraOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_EXTRA": {
      memoizedSchema(RemoveExtraInputSchema).parse(action.input);

      tripExtrasOperations.removeExtraOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_ATTACHMENT": {
      memoizedSchema(AddAttachmentInputSchema).parse(action.input);

      tripDocumentsOperations.addAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_ATTACHMENT": {
      memoizedSchema(RemoveAttachmentInputSchema).parse(action.input);

      tripDocumentsOperations.removeAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_SOURCE": {
      memoizedSchema(AddSourceInputSchema).parse(action.input);

      tripDocumentsOperations.addSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_SOURCE": {
      memoizedSchema(RemoveSourceInputSchema).parse(action.input);

      tripDocumentsOperations.removeSourceOperation(
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

export const reducer: Reducer<TripPHState> = createReducer(stateReducer);
