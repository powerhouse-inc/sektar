/**
 * Picking the work an agent should do next.
 *
 * The task list IS the queue. A person filters a collection down to the
 * sources that need something, raises one task per source with an owner and
 * a description, and an agent drains them — so selection here is the mirror
 * image of the filter in the editor, and selects on the same things: who the
 * task is for, what it says, and the state and tags of the source behind it.
 *
 * Pure, and for the usual reason: it is handed a state a reactor Get
 * Document step already fetched. A piece may not read a document itself
 * (docs/bugs/pieces-cannot-reach-the-reactor.md), so this takes the state as
 * an argument and emits actions for a Dispatch step to apply.
 *
 * The source travels with the task. A task names a source by id, and an
 * agent that has to go and look it up cannot act on one — it needs the
 * identifier, the path, the attachments. Carrying them is what makes a task
 * self-contained enough to hand to a flow.
 */

export interface TaskSource {
  id: string;
  externalId: string;
  aliases: string[];
  status: string;
  title: string | null;
  origin: string | null;
  tags: string[];
  payload: unknown;
  attachments: unknown[];
  mergedInto?: string | null;
}

export interface Task {
  id: string;
  status: string;
  owner: string | null;
  description: string | null;
  source: string | null;
  createdAt: string;
}

export interface CollectionState {
  title?: string | null;
  sources?: TaskSource[];
  tasks?: Task[];
}

export interface TaskFilter {
  /** Exact, case-insensitive. The agent's name. */
  owner?: string;
  /** Substring, case-insensitive — a description is a sentence, not a key. */
  description?: string;
  /** Task status; defaults to TODO, which is what "not yet done" means. */
  taskStatus?: string;
  /** Status the source must be in. */
  sourceStatus?: string;
  /** Tag the source must carry. */
  sourceTag?: string;
  /** Most to return. One is the usual answer: a run does one task. */
  limit: number;
}

export interface SelectedTask {
  taskId: string;
  description: string | null;
  owner: string | null;
  status: string;
  createdAt: string;
  /** Null when the task is about the batch rather than one source. */
  source: TaskSource | null;
}

export interface Selection {
  tasks: SelectedTask[];
  /** Matching tasks in total, which is what says whether more remain. */
  matched: number;
  /** Tasks whose source is missing or folded; never handed out. */
  unresolved: number;
}

function sameText(a: string | null | undefined, b: string | undefined): boolean {
  if (b === undefined || b === "") return true;
  return (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
}

function contains(a: string | null | undefined, b: string | undefined): boolean {
  if (b === undefined || b === "") return true;
  return (a ?? "").toLowerCase().includes(b.trim().toLowerCase());
}

/**
 * The tasks an agent should pick up, oldest first.
 *
 * Oldest first because a queue drained newest-first starves whatever was
 * raised at the start of a big batch — which is exactly the batch this
 * exists to serve.
 */
export function selectTasks(
  state: CollectionState,
  filter: TaskFilter,
): Selection {
  const sources = state.sources ?? [];
  const byId = new Map(sources.map((source) => [source.id, source]));
  const wantedStatus = filter.taskStatus ?? "TODO";

  const candidates = (state.tasks ?? [])
    .filter((task) => sameText(task.status, wantedStatus))
    .filter((task) => sameText(task.owner, filter.owner))
    .filter((task) => contains(task.description, filter.description))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const picked: SelectedTask[] = [];
  let matched = 0;
  let unresolved = 0;

  for (const task of candidates) {
    const source = task.source ? (byId.get(task.source) ?? null) : null;

    if (task.source) {
      // A task about a source that is gone, or that turned out to be a
      // duplicate of another, is not work: acting on a folded source would
      // write to a tombstone rather than to the record that absorbed it.
      if (!source || source.mergedInto) {
        unresolved++;
        continue;
      }
      if (!sameText(source.status, filter.sourceStatus)) continue;
      if (
        filter.sourceTag !== undefined &&
        filter.sourceTag !== "" &&
        !source.tags.includes(filter.sourceTag)
      ) {
        continue;
      }
    } else if (
      (filter.sourceStatus !== undefined && filter.sourceStatus !== "") ||
      (filter.sourceTag !== undefined && filter.sourceTag !== "")
    ) {
      // Asked for a source property, and this task has no source to have it.
      continue;
    }

    matched++;
    if (picked.length < Math.max(0, filter.limit)) {
      picked.push({
        taskId: task.id,
        description: task.description,
        owner: task.owner,
        status: task.status,
        createdAt: task.createdAt,
        source,
      });
    }
  }

  return { tasks: picked, matched, unresolved };
}

export interface DispatchAction {
  type: string;
  input: Record<string, unknown>;
}

/**
 * Moving the picked tasks to a status, so a second run does not take them.
 *
 * Claiming is separate from completing on purpose. A flow that marks a task
 * DONE before doing the work loses it on a crash; one that claims it first
 * leaves it IN_PROGRESS, which is visibly different from both TODO and DONE
 * and is the state a person can go and look at when something is stuck.
 */
export function taskStatusActions(
  tasks: SelectedTask[],
  status: string,
): DispatchAction[] {
  return tasks.map((task) => ({
    type: "SET_TASK_STATUS",
    input: { task: task.taskId, status },
  }));
}
