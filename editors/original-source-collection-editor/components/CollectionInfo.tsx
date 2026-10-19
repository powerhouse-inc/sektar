/**
 * Everything true of the collection as a whole, behind one button.
 *
 * These used to be a strip under the toolbar: a title input, a status pill, a
 * run of counters, a provenance note and an Abandon button, all competing for
 * one line with the list below. Each of them needs a sentence more than a
 * strip can give — the status cannot be set by hand, Abandon is not a delete,
 * and "from gmail" is three fields flattened into two words. A modal has
 * the room to say so.
 *
 * The controls a toolbar renders are handed only the document, so this reads
 * its own state through the same hook the editor uses rather than having it
 * threaded down. That also keeps the component identity stable, which an
 * inline closure would not: a title input that remounts on every keystroke
 * loses focus on every keystroke.
 */
import { Icon } from "@powerhousedao/design-system";
import { ToolbarButton } from "@powerhousedao/design-system/connect";
import {
  actions,
  useSelectedOriginalSourceCollectionDocument,
} from "document-models/original-source-collection";
import { useEffect, useState } from "react";
import { BTN, INPUT, PILL, STATUS_PILL } from "./lib.js";

/**
 * What each collection status means, since none of them can be chosen.
 *
 * Every one but DISCARDED is derived from the sources, so a reader looking
 * for the control that sets it is looking for something that does not exist.
 * Saying what moves it is more use than a tooltip saying what it is.
 */
const STATUS_MEANING: Record<string, string> = {
  NEW: "Nothing here has been worked yet. Calculated from the sources.",
  PROCESSING: "Some sources are in hand, not all. Calculated from the sources.",
  COMPLETED: "Every source has been dealt with. Calculated from the sources.",
  DISCARDED:
    "Set by hand with Abandon. The one status that is a decision rather than a calculation.",
};

/**
 * One label column for the whole modal.
 *
 * Every value — a field, a pill, an id, the sentence explaining one of them —
 * starts on the same vertical, because they all come out of this one grid.
 * The sentences used to fake that with a hardcoded left padding that restated
 * the column width in a second place, and two numbers meaning one thing drift.
 *
 * `leading-6` on both halves is what aligns a label with what it labels: a
 * 24px line box puts a run of text at the same centre as the text inside an
 * input of the same size, so plain values, controls and the first line of a
 * textarea all line up against their label without any of them needing a
 * nudge of its own.
 */
const GRID = "grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-4";

/**
 * A labelled value, and anything that has to be said about it.
 *
 * A note belongs to the field it explains, so it is rendered inside that
 * field's cell rather than as a sibling that has to be pushed back into
 * line. Nothing in this file positions itself.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-xs leading-6 text-muted-foreground">{label}</span>
      <div className="min-w-0 text-xs leading-6 text-foreground">{children}</div>
    </>
  );
}

/** The sentence under a value. Always the same size, always in its own cell. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * A group, separated by a rule with equal air on both sides.
 *
 * The spacing is one decision made once: the parent's `space-y-6` puts 24px
 * above the rule and the section's own `pt-6` puts 24px below it. Before,
 * the two were different numbers that added up, so every rule sat nearer to
 * what followed it than to what it divided.
 *
 * Headings are uppercase rather than another run of sentence-case text at the
 * same size, so a heading at the left margin and a field label at the left
 * margin do not read as one ragged column of the same thing.
 */
