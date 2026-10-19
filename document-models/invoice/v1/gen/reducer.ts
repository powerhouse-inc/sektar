/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { InvoicePHState } from "document-models/invoice/v1";

import { invoiceDetailsOperations } from "../src/reducers/details.js";
import { invoiceLifecycleOperations } from "../src/reducers/lifecycle.js";
import { invoiceLinesOperations } from "../src/reducers/lines.js";

import {
  AddLineInputSchema,
  IssueInvoiceInputSchema,
  RecordPaymentInputSchema,
  RemoveLineInputSchema,
  SetInvoiceDetailsInputSchema,
  UpdateLineInputSchema,
  VoidInvoiceInputSchema,
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

const stateReducer: StateReducer<InvoicePHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_INVOICE_DETAILS": {
      memoizedSchema(SetInvoiceDetailsInputSchema).parse(action.input);

      invoiceDetailsOperations.setInvoiceDetailsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_LINE": {
      memoizedSchema(AddLineInputSchema).parse(action.input);

      invoiceLinesOperations.addLineOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_LINE": {
      memoizedSchema(UpdateLineInputSchema).parse(action.input);

      invoiceLinesOperations.updateLineOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_LINE": {
      memoizedSchema(RemoveLineInputSchema).parse(action.input);

      invoiceLinesOperations.removeLineOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ISSUE_INVOICE": {
      memoizedSchema(IssueInvoiceInputSchema).parse(action.input);

      invoiceLifecycleOperations.issueInvoiceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "RECORD_PAYMENT": {
      memoizedSchema(RecordPaymentInputSchema).parse(action.input);

      invoiceLifecycleOperations.recordPaymentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "VOID_INVOICE": {
      memoizedSchema(VoidInvoiceInputSchema).parse(action.input);

      invoiceLifecycleOperations.voidInvoiceOperation(
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

export const reducer: Reducer<InvoicePHState> = createReducer(stateReducer);
