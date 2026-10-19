/**
 * One task, at full width.
 *
 * A task is mostly a sentence and a state, so the pane is mostly a place to
 * write the sentence properly. The link to its source is the useful part:
 * the reason you opened the task is usually to go and look at the thing.
 */
import type {
  OriginalSource,
  OriginalSourceCollectionAction,
  ProcessingTask,
} from "document-models/original-source-collection";
import { actions } from "document-models/original-source-collection";
import { BTN, INPUT, PILL, TASK_PILL, instant } from "./lib.js";

const TASK_STATUSES = [
  "DRAFT",
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

export function TaskDetail({
  task,
  sources,
  onPickSource,
  dispatch,
}: {
  task: ProcessingTask;
  sources: OriginalSource[];
  onPickSource: (id: string) => void;
  dispatch: (action: OriginalSourceCollectionAction) => void;
}) {
  const about = task.source
    ? sources.find((s) => s.id === task.source)
    : undefined;

  return (
    <div className="mx-auto h-full max-w-3xl space-y-5 overflow-y-auto p-6">
      <textarea
        key={`desc-${task.id}`}
        className="w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold text-foreground hover:border-border focus:border-border focus:outline-none"
        rows={2}
        defaultValue={task.description ?? ""}
        placeholder="What needs doing?"
        onBlur={(e) => {
          const description = e.target.value.trim();
          if (description !== (task.description ?? "")) {
            dispatch(
              actions.setTaskDescription({
                task: task.id,
                description: description || undefined,
              }),
            );
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className={`${PILL} ${TASK_PILL[task.status]}`}>
          {task.status.replace("_", " ").toLowerCase()}
        </span>
        <select
          className={INPUT}
          value={task.status}
          onChange={(e) => {
            dispatch(
              actions.setTaskStatus({
                task: task.id,
                status: e.target.value as ProcessingTask["status"],
              }),
            );
          }}
        >
          {TASK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
        <input
          key={`owner-${task.id}`}
          className={INPUT}
          defaultValue={task.owner ?? ""}
          placeholder="unassigned"
          onBlur={(e) => {
            const owner = e.target.value.trim();
            if (owner !== (task.owner ?? "")) {
              dispatch(
                actions.assignTask({
                  task: task.id,
                  owner: owner || undefined,
                }),
              );
            }
          }}
        />
      </div>

      <section className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">About</span>
        <span>
          {about ? (
            // The usual reason for opening a task is to go and look at the
            // thing it is about, so that is one click, not a hunt.
            <button
              type="button"
              className="text-left text-foreground underline"
              onClick={() => {
                onPickSource(about.id);
              }}
            >
              {about.title ?? about.externalId}
            </button>
          ) : (
            <span className="text-foreground">
              the batch as a whole
              {task.source ? ` (source ${task.source} is gone)` : ""}
            </span>
          )}
        </span>
        <span className="text-muted-foreground">Raised</span>
        <span className="tabular-nums text-foreground">
          {instant(task.createdAt)}
        </span>
      </section>

      {(task.status === "DONE" || task.status === "CANCELLED") && (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Settled, and kept. A cancelled or finished task records that the
          question was raised and answered — there is no delete here either.
        </p>
      )}

      {task.status !== "DONE" && (
        <button
          type="button"
          className={BTN}
          onClick={() => {
            dispatch(
              actions.setTaskStatus({ task: task.id, status: "DONE" }),
            );
          }}
        >
          Mark done
        </button>
      )}
    </div>
  );
}
