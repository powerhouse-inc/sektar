/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { EmailPHState } from "document-models/email/v1";

import { emailAttachmentsOperations } from "../src/reducers/attachments.js";
import { emailMessageOperations } from "../src/reducers/message.js";
import { emailTriageOperations } from "../src/reducers/triage.js";

import {
  AddAttachmentInputSchema,
  AddLabelsInputSchema,
  ArchiveInputSchema,
  CaptureMessageInputSchema,
  MarkReadInputSchema,
  MarkUnreadInputSchema,
  RemoveAttachmentInputSchema,
  RemoveLabelsInputSchema,
  SetAccountInputSchema,
  SetFlaggedInputSchema,
  SetNotesInputSchema,
  UnarchiveInputSchema,
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

const stateReducer: StateReducer<EmailPHState> = (state, action, dispatch) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_ACCOUNT": {
      memoizedSchema(SetAccountInputSchema).parse(action.input);

      emailMessageOperations.setAccountOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CAPTURE_MESSAGE": {
      memoizedSchema(CaptureMessageInputSchema).parse(action.input);

      emailMessageOperations.captureMessageOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_NOTES": {
      memoizedSchema(SetNotesInputSchema).parse(action.input);

      emailMessageOperations.setNotesOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_ATTACHMENT": {
      memoizedSchema(AddAttachmentInputSchema).parse(action.input);

      emailAttachmentsOperations.addAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_ATTACHMENT": {
      memoizedSchema(RemoveAttachmentInputSchema).parse(action.input);

      emailAttachmentsOperations.removeAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "MARK_READ": {
      memoizedSchema(MarkReadInputSchema).parse(action.input);

      emailTriageOperations.markReadOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "MARK_UNREAD": {
      memoizedSchema(MarkUnreadInputSchema).parse(action.input);

      emailTriageOperations.markUnreadOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_FLAGGED": {
      memoizedSchema(SetFlaggedInputSchema).parse(action.input);

      emailTriageOperations.setFlaggedOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ARCHIVE": {
      memoizedSchema(ArchiveInputSchema).parse(action.input);

      emailTriageOperations.archiveOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UNARCHIVE": {
      memoizedSchema(UnarchiveInputSchema).parse(action.input);

      emailTriageOperations.unarchiveOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_LABELS": {
      memoizedSchema(AddLabelsInputSchema).parse(action.input);

      emailTriageOperations.addLabelsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_LABELS": {
      memoizedSchema(RemoveLabelsInputSchema).parse(action.input);

      emailTriageOperations.removeLabelsOperation(
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

export const reducer: Reducer<EmailPHState> = createReducer(stateReducer);
