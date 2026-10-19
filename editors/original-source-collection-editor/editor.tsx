/**
 * An inbox for captured source data.
 *
 * The job this serves is triage: scan what arrived, open one, look at its
 * attachment. That is the same job an email client does, so it gets the same
 * shape — list, record, file — full width, each pane scrolling on its own.
 *
 * Below the breakpoint the three panes stop being a layout and become
 * navigation: one at a time, with a way back. That is a real state machine,
 * not a media query, which is why `view` exists and why the breakpoint is
 * read in JavaScript.
 */
import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import {
  useSelectedOriginalSourceCollectionDocument,
  type OscAttachment,
} from "document-models/original-source-collection";
import { useEffect, useRef, useState } from "react";
import { AttachmentPane } from "./components/AttachmentPane.js";
import { CollectionInfoControl } from "./components/CollectionInfo.js";
import { SourceDetail } from "./components/SourceDetail.js";
import { SourceRows } from "./components/SourceRows.js";
import { TaskDetail } from "./components/TaskDetail.js";
import { useMediaQuery } from "./components/useMediaQuery.js";

/** What the middle pane is showing. */
type Focus = { kind: "source"; id: string } | { kind: "task"; id: string };

/** Which single pane is visible when the screen is too narrow for three. */
type View = "list" | "detail" | "preview";

export default function Editor() {
  const [document, dispatch] = useSelectedOriginalSourceCollectionDocument();
  const state = document.state.global;

  const wide = useMediaQuery("(min-width: 1024px)");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [previewOpen, setPreviewOpen] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const [offsetTop, setOffsetTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      // Only react to a real move. The height depends on this number, so
      // reacting to sub-pixel noise would be a loop rather than a layout.
      setOffsetTop((previous) =>
        Math.abs(previous - top) > 0.5 ? top : previous,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  const source =
    focus?.kind === "source"
      ? state.sources.find((s) => s.id === focus.id)
      : undefined;
  const task =
    focus?.kind === "task"
      ? state.tasks.find((t) => t.id === focus.id)
      : undefined;
  const file = source?.attachments.find((a) => a.ref === ref);

  function pickSource(id: string) {
    setFocus({ kind: "source", id });
    // Line up the record's first file so an open pane follows the selection,
    // but do NOT open the pane: only an explicit click on an attachment does
    // that. A pane that reopens itself is a pane you cannot close.
    const first = state.sources.find((s) => s.id === id)?.attachments[0];
    setRef(first?.ref ?? null);
    setView("detail");
  }

  function pickTask(id: string) {
    setFocus({ kind: "task", id });
    setRef(null);
    setView("detail");
  }

  function pickAttachment(chosen: OscAttachment) {
    setRef(chosen.ref);
    setPreviewOpen(true);
    setView("preview");
  }

  // The pane is shown whenever it is not collapsed, with or without a file.
  // Letting it appear and vanish with each selection made the whole layout
  // jump, which is worse than an empty column.
  const showPreview = previewOpen;

  const list = (
    <SourceRows
      sources={state.sources}
      tasks={state.tasks}
      selectedSource={source?.id ?? null}
      selectedTask={task?.id ?? null}
      onPickSource={pickSource}
      onPickTask={pickTask}
      dispatch={dispatch}
    />
  );

  const detail = source ? (
    <SourceDetail
      source={source}
      tasks={state.tasks}
      selectedRef={ref}
      onPickAttachment={pickAttachment}
      onPickSource={pickSource}
      dispatch={dispatch}
    />
  ) : task ? (
    <TaskDetail
      task={task}
      sources={state.sources}
      onPickSource={pickSource}
      dispatch={dispatch}
    />
  ) : (
    <p className="p-8 text-sm text-muted-foreground">
      Pick something on the left. Sources are what arrived; tasks are what is
      still owed.
    </p>
  );

  return (
    // Height is measured, not assumed, and neither `h-full` nor a guessed
    // calc would do. Connect's wrapper has `min-height: auto`, so it grows
    // to fit whatever this editor renders — which makes `h-full` circular:
    // the parent is only as tall as the content that is asking it how tall
    // it is. Measuring our own offset and clipping breaks the loop, and
    // adapts if Connect ever puts chrome above us.
    <div
      ref={rootRef}
      className="flex w-full flex-col overflow-hidden"
      style={{ height: `calc(100dvh - ${String(Math.round(offsetTop))}px)` }}
    >
      {/*
        The toolbar already names the document, so everything that was in a
        strip beneath it — title, status, counters, provenance, Abandon —
        now sits behind one control in the same bar. Each of those needed a
        sentence the strip could not give: the status is calculated and
        cannot be set, Abandon is not a delete, and "from gmail" was three
        fields flattened into two words.
      */}
      <DocumentToolbar
        // The default container draws a rounded border, which reads as a
        // panel floating on the page rather than as the top of it.
        toolbarClassName="rounded-none border-0"
        customControls={{
          third: { component: CollectionInfoControl, position: "start" },
        }}
      />

      {wide ? (
        <div className="flex min-h-0 flex-1">
          {/* Clamped rather than fixed: wide enough to read a title at
              any window size, never so wide it starves the record. */}
          <aside className="w-[clamp(20rem,22vw,30rem)] shrink-0 overflow-hidden border-r border-border">
            {list}
          </aside>
          {/* Clipped rather than scrolled: the detail pane manages its own
              height so the record it is showing can fill the column. A scroll
              container here would hand it an unbounded height instead, and
              nothing inside could then know where the bottom was. */}
          <main className="min-w-0 flex-1 overflow-hidden">{detail}</main>
          {showPreview && (
            <aside className="w-[clamp(26rem,38vw,56rem)] shrink-0 overflow-hidden border-l border-border">
              <AttachmentPane
                documentId={document.header.id}
                file={file ?? null}
                onClose={() => {
                  setPreviewOpen(false);
                }}
              />
            </aside>
          )}
          {/* A way back once it has been collapsed. */}
          {!previewOpen && (
            <button
              type="button"
              className="shrink-0 border-l border-border px-2 text-xs text-muted-foreground hover:bg-secondary/50"
              title={file ? `Show ${file.fileName}` : "Show the file pane"}
              onClick={() => {
                setPreviewOpen(true);
              }}
            >
              ◀
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {view !== "list" && (
            <nav className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
              <button
                type="button"
                className="text-foreground underline"
                onClick={() => {
                  setView("list");
                }}
              >
                ← Sources
              </button>
              {view === "preview" && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <button
                    type="button"
                    className="truncate text-foreground underline"
                    onClick={() => {
                      setView("detail");
                    }}
                  >
                    {source?.title ?? "Record"}
                  </button>
                  <span className="truncate text-muted-foreground">
                    / {file?.fileName}
                  </span>
                </>
              )}
            </nav>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "list" && list}
            {view === "detail" && detail}
            {view === "preview" && file && (
              <AttachmentPane documentId={document.header.id} file={file} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
