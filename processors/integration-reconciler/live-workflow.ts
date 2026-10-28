/**
 * The live workflow of a calendar integration, as data: what it should be
 * (the spec), the actions that build it from nothing, and what to change
 * when the published workflow differs from the spec. Pure: the reconciler
 * reads and writes through its IO. Built like the mail flow that already
 * runs: the provider's polling trigger, a mapping step, Upsert Documents.
 */
import { actions as wf } from "@powerhousedao/workflow/document-models/workflow";
import type { IntegrationState } from "document-models/integration";

export const GOOGLE_CALENDAR_PIECE = "@activepieces/piece-google-calendar";
export const GOOGLE_CALENDAR_PIECE_VERSION = "0.13.3";
export const DISTYRA_PIECE = "@powerhousedao/distyra-piece";
export const DISTYRA_PIECE_VERSION = "1.0.0";
/** The calendar the pilot watches: the account's main calendar. */
export const PRIMARY_CALENDAR = "primary";
export const CALENDAR_DRIVE = "calendar";
export const CALENDAR_EVENT_TYPE = "sektar/calendar-event";

export type WorkflowAction = ReturnType<
  | typeof wf.setWorkflowName
  | typeof wf.setWorkflowStatus
  | typeof wf.setTrigger
  | typeof wf.setTriggerConfig
  | typeof wf.setTriggerConnection
  | typeof wf.addStep
  | typeof wf.addEdge
  | typeof wf.updateStep
  | typeof wf.publishWorkflow
>;

export type LiveWorkflowSpec = {
  name: string;
  enabled: boolean;
  connectionId: string;
  reactorConnectionId: string;
  triggerConfig: Record<string, unknown>;
};

/** What the published live workflow looks like, as far as the spec goes. */
export type WorkflowFacts = {
  status: string;
  /** null: never published */
  publishedVersion: number | null;
  version: number;
  triggerName: string | null;
  triggerConnectionId: string | null;
  triggerConfig: Record<string, unknown> | null;
  /** The trigger's reactor connection (a trigger that writes documents) */
  triggerReactorConnectionId?: string | null;
  /** The published steps, as far as their connections go */
  steps?: { id: string; key: string; connectionId: string | null }[];
};

/**
 * How the workflow runtime on this switchboard holds a workflow's trigger
 * (Powerhouse: WorkflowHealth, read through the workflow-triggers read
 * model). Live facts: never written into the integration, only turned into
 * issues.
 */
export type RuntimeHealth = {
  trigger: {
    status: string;
    lastError: string | null;
    consecutiveFailures: number;
  } | null;
  park: { reason: string; parkedAt: string } | null;
};

const SECONDS = { MINUTES: 60, HOURS: 3600, DAYS: 86400 } as const;

export function liveWorkflowSpec(
  name: string,
  state: IntegrationState,
  connectionId: string,
  reactorConnectionId: string,
): LiveWorkflowSpec {
  const every = state.intent.live.every;
  return {
    name: `${name} · new events`,
    enabled: state.intent.live.enabled,
    connectionId,
    reactorConnectionId,
    triggerConfig: {
      calendar_id: PRIMARY_CALENDAR,
      expandRecurringEvent: false,
      pollEverySeconds: every.value * SECONDS[every.unit],
    },
  };
}

/** Everything a new workflow document needs, in the order the runtime wants: trigger, steps, edges, publish, status. */
export function buildLiveWorkflow(
  spec: LiveWorkflowSpec,
  ids: { trigger: string; map: string; upsert: string; e1: string; e2: string },
  now: string,
  calendarName: string,
): WorkflowAction[] {
  return [
    wf.setWorkflowName({ name: spec.name }),
    wf.setTrigger({
      id: ids.trigger,
      pieceName: GOOGLE_CALENDAR_PIECE,
      pieceVersion: GOOGLE_CALENDAR_PIECE_VERSION,
      triggerName: "new_or_updated_event",
      connectionId: spec.connectionId,
      config: spec.triggerConfig,
    }),
    mapEventsStep(ids.map, "{{trigger.payload}}", calendarName),
    upsertEventsStep(ids.upsert, spec.reactorConnectionId),
    wf.addEdge({ id: ids.e1, from: ids.trigger, to: ids.map, port: "next" }),
    wf.addEdge({ id: ids.e2, from: ids.map, to: ids.upsert, port: "next" }),
    wf.publishWorkflow({ publishedAt: now }),
    wf.setWorkflowStatus({ status: spec.enabled ? "ENABLED" : "DISABLED" }),
  ];
}

