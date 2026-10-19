/**
 * The queues, and what is in them.
 *
 * A queue is the one part of the space that is discovered rather than
 * declared, so this panel shows both halves: the values, and which one the
 * walk is currently on.
 */
import type {
  OriginalSourceQueueAction,
  OsqCollection,
  OsqCursor,
} from "document-models/original-source-queue";
import {
  actions,
  isCollectionCursor,
} from "document-models/original-source-queue";
import { generateId } from "document-model";
import { useState } from "react";
import { BTN, BTN_PRIMARY, CARD, INPUT, str } from "./lib.js";

export function Queues({
  collections,
  cursors,
  status,
  dispatch,
}: {
  collections: OsqCollection[];
  cursors: OsqCursor[];
  status: string;
  dispatch: (action: OriginalSourceQueueAction) => void;
}) {
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const isDraft = status === "DRAFT";
  const isRunning = status === "IN_PROGRESS";

  /** Where each queue's cursor currently points, if one walks it. */
  const positionOf: Record<string, number | null> = {};
  for (const cursor of cursors) {
    if (isCollectionCursor(cursor)) {
      positionOf[cursor.collection] = cursor.current ?? null;
    }
  }

  function push(collection: string) {
    const raw = (drafts[collection] ?? "").trim();
    if (raw === "") return;
    // One value per line, so a batch of discovered work can be pasted in.
    // Each line is tried as JSON first: a queue of objects is as ordinary
    // here as a queue of filenames.
    const values = raw.split("\n").map((line) => {
      const text = line.trim();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    });
    dispatch(actions.addCollectionValue({ collection, values }));
    setDrafts({ ...drafts, [collection]: "" });
  }

  return (
    <section className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Queues</h2>
        <span className="text-xs text-muted-foreground">
          {isRunning
            ? "values can be added while running"
            : isDraft
              ? "seed values now, or push them once running"
              : "read only"}
        </span>
      </div>

      {collections.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          None yet. A queue is for work discovered as you go — files found, ids
          listed — rather than a range known up front.
        </p>
      )}

      <div className="mt-2 space-y-2">
        {collections.map((collection) => {
          const at = positionOf[collection.id];
          return (
            <div
              key={collection.id}
              className="rounded-md border border-border p-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {collection.name}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {collection.values.length} value
                  {collection.values.length === 1 ? "" : "s"}
                </span>
              </div>

              {collection.values.length > 0 && (
                <ol className="mt-1 max-h-40 overflow-y-auto text-xs">
                  {collection.values.map((value, index) => (
                    <li
                      key={`${collection.id}-${String(index)}`}
                      className={`flex gap-2 rounded px-1 py-0.5 ${
                        at === index
                          ? "bg-secondary font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-right tabular-nums">
                        {index}
                      </span>
                      <span className="truncate">{str(value)}</span>
                      {at === index && (
                        <span className="ml-auto shrink-0">← here</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {isRunning && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <textarea
                    className={`${INPUT} min-h-9 flex-1`}
                    rows={1}
                    placeholder="One value per line"
                    value={drafts[collection.id] ?? ""}
                    onChange={(e) => {
                      setDrafts({
                        ...drafts,
                        [collection.id]: e.target.value,
                      });
                    }}
                  />
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    onClick={() => {
                      push(collection.id);
                    }}
                  >
                    Push
                  </button>
                  <button
                    type="button"
                    className={BTN}
                    title="Empty this queue. Any cursor over it restarts from the top, so values pushed afterwards count as new work."
                    onClick={() => {
                      dispatch(
                        actions.clearCollection({ collection: collection.id }),
                      );
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isDraft && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            New queue
            <input
              className={INPUT}
              value={newName}
              placeholder="Files"
              onChange={(e) => {
                setNewName(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={newName.trim() === ""}
            onClick={() => {
              dispatch(
                actions.createCollection({
                  id: generateId(),
                  name: newName.trim(),
                }),
              );
              setNewName("");
            }}
          >
            Add queue
          </button>
        </div>
      )}
    </section>
  );
}