function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6 first:border-0 first:pt-0">
      {title !== undefined && (
        <h3 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/** One figure. Zero is shown greyed rather than hidden: absence is a fact. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p
        className={
          "text-lg font-semibold leading-tight tabular-nums " +
          (value === 0 ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[0.7rem] leading-tight text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const [document, dispatch] = useSelectedOriginalSourceCollectionDocument();
  const state = document.state.global;
  const discarded = state.status === "DISCARDED";
  const counts = state.counts;
  const provenance = state.provenance;
  const [copied, setCopied] = useState(false);

  return (
    // `max-h-full` rather than a viewport fraction: the backdrop is already
    // inset-0 with its own padding, so what that leaves is exactly the room
    // available. A separate 85vh would be a second opinion about the same
    // measurement, and the two disagree at small window heights.
    <div className="flex max-h-full w-[36rem] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <header className="flex shrink-0 items-baseline justify-between gap-4 border-b border-border px-8 py-5">
        <h2 className="text-base font-semibold text-foreground">
          Collection properties
        </h2>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-8 py-6">
        <Section>
          <div className={GRID}>
            <Row label="Title">
              <input
                className={`${INPUT} w-full text-xs`}
                defaultValue={state.title ?? document.header.name}
                placeholder="Name this collection"
                onBlur={(event) => {
                  const title = event.target.value.trim();
                  if (title !== (state.title ?? "")) {
                    // SET_TITLE, not setName. setName is a base action, and a
                    // model operation of that name would silently override the
                    // document's own rename.
                    dispatch(actions.setTitle({ title: title || undefined }));
                  }
                }}
              />
            </Row>
            <Row label="Description">
              <textarea
                className={`${INPUT} min-h-16 w-full resize-y text-xs leading-relaxed`}
                defaultValue={state.description ?? ""}
                placeholder="What this collection is for, and anything a reader would need to know about how it was filled."
                onBlur={(event) => {
                  const description = event.target.value.trim();
                  if (description !== (state.description ?? "")) {
                    dispatch(
                      actions.setDescription({
                        description: description || undefined,
                      }),
                    );
                  }
                }}
              />
            </Row>
            <Row label="Status">
              <span
                className={`${PILL} inline-block align-middle ${STATUS_PILL[state.status]}`}
              >
                {state.status.toLowerCase()}
              </span>
              <Note>
                {STATUS_MEANING[state.status] ?? "Calculated from the sources."}
              </Note>
            </Row>
          </div>
        </Section>

        <Section title="Sources">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={counts.total} label="total" />
            <Stat value={counts.new} label="new" />
            <Stat value={counts.processing} label="processing" />
            <Stat value={counts.completed} label="completed" />
            <Stat value={counts.discarded} label="discarded" />
            <Stat value={counts.merged} label="folded in" />
          </div>
          <Note>
            Folded sources are kept, not deleted — they are the record that two
            captures turned out to be the same object, and a split puts them
            back. {counts.openTasks} task
            {counts.openTasks === 1 ? " is" : "s are"} still open.
          </Note>
        </Section>

        <Section title="Where this came from">
          {provenance?.system || provenance?.queue ? (
            <div className={GRID}>
              <Row label="System">
                {provenance.system ?? (
                  <span className="text-muted-foreground">not recorded</span>
                )}
              </Row>
              <Row label="Driven by">
                {provenance.queue ? (
                  // The queue names the slices that failed; this collection
                  // holds what the rest produced. Read together they answer
                  // "is this backfill complete?", which neither does alone.
                  <code className="break-all text-[0.7rem]">
                    {provenance.queue}
                  </code>
                ) : (
                  <span className="text-muted-foreground">
                    no queue — captured directly
                  </span>
                )}
              </Row>
              {provenance.detail !== null &&
                provenance.detail !== undefined && (
                  <Row label="Detail">
                    {/* `py-1` rather than `p-2`: the box's own padding is
                        what decides where its first line lands, and at 8px
                        that line sat below the label naming it. 4px puts it
                        back on the row. */}
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background px-2 py-1 text-[0.7rem] leading-relaxed text-muted-foreground">
                      {JSON.stringify(provenance.detail, null, 2)}
                    </pre>
                  </Row>
                )}
            </div>
          ) : (
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
              Nothing recorded. A flow sets this when it captures, so an empty
              provenance usually means these sources were added by hand.
            </p>
          )}
        </Section>

        <Section title="This document">
          <div className={GRID}>
            <Row label="Id">
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-[0.7rem] leading-6">
                  {document.header.id}
                </code>
                <button
                  type="button"
                  className={`${BTN} shrink-0`}
                  onClick={() => {
                    void navigator.clipboard.writeText(document.header.id);
                    setCopied(true);
                    window.setTimeout(() => {
                      setCopied(false);
                    }, 1200);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {/* The id is what a workflow step is pointed at, so it is worth
                  being able to lift out of here rather than out of the URL. */}
              <Note>What a workflow step names to write here.</Note>
            </Row>
          </div>
        </Section>

        <Section title={discarded ? "Restore" : "Abandon"}>
          {/* The sentence comes first. A button whose consequences are set out
              underneath it explains itself to the people who already pressed
              it. */}
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
            {discarded
              ? "Restoring makes it live again and lets flows capture into it. Nothing was lost while it was abandoned."
              : "Abandoning marks the collection ignored and refuses further captures into it. Nothing is deleted — an original-source store that can forget is not one — and it can be restored at any time."}
          </p>
          <button
            type="button"
            className={`${BTN} mt-3 w-full py-1.5`}
            onClick={() => {
              dispatch(
                discarded
                  ? actions.restoreCollection({})
                  : actions.discardCollection({}),
              );
              onClose();
            }}
          >
            {discarded ? "Restore this collection" : "Abandon this collection"}
          </button>
        </Section>
      </div>
    </div>
  );
}

/**
 * The toolbar control.
 *
 * A toolbar control is given the document and nothing else, so the panel
 * reads its own state. The button only owns whether the panel is open.
 */
export function CollectionInfoControl() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <ToolbarButton
        title="Collection properties"
        aria-label="Collection properties"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        <Icon name="CircleInfo" size={16} />
      </ToolbarButton>
      {open && (
        /*
         * Fixed, so it escapes the editor's clipping.
         *
         * The editor root is `overflow-hidden` — it has to be, because it
         * measures its own height — and an absolutely positioned panel
         * inside it is cut off at the first edge it reaches. A modal is
         * positioned against the viewport instead and has nothing to be
         * cut off by.
         */
        <div
          // One padding, matching the panel's own `px-8`. A `sm:` step was
          // here and silently did nothing — the panel measured the `p-6`
          // height at every width — so it was a stated intention that was
          // not happening.
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Collection properties"
          onClick={(event) => {
            // Only the backdrop itself. A click that started inside the
            // panel and bubbled out must not close what it came from.
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <Panel
            onClose={() => {
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}
