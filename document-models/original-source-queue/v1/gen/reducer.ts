/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { OriginalSourceQueuePHState } from "document-models/original-source-queue/v1";

import { originalSourceQueueAdvanceOperations } from "../src/reducers/advance.js";
import { originalSourceQueueCollectionsOperations } from "../src/reducers/collections.js";
import { originalSourceQueueDefinitionOperations } from "../src/reducers/definition.js";
import { originalSourceQueueErrorsOperations } from "../src/reducers/errors.js";
import { originalSourceQueueLifecycleOperations } from "../src/reducers/lifecycle.js";
import { originalSourceQueueMemoryOperations } from "../src/reducers/memory.js";
import { originalSourceQueueMetaOperations } from "../src/reducers/meta.js";

import {
  AddCollectionValueInputSchema,
  ClearCollectionInputSchema,
  CreateCollectionCursorInputSchema,
  CreateCollectionInputSchema,
  CreateDateTimeCursorInputSchema,
  CreateNumberCursorInputSchema,
  PauseInputSchema,
  ProceedInputSchema,
  ProceedWithErrorInputSchema,
  ReorderCursorsInputSchema,
  ReportErrorInputSchema,
  ResetInputSchema,
  SetCursorDescriptionInputSchema,
  SetCursorNameInputSchema,
  SetDescriptionInputSchema,
  StartInputSchema,
  TerminateInputSchema,
  UnpauseInputSchema,
  UpdateMemoryInputSchema,
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

const stateReducer: StateReducer<OriginalSourceQueuePHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "CREATE_DATE_TIME_CURSOR": {
      memoizedSchema(CreateDateTimeCursorInputSchema).parse(action.input);

      originalSourceQueueDefinitionOperations.createDateTimeCursorOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CREATE_NUMBER_CURSOR": {
      memoizedSchema(CreateNumberCursorInputSchema).parse(action.input);

      originalSourceQueueDefinitionOperations.createNumberCursorOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CREATE_COLLECTION_CURSOR": {
      memoizedSchema(CreateCollectionCursorInputSchema).parse(action.input);

      originalSourceQueueDefinitionOperations.createCollectionCursorOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REORDER_CURSORS": {
      memoizedSchema(ReorderCursorsInputSchema).parse(action.input);

      originalSourceQueueDefinitionOperations.reorderCursorsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_CURSOR_NAME": {
      memoizedSchema(SetCursorNameInputSchema).parse(action.input);

      originalSourceQueueDefinitionOperations.setCursorNameOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CREATE_COLLECTION": {
      memoizedSchema(CreateCollectionInputSchema).parse(action.input);

      originalSourceQueueDefinitionOperations.createCollectionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "START": {
      memoizedSchema(StartInputSchema).parse(action.input);

      originalSourceQueueLifecycleOperations.startOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "PAUSE": {
      memoizedSchema(PauseInputSchema).parse(action.input);

      originalSourceQueueLifecycleOperations.pauseOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UNPAUSE": {
      memoizedSchema(UnpauseInputSchema).parse(action.input);

      originalSourceQueueLifecycleOperations.unpauseOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "RESET": {
      memoizedSchema(ResetInputSchema).parse(action.input);

      originalSourceQueueLifecycleOperations.resetOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "TERMINATE": {
      memoizedSchema(TerminateInputSchema).parse(action.input);

      originalSourceQueueLifecycleOperations.terminateOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "PROCEED": {
      memoizedSchema(ProceedInputSchema).parse(action.input);

      originalSourceQueueAdvanceOperations.proceedOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "PROCEED_WITH_ERROR": {
      memoizedSchema(ProceedWithErrorInputSchema).parse(action.input);

      originalSourceQueueAdvanceOperations.proceedWithErrorOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_COLLECTION_VALUE": {
      memoizedSchema(AddCollectionValueInputSchema).parse(action.input);

      originalSourceQueueCollectionsOperations.addCollectionValueOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CLEAR_COLLECTION": {
      memoizedSchema(ClearCollectionInputSchema).parse(action.input);

      originalSourceQueueCollectionsOperations.clearCollectionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REPORT_ERROR": {
      memoizedSchema(ReportErrorInputSchema).parse(action.input);

      originalSourceQueueErrorsOperations.reportErrorOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_MEMORY": {
      memoizedSchema(UpdateMemoryInputSchema).parse(action.input);

      originalSourceQueueMemoryOperations.updateMemoryOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_DESCRIPTION": {
      memoizedSchema(SetDescriptionInputSchema).parse(action.input);

      originalSourceQueueMetaOperations.setDescriptionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_CURSOR_DESCRIPTION": {
      memoizedSchema(SetCursorDescriptionInputSchema).parse(action.input);

      originalSourceQueueMetaOperations.setCursorDescriptionOperation(
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

export const reducer: Reducer<OriginalSourceQueuePHState> =
  createReducer(stateReducer);
