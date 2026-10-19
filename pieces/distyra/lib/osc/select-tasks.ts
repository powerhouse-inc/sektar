/**
 * Select Tasks — hand an agent the next piece of work, with its source.
 *
 * Pairs with the batch button in the collection editor: a person filters
 * sources, raises one task per source for a named owner, and this is what a
 * flow selects them back out with. Pure — it reads a state a reactor Get
 * Document step fetched, and emits actions for a Dispatch step to apply.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import {
  selectTasks,
  taskStatusActions,
  type CollectionState,
} from "./tasks.js";

const TASK_STATES = ["DRAFT", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
const SOURCE_STATES = ["NEW", "PROCESSING", "COMPLETED", "DISCARDED"];

function optional(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export const distyraOscSelectTasksAction = createAction({
  name: "osc-select-tasks",
  // Reads nothing and writes nothing: it is handed the state.
  requireAuth: false,
  displayName: "Select Tasks",
  description:
    "Pick the tasks an agent should do next, oldest first, each with the source it is about. Selects on owner, description, task status and the source's own status and tags — the same things the editor filters by. Feed it the state from a reactor Get Document step; apply claimActions with a Dispatch step to mark what you took, so a second run does not take it again.",
  props: {
    state: Property.Json({
      displayName: "Collection state",
      description:
        "The collection document's global state, e.g. {{steps.read.output.state}}.",
      required: true,
    }),
    owner: Property.ShortText({
      displayName: "Owner",
      description:
        "The agent the task is for, e.g. dropbox-dl-agent. Exact match; leave empty for any.",
      required: false,
    }),
    description: Property.ShortText({
      displayName: "Description contains",
      description:
        "Substring of the task's description, e.g. download file. A description is a sentence, so this matches loosely rather than exactly.",
      required: false,
    }),
    taskStatus: Property.StaticDropdown({
      displayName: "Task status",
      description: "Defaults to TODO, which is what not-yet-done means.",
      required: false,
      defaultValue: "TODO",
      options: { options: TASK_STATES.map((v) => ({ label: v, value: v })) },
    }),
    sourceStatus: Property.StaticDropdown({
      displayName: "Source status",
      description: "Only tasks whose source is in this state. Any if empty.",
      required: false,
      options: { options: SOURCE_STATES.map((v) => ({ label: v, value: v })) },
    }),
    sourceTag: Property.ShortText({
      displayName: "Source tag",
      description: "Only tasks whose source carries this tag.",
      required: false,
    }),
    limit: Property.Number({
      displayName: "How many",
      description:
        "One is usually right: a run does one task, and the next run takes the next. More only helps when the work itself is batched.",
      required: false,
      defaultValue: 1,
    }),
    claimAs: Property.StaticDropdown({
      displayName: "Claim as",
      description:
        "The status claimActions moves the picked tasks to. IN_PROGRESS by default — claiming before the work means a crash leaves a task visibly stuck rather than silently done.",
      required: false,
      defaultValue: "IN_PROGRESS",
      options: { options: TASK_STATES.map((v) => ({ label: v, value: v })) },
    }),
  },
  run(context) {
    const input = context.propsValue;
    // The prop is required, so its type says it is present and an object.
    // Nothing checks its SHAPE though, which is why everything downstream
    // treats each field as possibly absent.
    const state = input.state as CollectionState;

    const selection = selectTasks(state, {
      owner: optional(input.owner),
      description: optional(input.description),
      taskStatus: optional(input.taskStatus) ?? "TODO",
      sourceStatus: optional(input.sourceStatus),
      sourceTag: optional(input.sourceTag),
      limit: Math.max(0, input.limit ?? 1),
    });

    // Indexed access is not `| undefined` under this tsconfig, so the
    // emptiness has to be checked rather than optional-chained.
    const first = selection.tasks.length > 0 ? selection.tasks[0] : null;
    return Promise.resolve({
      ...selection,
      // The common case is one task a run, so the first is worth naming
      // rather than making every downstream step write `tasks.0`.
      found: first !== null,
      taskId: first ? first.taskId : null,
      source: first ? first.source : null,
      claimActions: taskStatusActions(
        selection.tasks,
        optional(input.claimAs) ?? "IN_PROGRESS",
      ),
    });
  },
});
