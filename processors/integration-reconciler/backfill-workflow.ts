/**
 * The backfill workflow of a calendar integration, as data: the for-every
 * trigger walking the plugged queue a slice per poll, Google's Get Events for
 * the slice, then the live workflow's mapping and upsert steps. One per
 * integration; the reconciler points it at one queue at a time. Pure, like
 * live-workflow.ts.
 */
import { actions as wf } from "@powerhousedao/workflow/document-models/workflow";
import { forEveryConfig, SLICE_RANGE } from "./backfill-osq.js";
import {
  DISTYRA_PIECE,
  DISTYRA_PIECE_VERSION,
  GOOGLE_CALENDAR_PIECE,
  GOOGLE_CALENDAR_PIECE_VERSION,
  mapEventsStep,
  PRIMARY_CALENDAR,
  sameJson,
  upsertEventsStep,
  type WorkflowAction,
  type WorkflowFacts,
} from "./live-workflow.js";

/** One slice a minute (Wouter, 2026-10-28). */
export const BACKFILL_POLL_SECONDS = 60;
export const GET_EVENTS_STEP = "get_events";

export type BackfillWorkflowSpec = {
  name: string;
  enabled: boolean;
  /** The queue the trigger walks */
  queueId: string;
  /** The Google sign-in Get Events uses */
  connectionId: string;
  /** The switchboard's own connection: the trigger moves the queue, the upsert writes events */
  reactorConnectionId: string;
  triggerConfig: Record<string, unknown>;
};

export function backfillWorkflowSpec(
  integrationName: string,
  enabled: boolean,
  queueId: string,
  connectionId: string,
  reactorConnectionId: string,
): BackfillWorkflowSpec {
  return {
    name: `${integrationName} · history`,
    enabled,
    queueId,
    connectionId,
    reactorConnectionId,
    triggerConfig: {
      ...forEveryConfig(queueId),
      pollEverySeconds: BACKFILL_POLL_SECONDS,
    },
  };
}

const slice = (end: "from" | "to") =>
  `{{trigger.payload.ranges.${SLICE_RANGE}.${end}}}`;

/** Everything a new backfill workflow document needs, in the order the runtime wants. */
export function buildBackfillWorkflow(
  spec: BackfillWorkflowSpec,
  ids: {
    trigger: string;
    get: string;
    map: string;
    upsert: string;
    e1: string;
    e2: string;
    e3: string;
  },
  now: string,
  calendarName: string,
): WorkflowAction[] {
  return [
    wf.setWorkflowName({ name: spec.name }),
    wf.setTrigger({
      id: ids.trigger,
      pieceName: DISTYRA_PIECE,
      pieceVersion: DISTYRA_PIECE_VERSION,
      triggerName: "for-every",
      reactorConnectionId: spec.reactorConnectionId,
      config: spec.triggerConfig,
    }),
    wf.addStep({
      id: ids.get,
      key: GET_EVENTS_STEP,
      name: "Get Events",
      pieceName: GOOGLE_CALENDAR_PIECE,
      pieceVersion: GOOGLE_CALENDAR_PIECE_VERSION,
      actionName: "google_calendar_get_events",
      connectionId: spec.connectionId,
      config: {
        calendar_id: PRIMARY_CALENDAR,
        event_types: ["default", "focusTime", "outOfOffice"],
        start_date: slice("from"),
        end_date: slice("to"),
        singleEvents: false,
      },
    }),
    // The whole answer, so the mapping can refuse a window with a second page
    mapEventsStep(
      ids.map,
      `{{steps.${GET_EVENTS_STEP}.output.body}}`,
      calendarName,
    ),
    upsertEventsStep(ids.upsert, spec.reactorConnectionId),
    wf.addEdge({ id: ids.e1, from: ids.trigger, to: ids.get, port: "next" }),
    wf.addEdge({ id: ids.e2, from: ids.get, to: ids.map, port: "next" }),
    wf.addEdge({ id: ids.e3, from: ids.map, to: ids.upsert, port: "next" }),
    wf.publishWorkflow({ publishedAt: now }),
    wf.setWorkflowStatus({ status: spec.enabled ? "ENABLED" : "DISABLED" }),
  ];
}

/**
 * What to change so the published backfill workflow is the spec again: the
 * queue it walks and its pace, its reactor connection, Get Events' sign-in
 * (then a re-publish), and its status.
 */
export function backfillWorkflowDrift(
  spec: BackfillWorkflowSpec,
  facts: WorkflowFacts,
  now: string,
): { differences: string[]; actions: WorkflowAction[] } {
  const differences: string[] = [];
  const edits: WorkflowAction[] = [];
  if (!sameJson(facts.triggerConfig, spec.triggerConfig)) {
    differences.push(
      facts.triggerConfig?.documentId !== spec.queueId
        ? "the history workflow walked another backfill"
        : "the history workflow's pace was changed",
    );
    edits.push(wf.setTriggerConfig({ config: spec.triggerConfig }));
  }
  if ((facts.triggerReactorConnectionId ?? null) !== spec.reactorConnectionId) {
    differences.push("the history workflow wrote with another connection");
    edits.push(
      wf.setTriggerConnection({
        connectionId: null,
        reactorConnectionId: spec.reactorConnectionId,
      }),
    );
  }
  const get = facts.steps?.find((s) => s.key === GET_EVENTS_STEP);
  if (get && get.connectionId !== spec.connectionId) {
    differences.push("the history workflow used another Google sign-in");
    edits.push(wf.updateStep({ id: get.id, connectionId: spec.connectionId }));
  }
  const unpublished =
    facts.publishedVersion === null || facts.publishedVersion !== facts.version;
  if (edits.length > 0 || unpublished) {
    if (unpublished && edits.length === 0) {
      differences.push("the history workflow had unpublished changes");
    }
    edits.push(wf.publishWorkflow({ publishedAt: now }));
  }
  const status = spec.enabled ? "ENABLED" : "DISABLED";
  if (facts.status !== status) {
    differences.push(
      spec.enabled
        ? "the history workflow was off"
        : "the history workflow was on",
    );
    edits.push(wf.setWorkflowStatus({ status }));
  }
  return { differences, actions: edits };
}
