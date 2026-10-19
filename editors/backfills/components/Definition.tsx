// What a backfill walks: its loops, outermost first, and the queues the
// loops over discovered work read from. Loops can only be defined while the
// queue is a draft, matching what the reducers allow: every recorded
// position is an index into this shape, so it cannot move under a walk.
import type {
  OriginalSourceQueueDocument,
  OsqCollection,
  OsqCursor,
} from "document-models/original-source-queue";
import {
  actions,
  cursorLabel,
} from "document-models/original-source-queue";
import { generateId } from "document-model";
import { useState } from "react";
import {
  Badge,
  Button,
  Field,
  IconTile,
  Input,
  Segmented,
  Select,
  Textarea,
} from "../../sektar/kit/ui.js";
import { PaneSection } from "../../sektar/kit/workspace.js";
import {
  cursorAction,
  fromLocalInput,
  KIND,
  kindOf,
  parseValues,
  plural,
  renameBackfill,
  spanOf,
  STEP_PRESETS,
  str,
  todayIso,
  toLocalInput,
  walkedBy,
  yearsAgoIso,
  type Dispatch,
  type NewCursor,
} from "../lib.js";

export function Definition({
  doc,
  driveId,
  dispatch,
}: {
  doc: OriginalSourceQueueDocument;
  driveId: string;
  dispatch: Dispatch;
}) {
  const s = doc.state.global;
  const isDraft = s.status === "DRAFT";
  const isRunning = s.status === "IN_PROGRESS";
  const [loopsOpen, setLoopsOpen] = useState(true);
  const [queuesOpen, setQueuesOpen] = useState(true);

  return (
    <div className="sk-stack sk-stack--6 sk-backfills__definition">
      <About doc={doc} driveId={driveId} dispatch={dispatch} />

      <PaneSection
        title="Loops"
        count={s.cursors.length}
        collapsed={!loopsOpen}
        onToggle={() => setLoopsOpen((v) => !v)}
      >
        <p className="sk-small sk-text-muted">
          {isDraft
            ? "Outermost first: the last loop turns on every position, the first once per full sweep of the rest."
            : "Locked while the walk is on. Reset the backfill to change its shape."}
        </p>
        {s.cursors.length === 0 ? (
          <p className="sk-small sk-text-muted sk-mt-1">
            None yet. A backfill needs at least one loop before it can start.
          </p>
        ) : (
          <ol className="sk-backfills__loops">
            {s.cursors.map((cursor, index) => (
              <LoopRow
                key={cursor.id}
                cursor={cursor}
                index={index}
                last={index === s.cursors.length - 1}
                collections={s.collections}
                editable={isDraft}
                onMove={(by) => {
                  const order = s.cursors.map((c) => c.id);
                  const to = index + by;
                  if (to < 0 || to >= order.length) return;
                  [order[index], order[to]] = [order[to], order[index]];
                  void dispatch(actions.reorderCursors({ order }));
                }}
              />
            ))}
          </ol>
        )}
        {isDraft && (
          <AddLoop
            collections={s.collections}
            onAdd={(cursor) => void dispatch(cursorAction(cursor))}
          />
        )}
      </PaneSection>

      <PaneSection
        title="Queues"
        count={s.collections.length}
        collapsed={!queuesOpen}
        onToggle={() => setQueuesOpen((v) => !v)}
      >
        <p className="sk-small sk-text-muted">
          {isRunning
            ? "Values can be pushed while the walk is on; a loop waiting on an empty queue picks them up on its next turn."
            : isDraft
              ? "For work discovered as you go: files found, ids listed. Seed values now, or push them once walking."
              : "Read only."}
        </p>
        {s.collections.length === 0 ? (
          <p className="sk-small sk-text-muted sk-mt-1">
            None. Ranges of time and numbers are declared as loops; a queue is
            only needed for values no range can describe.
          </p>
        ) : (
          <div className="sk-stack sk-stack--3 sk-mt-1">
            {s.collections.map((collection) => (
              <QueueCard
                key={collection.id}
                collection={collection}
                cursors={s.cursors}
                running={isRunning}
                dispatch={dispatch}
              />
            ))}
          </div>
        )}
        {isDraft && (
          <AddQueue
            onAdd={(name, values) =>
              void dispatch(
                actions.createCollection({ id: generateId(), name, values }),
              )
            }
          />
        )}
      </PaneSection>
    </div>
  );
}

/* ------------------------------------------------------------- about */

