/**
 * Taking things in, exactly as they arrived.
 *
 * `CAPTURE_SOURCE` is the whole model in one operation. It resolves by
 * identifier rather than by position, which is what makes a re-run of a
 * backfill safe: an identifier nobody claims creates a source, one that is
 * claimed updates it in place, and identifiers spanning several sources fold
 * them together.
 *
 * Nothing here transforms a payload. Capture stores what arrived; deciding
 * what it means is somebody else's operation.
 */
import type { OriginalSourceCollectionCaptureOperations } from "document-models/original-source-collection/v1";
import {
  AttachRefAlreadyPresentError,
  AttachSourceNotFoundError,
  CaptureIntoDiscardedCollectionError,
  CaptureSourceIdTakenError,
  CaptureUnnamespacedIdentifierError,
  DetachRefNotFoundError,
  DetachSourceNotFoundError,
  ReferenceSourceNotFoundError,
} from "../../gen/capture/error.js";
import { recalculate } from "../derived.js";
import {
  aliasesWith,
  claimantsOf,
  identifiersToAbsorb,
  isNamespaced,
  pickWinner,
  union,
} from "../identity.js";

export const originalSourceCollectionCaptureOperations: OriginalSourceCollectionCaptureOperations =
  {
    captureSourceOperation(state, action) {
      if (state.status === "DISCARDED") {
        throw new CaptureIntoDiscardedCollectionError(
          "This collection has been abandoned; capturing into it would add to something nobody is reading. Restore it first.",
        );
      }

      const incoming = [
        action.input.externalId,
        ...(action.input.aliases ?? []),
      ].map((value) => value.trim());

      for (const identifier of incoming) {
        if (!isNamespaced(identifier)) {
          throw new CaptureUnnamespacedIdentifierError(
            `Identifier "${identifier}" does not name the system it came from. Use system:value, for example gmail:18f3a — without it, an id from one system and an id from another are the same key.`,
          );
        }
      }

      const claimants = claimantsOf(state.sources, incoming);

      if (claimants.length === 0) {
        if (state.sources.some((source) => source.id === action.input.id)) {
          throw new CaptureSourceIdTakenError(
            `No source claims these identifiers, so this capture creates one — but OID ${action.input.id} is already taken. Supply a fresh id.`,
          );
        }
        state.sources.push({
          id: action.input.id,
          status: "NEW",
          externalId: action.input.externalId.trim(),
          aliases: union([], action.input.aliases ?? []),
          title: action.input.title ?? null,
          origin: action.input.origin ?? null,
          content: action.input.content ?? null,
          payload: action.input.payload ?? null,
          attachments: (action.input.attachments ?? []).map((file) => ({
            ref: file.ref,
            fileName: file.fileName,
            sizeBytes: file.sizeBytes ?? null,
            mimeType: file.mimeType ?? null,
          })),
          references: action.input.references ?? [],
          tags: union([], action.input.tags ?? []),
          occurredAt: action.input.occurredAt ?? null,
          capturedAt: action.input.capturedAt,
          lastSeenAt: action.input.capturedAt,
          mergedInto: null,
          mergedAt: null,
          mergedFrom: [],
        });
        recalculate(state);
        return;
      }

      // More than one live source answers to these identifiers, so this record
      // is evidence they are the same object. Folding them together here was a
      // deliberate choice: the tombstones make it auditable, and SPLIT_SOURCE
      // makes it reversible, which is what keeps an automatic merge from being
      // an irreversible decision taken by a side effect.
      const winner = pickWinner(claimants);
      for (const loser of claimants) {
        if (loser.id === winner.id) continue;
        winner.aliases = aliasesWith(
          winner,
          identifiersToAbsorb(winner, loser),
        );
        loser.status = "DISCARDED";
        loser.mergedInto = winner.id;
        // From the input, never a clock: a reducer has to replay identically.
        loser.mergedAt = action.input.capturedAt;
      }

      // Provided fields overwrite; absent ones are left alone. Sets are unioned
      // and never emptied by a capture — a later sighting that happens to omit
      // a tag is not a decision to remove it.
      const target = winner;
      target.aliases = aliasesWith(target, incoming);
      if (action.input.title !== undefined && action.input.title !== null) {
        target.title = action.input.title;
      }
      if (action.input.origin !== undefined && action.input.origin !== null) {
        target.origin = action.input.origin;
      }
      if (action.input.content !== undefined && action.input.content !== null) {
        target.content = action.input.content;
      }
      if (action.input.payload !== undefined && action.input.payload !== null) {
        target.payload = action.input.payload;
      }
      if (action.input.occurredAt) target.occurredAt = action.input.occurredAt;
      // `capturedAt` does NOT move. It is when this object entered the
      // collection, and `pickWinner` sorts on it — letting a re-sighting
      // push it forward would make a long-known source lose a merge it
      // should win, and would quietly falsify "keeps the earliest sighting".
      target.lastSeenAt = action.input.capturedAt;
      target.tags = union(target.tags, action.input.tags ?? []);
      target.references = union(
        target.references,
        action.input.references ?? [],
      );
      for (const file of action.input.attachments ?? []) {
        if (target.attachments.some((held) => held.ref === file.ref)) continue;
        target.attachments.push({
          ref: file.ref,
          fileName: file.fileName,
          sizeBytes: file.sizeBytes ?? null,
          mimeType: file.mimeType ?? null,
        });
      }

      recalculate(state);
    },

    attachToSourceOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new AttachSourceNotFoundError(
          `There is no source ${action.input.source} to attach to.`,
        );
      }
      if (source.attachments.some((held) => held.ref === action.input.ref)) {
        throw new AttachRefAlreadyPresentError(
          "That file is already attached to this source; attachments are content-addressed, so the same ref is the same bytes.",
        );
      }

      source.attachments.push({
        ref: action.input.ref,
        fileName: action.input.fileName,
        sizeBytes: action.input.sizeBytes ?? null,
        mimeType: action.input.mimeType ?? null,
      });
    },

    detachFromSourceOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new DetachSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      const index = source.attachments.findIndex(
        (held) => held.ref === action.input.ref,
      );
      if (index === -1) {
        throw new DetachRefNotFoundError(
          "That file is not attached to this source.",
        );
      }
      // Only the reference goes; the bytes stay in the store, because this
      // operation is for a mis-attachment, not for destroying evidence.
      source.attachments.splice(index, 1);
    },

    addSourceReferenceOperation(state, action) {
      const source = state.sources.find((s) => s.id === action.input.source);
      if (!source) {
        throw new ReferenceSourceNotFoundError(
          `There is no source ${action.input.source}.`,
        );
      }
      source.references = union(source.references, [action.input.reference]);
    },
  };
