/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { FilePHState } from "document-models/file/v1";

import { fileContentOperations } from "../src/reducers/content.js";
import { fileDiskOperations } from "../src/reducers/disk.js";
import { fileRenditionsOperations } from "../src/reducers/renditions.js";
import { fileTagsOperations } from "../src/reducers/tags.js";

import {
  AddRenditionInputSchema,
  AddTagInputSchema,
  ApplyDiskVersionInputSchema,
  ClearPlaceholderInputSchema,
  ClearSourceInputSchema,
  RemoveRenditionInputSchema,
  RemoveTagInputSchema,
  SetAttachmentSourceInputSchema,
  SetDescriptionInputSchema,
  SetDocumentSourceInputSchema,
  SetPlaceholderInputSchema,
  SetTitleInputSchema,
  UpdateRenditionInputSchema,
  UpdateTagInputSchema,
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

const stateReducer: StateReducer<FilePHState> = (state, action, dispatch) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_TITLE": {
      memoizedSchema(SetTitleInputSchema).parse(action.input);

      fileContentOperations.setTitleOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_DESCRIPTION": {
      memoizedSchema(SetDescriptionInputSchema).parse(action.input);

      fileContentOperations.setDescriptionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_ATTACHMENT_SOURCE": {
      memoizedSchema(SetAttachmentSourceInputSchema).parse(action.input);

      fileContentOperations.setAttachmentSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_DOCUMENT_SOURCE": {
      memoizedSchema(SetDocumentSourceInputSchema).parse(action.input);

      fileContentOperations.setDocumentSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CLEAR_SOURCE": {
      memoizedSchema(ClearSourceInputSchema).parse(action.input);

      fileContentOperations.clearSourceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_RENDITION": {
      memoizedSchema(AddRenditionInputSchema).parse(action.input);

      fileRenditionsOperations.addRenditionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_RENDITION": {
      memoizedSchema(UpdateRenditionInputSchema).parse(action.input);

      fileRenditionsOperations.updateRenditionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_RENDITION": {
      memoizedSchema(RemoveRenditionInputSchema).parse(action.input);

      fileRenditionsOperations.removeRenditionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_TAG": {
      memoizedSchema(AddTagInputSchema).parse(action.input);

      fileTagsOperations.addTagOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_TAG": {
      memoizedSchema(UpdateTagInputSchema).parse(action.input);

      fileTagsOperations.updateTagOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_TAG": {
      memoizedSchema(RemoveTagInputSchema).parse(action.input);

      fileTagsOperations.removeTagOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_PLACEHOLDER": {
      memoizedSchema(SetPlaceholderInputSchema).parse(action.input);

      fileDiskOperations.setPlaceholderOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CLEAR_PLACEHOLDER": {
      memoizedSchema(ClearPlaceholderInputSchema).parse(action.input);

      fileDiskOperations.clearPlaceholderOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "APPLY_DISK_VERSION": {
      memoizedSchema(ApplyDiskVersionInputSchema).parse(action.input);

      fileDiskOperations.applyDiskVersionOperation(
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

export const reducer: Reducer<FilePHState> = createReducer(stateReducer);
