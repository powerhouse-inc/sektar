/**
 * Read Slice — resolve a queue's raw state into the position to work on.
 *
 * Pure: it is handed the state a `document-get` step already fetched and
 * never touches the reactor, which is the only reason it can exist in this
 * piece at all (see docs/bugs/pieces-cannot-reach-the-reactor.md).
 *
 * Two things make it necessary rather than convenient.
 *
 * A collection cursor's `current` is an INDEX, not a value — the model says
 * so deliberately, because an index outlives a value and a value does not
 * outlive a clear. Turning that index into the folder path it stands for
 * means indexing `collections[n].values` by a number known only at run time,
 * and the expression language resolves static paths only. Without this step
 * a collection cursor cannot be read from a workflow at all.
 *
 * And it gives every cursor a name to be read by. `values.folder` and
 * `ranges.week.from` say what they are; `cursors.0.current` says where it
 * happens to sit today, which stops being true the moment a cursor is added.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { hasWorkToDo, shapeOf, stateOf } from "./client.js";

/**
 * Calendar dates for each time range, alongside the instants.
 *
 * A slice named "2026-09-29" is one a person can find in a folder; the
 * instant it is cut from, "2026-09-29T00:00:00.000Z", is not. The
 * expression language cannot take the first ten characters of a string —
 * it resolves paths and nothing else — so a flow that wants to name a
 * document after a day has to be handed the day already formed.
 */
export function datesOf(
  ranges: Record<string, { from: unknown; to: unknown }>,
): Record<string, { from: string | null; to: string | null }> {
  const day = (value: unknown): string | null =>
    typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : null;
  return Object.fromEntries(
    Object.entries(ranges).map(([name, range]) => [
      name,
      { from: day(range.from), to: day(range.to) },
    ]),
  );
}

export const distyraOsqReadSliceAction = createAction({
  name: "osq-read-slice",
  requireAuth: false,
  displayName: "Read Slice",
  description:
    "Turn the raw state of a queue document into the position to work on: cursor values by name, ready-made from/to ranges for time cursors, the same ranges as plain calendar dates for naming things, resolved values for collection cursors, and hasWork. Feed it the state from a reactor Get Document step. Reads nothing and writes nothing itself.",
  props: {
    state: Property.Json({
      displayName: "Queue state",
      description:
        "The queue document's global state, e.g. {{steps.read.output.state}}.",
      required: true,
    }),
    documentId: Property.ShortText({
      displayName: "Queue document",
      description:
        "Carried through to the output so later steps can address the queue without repeating the id. Optional.",
      required: false,
    }),
  },
  run(context) {
    // `stateOf` rejects anything that is not a queue, which matters: the
    // likeliest mistake here is wiring the state of the wrong document, and
    // that would otherwise surface as a cursor list that is quietly empty.
    const state = stateOf(context.propsValue.state);
    const documentId = context.propsValue.documentId?.trim() ?? "";
    const shape = shapeOf(documentId, state);
    return Promise.resolve({
      ...shape,
      dates: datesOf(shape.ranges),
      hasWork: hasWorkToDo(state),
    });
  },
});
