/**
 * Editing an Original Source Queue.
 *
 * The layout follows the question order of whoever opens it. Where has it got
 * to, and is it moving? Then: what is it walking, and what is in the queues?
 * Then: what failed, and what is the workflow holding on to? Definition sits
 * in the middle rather than the top because it is only editable in a draft,
 * and a draft is the one state where nothing has got anywhere yet.
 */
import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import {
  actions,
  useSelectedOriginalSourceQueueDocument,
} from "document-models/original-source-queue";
import { Cursors } from "./components/Cursors.js";
import { Failures } from "./components/Failures.js";
import { Memory } from "./components/Memory.js";
import { Odometer } from "./components/Odometer.js";
import { Queues } from "./components/Queues.js";
import { StatusBar } from "./components/StatusBar.js";

export default function Editor() {
  const [document, dispatch] = useSelectedOriginalSourceQueueDocument();
  const state = document.state.global;

  // The size of the space, from the counts the reducers already calculated —
  // recomputing it here would be a second opinion where there should be one.
  const total =
    state.cursors.length === 0
      ? 0
      : state.cursors.reduce((product, cursor) => product * cursor.count, 1);

  return (
    <div className="mx-auto max-w-5xl bg-background p-6">
      <DocumentToolbar
        // The default container draws a rounded border, which reads as a
        // panel floating on the page rather than as the top of it.
        toolbarClassName="rounded-none border-0"
      />

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <input
          type="text"
          defaultValue={document.header.name}
          placeholder="Name this queue, e.g. Gmail backfill"
          title="The name is how it is found in the drive."
          className="min-w-64 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold text-foreground hover:border-border focus:border-border focus:outline-none"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== document.header.name) {
              dispatch(actions.setName(name));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>

      <input
        type="text"
        defaultValue={state.description ?? ""}
        placeholder="What does this backfill? e.g. every week of Gmail since 2019"
        className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-muted-foreground hover:border-border focus:border-border focus:outline-none"
        onBlur={(e) => {
          const description = e.target.value.trim();
          if (description !== (state.description ?? "")) {
            dispatch(actions.setDescription({ description: description || undefined }));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <div className="mt-4 grid gap-4">
        <StatusBar
          status={state.status}
          progress={state.progress}
          total={total}
          cursorCount={state.cursors.length}
          dispatch={dispatch}
        />

        <Odometer
          cursors={state.cursors}
          collections={state.collections}
          awaitingValues={state.awaitingValues}
          status={state.status}
        />

        <Cursors
          cursors={state.cursors}
          collections={state.collections}
          isDraft={state.status === "DRAFT"}
          dispatch={dispatch}
        />

        <Queues
          collections={state.collections}
          cursors={state.cursors}
          status={state.status}
          dispatch={dispatch}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Failures errors={state.errors} cursors={state.cursors} />
          <Memory memory={state.memory} />
        </div>
      </div>
    </div>
  );
}
