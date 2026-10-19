/**
 * Descriptions. Allowed in any status because they never affect the walk.
 */
import type { OriginalSourceQueueMetaOperations } from "document-models/original-source-queue/v1";
import { SetCursorDescriptionCursorNotFoundError } from "../../gen/meta/error.js";

export const originalSourceQueueMetaOperations: OriginalSourceQueueMetaOperations =
  {
    setDescriptionOperation(state, action) {
      state.description = action.input.description ?? null;
    },

    setCursorDescriptionOperation(state, action) {
      const cursor = state.cursors.find((c) => c.id === action.input.id);
      if (!cursor) {
        throw new SetCursorDescriptionCursorNotFoundError(
          `There is no cursor ${action.input.id}.`,
        );
      }
      cursor.description = action.input.description ?? null;
    },
  };
