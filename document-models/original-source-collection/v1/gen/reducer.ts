/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { OriginalSourceCollectionPHState } from "document-models/original-source-collection/v1";

import { originalSourceCollectionCaptureOperations } from "../src/reducers/capture.js";
import { originalSourceCollectionClassifyOperations } from "../src/reducers/classify.js";
import { originalSourceCollectionCollectionOperations } from "../src/reducers/collection.js";
import { originalSourceCollectionIdentityOperations } from "../src/reducers/identity.js";
import { originalSourceCollectionTasksOperations } from "../src/reducers/tasks.js";

import {
  AddAliasInputSchema,
  AddSourceReferenceInputSchema,
  AssignTaskInputSchema,
  AttachToSourceInputSchema,
  CaptureSourceInputSchema,
  CreateTaskInputSchema,
  DetachFromSourceInputSchema,
  DiscardCollectionInputSchema,
  DiscardSourceInputSchema,
  MergeSourcesInputSchema,
  RemoveAliasInputSchema,
  RestoreCollectionInputSchema,
  SetDescriptionInputSchema,
  SetProvenanceInputSchema,
  SetSourceStatusInputSchema,
  SetSourceTitleInputSchema,
  SetTaskDescriptionInputSchema,
  SetTaskStatusInputSchema,
  SetTitleInputSchema,
  SplitSourceInputSchema,
  TagSourceInputSchema,
  UntagSourceInputSchema,
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

const stateReducer: StateReducer<OriginalSourceCollectionPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_TITLE": {
      memoizedSchema(SetTitleInputSchema).parse(action.input);

      originalSourceCollectionCollectionOperations.setTitleOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_DESCRIPTION": {
      memoizedSchema(SetDescriptionInputSchema).parse(action.input);

      originalSourceCollectionCollectionOperations.setDescriptionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_PROVENANCE": {
      memoizedSchema(SetProvenanceInputSchema).parse(action.input);

      originalSourceCollectionCollectionOperations.setProvenanceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "DISCARD_COLLECTION": {
      memoizedSchema(DiscardCollectionInputSchema).parse(action.input);

      originalSourceCollectionCollectionOperations.discardCollectionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "RESTORE_COLLECTION": {
      memoizedSchema(RestoreCollectionInputSchema).parse(action.input);

      originalSourceCollectionCollectionOperations.restoreCollectionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CAPTURE_SOURCE": {
      memoizedSchema(CaptureSourceInputSchema).parse(action.input);

      originalSourceCollectionCaptureOperations.captureSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ATTACH_TO_SOURCE": {
      memoizedSchema(AttachToSourceInputSchema).parse(action.input);

      originalSourceCollectionCaptureOperations.attachToSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "DETACH_FROM_SOURCE": {
      memoizedSchema(DetachFromSourceInputSchema).parse(action.input);

      originalSourceCollectionCaptureOperations.detachFromSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_SOURCE_REFERENCE": {
      memoizedSchema(AddSourceReferenceInputSchema).parse(action.input);

      originalSourceCollectionCaptureOperations.addSourceReferenceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_ALIAS": {
      memoizedSchema(AddAliasInputSchema).parse(action.input);

      originalSourceCollectionIdentityOperations.addAliasOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_ALIAS": {
      memoizedSchema(RemoveAliasInputSchema).parse(action.input);

      originalSourceCollectionIdentityOperations.removeAliasOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "MERGE_SOURCES": {
      memoizedSchema(MergeSourcesInputSchema).parse(action.input);

      originalSourceCollectionIdentityOperations.mergeSourcesOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SPLIT_SOURCE": {
      memoizedSchema(SplitSourceInputSchema).parse(action.input);

      originalSourceCollectionIdentityOperations.splitSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_SOURCE_TITLE": {
      memoizedSchema(SetSourceTitleInputSchema).parse(action.input);

      originalSourceCollectionClassifyOperations.setSourceTitleOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "TAG_SOURCE": {
      memoizedSchema(TagSourceInputSchema).parse(action.input);

      originalSourceCollectionClassifyOperations.tagSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UNTAG_SOURCE": {
      memoizedSchema(UntagSourceInputSchema).parse(action.input);

      originalSourceCollectionClassifyOperations.untagSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_SOURCE_STATUS": {
      memoizedSchema(SetSourceStatusInputSchema).parse(action.input);

      originalSourceCollectionClassifyOperations.setSourceStatusOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "DISCARD_SOURCE": {
      memoizedSchema(DiscardSourceInputSchema).parse(action.input);

      originalSourceCollectionClassifyOperations.discardSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CREATE_TASK": {
      memoizedSchema(CreateTaskInputSchema).parse(action.input);

      originalSourceCollectionTasksOperations.createTaskOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_TASK_STATUS": {
      memoizedSchema(SetTaskStatusInputSchema).parse(action.input);

      originalSourceCollectionTasksOperations.setTaskStatusOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ASSIGN_TASK": {
      memoizedSchema(AssignTaskInputSchema).parse(action.input);

      originalSourceCollectionTasksOperations.assignTaskOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_TASK_DESCRIPTION": {
      memoizedSchema(SetTaskDescriptionInputSchema).parse(action.input);

      originalSourceCollectionTasksOperations.setTaskDescriptionOperation(
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

export const reducer: Reducer<OriginalSourceCollectionPHState> =
  createReducer(stateReducer);
