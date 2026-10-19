/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { ExpenseReportPHState } from "document-models/expense-report/v1";

import { expenseReportApprovalOperations } from "../src/reducers/approval.js";
import { expenseReportItemsOperations } from "../src/reducers/items.js";

import {
  AddItemInputSchema,
  ApproveReportInputSchema,
  ReimburseReportInputSchema,
  RejectReportInputSchema,
  RemoveItemInputSchema,
  SetReportDetailsInputSchema,
  SubmitReportInputSchema,
  UpdateItemInputSchema,
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

const stateReducer: StateReducer<ExpenseReportPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_REPORT_DETAILS": {
      memoizedSchema(SetReportDetailsInputSchema).parse(action.input);

      expenseReportItemsOperations.setReportDetailsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "ADD_ITEM": {
      memoizedSchema(AddItemInputSchema).parse(action.input);

      expenseReportItemsOperations.addItemOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPDATE_ITEM": {
      memoizedSchema(UpdateItemInputSchema).parse(action.input);

      expenseReportItemsOperations.updateItemOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_ITEM": {
      memoizedSchema(RemoveItemInputSchema).parse(action.input);

      expenseReportItemsOperations.removeItemOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SUBMIT_REPORT": {
      memoizedSchema(SubmitReportInputSchema).parse(action.input);

      expenseReportApprovalOperations.submitReportOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "APPROVE_REPORT": {
      memoizedSchema(ApproveReportInputSchema).parse(action.input);

      expenseReportApprovalOperations.approveReportOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REJECT_REPORT": {
      memoizedSchema(RejectReportInputSchema).parse(action.input);

      expenseReportApprovalOperations.rejectReportOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REIMBURSE_REPORT": {
      memoizedSchema(ReimburseReportInputSchema).parse(action.input);

      expenseReportApprovalOperations.reimburseReportOperation(
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

export const reducer: Reducer<ExpenseReportPHState> =
  createReducer(stateReducer);
