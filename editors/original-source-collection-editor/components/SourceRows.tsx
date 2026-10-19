/**
 * The left column: what arrived, and what a person still owes it.
 *
 * Two sections, each collapsible, sharing the column's height. One is always
 * open — collapsing the last open section opens the other instead, because a
 * column with nothing in it is not a state anyone wants to land in.
 *
 * Folded sources are shown as children of whatever absorbed them, not as
 * rows of their own. They carry status DISCARDED, but so does something a
 * person deliberately threw away — listing them together would conflate "I
 * decided to ignore this" with "this turned out to be the same object", and
 * only one of those is a judgement anyone made.
 *
 * Rows are deliberately dense. Triage is reading forty of these, not one.
 */
import type {
  OriginalSource,
  OriginalSourceCollectionAction,
  ProcessingTask,
} from "document-models/original-source-collection";
import { actions } from "document-models/original-source-collection";
import { generateId } from "document-model";
import { useRef, useState } from "react";
import {
  DOT,
  EMOJI_FONT,
  INPUT,
  PAPERCLIP,
  ROW_HOVER,
  ROW_SELECTED,
  STATUS_DOT,
  TASK_DOT,
  rowDate,
} from "./lib.js";

/**
 * Lifecycle order, which puts the settled states last without needing a
 * separate rule for "done". Both lists are grouped by it: a column sorted by
 * date buries the one NEW thing under thirty completed ones.
 */
const STATUSES = ["NEW", "PROCESSING", "COMPLETED", "DISCARDED"] as const;
const TASK_STATUSES = [
  "DRAFT",
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

const MIN_TASKS_HEIGHT = 96;

/** Items under their status, in lifecycle order, skipping empty groups. */
function grouped<T extends { status: string }>(
  items: T[],
  order: readonly string[],
): { status: string; items: T[] }[] {
  return order
    .map((status) => ({
      status,
      items: items.filter((item) => item.status === status),
    }))
    .filter((group) => group.items.length > 0);
}

function GroupHeading({ status, count }: { status: string; count: number }) {
  return (
    // Sticky, so you always know which group you are scrolling through.
    // Deliberately quiet: the colour that matters is on the rows.
    <li className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-border bg-card px-3 py-0.5">
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {status.replace("_", " ").toLowerCase()}
      </span>
      <span className="text-[0.65rem] tabular-nums text-muted-foreground">
        {count}
      </span>
    </li>
  );
}

/** One collapsible section's header. Big enough to be an obvious target. */
function SectionHeader({
  label,
  detail,
  open,
  onToggle,
}: {
  label: string;
  detail: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3 text-left hover:bg-secondary/50"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {/* Plain, not a badge: the only colour in this column is the status
          dot on each row, which is what a long list is scanned by. */}
      <span className="text-xs tabular-nums text-muted-foreground">
        {detail}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">
        {open ? "▾" : "▸"}
      </span>
    </button>
  );
}

