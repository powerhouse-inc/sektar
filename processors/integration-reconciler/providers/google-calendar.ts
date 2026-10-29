/**
 * Google Calendar: the publisher's Google app with the calendar scopes the
 * user chose; live, the piece's polling trigger on the primary calendar;
 * per backfill slice, Get Events for the window. Both map events with the
 * distyra mapping and upsert them into the Calendar drive, keyed so nothing
 * doubles.
 */
import type { IntegrationState } from "document-models/integration";
import { humanSeconds, type StepSpec } from "../workflow-spec.js";
import { DISTYRA_PIECE, DISTYRA_PIECE_VERSION } from "../pieces.js";
import type { ProviderAdapter, ProviderContext } from "./types.js";

/** The publisher's Google app (powerhouse.config.json workflows.oauthApps). */
export const GOOGLE_APP = "sektar-google";

export const GOOGLE_CALENDAR_PIECE = "@activepieces/piece-google-calendar";
export const GOOGLE_CALENDAR_PIECE_VERSION = "0.13.3";
/** The calendar the pilot watches: the account's main calendar. */
export const PRIMARY_CALENDAR = "primary";
/** The Calendar drive's slug; the reconciler resolves it to the drive's id (ctx.driveId). */
export const CALENDAR_DRIVE = "calendar";
export const CALENDAR_EVENT_TYPE = "sektar/calendar-event";
export const GET_EVENTS_STEP = "get_events";

const CALENDAR_READ = "https://www.googleapis.com/auth/calendar.readonly";
/**
 * Who signed in: Google answers with an ID token naming the account, which
 * the runtime keeps as the connection's label (the Calendar piece has no
 * label of its own). Non-sensitive scopes.
 */
const IDENTITY = ["openid", "https://www.googleapis.com/auth/userinfo.email"];
const CALENDAR_EVENTS = "https://www.googleapis.com/auth/calendar.events";

const SECONDS = { MINUTES: 60, HOURS: 3600, DAYS: 86400 } as const;

/** The step that turns Google events into upsert items. */
export function mapEventsStep(events: string, calendarName: string): StepSpec {
  return {
    key: "map_events",
    name: "Google Calendar Events to Calendar Events",
    pieceName: DISTYRA_PIECE,
    pieceVersion: DISTYRA_PIECE_VERSION,
    actionName: "google-event-to-calendar-event",
    config: { events, calendarId: PRIMARY_CALENDAR, calendarName },
  };
}

/** The step that writes the events into the Calendar drive, keyed so nothing doubles. */
export function upsertEventsStep(reactorConnectionId: string, driveId: string): StepSpec {
  return {
    key: "upsert_events",
    name: "Upsert Documents",
    pieceName: DISTYRA_PIECE,
    pieceVersion: DISTYRA_PIECE_VERSION,
    actionName: "upsert-documents",
    reactorConnectionId,
    config: {
      items: "{{steps.map_events.output.items}}",
      documentType: CALENDAR_EVENT_TYPE,
      driveId,
      folderName: "$item.folder",
      itemKeyPath: "key",
      documentKeyPath: "externalId",
      name: "$item.name",
      createActions: "$item.actions",
      updateActions: "$item.updateActions",
      limit: 500,
      stopOnError: false,
    },
  };
}

const slice = (range: string, end: "from" | "to") =>
  `{{trigger.payload.ranges.${range}.${end}}}`;

export const googleCalendar: ProviderAdapter = {
  id: "google-calendar",
  label: "Google",
  drive: CALENDAR_DRIVE,
  auth: "oauth",
  backfillPollSeconds: 60,
  backfillSliceSeconds: 7 * 86_400,

  connection(name: string, state: IntegrationState) {
    const scopes = [
      ...IDENTITY,
      ...(state.intent.access === "READ_WRITE"
        ? [CALENDAR_READ, CALENDAR_EVENTS]
        : [CALENDAR_READ]),
    ];
    return {
      name: `${name} · Google`,
      connectorId: "@activepieces/piece-google-calendar#google-calendar",
      config: { oauth_app: GOOGLE_APP, oauth_scopes: scopes },
    };
  },

  live(ctx: ProviderContext) {
    const every = ctx.state.intent.live.every;
    return {
      name: `${ctx.name} · new events`,
      trigger: {
        pieceName: GOOGLE_CALENDAR_PIECE,
        pieceVersion: GOOGLE_CALENDAR_PIECE_VERSION,
        triggerName: "new_or_updated_event",
        connectionId: ctx.connectionId,
        config: {
          calendar_id: PRIMARY_CALENDAR,
          expandRecurringEvent: false,
          pollEverySeconds: every.value * SECONDS[every.unit],
        },
      },
      steps: [
        mapEventsStep("{{trigger.payload}}", ctx.name),
        upsertEventsStep(ctx.reactorConnectionId, ctx.driveId),
      ],
      config(actual, wanted) {
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
      },
    };
  },

  backfillSteps(ctx: ProviderContext, range: string) {
    return [
      {
        key: GET_EVENTS_STEP,
        name: "Get Events",
        pieceName: GOOGLE_CALENDAR_PIECE,
        pieceVersion: GOOGLE_CALENDAR_PIECE_VERSION,
        actionName: "google_calendar_get_events",
        connectionId: ctx.connectionId,
        config: {
          calendar_id: PRIMARY_CALENDAR,
          event_types: ["default", "focusTime", "outOfOffice"],
          start_date: slice(range, "from"),
          end_date: slice(range, "to"),
          singleEvents: false,
        },
      },
      // The whole answer, so the mapping can refuse a window with a second page
      mapEventsStep(`{{steps.${GET_EVENTS_STEP}.output.body}}`, ctx.name),
      upsertEventsStep(ctx.reactorConnectionId, ctx.driveId),
    ];
  },
};