function About({
  doc,
  driveId,
  dispatch,
}: {
  doc: OriginalSourceQueueDocument;
  driveId: string;
  dispatch: Dispatch;
}) {
  const s = doc.state.global;
  return (
    <div className="sk-grid sk-grid--2 sk-backfills__about">
      <Field label="Name" required>
        <Input
          defaultValue={doc.header.name}
          placeholder="Gmail since 2019"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== doc.header.name) {
              void renameBackfill(driveId, doc.header.id, name);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </Field>
      <Field label="What it backfills" hint="Shown in the list, and to whoever picks this up later.">
        <Textarea
          rows={2}
          defaultValue={s.description ?? ""}
          placeholder="Every week of the Powerhouse mailbox, newest first"
          onBlur={(e) => {
            const description = e.target.value.trim();
            if (description !== (s.description ?? "")) {
              void dispatch(
                actions.setDescription({
                  description: description || undefined,
                }),
              );
            }
          }}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------- loops */

function LoopRow({
  cursor,
  index,
  last,
  collections,
  editable,
  onMove,
}: {
  cursor: OsqCursor;
  index: number;
  last: boolean;
  collections: OsqCollection[];
  editable: boolean;
  onMove: (by: -1 | 1) => void;
}) {
  const kind = KIND[kindOf(cursor)];
  return (
    <li className="sk-backfills__loop">
      <span className="sk-backfills__depth sk-tabular" aria-label={`Depth ${String(index + 1)}`}>
        {index + 1}
      </span>
      <IconTile name={kind.icon} size="sm" />
      <div className="sk-backfills__loop-body">
        <div className="sk-row sk-row--2 sk-row--wrap">
          <span className="sk-weight-semibold">{cursorLabel(cursor)}</span>
          <Badge tone="outline">{kind.label}</Badge>
        </div>
        <div className="sk-small sk-text-secondary">
          {spanOf(cursor, collections)}
        </div>
        {cursor.description && (
          <div className="sk-caption">{cursor.description}</div>
        )}
      </div>
      <span className="sk-caption sk-tabular sk-backfills__loop-count">
        {plural(cursor.count, "position")}
      </span>
      {editable && (
        <span className="sk-row sk-row--2">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon="arrow-up-right"
            aria-label="Move outwards"
            title="Move outwards: this loop will turn less often."
            disabled={index === 0}
            onClick={() => onMove(-1)}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon="arrow-down-right"
            aria-label="Move inwards"
            title="Move inwards: this loop will turn more often."
            disabled={last}
            onClick={() => onMove(1)}
          />
        </span>
      )}
    </li>
  );
}

type Kind = "number" | "datetime" | "collection";
const KINDS: { value: Kind; label: string }[] = [
  { value: "datetime", label: "Time" },
  { value: "number", label: "Numbers" },
  { value: "collection", label: "Queue" },
];

function AddLoop({
  collections,
  onAdd,
}: {
  collections: OsqCollection[];
  onAdd: (cursor: NewCursor) => void;
}) {
  const [kind, setKind] = useState<Kind>("datetime");
  const [name, setName] = useState("");
  const [from, setFrom] = useState(() => toLocalInput(todayIso()));
  const [to, setTo] = useState(() => toLocalInput(yearsAgoIso(1)));
  const [delta, setDelta] = useState(String(86400 * 7));
  const [first, setFirst] = useState("1");
  const [last, setLast] = useState("50");
  const [step, setStep] = useState("1");
  const [collection, setCollection] = useState("");

  const reading = (): NewCursor | null => {
    if (kind === "collection") {
      return collection ? { kind, name, collection } : null;
    }
    if (kind === "datetime") {
      const a = fromLocalInput(from);
      const b = fromLocalInput(to);
      const d = Number(delta);
      return a && b && a !== b && d > 0
        ? { kind, name, first: a, last: b, deltaSeconds: d }
        : null;
    }
    const a = Number(first);
    const b = Number(last);
    const c = Number(step);
    return Number.isFinite(a) && Number.isFinite(b) && c > 0
      ? { kind, name, first: a, last: b, step: c }
      : null;
  };
  const ready = reading();

  return (
    <div className="sk-backfills__form sk-stack sk-stack--3">
      <div className="sk-row sk-row--between sk-row--wrap">
        <span className="sk-eyebrow">Add a loop</span>
        <Segmented value={kind} options={KINDS} onChange={setKind} />
      </div>
      <div className="sk-grid sk-grid--4 sk-backfills__fields">
        <Field label="Name">
          <Input
            value={name}
            placeholder={kind === "datetime" ? "Week" : kind === "number" ? "Page" : "Label"}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {kind === "datetime" && (
          <>
            <Field label="From">
              <Input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="To">
              <Input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <Field label="Step">
              <Select value={delta} onChange={(e) => setDelta(e.target.value)}>
                {STEP_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {kind === "number" && (
          <>
            <Field label="From">
              <Input type="number" value={first} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="number" value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
            <Field label="Step">
              <Input type="number" min={1} value={step} onChange={(e) => setStep(e.target.value)} />
            </Field>
          </>
        )}
        {kind === "collection" && (
          <Field label="Queue" hint={collections.length === 0 ? "Add a queue below first." : undefined}>
            <Select value={collection} onChange={(e) => setCollection(e.target.value)}>
              <option value="">Choose…</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="sk-row sk-row--between sk-row--wrap">
        {kind === "collection" ? (
          <span className="sk-caption">
            Walks every value of the queue, including ones pushed later.
          </span>
        ) : (
          <span className="sk-caption">
            Put the later bound in <em>From</em> to walk backwards, newest
            first, which is what a backfill usually wants. The step is a size
            either way.
          </span>
        )}
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          disabled={!ready}
          onClick={() => {
            if (!ready) return;
            onAdd(ready);
            setName("");
          }}
        >
          Add loop
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- queues */

function QueueCard({
  collection,
  cursors,
  running,
  dispatch,
}: {
  collection: OsqCollection;
  cursors: OsqCursor[];
  running: boolean;
  dispatch: Dispatch;
}) {
  const [draft, setDraft] = useState("");
  const walker = walkedBy(collection, cursors);
  const at = walker?.current ?? null;
  const preview = collection.values.slice(0, 6);
  const push = () => {
    const values = parseValues(draft);
    if (values.length === 0) return;
    void dispatch(
      actions.addCollectionValue({ collection: collection.id, values }),
    );
    setDraft("");
  };
  return (
    <div className="sk-card sk-card--subtle sk-card--compact sk-backfills__queue">
      <div className="sk-row sk-row--between sk-row--wrap">
        <span className="sk-weight-semibold">{collection.name}</span>
        <span className="sk-caption sk-tabular">
          {plural(collection.values.length, "value")}
        </span>
      </div>
      <div className="sk-caption">
        {walker
          ? `Walked by the loop "${cursorLabel(walker)}"`
          : "No loop walks this queue yet"}
      </div>
      {preview.length > 0 && (
        <ol className="sk-backfills__values">
          {preview.map((value, index) => (
            <li
              key={`${collection.id}-${String(index)}`}
              className={at === index ? "is-current" : undefined}
            >
              <span className="sk-tabular sk-text-muted">{index}</span>
              <span className="sk-backfills__value">{str(value)}</span>
              {at === index && <Badge tone="mint">here</Badge>}
            </li>
          ))}
          {collection.values.length > preview.length && (
            <li className="sk-caption">
              and {collection.values.length - preview.length} more
            </li>
          )}
        </ol>
      )}
      {running && (
        <div className="sk-stack sk-stack--2 sk-mt-1">
          <Textarea
            rows={2}
            placeholder="One value per line; JSON is kept as JSON"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="sk-row sk-row--2 sk-row--end">
            <Button
              variant="ghost"
              size="sm"
              title="Empty this queue. A loop over it restarts from the top, so values pushed afterwards count as new work."
              onClick={() =>
                void dispatch(
                  actions.clearCollection({ collection: collection.id }),
                )
              }
            >
              Clear
            </Button>
            <Button variant="secondary" size="sm" icon="upload" disabled={draft.trim() === ""} onClick={push}>
              Push values
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddQueue({
  onAdd,
}: {
  onAdd: (name: string, values: unknown[]) => void;
}) {
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  return (
    <div className="sk-backfills__form sk-stack sk-stack--3">
      <span className="sk-eyebrow">Add a queue</span>
      <div className="sk-grid sk-grid--2 sk-backfills__fields">
        <Field label="Name">
          <Input
            value={name}
            placeholder="Labels"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Seed values" hint="Optional. One per line.">
          <Textarea
            rows={2}
            value={seed}
            placeholder={"INBOX\nSENT"}
            onChange={(e) => setSeed(e.target.value)}
          />
        </Field>
      </div>
      <div className="sk-row sk-row--end">
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          disabled={name.trim() === ""}
          onClick={() => {
            onAdd(name.trim(), parseValues(seed));
            setName("");
            setSeed("");
          }}
        >
          Add queue
        </Button>
      </div>
    </div>
  );
}
