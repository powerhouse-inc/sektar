/**
 * Folding captures together, and pulling them apart again.
 *
 * A merge moves identity and nothing else: the loser keeps its own payload,
 * attachments and identifiers, and gains a tombstone pointing at the winner.
 * That is what makes the whole thing reversible — `SPLIT_SOURCE` can work out
 * exactly what to take back, because nothing was taken away in the first
 * place.
 */
import type { OriginalSourceCollectionIdentityOperations } from "document-models/original-source-collection/v1";
import {
  AddAliasSourceNotFoundError,
  AddAliasUnnamespacedError,
  AliasAlreadyClaimedError,
  AliasNotFoundError,
  CannotMergeSourceIntoItselfError,
  CannotRemoveCanonicalIdentifierError,
  MergeAlreadyMergedError,
  MergeKeepNotFoundError,
  MergeSourceNotFoundError,
  RemoveAliasSourceNotFoundError,
  SourceNotMergedError,
  SplitSourceNotFoundError,
} from "../../gen/identity/error.js";
import { recalculate } from "../derived.js";
import {
  aliasesWith,
  claimantOf,
  identifiersToAbsorb,
  identifiersToReturn,
  isMerged,
  isNamespaced,
} from "../identity.js";

export const originalSourceCollectionIdentityOperations: OriginalSourceCollectionIdentityOperations =
  {
    addAliasOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new AddAliasSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      const alias = action.input.alias.trim();
      if (!isNamespaced(alias)) {
        throw new AddAliasUnnamespacedError(
          `Alias "${alias}" does not name the system it came from. Use system:value, for example gmail:18f3a.`,
        );
      }

      const holder = claimantOf(state.sources, alias);
      if (holder && holder.id !== source.id) {
        // Deliberately not an automatic merge. Capture folds sources together
        // because a record arriving under both ids is evidence; someone
        // typing an alias by hand is not, so this asks them to mean it.
        throw new AliasAlreadyClaimedError(
          `Source ${holder.id} already answers to "${alias}". An identifier belongs to one source; if these are the same object, merge them.`,
        );
      }

      source.aliases = aliasesWith(source, [alias]);
      recalculate(state);
    },

    removeAliasOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new RemoveAliasSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      const alias = action.input.alias.trim();
      if (alias === source.externalId) {
        throw new CannotRemoveCanonicalIdentifierError(
          `"${alias}" is this source's canonical externalId, not an alias. Removing it would leave the source unaddressable by the system it came from.`,
        );
      }
      if (!source.aliases.includes(alias)) {
        throw new AliasNotFoundError(
          `This source does not answer to "${alias}".`,
        );
      }
      source.aliases = source.aliases.filter((held) => held !== alias);
      recalculate(state);
    },

    mergeSourcesOperation(state, action) {
      const winner = state.sources.find((s) => s.id === action.input.keep);
      if (!winner) {
        throw new MergeKeepNotFoundError(
          `There is no source ${action.input.keep} to keep.`,
        );
      }

      // Everything is validated before anything is written: a merge that
      // fails halfway would leave some sources folded and others not, with no
      // record of which.
      const losers = action.input.merge.map((id) => {
        if (id === winner.id) {
          throw new CannotMergeSourceIntoItselfError(
            `Source ${id} cannot be folded into itself.`,
          );
        }
        const loser = state.sources.find((s) => s.id === id);
        if (!loser) {
          throw new MergeSourceNotFoundError(`There is no source ${id}.`);
        }
        if (isMerged(loser)) {
          throw new MergeAlreadyMergedError(
            `Source ${id} was already folded into ${String(loser.mergedInto)}. Split it first if that was wrong.`,
          );
        }
        return loser;
      });

      for (const loser of losers) {
        winner.aliases = aliasesWith(
          winner,
          identifiersToAbsorb(winner, loser),
        );
        loser.status = "DISCARDED";
        loser.mergedInto = winner.id;
        loser.mergedAt = action.input.mergedAt;
      }
      recalculate(state);
    },

    splitSourceOperation(state, action) {
      const loser = state.sources.find((s) => s.id === action.input.source);
      if (!loser) {
        throw new SplitSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      if (!isMerged(loser)) {
        throw new SourceNotMergedError(
          "That source stands on its own, so there is no merge to undo.",
        );
      }

      const winner = state.sources.find((s) => s.id === loser.mergedInto);
      if (winner) {
        // Take back only what this loser brought and nothing else still
        // depends on — undoing one merge must not quietly break another.
        const returning = new Set(
          identifiersToReturn(state.sources, winner, loser),
        );
        winner.aliases = winner.aliases.filter(
          (alias) => !returning.has(alias),
        );
      }

      loser.mergedInto = null;
      loser.mergedAt = null;
      loser.status = action.input.status ?? "NEW";
      recalculate(state);
    },
  };
