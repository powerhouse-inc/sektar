/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { InvoicePHState } from "document-models/invoice/v2";

import { invoiceAttachmentsOperations } from "../src/reducers/attachments.js";
import { invoiceCurrencyOperations } from "../src/reducers/currency.js";
import { invoiceHeaderOperations } from "../src/reducers/header.js";
import { invoiceLifecycleOperations } from "../src/reducers/lifecycle.js";
import { invoiceLinesOperations } from "../src/reducers/lines.js";
import { invoicePartiesOperations } from "../src/reducers/parties.js";
import { invoicePaymentOperations } from "../src/reducers/payment.js";
import { invoiceVatOperations } from "../src/reducers/vat.js";

import {
  AddAttachmentInputSchema,
  AddLineInputSchema,
  AddPrecedingInvoiceInputSchema,
  IssueInvoiceInputSchema,
  MoveAttachmentInputSchema,
  MoveLineInputSchema,
  RecordPaymentInputSchema,
  RemoveAttachmentInputSchema,
  RemoveExchangeRateInputSchema,
  RemoveLineInputSchema,
  RemovePaymentInputSchema,
  RemovePrecedingInvoiceInputSchema,
  RemoveVatReasonInputSchema,
  SetBuyerInputSchema,
  SetCurrencyInputSchema,
  SetExchangeRateInputSchema,
  SetHeaderInputSchema,
  SetPaymentInstructionsInputSchema,
  SetSellerInputSchema,
  SetVatReasonInputSchema,
  UpdateAttachmentInputSchema,
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
    case "SET_HEADER": {
      memoizedSchema(SetHeaderInputSchema).parse(action.input);

      invoiceHeaderOperations.setHeaderOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_PRECEDING_INVOICE": {
      memoizedSchema(AddPrecedingInvoiceInputSchema).parse(action.input);

      invoiceHeaderOperations.addPrecedingInvoiceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_PRECEDING_INVOICE": {
      memoizedSchema(RemovePrecedingInvoiceInputSchema).parse(action.input);

      invoiceHeaderOperations.removePrecedingInvoiceOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_SELLER": {
      memoizedSchema(SetSellerInputSchema).parse(action.input);

      invoicePartiesOperations.setSellerOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_BUYER": {
      memoizedSchema(SetBuyerInputSchema).parse(action.input);

      invoicePartiesOperations.setBuyerOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_CURRENCY": {
      memoizedSchema(SetCurrencyInputSchema).parse(action.input);

      invoiceCurrencyOperations.setCurrencyOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_EXCHANGE_RATE": {
      memoizedSchema(SetExchangeRateInputSchema).parse(action.input);

      invoiceCurrencyOperations.setExchangeRateOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_EXCHANGE_RATE": {
      memoizedSchema(RemoveExchangeRateInputSchema).parse(action.input);

      invoiceCurrencyOperations.removeExchangeRateOperation(
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

    case "MOVE_LINE": {
      memoizedSchema(MoveLineInputSchema).parse(action.input);

      invoiceLinesOperations.moveLineOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_VAT_REASON": {
      memoizedSchema(SetVatReasonInputSchema).parse(action.input);

      invoiceVatOperations.setVatReasonOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_VAT_REASON": {
      memoizedSchema(RemoveVatReasonInputSchema).parse(action.input);

      invoiceVatOperations.removeVatReasonOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_PAYMENT_INSTRUCTIONS": {
      memoizedSchema(SetPaymentInstructionsInputSchema).parse(action.input);

      invoicePaymentOperations.setPaymentInstructionsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_ATTACHMENT": {
      memoizedSchema(AddAttachmentInputSchema).parse(action.input);

      invoiceAttachmentsOperations.addAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_ATTACHMENT": {
      memoizedSchema(UpdateAttachmentInputSchema).parse(action.input);

      invoiceAttachmentsOperations.updateAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_ATTACHMENT": {
      memoizedSchema(RemoveAttachmentInputSchema).parse(action.input);

      invoiceAttachmentsOperations.removeAttachmentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "MOVE_ATTACHMENT": {
      memoizedSchema(MoveAttachmentInputSchema).parse(action.input);

      invoiceAttachmentsOperations.moveAttachmentOperation(
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

    case "REMOVE_PAYMENT": {
      memoizedSchema(RemovePaymentInputSchema).parse(action.input);

      invoiceLifecycleOperations.removePaymentOperation(
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