/** The step that turns Google events into upsert items; the live and backfill workflows share it. */
export function mapEventsStep(
  id: string,
  events: string,
  calendarName: string,
) {
  return wf.addStep({
    id,
    key: "map_events",
    name: "Google Calendar Events to Calendar Events",
    pieceName: DISTYRA_PIECE,
    pieceVersion: DISTYRA_PIECE_VERSION,
    actionName: "google-event-to-calendar-event",
    config: { events, calendarId: PRIMARY_CALENDAR, calendarName },
  });
}

/** The step that writes the events into the Calendar drive, keyed so nothing doubles. */
export function upsertEventsStep(id: string, reactorConnectionId: string) {
  return wf.addStep({
    id,
    key: "upsert_events",
    name: "Upsert Documents",
    pieceName: DISTYRA_PIECE,
    pieceVersion: DISTYRA_PIECE_VERSION,
    actionName: "upsert-documents",
    reactorConnectionId,
    config: {
      items: "{{steps.map_events.output.items}}",
      documentType: CALENDAR_EVENT_TYPE,
      driveId: CALENDAR_DRIVE,
      folderName: "$item.folder",
      itemKeyPath: "key",
      documentKeyPath: "externalId",
      name: "$item.name",
      createActions: "$item.actions",
      updateActions: "$item.updateActions",
      limit: 500,
      stopOnError: false,
    },
  });
}

export const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

export type Drift = {
  /** In the user's words, for the fixes log */
  differences: string[];
  actions: WorkflowAction[];
};

/**
 * What to change so the published workflow is the spec again: the trigger's
 * config and connection (then a re-publish), and its status. Empty when it
 * already is.
 */
export function liveWorkflowDrift(
  spec: LiveWorkflowSpec,
  facts: WorkflowFacts,
  now: string,
): Drift {
  const differences: string[] = [];
  const edits: WorkflowAction[] = [];
  if (!sameJson(facts.triggerConfig, spec.triggerConfig)) {
    differences.push(describeConfig(facts.triggerConfig, spec.triggerConfig));
    edits.push(wf.setTriggerConfig({ config: spec.triggerConfig }));
  }
  if (facts.triggerConnectionId !== spec.connectionId) {
    differences.push("the workflow used another Google sign-in");
    edits.push(wf.setTriggerConnection({ connectionId: spec.connectionId }));
  }
  const unpublished =
    facts.publishedVersion === null || facts.publishedVersion !== facts.version;
  if (edits.length > 0 || unpublished) {
    if (unpublished && edits.length === 0) {
      differences.push("the workflow had unpublished changes");
    }
    edits.push(wf.publishWorkflow({ publishedAt: now }));
  }
  const status = spec.enabled ? "ENABLED" : "DISABLED";
  if (facts.status !== status) {
    differences.push(
      spec.enabled ? "the workflow was off" : "the workflow was on",
    );
    edits.push(wf.setWorkflowStatus({ status }));
  }
  return { differences, actions: edits };
}

function describeConfig(
  actual: Record<string, unknown> | null,
  wanted: Record<string, unknown>,
): string {
  const was = actual?.pollEverySeconds;
  const now = wanted.pollEverySeconds;
  if (typeof was === "number" && typeof now === "number" && was !== now) {
    return `the workflow checked every ${humanSeconds(was)}, not every ${humanSeconds(now)}`;
  }
  if (actual?.calendar_id !== wanted.calendar_id) {
    const id = actual?.calendar_id;
    return `the workflow watched calendar ${typeof id === "string" ? id : "none"}`;
  }
  return "the workflow's trigger settings were changed";
}

/**
 * What the runtime's view of the live workflow means for the person: a park
 * stops live updates until someone acts, so it blocks; a trigger that keeps
 * failing may recover by itself, so it warns.
 */
export function runtimeIssue(
  health: RuntimeHealth | null,
  which: "live" | "backfill" = "live",
): { code: string; severity: "BLOCKING" | "WARNING"; message: string } | null {
  if (!health) return null;
  const prefix = which === "live" ? "LIVE" : "BACKFILL";
  const what = which === "live" ? "Live updates" : "Bringing in history";
  if (health.park) {
    return {
      code: `${prefix}_WORKFLOW_PARKED`,
      severity: "BLOCKING",
      message: `${what} stopped after a failed run: ${health.park.reason}`,
    };
  }
  const t = health.trigger;
  if (t && t.status === "ERROR" && t.lastError) {
    return {
      code: `${prefix}_WORKFLOW_FAILING`,
      severity: "WARNING",
      message: `${what} ${which === "live" ? "are" : "is"} failing: ${t.lastError}`,
    };
  }
  return null;
}

export function humanSeconds(s: number): string {
  if (s % 86400 === 0) return s === 86400 ? "day" : `${s / 86400} days`;
  if (s % 3600 === 0) return s === 3600 ? "hour" : `${s / 3600} hours`;
  if (s % 60 === 0) return s === 60 ? "minute" : `${s / 60} minutes`;
  return `${s} seconds`;
}
