/**
 * The integrations' words and rules that the page, the create flow and the
 * cards share, kept free of React so they can be tested on their own: the
 * kinds and providers the flow offers, what a choice of "how much" means,
 * the actions Create dispatches, and the state a card shows.
 * Design: workspace/integrations-design.md; pilot: calendar-integration-pilot.md.
 */
import {
  actions,
  type IntegrationAction,
  type IntegrationKind,
  type IntegrationState,
  type IntervalUnit,
} from "document-models/integration";
import type { BadgeTone } from "./format.js";
import type { IconName } from "./ui.js";

export const INTEGRATION_TYPE = "sektar/integration";
/** The backfill document type the reconciler creates for a date range. */
export const DATE_RANGE_BACKFILL_TYPE = "distyra/original-source-queue";

export type KindInfo = {
  kind: IntegrationKind;
  label: string;
  /** One line under the label on the "What to bring in" tile */
  lead: string;
  icon: IconName;
  /** Offered in the create flow; the others say Coming soon */
  available: boolean;
};

/** In the order the "What to bring in" step shows them. */
export const KINDS: readonly KindInfo[] = [
  {
    kind: "CALENDAR",
    label: "Calendar",
    lead: "Events and meetings",
    icon: "calendar",
    available: true,
  },
  {
    kind: "EMAIL",
    label: "Email",
    lead: "Messages and attachments",
    icon: "mail",
    available: false,
  },
  {
    kind: "TRANSACTIONS",
    label: "Bank transactions",
    lead: "Payments in and out",
    icon: "bank",
    available: false,
  },
  {
    kind: "TIME_TRACKING",
    label: "Time tracking",
    lead: "Hours worked",
    icon: "reports",
    available: false,
  },
];

export function kindInfo(
  kind: IntegrationKind | null | undefined,
): KindInfo | undefined {
  return KINDS.find((k) => k.kind === kind);
}

export type ProviderInfo = {
  id: string;
  kind: IntegrationKind;
  /** As people know it */
  label: string;
  lead: string;
  /** What it can do, in a badge: Instant, Every 5 min */
  badge: string;
  /** The tile's letter or icon; no brand marks */
  mark: string;
  available: boolean;
};

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "google-calendar",
    kind: "CALENDAR",
    label: "Google",
    lead: "Google Calendar and Workspace",
    badge: "Every 5 min",
    mark: "G",
    available: true,
  },
  {
    id: "microsoft-calendar",
    kind: "CALENDAR",
    label: "Microsoft 365",
    lead: "Outlook and Exchange",
    badge: "Coming soon",
    mark: "M",
    available: false,
  },
  {
    id: "caldav",
    kind: "CALENDAR",
    label: "Other calendar",
    lead: "iCloud, Fastmail and others",
    badge: "Coming soon",
    mark: "",
    available: false,
  },
];

export function providersFor(kind: IntegrationKind): ProviderInfo[] {
  return PROVIDERS.filter((p) => p.kind === kind);
}

export function providerInfo(
  id: string | null | undefined,
): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export type History =
  | { kind: "none" }
  | { kind: "since"; date: string }
  | { kind: "everything" };

/** What the user picked in the flow, before anything is written. */
export type CreateChoices = {
  kind: IntegrationKind;
  provider: string;
  name: string;
  live: boolean;
  every: { value: number; unit: IntervalUnit };
  history: History;
};

/** The intervals the "Check every" select offers. */
export const INTERVALS: readonly {
  value: number;
  unit: IntervalUnit;
  label: string;
}[] = [
  { value: 5, unit: "MINUTES", label: "5 minutes" },
  { value: 15, unit: "MINUTES", label: "15 minutes" },
  { value: 1, unit: "HOURS", label: "hour" },
];

/** Months ahead a calendar's first import reaches. */
export const MONTHS_AHEAD = 12;
/** "Everything": earlier than any calendar a person still keeps. */
const EVERYTHING_FROM = "2000-01-01";
/** One slice of a calendar backfill: a month of events. */
export const CALENDAR_SLICE_SECONDS = 30 * 24 * 3600;

/** 1 January of last year, as yyyy-mm-dd: the "Since" default. */
export function defaultSince(now: Date): string {
  return `${now.getFullYear() - 1}-01-01`;
}

export function defaultChoices(
  kind: IntegrationKind,
  provider: string,
  now: Date,
): CreateChoices {
  return {
    kind,
    provider,
    name: defaultName(kind, provider),
    live: true,
    every: { value: 5, unit: "MINUTES" },
    history: { kind: "since", date: defaultSince(now) },
  };
}

export function defaultName(kind: IntegrationKind, provider: string): string {
  const p = providerInfo(provider);
  const k = kindInfo(kind);
  return [p?.label, k?.label].filter(Boolean).join(" ") || "Integration";
}

