/**
 * The integrations' words and rules that the page, the create flow and the
 * cards share, kept free of React so they can be tested on their own: the
 * kinds and providers the flow offers, what a choice of "how much" means,
 * the actions Create dispatches, and the state a card shows.
 * Design: workspace/integrations-design.md; pilot: calendar-integration-pilot.md.
 */
import {
  actions,
  type IntegrationAccess,
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

/**
 * What each access level lets Sektar do with the account, in the user's
 * words, and the provider permission it maps to (the scope override asks for
 * exactly this, so the provider's own consent screen says the same).
 */
export type AccessOption = {
  access: IntegrationAccess;
  label: string;
  can: string[];
  cannot: string[];
  /** The provider's permission, shown small for those who check */
  permission: string;
};

const ACCESS: Record<string, AccessOption[]> = {
  "google-calendar": [
    {
      access: "READ",
      label: "Read only",
      can: [
        "See your calendars and events",
        "See guests, places and attachments",
      ],
      cannot: ["Change or delete anything"],
      permission: "Google: calendar.readonly",
    },
    {
      access: "READ_WRITE",
      label: "Read and write",
      can: [
        "Everything in Read only",
        "Add events, like trips you plan",
        "Change events Sektar added",
      ],
      cannot: ["Delete events"],
      permission: "Google: calendar.events",
    },
  ],
};

export function accessOptions(
  provider: string | null | undefined,
): AccessOption[] {
  return (provider && ACCESS[provider]) || [];
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
  access: IntegrationAccess;
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
    access: "READ",
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
    actions.setAccess({ access: choices.access }),
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
  | "attention"
  | "removing"
  | "incomplete";

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
  if (!state.kind) {
    return {
      state: "incomplete",
      badge: { label: "Incomplete", tone: "warning" },
      line: "Its setup did not finish. Remove it and add it again.",
    };
  }
  if (state.intent.archived) {
    return {
      state: "removing",
      badge: { label: "Removing", tone: "outline" },
      line: "Taking down what Sektar set up for it",
    };
  }
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

/** Whether anything was built for an integration: a connection, a workflow or a backfill document. */
export function hasBuiltAnything(state: IntegrationState): boolean {
  const r = state.resources;
  return Boolean(
    r.connectionId ||
    r.liveWorkflowId ||
    r.backfillWorkflowId ||
    state.intent.backfill.items.some((b) => b.documentId),
  );
}

export type RemovalPlan = {
  /** Nothing was built: the document goes now. Otherwise the runner takes things down first. */
  immediate: boolean;
  /** What removing does, in order, in the user's words */
  steps: string[];
  /** What stays */
  keeps: string;
};

/**
 * What removing an integration does. Built things are taken down by the
 * reconciler on the runner (it holds the token and the workflows), so the app
 * only records the wish (ARCHIVE) and the card says Removing until it is done.
 */
export function removalPlan(state: IntegrationState): RemovalPlan {
  const kind = kindInfo(state.kind)?.label.toLowerCase() ?? "integration";
  const known = providerInfo(state.provider)?.label;
  const provider = known ?? "the account";
  const keeps = `Everything already brought in stays in Sektar. ${known ? `Your ${known} account` : "The account"} itself is not changed.`;
  if (!hasBuiltAnything(state)) {
    return {
      immediate: true,
      steps: [
        "Nothing has been set up for it yet, so it is removed right away.",
      ],
      keeps,
    };
  }
  return {
    immediate: false,
    steps: [
      "Live updates and the history import stop.",
      `The workflows Sektar made for this ${kind} are archived.`,
      `Sektar signs out of ${provider} and forgets the sign-in on the computer that runs it.`,
      "Then the integration disappears from this page.",
    ],
    keeps,
  };
}