export function SourceRows({
  sources,
  tasks,
  selectedSource,
  selectedTask,
  onPickSource,
  onPickTask,
  dispatch,
}: {
  sources: OriginalSource[];
  tasks: ProcessingTask[];
  selectedSource: string | null;
  selectedTask: string | null;
  onPickSource: (id: string) => void;
  onPickTask: (id: string) => void;
  dispatch: (actions: OriginalSourceCollectionAction[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [expanded, setExpanded] = useState<string[]>([]);

  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [tasksHeight, setTasksHeight] = useState(220);

  const columnRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  /**
   * Collapsing the only open section opens the other one.
   *
   * Both closed is a column showing nothing but two headers, which is never
   * what someone meant by collapsing the one they were not using.
   */
  function toggleSources() {
    if (!sourcesOpen) {
      setSourcesOpen(true);
      return;
    }
    setSourcesOpen(false);
    if (!tasksOpen) setTasksOpen(true);
  }

  function toggleTasks() {
    if (!tasksOpen) {
      setTasksOpen(true);
      return;
    }
    setTasksOpen(false);
    if (!sourcesOpen) setSourcesOpen(true);
  }

  /** Keep the handle inside what the column can actually give it. */
  function clampHeight(value: number): number {
    const available = columnRef.current?.clientHeight ?? 600;
    return Math.max(MIN_TASKS_HEIGHT, Math.min(value, available - 160));
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    drag.current = { startY: event.clientY, startHeight: tasksHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDrag(event: React.PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    if (!from) return;
    // The handle sets the distance from the BOTTOM, so dragging up grows the
    // section: the delta is inverted relative to the pointer.
    setTasksHeight(
      clampHeight(from.startHeight + (from.startY - event.clientY)),
    );
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const tags = [...new Set(sources.flatMap((s) => s.tags))].sort();
  const needle = search.trim().toLowerCase();

  const matches = (source: OriginalSource) => {
    if (!needle) return true;
    return [source.title, source.externalId, ...source.aliases, source.content]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(needle));
  };

  const childrenOf = (id: string) =>
    sources.filter((source) => source.mergedInto === id);

  const live = sources.filter((source) => !source.mergedInto);
  const shown = live.filter((source) => {
    if (status !== "all" && source.status !== status) return false;
    if (tag !== "all" && !source.tags.includes(tag)) return false;
    // A search that hits a folded child still finds its parent, or the child
    // would be unreachable by the identifier it is filed under.
    return matches(source) || childrenOf(source.id).some(matches);
  });

  const foldedCount = sources.length - live.length;
  const openTasks = tasks.filter(
    (task) => task.status !== "DONE" && task.status !== "CANCELLED",
  ).length;

  // Only resizable when both sections are sharing the column. With sources
  // collapsed the tasks list already fills it, so a handle would move
  // nothing.
  const resizable = tasksOpen && sourcesOpen;

  return (
    <div ref={columnRef} className="flex h-full min-h-0 w-full flex-col">
      <SectionHeader
        label="Sources"
        detail={
          (shown.length === live.length
            ? String(live.length)
            : `${String(shown.length)} of ${String(live.length)}`) +
          (foldedCount > 0 ? ` · ${String(foldedCount)} folded in` : "")
        }
        open={sourcesOpen}
        onToggle={toggleSources}
      />

      {sourcesOpen && (
        <>
          <div className="shrink-0 space-y-1 border-b border-border px-3 py-2">
            <input
              className={`${INPUT} w-full text-xs`}
              type="search"
              placeholder="Search title, identifier, content"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
            <div className="flex gap-1">
              <select
                className={`${INPUT} flex-1 text-xs`}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                }}
              >
                <option value="all">Any status</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase()}
                  </option>
                ))}
              </select>
              {tags.length > 0 && (
                <select
                  className={`${INPUT} flex-1 text-xs`}
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value);
                  }}
                >
                  <option value="all">Any tag</option>
                  {tags.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {shown.length === 0 && (
              <li className="p-4 text-xs text-muted-foreground">
                {sources.length === 0
                  ? "Nothing captured yet. A flow writes here as it walks a queue."
                  : "Nothing matches that filter."}
              </li>
            )}
            {grouped(shown, STATUSES).map((group) => (
              <li key={group.status}>
                <ul>
                  <GroupHeading
                    status={group.status}
                    count={group.items.length}
                  />
                  {group.items.map((source) => {
                    const children = childrenOf(source.id);
                    // Expanded by hand, or forced open because the search
                    // found something only a child answers to.
                    const open =
                      expanded.includes(source.id) ||
                      (needle !== "" && !matches(source));
                    return (
                      <li key={source.id}>
                        <div
                          className={
                            `flex w-full items-start border-b border-border ${ROW_HOVER} ` +
                            (selectedSource === source.id ? ROW_SELECTED : "")
                          }
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 px-3 py-2 text-left"
                            onClick={() => {
                              onPickSource(source.id);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`${DOT} ${STATUS_DOT[source.status]}`}
                                title={source.status.toLowerCase()}
                              />
                              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                {source.title ?? source.externalId}
                              </p>
                              <span
                                className="shrink-0 text-[0.7rem] tabular-nums text-muted-foreground"
                                title={rowDate(source).title}
                              >
                                {rowDate(source).text}
                              </span>
                            </div>
                            <p className="truncate pl-4 text-[0.7rem] text-muted-foreground">
                              {source.attachments.length > 0 && (
                                <span className="mr-1">
                                  <span style={{ fontFamily: EMOJI_FONT }}>
                                    {PAPERCLIP}
                                  </span>{" "}
                                  {source.attachments.length}
                                </span>
                              )}
                              {source.tags.join(" · ") || source.externalId}
                            </p>
                          </button>

                          {children.length > 0 && (
                            <button
                              type="button"
                              className="shrink-0 px-2 py-2 text-[0.7rem] text-muted-foreground hover:text-foreground"
                              title={`${String(children.length)} source${children.length === 1 ? "" : "s"} folded into this one`}
                              onClick={() => {
                                setExpanded(
                                  expanded.includes(source.id)
                                    ? expanded.filter((id) => id !== source.id)
                                    : [...expanded, source.id],
                                );
                              }}
                            >
                              {open ? "▾" : "▸"} {children.length}
                            </button>
                          )}
                        </div>

                        {open && children.length > 0 && (
                          <ul className="border-b border-border bg-secondary/20">
                            {children.map((child) => (
                              <li key={child.id}>
                                <button
                                  type="button"
                                  className={
                                    `flex w-full items-baseline gap-2 border-l-2 border-border py-1.5 pl-6 pr-3 text-left ${ROW_HOVER} ` +
                                    (selectedSource === child.id
                                      ? ROW_SELECTED
                                      : "")
                                  }
                                  onClick={() => {
                                    onPickSource(child.id);
                                  }}
                                >
                                  <span
                                    className={`${DOT} ${STATUS_DOT.DISCARDED}`}
                                  />
                                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                    {child.title ?? child.externalId}
                                  </span>
                                  <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                                    folded in
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {resizable && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the task list"
          tabIndex={0}
          className="group h-2 shrink-0 cursor-row-resize border-t border-border bg-card hover:bg-secondary focus:bg-secondary focus:outline-none"
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            // Not mouse-only: the same grab, one row at a time.
            if (e.key === "ArrowUp") setTasksHeight(clampHeight(tasksHeight + 24));
            else if (e.key === "ArrowDown")
              setTasksHeight(clampHeight(tasksHeight - 24));
            else return;
            e.preventDefault();
          }}
        >
          <div className="mx-auto h-0.5 w-8 translate-y-[3px] rounded-full bg-border group-hover:bg-muted-foreground" />
        </div>
      )}

      <SectionHeader
        label="Tasks"
        detail={openTasks > 0 ? `${String(openTasks)} open` : "none open"}
        open={tasksOpen}
        onToggle={toggleTasks}
      />

      {tasksOpen && (
        <ul
          className={
            sourcesOpen
              ? "shrink-0 overflow-y-auto"
              : "min-h-0 flex-1 overflow-y-auto"
          }
          style={sourcesOpen ? { height: tasksHeight } : undefined}
        >
          {tasks.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              None. Raise one from a source that needs a human.
            </li>
          )}
          {grouped(tasks, TASK_STATUSES).map((group) => (
            <li key={group.status}>
              <ul>
                <GroupHeading
                  status={group.status}
                  count={group.items.length}
                />
                {group.items.map((task) => {
                  const done =
                    task.status === "DONE" || task.status === "CANCELLED";
                  const about = task.source
                    ? (sources.find((s) => s.id === task.source)?.title ??
                      task.source)
                    : "about the batch";
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        className={
                          `w-full border-b border-border px-3 py-1.5 text-left ${ROW_HOVER} ` +
                          (selectedTask === task.id ? `${ROW_SELECTED} ` : "") +
                          (done ? "opacity-60" : "")
                        }
                        onClick={() => {
                          onPickTask(task.id);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`${DOT} ${TASK_DOT[task.status]}`}
                            title={task.status.replace("_", " ").toLowerCase()}
                          />
                          <p className="min-w-0 flex-1 truncate text-xs text-foreground">
                            {task.description ?? "(no description)"}
                          </p>
                          {task.owner && (
                            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                              {task.owner}
                            </span>
                          )}
                        </div>
                        <p className="truncate pl-4 text-[0.7rem] text-muted-foreground">
                          {about}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {tasksOpen && (
        <BatchTasks
          count={shown.length}
          onCreate={(description, owner) => {
            // One action per source, dispatched together. The filter above is
            // the selection — whatever is on screen is what gets a task — so
            // the count is in the button rather than in a confirmation,
            // because the number IS the thing to check before clicking.
            const createdAt = new Date().toISOString();
            dispatch(
              shown.map((source) =>
                actions.createTask({
                  id: generateId(),
                  description,
                  owner: owner || undefined,
                  source: source.id,
                  status: "TODO",
                  createdAt,
                }),
              ),
            );
          }}
        />
      )}
    </div>
  );
}

/**
 * Raising the same task against everything currently filtered.
 *
 * The point is unattended work: filter a collection down to the sources that
 * need something, name the thing and who does it, and leave a queue an agent
 * can drain. A task carries an owner and a description, and both are what a
 * workflow selects on, so this is the step where a human decides the scope
 * and hands it over.
 */
function BatchTasks({
  count,
  onCreate,
}: {
  count: number;
  onCreate: (description: string, owner: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");

  const described = description.trim();
  const ready = count > 0 && described !== "";

  return (
    <div className="shrink-0 border-t border-border bg-muted/30 p-2">
      <div className="mb-1.5 flex gap-1.5">
        <input
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          placeholder="What needs doing — e.g. download file"
          className={`${INPUT} min-w-0 flex-1 text-xs`}
        />
        <input
          value={owner}
          onChange={(event) => {
            setOwner(event.target.value);
          }}
          placeholder="Owner — e.g. dropbox-dl-agent"
          className={`${INPUT} w-40 shrink-0 text-xs`}
        />
      </div>
      <button
        type="button"
        disabled={!ready}
        title={
          count === 0
            ? "Nothing matches the filter above"
            : described === ""
              ? "Describe what needs doing first"
              : `Raises ${String(count)} tasks, one per source shown above`
        }
        onClick={() => {
          onCreate(described, owner.trim());
          // The description is the one thing that changes per batch; the
          // owner is usually the same agent twice running, so it stays.
          setDescription("");
        }}
        className={
          "w-full rounded px-2 py-1.5 text-xs font-medium " +
          (ready
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "cursor-not-allowed bg-muted text-muted-foreground")
        }
      >
        {count === 0
          ? "No sources match the filter"
          : `Create task for ${String(count)} source${count === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
