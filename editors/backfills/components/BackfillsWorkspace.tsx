// The Backfills workspace: the design system's panes pattern. Four panes —
// the status chooser (a level-0 parent, visible only when stacked), the list
// of backfills, the definition of the one picked, and its walk — side by
// side on a wide screen and one at a time under 800px of workspace width, as
// a push navigation. The top bar's search filters the list; the status
// selector is a second top-bar row wide, and the list's title is the switch
// to the chooser when stacked.
//
// The list, its counts and the picked one's head come from the integration
// index (the queues' rows); only the backfill picked is loaded as a
// document, for the definition and walk panes that edit it.
import {
  isFileNodeKind,
  useDocumentSafe,
  useSelectedDrive,
  useSelectedNode,
} from "@powerhousedao/reactor-browser";
import {
  isOriginalSourceQueueDocument,
  type OriginalSourceQueueDocument,
} from "document-models/original-source-queue";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useQueueRows,
  type QueueListRow,
} from "../../sektar/kit/integration-index.js";
import { Menu } from "../../sektar/kit/menu.js";
import { useSearch } from "../../sektar/kit/search-context.js";
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Modal,
  More,
  Selector,
  type IconName,
} from "../../sektar/kit/ui.js";
import {
  Pane,
  PaneSwitch,
  SubBar,
  Workspace,
} from "../../sektar/kit/workspace.js";
import {
  createBackfill,
  deleteBackfill,
  dispatcherFor,
  matchesQueue,
  OSQ_TYPE,
  sortQueues,
  STATUS,
  STATUS_ORDER,
  statusOf,
  type Filter,
} from "../lib.js";
import { Definition } from "./Definition.js";
import { useFillHeight, useNarrow } from "./measure.js";
import { NewBackfill } from "./NewBackfill.js";
import { QueueRow } from "./QueueRow.js";
import { Walk } from "./Walk.js";

/** Which level a stacked workspace shows: 0 chooser · 1 list · 2 definition · 3 walk */
type Level = 0 | 1 | 2 | 3;

// The status tabs wear the same icons as the rows they filter.
const ALL_ICON: IconName = "download";

