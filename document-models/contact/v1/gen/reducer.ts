/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { ContactPHState } from "document-models/contact/v1";

import { contactLifecycleOperations } from "../src/reducers/lifecycle.js";
import { contactPeopleOperations } from "../src/reducers/people.js";
import { contactProfileOperations } from "../src/reducers/profile.js";

import {
  AddPersonInputSchema,
  AddTagInputSchema,
  ArchiveContactInputSchema,
  RemovePersonInputSchema,
  RemoveTagInputSchema,
  SetAddressInputSchema,
  SetBankDetailsInputSchema,
  SetPaymentTermsInputSchema,
  SetProfileInputSchema,
  UpdatePersonInputSchema,
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

const stateReducer: StateReducer<ContactPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_PROFILE": {
      memoizedSchema(SetProfileInputSchema).parse(action.input);

      contactProfileOperations.setProfileOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_ADDRESS": {
      memoizedSchema(SetAddressInputSchema).parse(action.input);

      contactProfileOperations.setAddressOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_BANK_DETAILS": {
      memoizedSchema(SetBankDetailsInputSchema).parse(action.input);

      contactProfileOperations.setBankDetailsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_PAYMENT_TERMS": {
      memoizedSchema(SetPaymentTermsInputSchema).parse(action.input);

      contactProfileOperations.setPaymentTermsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_TAG": {
      memoizedSchema(AddTagInputSchema).parse(action.input);

      contactProfileOperations.addTagOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_TAG": {
      memoizedSchema(RemoveTagInputSchema).parse(action.input);

      contactProfileOperations.removeTagOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_PERSON": {
      memoizedSchema(AddPersonInputSchema).parse(action.input);

      contactPeopleOperations.addPersonOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_PERSON": {
      memoizedSchema(UpdatePersonInputSchema).parse(action.input);

      contactPeopleOperations.updatePersonOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_PERSON": {
      memoizedSchema(RemovePersonInputSchema).parse(action.input);

      contactPeopleOperations.removePersonOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ARCHIVE_CONTACT": {
      memoizedSchema(ArchiveContactInputSchema).parse(action.input);

      contactLifecycleOperations.archiveContactOperation(
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

export const reducer: Reducer<ContactPHState> = createReducer(stateReducer);
