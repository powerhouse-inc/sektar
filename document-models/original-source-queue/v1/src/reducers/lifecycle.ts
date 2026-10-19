/**
 * Moving between the four statuses.
 *
 * Each transition is guarded by a named error rather than being quietly
 * ignored, because a workflow that pauses a finished queue has a bug and
 * silence would hide it.
 */
import type { OriginalSourceQueueLifecycleOperations } from "document-models/original-source-queue/v1";
import {
  PauseNotInProgressError,
  ResetAlreadyDraftError,
  StartNotDraftError,
  StartWithoutCursorsError,
  TerminateAlreadyFinishedError,
  UnpauseNotPausedError,
} from "../../gen/lifecycle/error.js";
import { advance, recalculate } from "../machine.js";

export const originalSourceQueueLifecycleOperations: OriginalSourceQueueLifecycleOperations =
  {
    startOperation(state) {
      if (state.status !== "DRAFT") {
        throw new StartNotDraftError(
          `Only a draft can be started; this queue is ${state.status}.`,
        );
      }
      if (state.cursors.length === 0) {
        throw new StartWithoutCursorsError(
          "This queue has no cursors, so it describes no loop and starting it would finish it immediately.",
        );
      }

      state.status = "IN_PROGRESS";
      state.errors = [];
      state.cursors.forEach((cursor) => {
        cursor.position = 0;
      });
      // Not yet handed out: the first advance realises position zero rather
      // than stepping past it.
      state.awaitingValues = true;
      advance(state);
    },

    pauseOperation(state) {
      if (state.status !== "IN_PROGRESS") {
        throw new PauseNotInProgressError(
          `Only a walk in progress can be paused; this queue is ${state.status}.`,
        );
      }
      state.status = "PAUSED";
    },

    unpauseOperation(state) {
      if (state.status !== "PAUSED") {
        throw new UnpauseNotPausedError(
          `Only a paused walk can be resumed; this queue is ${state.status}.`,
        );
      }
      state.status = "IN_PROGRESS";
      // The tuple it stopped on is still the tuple to work, so this resumes
      // rather than advances.
      recalculate(state);
    },

    resetOperation(state) {
      if (state.status === "DRAFT") {
        throw new ResetAlreadyDraftError(
          "This queue is already a draft, so there is no position, error or memory to clear.",
        );
      }

      // Definitions and queued values survive; everything the run produced
      // does not. A reset is for running the same space again after fixing
      // something, so the space itself must stay.
      state.status = "DRAFT";
      state.errors = [];
      state.memory = [];
      recalculate(state);
    },

    terminateOperation(state) {
      if (state.status === "FINISHED") {
        throw new TerminateAlreadyFinishedError(
          "This queue has already finished.",
        );
      }
      state.status = "FINISHED";
      recalculate(state);
    },
  };
