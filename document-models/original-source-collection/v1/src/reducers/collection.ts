/**
 * The collection itself.
 *
 * `SET_TITLE`, not `SET_NAME`: `setName` is one of the base actions spread
 * into every model's `actions` object, and a model operation of the same name
 * silently overrides it — a collection that could no longer be renamed.
 */
import type { OriginalSourceCollectionCollectionOperations } from "document-models/original-source-collection/v1";
import {
  CollectionAlreadyDiscardedError,
  CollectionNotDiscardedError,
} from "../../gen/collection/error.js";
import { recalculate } from "../derived.js";

export const originalSourceCollectionCollectionOperations: OriginalSourceCollectionCollectionOperations =
  {
    setTitleOperation(state, action) {
      state.title = action.input.title ?? null;
    },

    setDescriptionOperation(state, action) {
      state.description = action.input.description ?? null;
    },

    setProvenanceOperation(state, action) {
      state.provenance = {
        queue: action.input.queue ?? null,
        system: action.input.system ?? null,
        detail: action.input.detail ?? null,
      };
    },

    discardCollectionOperation(state) {
      if (state.status === "DISCARDED") {
        throw new CollectionAlreadyDiscardedError(
          "This collection has already been abandoned.",
        );
      }
      // Sticky: recalculate leaves DISCARDED alone, because abandoning a
      // collection is a decision and a roll-up would undo it on the next
      // operation.
      state.status = "DISCARDED";
      recalculate(state);
    },

    restoreCollectionOperation(state) {
      if (state.status !== "DISCARDED") {
        throw new CollectionNotDiscardedError(
          "This collection is live, so there is nothing to restore; its status is calculated from its sources.",
        );
      }
      // Anything not DISCARDED lets the roll-up take over again.
      state.status = "NEW";
      recalculate(state);
    },
  };
