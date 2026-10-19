/**
 * Saying what something is.
 *
 * Additive and reversible, and none of it touches `payload`. That separation
 * is the point of the model: a classification you later decide was wrong
 * costs you the classification, never the record it was about.
 */
import type { OriginalSourceCollectionClassifyOperations } from "document-models/original-source-collection/v1";
import {
  CannotRestatusMergedSourceError,
  DiscardSourceNotFoundError,
  SetSourceStatusNotFoundError,
  SetSourceTitleNotFoundError,
  TagSourceNotFoundError,
  UntagSourceNotFoundError,
} from "../../gen/classify/error.js";
import { recalculate } from "../derived.js";
import { isMerged, union } from "../identity.js";

export const originalSourceCollectionClassifyOperations: OriginalSourceCollectionClassifyOperations =
  {
    setSourceTitleOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new SetSourceTitleNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      source.title = action.input.title ?? null;
    },

    tagSourceOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new TagSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      // A set: tagging twice is not an error, because a flow that re-runs
      // should not have to check first.
      source.tags = union(source.tags, action.input.tags);
    },

    untagSourceOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new UntagSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      const removing = new Set(action.input.tags.map((tag) => tag.trim()));
      source.tags = source.tags.filter((tag) => !removing.has(tag));
    },

    setSourceStatusOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new SetSourceStatusNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      if (isMerged(source)) {
        // Its DISCARDED status IS the record of the merge. Letting this
        // change it would leave a source that is folded into another while
        // claiming to be live.
        throw new CannotRestatusMergedSourceError(
          `Source ${source.id} was folded into ${String(source.mergedInto)}, so its status records that. Split it first if it should stand on its own again.`,
        );
      }
      source.status = action.input.status;
      recalculate(state);
    },

    discardSourceOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new DiscardSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      // Discarding something already folded in is harmless — it is already
      // discarded — so this one does not refuse.
      source.status = "DISCARDED";
      recalculate(state);
    },
  };
