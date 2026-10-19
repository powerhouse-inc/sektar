/**
 * One source, at full width.
 *
 * The list is dense on purpose, so this is the opposite: room to read the
 * thing. The payload especially — it is the reason the collection exists,
 * and squinting at it in a 0.7rem box would make the whole model pointless.
 */
import type {
  OriginalSource,
  OriginalSourceCollectionAction,
  OscAttachment,
  ProcessingTask,
} from "document-models/original-source-collection";
import { actions } from "document-models/original-source-collection";
import { generateId } from "document-model";
import { useState } from "react";
import {
  BTN,
  EMOJI_FONT,
  INPUT,
  PAPERCLIP,
  PILL,
  TASK_PILL,
  bytes,
  instant,
  pretty,
  systemOf,
} from "./lib.js";

const STATUSES = ["NEW", "PROCESSING", "COMPLETED", "DISCARDED"] as const;

export function SourceDetail({
  source,
  tasks,
  selectedRef,
  onPickAttachment,
  onPickSource,
  dispatch,
}: {
  source: OriginalSource;
  tasks: ProcessingTask[];
  selectedRef: string | null;
  onPickAttachment: (file: OscAttachment) => void;
  onPickSource: (id: string) => void;
  dispatch: (action: OriginalSourceCollectionAction) => void;
}) {
  const [tag, setTag] = useState("");
  const [task, setTask] = useState("");
  const [tab, setTab] = useState<"content" | "payload">("content");

  const hasContent = Boolean(source.content);
  const hasPayload = source.payload !== null && source.payload !== undefined;
  // Derived rather than reset on selection: a source with no content should
  // not leave the pane showing an empty Content tab just because the last
  // one had some.
  const shown: "content" | "payload" =
    tab === "payload"
      ? hasPayload
        ? "payload"
        : "content"
      : hasContent
        ? "content"
        : "payload";
  const merged = Boolean(source.mergedInto);
  const mine = tasks.filter((t) => t.source === source.id);

  return (
    /*
     * A column, not a scrolling block.
     *
     * Everything above the body is its natural height and scrolls if it has
     * to; the body takes whatever is left and scrolls inside that. A record
     * is mostly its content, so the content is what should get the room —
     * capping it and leaving the space below empty is backwards.
     */
    <div className="mx-auto flex h-full min-h-0 max-w-3xl flex-col p-6">
      <div className="min-h-0 shrink space-y-5 overflow-y-auto">
        <header className="space-y-2">
        {/* Status leads the line: it is the thing you change most often, and
            a fixed width keeps the title starting in the same place as you
            move down the list. */}
        <div className="flex items-center gap-2">
          <select
            className={`${INPUT} w-36 shrink-0`}
            value={source.status}
            disabled={merged}
            title={
              merged
                ? "Folded into another source, so its status records the merge. Split it first."
                : undefined
            }
            onChange={(e) => {
              dispatch(
                actions.setSourceStatus({
                  source: source.id,
                  status: e.target.value as OriginalSource["status"],
                }),
              );
            }}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>

          <input
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold text-foreground hover:border-border focus:border-border focus:outline-none"
            defaultValue={source.title ?? ""}
            placeholder={source.externalId}
            key={`title-${source.id}`}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title !== (source.title ?? "")) {
                dispatch(
                  actions.setSourceTitle({
                    source: source.id,
                    title: title || undefined,
                  }),
                );
              }
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {source.tags.map((value) => (
            <button
              key={value}
              type="button"
              className={`${PILL} bg-secondary text-secondary-foreground hover:line-through`}
              title="Remove this tag"
              onClick={() => {
                dispatch(
                  actions.untagSource({ source: source.id, tags: [value] }),
                );
              }}
            >
              {value}
            </button>
          ))}
          <input
            className={`${INPUT} w-32 text-xs`}
            placeholder="add a tag"
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || tag.trim() === "") return;
              dispatch(
                actions.tagSource({ source: source.id, tags: [tag.trim()] }),
              );
              setTag("");
            }}
          />
        </div>
      </header>

      {/* The merge, from whichever end you are standing on. */}
      {merged && (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Folded into{" "}
          <button
            type="button"
            className="font-mono underline"
            onClick={() => {
              onPickSource(source.mergedInto as string);
            }}
          >
            {source.mergedInto}
          </button>{" "}
          on {instant(source.mergedAt)}. Its payload and files are still here —
          only the identity moved.
          <button
            type="button"
            className={`${BTN} ml-2`}
            onClick={() => {
              dispatch(actions.splitSource({ source: source.id }));
            }}
          >
            Split
          </button>
        </p>
      )}
      {source.mergedFrom.length > 0 && (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          Absorbed{" "}
          {source.mergedFrom.map((id, index) => (
            <span key={id}>
              {index > 0 ? ", " : ""}
              <button
                type="button"
                className="font-mono underline"
                onClick={() => {
                  onPickSource(id);
                }}
              >
                {id}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Known as
        </h3>
        <ul className="space-y-0.5">
          {[source.externalId, ...source.aliases].map((identifier, index) => (
            <li key={identifier} className="flex items-baseline gap-2 text-sm">
              <span className={`${PILL} bg-secondary text-secondary-foreground`}>
                {systemOf(identifier)}
              </span>
              <span className="break-all font-mono text-foreground">
                {identifier}
              </span>
              {index === 0 ? (
                <span className="text-xs text-muted-foreground">canonical</span>
              ) : (
                <button
                  type="button"
                  className={`${BTN} ml-auto`}
                  title="This source no longer answers to this identifier"
                  onClick={() => {
                    dispatch(
                      actions.removeAlias({
                        source: source.id,
                        alias: identifier,
                      }),
                    );
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">First captured</span>
        <span className="tabular-nums text-foreground">
          {instant(source.capturedAt)}
        </span>
        {source.lastSeenAt !== source.capturedAt && (
          <>
            <span className="text-muted-foreground">Last seen</span>
            <span className="tabular-nums text-foreground">
              {instant(source.lastSeenAt)}
            </span>
          </>
        )}
        {source.occurredAt && (
          <>
            <span className="text-muted-foreground">Happened</span>
            <span className="tabular-nums text-foreground">
              {instant(source.occurredAt)}
            </span>
          </>
        )}
        {source.origin && (
          <>
            <span className="text-muted-foreground">Origin</span>
            <a
              className="truncate text-foreground underline"
              href={source.origin}
              target="_blank"
              rel="noreferrer"
            >
              {source.origin}
            </a>
          </>
        )}
        {source.references.map((reference, index) => (
          <>
            <span key={`k-${reference}`} className="text-muted-foreground">
              {index === 0 ? "References" : ""}
            </span>
            <a
              key={reference}
              className="truncate text-foreground underline"
              href={reference}
              target="_blank"
              rel="noreferrer"
            >
              {reference}
            </a>
          </>
        ))}
      </section>

      {source.attachments.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Files
          </h3>
          <ul className="space-y-1">
            {source.attachments.map((file) => (
              <li key={file.ref}>
                <button
                  type="button"
                  className={`flex w-full items-baseline gap-2 rounded-md border px-3 py-2 text-left hover:bg-secondary/50 ${selectedRef === file.ref ? "border-blue-600 bg-secondary" : "border-border"}`}
                  onClick={() => {
                    onPickAttachment(file);
                  }}
                >
                  <span className="truncate text-sm text-foreground">
                    <span style={{ fontFamily: EMOJI_FONT }}>
                      {PAPERCLIP}
                    </span>{" "}
                    {file.fileName}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {[file.mimeType, bytes(file.sizeBytes)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tasks on this source
        </h3>
        {mine.length === 0 && (
          <p className="text-sm text-muted-foreground">None.</p>
        )}
        <ul className="space-y-1">
          {mine.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline gap-2 text-sm text-foreground"
            >
              <span className={`${PILL} ${TASK_PILL[item.status]}`}>
                {item.status.replace("_", " ").toLowerCase()}
              </span>
              {item.description ?? "(no description)"}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-1">
          <input
            className={`${INPUT} flex-1`}
            placeholder="Raise a task about this source"
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
            }}
          />
          <button
            type="button"
            className={BTN}
            disabled={task.trim() === ""}
            onClick={() => {
              dispatch(
                actions.createTask({
                  id: generateId(),
                  description: task.trim(),
                  source: source.id,
                  createdAt: new Date().toISOString(),
                }),
              );
              setTask("");
            }}
          >
            Raise
          </button>
        </div>
        </section>
      </div>

      {/* One region, two views of the same thing: what a person reads, and
          what actually arrived. Tabs rather than two stacked panels because
          a long body would otherwise bury the payload entirely. */}
      {(hasContent || hasPayload) && (
        <section className="mt-5 flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 gap-1 border-b border-border">
            {hasContent && (
              <button
                type="button"
                className={
                  "px-3 py-1.5 text-xs " +
                  (shown === "content"
                    ? "border-b-2 border-blue-500 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
                onClick={() => {
                  setTab("content");
                }}
              >
                Content
              </button>
            )}
            {hasPayload && (
              <button
                type="button"
                className={
                  "px-3 py-1.5 text-xs " +
                  (shown === "payload"
                    ? "border-b-2 border-blue-500 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
                onClick={() => {
                  setTab("payload");
                }}
              >
                Payload, as received
              </button>
            )}
          </div>

          {/* Fills what the column has left and scrolls inside it, so the
              tabs stay in reach of a body running to several screens and a
              short one does not leave the pane half empty.

              `scrollbar-gutter: stable` on both panels reserves the track
              whether or not it is needed. Without it, switching from a long
              body to a short payload removes the scrollbar and the text
              jumps sideways by its width. */}
          {shown === "content" && source.content && (
            <p className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {source.content}
            </p>
          )}
          {shown === "payload" && hasPayload && (
            <pre className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
              {pretty(source.payload)}
            </pre>
          )}
        </section>
      )}

    </div>
  );
}
