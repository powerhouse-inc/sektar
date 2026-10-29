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
  ProceedStaleError,
  ProceedWithErrorIdTakenError,
  ProceedWithErrorNotInProgressError,
  ProceedWithErrorStaleError,
} from "../../gen/advance/error.js";
import { advance, currentTuple, isOnTuple } from "../machine.js";

export const originalSourceQueueAdvanceOperations: OriginalSourceQueueAdvanceOperations =
  {
    proceedOperation(state, action) {
      if (state.status !== "IN_PROGRESS") {
        throw new ProceedNotInProgressError(
          `Only a walk in progress can advance; this queue is ${state.status}.`,
        );
      }
      // A caller that worked on a tuple moves the queue only from that tuple:
      // a second run on the same one must not step past the next.
      if (action.input.expected && !isOnTuple(state, action.input.expected)) {
        throw new ProceedStaleError(
          "The queue is no longer on the tuple this caller worked on; moving it again would skip the next one.",
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
      if (action.input.expected && !isOnTuple(state, action.input.expected)) {
        throw new ProceedWithErrorStaleError(
          "The queue is no longer on the tuple this caller worked on; the failure would be stamped on the wrong one.",
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
