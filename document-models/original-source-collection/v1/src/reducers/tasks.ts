/**
 * Work a person still has to do.
 *
 * No delete: a cancelled task records that someone decided not to do it,
 * which is information. Deleting it would leave the collection looking as
 * though the question was never raised.
 */
import type { OriginalSourceCollectionTasksOperations } from "document-models/original-source-collection/v1";
import {
  AssignTaskNotFoundError,
  SetTaskDescriptionNotFoundError,
  SetTaskStatusNotFoundError,
  TaskIdTakenError,
  TaskSourceNotFoundError,
} from "../../gen/tasks/error.js";
import { recalculate } from "../derived.js";

export const originalSourceCollectionTasksOperations: OriginalSourceCollectionTasksOperations =
  {
    createTaskOperation(state, action) {
      if (state.tasks.some((task) => task.id === action.input.id)) {
        throw new TaskIdTakenError(
          `A task with id ${action.input.id} already exists.`,
        );
      }
      const source = action.input.source ?? null;
      if (source && !state.sources.some((s) => s.id === source)) {
        throw new TaskSourceNotFoundError(
          `This task points at source ${source}, which does not exist. Leave it out to raise a task about the whole batch.`,
        );
      }

      state.tasks.push({
        id: action.input.id,
        status: action.input.status ?? "TODO",
        owner: action.input.owner ?? null,
        description: action.input.description ?? null,
        source,
        createdAt: action.input.createdAt,
      });
      recalculate(state);
    },

    setTaskStatusOperation(state, action) {
      const task = state.tasks.find((t) => t.id === action.input.task);
      if (!task) {
        throw new SetTaskStatusNotFoundError(
          `There is no task ${action.input.task}.`,
        );
      }
      task.status = action.input.status;
      recalculate(state);
    },

    assignTaskOperation(state, action) {
      const task = state.tasks.find((t) => t.id === action.input.task);
      if (!task) {
        throw new AssignTaskNotFoundError(
          `There is no task ${action.input.task}.`,
        );
      }
      // Clearing an owner is a legitimate act, not a missing argument.
      task.owner = action.input.owner ?? null;
    },

    setTaskDescriptionOperation(state, action) {
      const task = state.tasks.find((t) => t.id === action.input.task);
      if (!task) {
        throw new SetTaskDescriptionNotFoundError(
          `There is no task ${action.input.task}.`,
        );
      }
      task.description = action.input.description ?? null;
    },
  };