const startOfDayUtc = (d: Date) =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/** The range the first import covers: from the history choice to MONTHS_AHEAD from today. */
export function importRange(
  history: History,
  now: Date,
): { from: string; to: string } {
  const today = startOfDayUtc(now);
  const ahead = new Date(today);
  ahead.setUTCMonth(ahead.getUTCMonth() + MONTHS_AHEAD);
  const from =
    history.kind === "none"
      ? today
      : history.kind === "everything"
        ? Date.parse(`${EVERYTHING_FROM}T00:00:00.000Z`)
        : Date.parse(`${history.date}T00:00:00.000Z`);
  return {
    from: new Date(
      Number.isNaN(from) ? today : Math.min(from, today),
    ).toISOString(),
    to: ahead.toISOString(),
  };
}

const MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "1 Jan 2025 to 12 months ahead", "Today to 12 months ahead" */
export function rangeLabel(history: History, now: Date): string {
  const ahead = `${MONTHS_AHEAD} months ahead`;
  if (history.kind === "none") return `Today to ${ahead}`;
  if (history.kind === "everything") return `Everything to ${ahead}`;
  const { from } = importRange(history, now);
  return `${MONTH.format(new Date(from))} to ${ahead}`;
}

export function intervalLabel(every: {
  value: number;
  unit: IntervalUnit;
}): string {
  const unit =
    every.unit === "MINUTES"
      ? "minute"
      : every.unit === "HOURS"
        ? "hour"
        : "day";
  return every.value === 1 ? `every ${unit}` : `every ${every.value} ${unit}s`;
}

/** What Sektar will set up, in one or two sentences, for the flow's last steps. */
export function setupSummary(choices: CreateChoices, now: Date): string {
  const provider = providerInfo(choices.provider)?.label ?? "the account";
  const live = choices.live
    ? `checks your ${provider} calendars for changes ${intervalLabel(choices.every)}`
    : `keeps live updates off for now`;
  const history =
    choices.history.kind === "none"
      ? `brings in your events from today to ${MONTHS_AHEAD} months ahead`
      : choices.history.kind === "everything"
        ? `brings in all your events, up to ${MONTHS_AHEAD} months ahead`
        : `brings in your events from ${MONTH.format(new Date(importRange(choices.history, now).from))} to ${MONTHS_AHEAD} months ahead`;
  return `Sektar ${live}, and ${history}. You sign in with ${provider} on the computer that runs Sektar to start.`;
}

/**
 * The actions Create dispatches on the new document, in one batch: the kind,
 * the source, live updates, and the first import as a date-range backfill.
 * The document's name is set when it is created (the built-in name).
 */
export function createActions(
  choices: CreateChoices,
  now: Date,
  backfillId: string,
): IntegrationAction[] {
  const range = importRange(choices.history, now);
  return [
    actions.initialize({ kind: choices.kind, provider: choices.provider }),
    actions.setCalendarSource({ calendars: [], allOwned: true }),
    actions.setLiveEnabled({ enabled: choices.live }),
    actions.setLiveInterval({
      value: choices.every.value,
      unit: choices.every.unit,
    }),
    actions.setBackfillEnabled({ enabled: true }),
    actions.addDateRangeBackfill({
      id: backfillId,
      label: rangeLabel(choices.history, now),
      documentType: DATE_RANGE_BACKFILL_TYPE,
      from: range.from,
      to: range.to,
      stepSeconds: CALENDAR_SLICE_SECONDS,
    }),
  ];
}

export type CardState =
  | "waiting-for-sign-in"
  | "applying"
  | "live"
  | "paused"
  | "attention";

export type CardView = {
  state: CardState;
  badge: { label: string; tone: BadgeTone; dot?: boolean };
  /** One line under the head, in the user's words */
  line: string;
};

/**
 * What a card shows, from the document alone. Later steps add the live facts
 * (last sync, runs, backfill progress) read from the workflows; this is the
 * part the document can answer.
 */
export function cardView(state: IntegrationState): CardView {
  const where = state.runner?.label
    ? state.runner.label
    : "the computer that runs Sektar";
  const blocking = state.check?.issues.find(
    (i) => i.severity === "BLOCKING" && i.code !== "NEEDS_SIGN_IN",
  );
  if (blocking) {
    return {
      state: "attention",
      badge: { label: "Needs attention", tone: "danger", dot: true },
      line: blocking.message,
    };
  }
  const signedIn =
    Boolean(state.resources.connectionId) &&
    !state.check?.issues.some((i) => i.code === "NEEDS_SIGN_IN");
  if (!signedIn) {
    return {
      state: "waiting-for-sign-in",
      badge: { label: "Waiting for sign-in", tone: "warning", dot: true },
      line: `Sign in on ${where} to finish`,
    };
  }
  if ((state.applied?.generation ?? -1) < state.intent.generation) {
    return {
      state: "applying",
      badge: { label: "Applying", tone: "outline" },
      line: "Setting up what you asked for",
    };
  }
  if (!state.intent.live.enabled) {
    return {
      state: "paused",
      badge: { label: "Paused", tone: "outline" },
      line: "Live updates are off",
    };
  }
  return {
    state: "live",
    badge: { label: "Live", tone: "success", dot: true },
    line: `Checks for changes ${intervalLabel(state.intent.live.every)}`,
  };
}