export function BackfillsWorkspace() {
  const [drive] = useSelectedDrive();
  const node = useSelectedNode();
  const queues = useQueueRows(null, drive);
  const { query } = useSearch();

  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>(1);
  const [listCollapsed, setListCollapsed] = useState(false);
  // The walk pane: null means "decide for me" — collapsed while the
  // workspace is too narrow for three readable panes; a toggle makes the
  // choice explicit.
  const [walkPref, setWalkPref] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A queue opened by URL (/d/backfills/<node>) is the selection.
  useEffect(() => {
    if (node && isFileNodeKind(node) && node.documentType === OSQ_TYPE) {
      setSelectedId(node.id);
      setLevel(2);
    }
  }, [node]);

  const sorted = useMemo(() => sortQueues(queues ?? []), [queues]);
  const counts = useMemo(() => {
    const by: Record<Filter, number> = {
      all: sorted.length,
      IN_PROGRESS: 0,
      PAUSED: 0,
      DRAFT: 0,
      FINISHED: 0,
    };
    for (const row of sorted) by[statusOf(row)] += 1;
    return by;
  }, [sorted]);
  const visible = useMemo(
    () =>
      sorted.filter(
        (row) =>
          (filter === "all" || statusOf(row) === filter) &&
          matchesQueue(query, row),
      ),
    [sorted, filter, query],
  );

  const selected: QueueListRow | undefined = sorted.find(
    (r) => r.id === selectedId,
  );
  const dispatch = useMemo(
    () => (selectedId ? dispatcherFor(selectedId) : undefined),
    [selectedId],
  );

  const pick = (row: QueueListRow) => {
    setSelectedId(row.id);
    setLevel(2);
  };

  const filterLabel = filter === "all" ? "All backfills" : STATUS[filter].label;
  const filterOptions = [
    {
      value: "all" as Filter,
      name: "All backfills",
      meta: `${String(counts.all)} in the drive`,
      icon: ALL_ICON,
    },
    ...STATUS_ORDER.map((status) => ({
      value: status as Filter,
      name: STATUS[status].label,
      meta: String(counts[status]),
      icon: STATUS[status].icon,
    })),
  ];

  const root = useRef<HTMLDivElement>(null);
  const hasQueues = sorted.length > 0;
  const height = useFillHeight(root, hasQueues);
  const narrow = useNarrow(root, 1100, hasQueues);
  const walkCollapsed = walkPref ?? narrow;

  const create = (draft: Parameters<typeof createBackfill>[1]) => {
    setBusy(true);
    setError(null);
    createBackfill(drive.header.id, draft)
      .then((id) => {
        setCreating(false);
        setSelectedId(id);
        setLevel(2);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const dialogs = (
    <>
      {creating && (
        <NewBackfill busy={busy} onCreate={create} onClose={() => setCreating(false)} />
      )}
      {confirmDelete && selected && (
        <Modal
          title="Delete this backfill?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const id = selected.id;
                  setConfirmDelete(false);
                  setSelectedId(null);
                  setLevel(1);
                  void deleteBackfill(drive.header.id, id);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p>
            <strong>{selected.name}</strong> and its position, queued
            values and failures are removed from the drive. The documents a
            workflow captured while walking it are not touched.
          </p>
        </Modal>
      )}
      {error && (
        <div className="sk-mt-4">
          <p className="sk-text-danger sk-small">{error}</p>
        </div>
      )}
    </>
  );

  if (!queues) {
    return (
      <div className="sk-page" style={{ padding: "var(--sk-space-10) var(--sk-space-6)" }}>
        <p className="sk-small sk-text-muted">Reading the backfills…</p>
      </div>
    );
  }

  if (!hasQueues) {
    return (
      <div className="sk-page" style={{ padding: "var(--sk-space-10) var(--sk-space-6)" }}>
        <div className="sk-stack sk-stack--6" style={{ maxWidth: 560, margin: "0 auto" }}>
          <EmptyState
            icon="download"
            title="No backfills yet"
            action={
              <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                New backfill
              </Button>
            }
          >
            A backfill walks a space one position at a time: every week back
            to a date, pages 1 to 50, every value of a queue. A workflow with
            the For Every trigger picks up each position in turn, and the
            backfill remembers where it got to, so it can be paused, resumed,
            and inspected while it runs.
          </EmptyState>
        </div>
        {dialogs}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="sk-backfills"
      style={{ height: height ? `${String(height)}px` : undefined }}
    >
      <SubBar className="sk-subbar--wide">
        <Selector
          value={filter}
          options={filterOptions}
          onChange={(v) => {
            setFilter(v);
            setLevel(1);
          }}
          label="Status"
        />
      </SubBar>

      <Workspace level={level} hasParent>
        <Pane parent title="Backfills" count={sorted.length} flush>
          <Selector
            value={filter}
            options={filterOptions}
            onChange={(v) => {
              setFilter(v);
              setLevel(1);
            }}
            label="Status"
            list
          />
        </Pane>

        <Pane
          side="start"
          grow={1}
          flush
          collapsed={listCollapsed}
          onToggle={() => setListCollapsed((v) => !v)}
          count={visible.length}
          header={
            <PaneSwitch
              label={filterLabel}
              ariaLabel="Choose which backfills to list"
              onClick={() => setLevel(0)}
            />
          }
          trailing={
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => setCreating(true)}
            >
              New
            </Button>
          }
        >
          {visible.length === 0 ? (
            <div style={{ padding: "var(--sk-space-6)" }}>
              <EmptyState icon="download" title="Nothing here">
                {query
                  ? "No backfill matches that search."
                  : `No ${filterLabel.toLowerCase()} right now.`}
              </EmptyState>
            </div>
          ) : (
            <ul className="sk-list sk-list--rich">
              {visible.map((row) => (
                <li key={row.id}>
                  <QueueRow
                    row={row}
                    selected={row.id === selectedId}
                    onClick={() => pick(row)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Pane>

        <Pane
          grow={1.5}
          onBack={() => setLevel(1)}
          backLabel="Back to the list"
          title={selected?.name ?? "Backfill"}
          titleDisplay
          header={
            selected && (
              <>
                <Badge tone={STATUS[statusOf(selected)].tone} dot pill>
                  {STATUS[statusOf(selected)].label}
                </Badge>
                <span className="sk-pane__spacer" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="sk-stack-only"
                  onClick={() => setLevel(3)}
                >
                  Walk
                  <Icon name="chevron-right" size={16} mono />
                </Button>
                <Menu
                  label="Backfill actions"
                  items={[
                    {
                      label: "Delete backfill",
                      icon: "close",
                      danger: true,
                      onSelect: () => setConfirmDelete(true),
                    },
                  ]}
                  trigger={(open, toggle) => (
                    <More aria-haspopup="menu" aria-expanded={open} onClick={toggle} />
                  )}
                />
              </>
            )
          }
        >
          {selectedId && dispatch ? (
            <PickedQueue
              key={selectedId}
              id={selectedId}
              fallback={<p className="sk-small sk-text-muted">Opening…</p>}
            >
              {(doc) => (
                <Definition
                  doc={doc}
                  driveId={drive.header.id}
                  dispatch={dispatch}
                />
              )}
            </PickedQueue>
          ) : (
            <EmptyState icon="download" title="Pick a backfill">
              Its loops and queues open here; the walk opens beside it.
            </EmptyState>
          )}
        </Pane>

        <Pane
          side="end"
          grow={1}
          collapsed={walkCollapsed}
          onToggle={() => setWalkPref(!walkCollapsed)}
          onBack={() => setLevel(2)}
          backLabel="Back to the definition"
          title="Walk"
        >
          {selectedId && dispatch ? (
            <PickedQueue
              key={selectedId}
              id={selectedId}
              fallback={<p className="sk-small sk-text-muted">Opening…</p>}
            >
              {(doc) => <Walk doc={doc} dispatch={dispatch} />}
            </PickedQueue>
          ) : (
            <p className="sk-small sk-text-muted">
              Position, controls, failures and memory of the backfill picked.
            </p>
          )}
        </Pane>
      </Workspace>
      {dialogs}
    </div>
  );
}

/**
 * The backfill picked, as its document: the one queue the definition and
 * walk panes edit. Read without suspending, so the list stays on screen
 * while it loads; a queue that cannot be read (just deleted) shows the
 * fallback.
 */
function PickedQueue({
  id,
  fallback,
  children,
}: {
  id: string;
  fallback: ReactNode;
  children: (doc: OriginalSourceQueueDocument) => ReactNode;
}) {
  const { data } = useDocumentSafe(id);
  if (!data || !isOriginalSourceQueueDocument(data)) return <>{fallback}</>;
  return <>{children(data)}</>;
}
