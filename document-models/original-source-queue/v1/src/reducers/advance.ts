/**
 * Turning the odometer.
 *
 * Neither reducer works out where to go: both hand the question to the
 * machine, which owns the carrying, the resetting and the decision between
 * parking and finishing.
 */
import type { OriginalSourceQueueAdvanceOperations } from "document-models/original-source-queue/v1";
import {
  ProceedNotInProgressError,
  ProceedWithErrorIdTakenError,
  ProceedWithErrorNotInProgressError,
} from "../../gen/advance/error.js";
import { advance, currentTuple } from "../machine.js";

export const originalSourceQueueAdvanceOperations: OriginalSourceQueueAdvanceOperations =
  {
    proceedOperation(state) {
      if (state.status !== "IN_PROGRESS") {
        throw new ProceedNotInProgressError(
          `Only a walk in progress can advance; this queue is ${state.status}.`,
        );
      }
      advance(state);
    },

    proceedWithErrorOperation(state, action) {
      if (state.status !== "IN_PROGRESS") {
        throw new ProceedWithErrorNotInProgressError(
          `Only a walk in progress can record a failure and advance; this queue is ${state.status}.`,
        );
      }
      if (state.errors.some((error) => error.id === action.input.id)) {
        throw new ProceedWithErrorIdTakenError(
          `An error with id ${action.input.id} is already recorded; reusing it would overwrite an earlier failure.`,
        );
      }

      // Stamped BEFORE the move, or the error would name the tuple after the
      // failing one — which is the single most misleading thing this document
      // could record.
      state.errors.push({
        id: action.input.id,
        message: action.input.message,
        data: action.input.data ?? null,
        cursors: currentTuple(state),
      });

      advance(state);
    },
  };
