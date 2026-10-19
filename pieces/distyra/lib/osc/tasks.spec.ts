/**
 * Which task an agent picks up next.
 *
 * The selection mirrors the editor's filter, so the things worth testing are
 * the ones where "what a person saw" and "what a flow acts on" could drift
 * apart: a source that has since been folded, a task about the batch rather
 * than a source, and the order a backlog drains in.
 */
import { describe, expect, it } from "vitest";
import {
  selectTasks,
  taskStatusActions,
  type CollectionState,
  type Task,
  type TaskSource,
} from "./tasks.js";

function source(over: Partial<TaskSource> = {}): TaskSource {
  return {
    id: "s1",
    externalId: "dropbox:id-1",
    aliases: ["dropbox-path:/ksdc/a.pdf"],
    status: "NEW",
    title: "a.pdf",
    origin: null,
    tags: ["file", "backfill"],
    payload: { name: "a.pdf" },
    attachments: [],
    mergedInto: null,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    status: "TODO",
    owner: "dropbox-dl-agent",
    description: "download file",
    source: "s1",
    createdAt: "2026-10-01T09:00:00.000Z",
    ...over,
  };
}

const state = (over: Partial<CollectionState> = {}): CollectionState => ({
  title: "Dropbox files",
  sources: [source()],
  tasks: [task()],
  ...over,
});

const FILTER = { owner: "dropbox-dl-agent", limit: 1 };

describe("picking work", () => {
  it("hands over the task with the source it is about", () => {
    // An agent given only a source id cannot act; it needs the identifier
    // and the payload, so the source travels with the task.
    const result = selectTasks(state(), FILTER);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskId).toBe("t1");
    expect(result.tasks[0].source?.externalId).toBe("dropbox:id-1");
    expect(result.matched).toBe(1);
  });

  it("defaults to TODO, which is what not-yet-done means", () => {
    const result = selectTasks(
      state({ tasks: [task({ status: "DONE" })] }),
      FILTER,
    );
    expect(result.tasks).toEqual([]);
  });

  it("matches the owner exactly and the description loosely", () => {
    const s = state({ tasks: [task({ description: "please download file 3" })] });
    expect(selectTasks(s, { ...FILTER, description: "download" }).matched).toBe(1);
    expect(selectTasks(s, { ...FILTER, description: "upload" }).matched).toBe(0);
    expect(selectTasks(s, { owner: "other-agent", limit: 1 }).matched).toBe(0);
  });

  it("is case-insensitive about the owner", () => {
    // The owner is typed by hand in the editor and again in the flow.
    expect(selectTasks(state(), { owner: "Dropbox-DL-Agent", limit: 1 }).matched).toBe(1);
  });

  it("filters on the source's status and tags, not only the task's", () => {
    const s = state({ sources: [source({ status: "COMPLETED" })] });
    expect(selectTasks(s, { ...FILTER, sourceStatus: "NEW" }).matched).toBe(0);
    expect(selectTasks(s, { ...FILTER, sourceStatus: "COMPLETED" }).matched).toBe(1);
    expect(selectTasks(s, { ...FILTER, sourceTag: "file" }).matched).toBe(1);
    expect(selectTasks(s, { ...FILTER, sourceTag: "invoice" }).matched).toBe(0);
  });

  it("drains oldest first", () => {
    // A backlog drained newest-first starves whatever was raised at the
    // start of a big batch — which is the batch this exists to serve.
    const s = state({
      tasks: [
        task({ id: "new", createdAt: "2026-10-01T12:00:00.000Z" }),
        task({ id: "old", createdAt: "2026-10-01T08:00:00.000Z" }),
      ],
    });
    expect(selectTasks(s, FILTER).tasks[0].taskId).toBe("old");
  });

  it("reports how many matched, not only how many it handed out", () => {
    // How a flow knows whether to keep going.
    const s = state({
      tasks: [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })],
    });
    const result = selectTasks(s, FILTER);
    expect(result.tasks).toHaveLength(1);
    expect(result.matched).toBe(3);
  });

  it("refuses a task whose source was folded into another", () => {
    // Acting on it would write to a tombstone rather than to the record
    // that absorbed it.
    const s = state({ sources: [source({ mergedInto: "s2" })] });
    const result = selectTasks(s, FILTER);
    expect(result.tasks).toEqual([]);
    expect(result.unresolved).toBe(1);
  });

  it("refuses a task whose source is gone entirely", () => {
    const result = selectTasks(state({ sources: [] }), FILTER);
    expect(result.tasks).toEqual([]);
    expect(result.unresolved).toBe(1);
  });

  it("keeps a task about the batch when no source property is asked for", () => {
    const s = state({ tasks: [task({ source: null })] });
    expect(selectTasks(s, FILTER).tasks[0].source).toBeNull();
  });

  it("skips a task about the batch when a source property is asked for", () => {
    // It has no source, so it cannot have that status — excluding it is the
    // honest answer rather than letting it through unchecked.
    const s = state({ tasks: [task({ source: null })] });
    expect(selectTasks(s, { ...FILTER, sourceStatus: "NEW" }).matched).toBe(0);
  });

  it("finds nothing in an empty collection", () => {
    expect(selectTasks({}, FILTER).tasks).toEqual([]);
    expect(selectTasks({}, FILTER).matched).toBe(0);
  });
});

describe("claiming what was picked", () => {
  it("moves exactly the picked tasks", () => {
    const result = selectTasks(state(), FILTER);
    expect(taskStatusActions(result.tasks, "IN_PROGRESS")).toEqual([
      { type: "SET_TASK_STATUS", input: { task: "t1", status: "IN_PROGRESS" } },
    ]);
  });

  it("claims nothing when nothing was picked", () => {
    // A dispatch of zero actions is refused by the reactor piece, so an
    // empty selection must produce an empty list and be branched on.
    expect(taskStatusActions([], "IN_PROGRESS")).toEqual([]);
  });
});
