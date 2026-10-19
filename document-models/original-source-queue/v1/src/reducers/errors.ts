/**
 * Recording a failure against the tuple that produced it.
 *
 * The value of this document is not that it knows a slice failed but that it
 * knows WHICH slice: an error without its coordinates is no better than a log
 * line, and a backfill's whole problem is knowing what to go back for.
 */
import type { OriginalSourceQueueErrorsOperations } from "document-models/original-source-queue/v1";
import {
  ReportErrorIdTakenError,
  ReportErrorNotInProgressError,
} from "../../gen/errors/error.js";
import { currentTuple } from "../machine.js";

export const originalSourceQueueErrorsOperations: OriginalSourceQueueErrorsOperations =
  {
    reportErrorOperation(state, action) {
      if (state.status !== "IN_PROGRESS") {
        throw new ReportErrorNotInProgressError(
          `A failure is recorded against the current tuple, and there is none unless the walk is in progress; this queue is ${state.status}.`,
        );
      }
      if (state.errors.some((error) => error.id === action.input.id)) {
        throw new ReportErrorIdTakenError(
          `An error with id ${action.input.id} is already recorded.`,
        );
      }

      state.errors.push({
        id: action.input.id,
        message: action.input.message,
        data: action.input.data ?? null,
        cursors: currentTuple(state),
      });
    },
  };
