/**
 * Shaping the loops, only while the queue is a draft.
 *
 * The DRAFT guard is not ceremony: adding, reordering or retyping a cursor
 * changes the shape of the space, and every position already handed out is an
 * index into that shape. Changing it mid-walk would silently reinterpret where
 * the machine has been.
 */
import type { OriginalSourceQueueDefinitionOperations } from "document-models/original-source-queue/v1";
import {
  CollectionCursorCollectionNotFoundError,
  CollectionCursorIdTakenError,
  CollectionIdTakenError,
  CreateCollectionCursorNotDraftError,
  CreateCollectionNotDraftError,
  CreateDateTimeCursorNotDraftError,
  CreateNumberCursorNotDraftError,
  CursorOrderMismatchError,
  DateTimeCursorDeltaNotPositiveError,
  DateTimeCursorEmptySpanError,
  DateTimeCursorIdTakenError,
  NumberCursorIdTakenError,
  NumberCursorStepNotPositiveError,
  ReorderCursorsNotDraftError,
  SetCursorNameCursorNotFoundError,
  SetCursorNameNotDraftError,
} from "../../gen/definition/error.js";
import { recalculate } from "../machine.js";

export const originalSourceQueueDefinitionOperations: OriginalSourceQueueDefinitionOperations =
  {
    createDateTimeCursorOperation(state, action) {
      if (state.status !== "DRAFT") {
        throw new CreateDateTimeCursorNotDraftError(
          `Cursors may only be added to a draft; this queue is ${state.status}.`,
        );
      }
      if (state.cursors.some((cursor) => cursor.id === action.input.id)) {
        throw new DateTimeCursorIdTakenError(
          `A cursor with id ${action.input.id} already exists.`,
        );
      }
      if (action.input.deltaSeconds <= 0) {
        throw new DateTimeCursorDeltaNotPositiveError(
          `deltaSeconds must be greater than zero; got ${String(action.input.deltaSeconds)}. Direction of travel comes from first and last.`,
        );
      }

      // No parse guard here: DateTime inputs are validated against
      // `z.iso.datetime()` before a reducer ever sees them, so an unreadable
      // instant is rejected at the action layer and this could never fire.
      const from = Date.parse(action.input.first);
      const to = Date.parse(action.input.last);
      if (from === to) {
        // A number cursor with first === last still yields one point; a span
        // of zero width contains no interval at all.
        throw new DateTimeCursorEmptySpanError(
          `first and last are the same instant (${action.input.first}), so there is no interval to hand out.`,
        );
      }

      state.cursors.push({
        id: action.input.id,
        name: action.input.name ?? null,
        description: action.input.description ?? null,
        first: action.input.first,
        last: action.input.last,
        deltaSeconds: action.input.deltaSeconds,
        position: 0,
        current: null,
        next: null,
        finished: false,
        count: 0,
      });
      recalculate(state);
    },

    createNumberCursorOperation(state, action) {
      if (state.status !== "DRAFT") {
        throw new CreateNumberCursorNotDraftError(
          `Cursors may only be added to a draft; this queue is ${state.status}.`,
        );
      }
      if (state.cursors.some((cursor) => cursor.id === action.input.id)) {
        throw new NumberCursorIdTakenError(
          `A cursor with id ${action.input.id} already exists.`,
        );
      }
      if (action.input.step <= 0) {
        throw new NumberCursorStepNotPositiveError(
          `step must be greater than zero; got ${String(action.input.step)}. It is a magnitude — travel from 52 to 1 by writing first: 52, last: 1.`,
        );
      }

      state.cursors.push({
        id: action.input.id,
        name: action.input.name ?? null,
        description: action.input.description ?? null,
        first: action.input.first,
        last: action.input.last,
        step: action.input.step,
        position: 0,
        current: null,
        next: null,
        finished: false,
        count: 0,
      });
      recalculate(state);
    },

    createCollectionCursorOperation(state, action) {
      if (state.status !== "DRAFT") {
        throw new CreateCollectionCursorNotDraftError(
          `Cursors may only be added to a draft; this queue is ${state.status}.`,
        );
      }
      if (state.cursors.some((cursor) => cursor.id === action.input.id)) {
        throw new CollectionCursorIdTakenError(
          `A cursor with id ${action.input.id} already exists.`,
        );
      }
      if (!state.collections.some((c) => c.id === action.input.collection)) {
        throw new CollectionCursorCollectionNotFoundError(
          `There is no collection ${action.input.collection} to walk; create it first.`,
        );
      }

      state.cursors.push({
        id: action.input.id,
        name: action.input.name ?? null,
        description: action.input.description ?? null,
        collection: action.input.collection,
        position: 0,
        current: null,
        next: null,
        finished: false,
        count: 0,
      });
      recalculate(state);
    },

    reorderCursorsOperation(state, action) {
      if (state.status !== "DRAFT") {
        throw new ReorderCursorsNotDraftError(
          `Nesting order may only change in a draft; this queue is ${state.status}.`,
        );
      }

      const existing = state.cursors.map((cursor) => cursor.id);
      const wanted = action.input.order;
      // A permutation, not a subset: a partial order would silently drop or
      // duplicate a loop.
      const samePopulation =
        wanted.length === existing.length &&
        new Set(wanted).size === wanted.length &&
        wanted.every((id) => existing.includes(id));
      if (!samePopulation) {
        throw new CursorOrderMismatchError(
          `The order must list each of the ${String(existing.length)} cursors exactly once; got ${String(wanted.length)} entries.`,
        );
      }

      state.cursors = wanted.map((id) =>
        state.cursors.find((cursor) => cursor.id === id)!,
      );
      recalculate(state);
    },

    setCursorNameOperation(state, action) {
      if (state.status !== "DRAFT") {
        throw new SetCursorNameNotDraftError(
          `Cursor names may only change in a draft; this queue is ${state.status}.`,
        );
      }
      const cursor = state.cursors.find((c) => c.id === action.input.id);
      if (!cursor) {
        throw new SetCursorNameCursorNotFoundError(
          `There is no cursor ${action.input.id}.`,
        );
      }
      cursor.name = action.input.name ?? null;
    },

    createCollectionOperation(state, action) {
      if (state.status !== "DRAFT") {
        throw new CreateCollectionNotDraftError(
          `Collections may only be defined in a draft; this queue is ${state.status}. Values can still be pushed once it is running.`,
        );
      }
      if (state.collections.some((c) => c.id === action.input.id)) {
        throw new CollectionIdTakenError(
          `A collection with id ${action.input.id} already exists.`,
        );
      }

      state.collections.push({
        id: action.input.id,
        name: action.input.name,
        values: action.input.values ?? [],
      });
      recalculate(state);
    },
  };
