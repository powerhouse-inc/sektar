/**
 * Everything the collection works out for itself.
 *
 * Counts, the back-pointers from a merge, and the collection's own status are
 * all functions of the sources. A reducer changes an input and asks for a
 * recalculation; none of them maintains a total by hand, because a total
 * maintained by hand is a total that eventually disagrees with the list it
 * describes.
 */
import type { OriginalSourceCollectionState } from "../gen/schema/types.js";
import { isMerged } from "./identity.js";

/**
 * Recompute the derived fields.
 *
 * Mutating rather than returning: reducers run inside Mutative, so this is
 * applied to the draft state directly.
 */
export function recalculate(state: OriginalSourceCollectionState): void {
  // Back-pointers, rebuilt from the tombstones rather than maintained
  // alongside them — one direction is the truth, the other is a view of it.
  const absorbed = new Map<string, string[]>();
  for (const source of state.sources) {
    if (!isMerged(source)) continue;
    const into = source.mergedInto as string;
    absorbed.set(into, [...(absorbed.get(into) ?? []), source.id]);
  }
  for (const source of state.sources) {
    source.mergedFrom = absorbed.get(source.id) ?? [];
  }

  const counts = {
    total: state.sources.length,
    new: 0,
    processing: 0,
    completed: 0,
    discarded: 0,
    merged: 0,
    openTasks: 0,
  };
  for (const source of state.sources) {
    if (source.status === "NEW") counts.new++;
    else if (source.status === "PROCESSING") counts.processing++;
    else if (source.status === "COMPLETED") counts.completed++;
    else counts.discarded++;
    if (isMerged(source)) counts.merged++;
  }
  for (const task of state.tasks) {
    if (task.status !== "DONE" && task.status !== "CANCELLED") {
      counts.openTasks++;
    }
  }
  state.counts = counts;

  // An abandoned collection stays abandoned. It is the one status that is a
  // decision rather than a roll-up, so rolling up would undo it.
  if (state.status === "DISCARDED") return;
  state.status = rollUp(state);
}

function rollUp(
  state: OriginalSourceCollectionState,
): OriginalSourceCollectionState["status"] {
  if (state.sources.length === 0) return "NEW";
  if (state.sources.every((source) => source.status === "NEW")) return "NEW";
  const settled = state.sources.every(
    (source) => source.status === "COMPLETED" || source.status === "DISCARDED",
  );
  return settled ? "COMPLETED" : "PROCESSING";
}
