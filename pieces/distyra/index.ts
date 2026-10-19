import { createPiece } from "@powerhousedao/pieces-framework";
import { distyraGetLatestTransactionsAction } from "./lib/actions/get-latest-transactions.js";
import { distyraPullForLedgerAction } from "./lib/actions/pull-for-ledger.js";
import { distyraAuth } from "./lib/auth.js";
import {
  distyraOsqAddCollectionValuesAction,
  distyraOsqClearCollectionAction,
  distyraOsqGetCurrentValueAction,
  distyraOsqGetNextValueAction,
  distyraOsqProceedAction,
  distyraOsqProceedWithErrorAction,
  distyraOsqReadMemoryAction,
  distyraOsqReportErrorAction,
  distyraOsqUpdateMemoryAction,
} from "./lib/osq/actions.js";
import { distyraForEveryTrigger } from "./lib/osq/for-every.js";
import { distyraOsqQueueDiscoveredAction } from "./lib/osq/queue-discovered.js";
import { distyraOsqReadSliceAction } from "./lib/osq/read-slice.js";
import {
  distyraOscCaptureSourceAction,
  distyraOscCaptureSourcesAction,
  distyraOscCreateTaskAction,
  distyraOscFindSourceAction,
  distyraOscMergeSourcesAction,
  distyraOscSetSourceStatusAction,
  distyraOscTagSourceAction,
} from "./lib/osc/actions.js";
import { distyraOscMapRecordsAction } from "./lib/osc/map-records.js";
import { distyraOnNewSourceTrigger } from "./lib/osc/on-new-source.js";
import { distyraOscSelectTasksAction } from "./lib/osc/select-tasks.js";
import { DISTYRA_LOGO } from "./lib/logo.js";

export const distyra = createPiece({
  // Name and description shown in the workflow editor's piece list
  displayName: "Distyra",
  description:
    "Fetch historical and new bank transactions, and drive Original Source Queues — resumable, inspectable cursors for backfilling any source.",
  // The connection every action and trigger uses; defined in lib/auth.ts
  auth: distyraAuth,
  minimumSupportedRelease: "0.30.0",
  logoUrl: DISTYRA_LOGO,
  authors: [],
  // ph generate piece-action and piece-trigger add entries here
  actions: [
    distyraGetLatestTransactionsAction,
    distyraPullForLedgerAction,
    // Queue steps. These talk to the reactor rather than to Distyra, so none
    // of them requires the bank connection above.
    // Pure queue steps: these read a state a reactor Get Document step has
    // already fetched, and emit actions for a reactor Dispatch step to
    // apply. They touch no reactor, which is why they work at all — see
    // docs/bugs/pieces-cannot-reach-the-reactor.md.
    distyraOsqReadSliceAction,
    distyraOsqQueueDiscoveredAction,
    distyraOsqGetCurrentValueAction,
    distyraOsqGetNextValueAction,
    distyraOsqReadMemoryAction,
    distyraOsqUpdateMemoryAction,
    distyraOsqProceedAction,
    distyraOsqReportErrorAction,
    distyraOsqProceedWithErrorAction,
    distyraOsqAddCollectionValuesAction,
    distyraOsqClearCollectionAction,
    // Collection steps. Capture runs the index lookup itself, so a flow does
    // not have to ask where something lives before filing it.
    distyraOscFindSourceAction,
    // The adapter between a fetch step and a capture step. Expressions
    // resolve paths but cannot touch list elements, so renaming a field
    // inside a list needs a step of its own.
    distyraOscMapRecordsAction,
    distyraOscCaptureSourceAction,
    distyraOscCaptureSourcesAction,
    distyraOscTagSourceAction,
    distyraOscSetSourceStatusAction,
    distyraOscMergeSourcesAction,
    distyraOscCreateTaskAction,
    // Pure: reads a state a reactor Get Document step fetched and emits
    // actions for a Dispatch step. Pairs with the batch button in the
    // collection editor.
    distyraOscSelectTasksAction,
  ],
  triggers: [distyraForEveryTrigger, distyraOnNewSourceTrigger],
});

export default distyra;
