/**
 * Queues, filled and drained while the walk runs.
 *
 * This is what separates a collection from a range: a range is known when the
 * queue is designed, a collection is discovered while it runs. One flow finds
 * work and pushes it here; the loop consumes it.
 */
import type { OriginalSourceQueueCollectionsOperations } from "document-models/original-source-queue/v1";
import {
  AddCollectionValueCollectionNotFoundError,
  AddCollectionValueEmptyError,
  AddCollectionValueNotInProgressError,
  ClearCollectionCollectionNotFoundError,
  ClearCollectionNotInProgressError,
} from "../../gen/collections/error.js";
import { recalculate } from "../machine.js";
import { isCollectionCursor } from "../utils.js";

export const originalSourceQueueCollectionsOperations: OriginalSourceQueueCollectionsOperations =
  {
    addCollectionValueOperation(state, action) {
      if (state.status !== "IN_PROGRESS") {
        throw new AddCollectionValueNotInProgressError(
          `Values may only be queued while the walk is in progress; this queue is ${state.status}. Seed a draft with CREATE_COLLECTION instead.`,
        );
      }
      const collection = state.collections.find(
        (c) => c.id === action.input.collection,
      );
      if (!collection) {
        throw new AddCollectionValueCollectionNotFoundError(
          `There is no collection ${action.input.collection}.`,
        );
      }
      if (action.input.values.length === 0) {
        throw new AddCollectionValueEmptyError(
          "No values were given, so this push would queue nothing.",
        );
      }

      collection.values.push(...action.input.values);
      // The walk may have been parked on this queue being empty. It stays
      // parked until the next advance, which is what hands the new work out —
      // pushing values is not itself an iteration.
      recalculate(state);
    },

    clearCollectionOperation(state, action) {
      if (state.status !== "IN_PROGRESS") {
        throw new ClearCollectionNotInProgressError(
          `Queues may only be cleared while the walk is in progress; this queue is ${state.status}.`,
        );
      }
      const collection = state.collections.find(
        (c) => c.id === action.input.collection,
      );
      if (!collection) {
        throw new ClearCollectionCollectionNotFoundError(
          `There is no collection ${action.input.collection}.`,
        );
      }

      collection.values = [];

      // Announce the clear to any cursor walking this queue.
      //
      // Length alone cannot tell "the list shrank, those items are gone" from
      // "cleared, and what arrives next is new work" — read as a bare shrink,
      // the machine would conclude there was nothing left and finish the
      // level. Resetting the position and un-entering says explicitly that
      // the next value to arrive is unworked and must be handed out.
      const walkers = state.cursors.filter(
        (cursor) =>
          isCollectionCursor(cursor) &&
          cursor.collection === action.input.collection,
      );
      if (walkers.length > 0) {
        walkers.forEach((cursor) => {
          cursor.position = 0;
        });
        state.awaitingValues = true;
      }
      recalculate(state);
    },
  };
