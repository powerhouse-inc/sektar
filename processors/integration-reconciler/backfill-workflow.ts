/**
 * The history workflow of an integration: the distyra for-every trigger
 * hands out the plugged queue's slice on the switchboard's reactor
 * connection, the provider's steps fetch and store it, and a last step moves
 * the queue on. One per integration; the reconciler points it at one queue at
 * a time.
 */
import { forEveryConfig, PROCEED_STEP } from "./backfill-osq.js";
import type { ProviderAdapter, ProviderContext } from "./providers/index.js";
import { DISTYRA_PIECE, DISTYRA_PIECE_VERSION } from "./pieces.js";
import type { WorkflowSpec } from "./workflow-spec.js";

/** One slice a minute (Wouter, 2026-10-28), unless the provider paces itself. */
export const BACKFILL_POLL_SECONDS = 60;

export function backfillWorkflowSpec(
  provider: ProviderAdapter,
  ctx: ProviderContext,
  queueId: string,
  enabled: boolean,
  /** The queue's cursor slug the steps read the window from */
  range: string,
): WorkflowSpec {
  return {
    name: `${ctx.name} · history`,
    enabled,
    trigger: {
      pieceName: DISTYRA_PIECE,
      pieceVersion: DISTYRA_PIECE_VERSION,
      triggerName: "for-every",
      reactorConnectionId: ctx.reactorConnectionId,
      config: {
        ...forEveryConfig(queueId),
        pollEverySeconds: provider.backfillPollSeconds ?? BACKFILL_POLL_SECONDS,
      },
    },
    steps: [
      ...provider.backfillSteps(ctx, range),
      {
        key: PROCEED_STEP,
        name: "Move to the next slice",
        pieceName: DISTYRA_PIECE,
        pieceVersion: DISTYRA_PIECE_VERSION,
        actionName: "osq-proceed",
        reactorConnectionId: ctx.reactorConnectionId,
        // Only from the slice this run brought in: a second run on the same
        // slice must not move the queue past the next one.
        config: { documentId: queueId, position: "{{trigger.payload}}" },
      },
    ],
    // The trigger only reads; without the last step it would hand out the
    // same slice forever.
    triggerNeedsSteps: true,
    words: {
      subject: "the history workflow",
      provider: provider.label,
      config: (actual) =>
        actual?.documentId !== queueId
          ? "the history workflow walked another backfill"
          : "advance" in actual
            ? "the history workflow's trigger had a setting it no longer takes"
            : "the history workflow's pace was changed",
    },
  };
}

/** The live workflow as the provider defines it, on or off as the integration asks. */
export function liveWorkflowSpec(
  provider: ProviderAdapter,
  ctx: ProviderContext,
): WorkflowSpec {
  const live = provider.live(ctx);
  return {
    name: live.name,
    enabled: ctx.state.intent.live.enabled,
    trigger: live.trigger,
    steps: live.steps,
    words: {
      subject: "the workflow",
      provider: provider.label,
      config: live.config,
    },
  };
}
