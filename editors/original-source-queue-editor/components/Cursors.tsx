/**
 * The loops, and the forms that define them.
 *
 * Editing is only offered while the queue is a draft, matching what the
 * reducers allow: the shape of the space is what every recorded position is
 * an index into, so it cannot move underneath a running walk.
 */
import type {
  OriginalSourceQueueAction,
  OsqCollection,
  OsqCursor,
} from "document-models/original-source-queue";
import {
  actions,
  cursorLabel,
  isDateTimeCursor,
  isNumberCursor,
} from "document-models/original-source-queue";
import { generateId } from "document-model";
import { useState } from "react";
import { BTN, BTN_PRIMARY, CARD, INPUT, instant } from "./lib.js";

type Kind = "number" | "datetime" | "collection";

/** A one-line account of what a cursor will walk. */
function span(cursor: OsqCursor, collections: OsqCollection[]): string {
  if (isNumberCursor(cursor)) {
    const dir = cursor.last < cursor.first ? "down to" : "to";
    return `${String(cursor.first)} ${dir} ${String(cursor.last)} by ${String(cursor.step)}`;
  }
  if (isDateTimeCursor(cursor)) {
    const dir = cursor.last < cursor.first ? "back to" : "to";
    const hours = cursor.deltaSeconds / 3600;
    const width =
      hours >= 24
        ? `${String(hours / 24)}d`
        : hours >= 1
          ? `${String(hours)}h`
          : `${String(cursor.deltaSeconds)}s`;
    return `${instant(cursor.first)} ${dir} ${instant(cursor.last)} in ${width} steps`;
  }
  const queue = collections.find((c) => c.id === cursor.collection);
  return `queue ${queue?.name ?? cursor.collection}`;
}

export function Cursors({
  cursors,
  collections,
  isDraft,
  dispatch,
}: {
  cursors: OsqCursor[];
  collections: OsqCollection[];
  isDraft: boolean;
  dispatch: (action: OriginalSourceQueueAction) => void;
}) {
  const [kind, setKind] = useState<Kind>("number");
  const [name, setName] = useState("");
  const [first, setFirst] = useState("1");
  const [last, setLast] = useState("10");
  const [step, setStep] = useState("1");
  const [collection, setCollection] = useState("");

  function move(index: number, by: -1 | 1) {
    const order = cursors.map((c) => c.id);
    const to = index + by;
    if (to < 0 || to >= order.length) return;
    [order[index], order[to]] = [order[to], order[index]];
    dispatch(actions.reorderCursors({ order }));
  }

  function add() {
    const id = generateId();
    const shared = { id, name: name.trim() || undefined };
    if (kind === "number") {
      dispatch(
        actions.createNumberCursor({
          ...shared,
          first: Number(first),
          last: Number(last),
          step: Number(step),
        }),
      );
    } else if (kind === "datetime") {
      dispatch(
        actions.createDateTimeCursor({
          ...shared,
          first: new Date(first).toISOString(),
          last: new Date(last).toISOString(),
          deltaSeconds: Number(step),
        }),
      );
    } else {
      dispatch(
        actions.createCollectionCursor({ ...shared, collection }),
      );
    }
    setName("");
  }

  const canAdd =
    kind === "collection"
      ? collection !== ""
      : first.trim() !== "" && last.trim() !== "" && Number(step) > 0;

  return (
    <section className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Cursors</h2>
        <span className="text-xs text-muted-foreground">
          {isDraft
            ? "first is the outermost loop"
            : "locked while the walk is running"}
        </span>
      </div>

      {cursors.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          None yet. A queue needs at least one cursor before it can start.
        </p>
      )}

      <ul className="mt-2 space-y-1">
        {cursors.map((cursor, index) => (
          <li
            key={cursor.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
          >
            <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-foreground">
              {cursorLabel(cursor)}
            </span>
            <span className="text-xs text-muted-foreground">
              {span(cursor, collections)}
            </span>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {cursor.count} value{cursor.count === 1 ? "" : "s"}
            </span>
            {isDraft && (
              <span className="flex gap-1">
                <button
                  type="button"
                  className={BTN}
                  disabled={index === 0}
                  title="Move outwards: this loop will turn less often."
                  onClick={() => {
                    move(index, -1);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={BTN}
                  disabled={index === cursors.length - 1}
                  title="Move inwards: this loop will turn more often."
                  onClick={() => {
                    move(index, 1);
                  }}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {isDraft && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Kind
            <select
              className={INPUT}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
              }}
            >
              <option value="number">Numbers</option>
              <option value="datetime">Time</option>
              <option value="collection">Queue</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Name
            <input
              className={INPUT}
              value={name}
              placeholder="Week"
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </label>

          {kind === "collection" ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Queue
              <select
                className={INPUT}
                value={collection}
                onChange={(e) => {
                  setCollection(e.target.value);
                }}
              >
                <option value="">Choose…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                From
                <input
                  className={INPUT}
                  type={kind === "datetime" ? "datetime-local" : "number"}
                  value={first}
                  onChange={(e) => {
                    setFirst(e.target.value);
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                To
                <input
                  className={INPUT}
                  type={kind === "datetime" ? "datetime-local" : "number"}
                  value={last}
                  onChange={(e) => {
                    setLast(e.target.value);
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {kind === "datetime" ? "Seconds per step" : "Step"}
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  value={step}
                  onChange={(e) => {
                    setStep(e.target.value);
                  }}
                />
              </label>
            </>
          )}

          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!canAdd}
            onClick={add}
          >
            Add cursor
          </button>

          {/* Direction is a property of the bounds, not a separate setting,
              and that is the least obvious thing about defining one. */}
          {kind !== "collection" && (
            <p className="w-full text-[0.7rem] text-muted-foreground">
              Put the later bound in <em>From</em> to walk backwards — newest
              first, which is usually what a backfill wants. The step is a
              magnitude either way.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
