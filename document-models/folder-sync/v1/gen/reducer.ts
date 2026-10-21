/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { FolderSyncPHState } from "document-models/folder-sync/v1";

import { folderSyncMappingOperations } from "../src/reducers/mapping.js";
import { folderSyncRunnerOperations } from "../src/reducers/runner.js";
import { folderSyncSyncOperations } from "../src/reducers/sync.js";

import {
  CompletePullInputSchema,
  FinishRunInputSchema,
  RequestPullInputSchema,
  RequestSyncInputSchema,
  ResolveIssueInputSchema,
  SetEnabledInputSchema,
  SetIssuesInputSchema,
  SetLocalPathInputSchema,
  SetOptionsInputSchema,
  SetTargetInputSchema,
  StartRunInputSchema,
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

const stateReducer: StateReducer<FolderSyncPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_TARGET": {
      memoizedSchema(SetTargetInputSchema).parse(action.input);

      folderSyncMappingOperations.setTargetOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_LOCAL_PATH": {
      memoizedSchema(SetLocalPathInputSchema).parse(action.input);

      folderSyncMappingOperations.setLocalPathOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_OPTIONS": {
      memoizedSchema(SetOptionsInputSchema).parse(action.input);

      folderSyncMappingOperations.setOptionsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_ENABLED": {
      memoizedSchema(SetEnabledInputSchema).parse(action.input);

      folderSyncMappingOperations.setEnabledOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REQUEST_SYNC": {
      memoizedSchema(RequestSyncInputSchema).parse(action.input);

      folderSyncSyncOperations.requestSyncOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REQUEST_PULL": {
      memoizedSchema(RequestPullInputSchema).parse(action.input);

      folderSyncSyncOperations.requestPullOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "START_RUN": {
      memoizedSchema(StartRunInputSchema).parse(action.input);

      folderSyncRunnerOperations.startRunOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "FINISH_RUN": {
      memoizedSchema(FinishRunInputSchema).parse(action.input);

      folderSyncRunnerOperations.finishRunOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_ISSUES": {
      memoizedSchema(SetIssuesInputSchema).parse(action.input);

      folderSyncRunnerOperations.setIssuesOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "RESOLVE_ISSUE": {
      memoizedSchema(ResolveIssueInputSchema).parse(action.input);

      folderSyncRunnerOperations.resolveIssueOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "COMPLETE_PULL": {
      memoizedSchema(CompletePullInputSchema).parse(action.input);

      folderSyncRunnerOperations.completePullOperation(
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

export const reducer: Reducer<FolderSyncPHState> = createReducer(stateReducer);
