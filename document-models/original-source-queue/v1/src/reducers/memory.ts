/**
 * The scratchpad that survives an iteration boundary.
 *
 * Keyed rather than positional so two steps of a flow cannot collide by
 * agreeing on different meanings for slot 0. Writing null removes a slot,
 * which is how a workflow says "the page token is spent" without leaving a
 * stale one for the next iteration to trust.
 */
import type { OriginalSourceQueueMemoryOperations } from "document-models/original-source-queue/v1";
import {
  UpdateMemoryFinishedError,
  UpdateMemoryKeyEmptyError,
} from "../../gen/memory/error.js";

export const originalSourceQueueMemoryOperations: OriginalSourceQueueMemoryOperations =
  {
    updateMemoryOperation(state, action) {
      if (state.status === "FINISHED") {
        throw new UpdateMemoryFinishedError(
          "This queue has finished, so there is no further iteration for a scratchpad value to carry into.",
        );
      }
      const key = action.input.key.trim();
      if (key === "") {
        throw new UpdateMemoryKeyEmptyError(
          "A memory slot needs a name to be read back by.",
        );
      }

      const existing = state.memory.findIndex((entry) => entry.key === key);
      if (action.input.value === null || action.input.value === undefined) {
        if (existing !== -1) state.memory.splice(existing, 1);
        return;
      }
      if (existing === -1) {
        state.memory.push({ key, value: action.input.value });
        return;
      }
      state.memory[existing].value = action.input.value;
    },
  };
