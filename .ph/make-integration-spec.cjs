// Writes specs/integration.json: the sektar/integration document model (v1).
// Run: node .ph/make-integration-spec.cjs
//
// One thing the user recognises ("Work mail", "Google Calendar") and keeps in
// sync with Sektar: what they asked for (the intent), what the reconciler on
// the runner built for it (resources), the last generation it committed, its
// last check, and what it put back. The live facts (last poll, runs, backfill
// progress) are read from the workflows and backfills it references, never
// copied in here. Design: workspace/integrations-design.md, section 4.
const fs = require("fs");
const crypto = require("crypto");
const id = () => crypto.randomUUID();

const stateSchema = `type IntegrationState {
  "What comes in; fixed by INITIALIZE. Null until then"
  kind: IntegrationKind
  "How it comes in: a provider adapter id (google-calendar, gmail, imap). Null until INITIALIZE"
  provider: String
  "Settings only this provider has, checked by its adapter"
  providerOptions: Unknown
  "What the user asked for; written from the app"
  intent: IntegrationIntent!
  "What the reconciler built for the intent"
  resources: IntegrationResources!
  "The last intent generation the reconciler committed"
  applied: IntegrationApplied
  "The reconciler's last pass: what it found"
  check: IntegrationCheck
  "A check asked for from the app (Check now)"
  checkRequest: IntegrationCheckRequest
  "What the reconciler put back, latest first, at most 20"
  fixes: [IntegrationFix!]!
  "The reactor that fetches and holds the token; null: the switchboard that owns this drive, until it claims it"
  runner: IntegrationRunner
}

enum IntegrationKind {
  EMAIL
  TRANSACTIONS
  CALENDAR
  TIME_TRACKING
}

type IntegrationIntent {
  "Raised by every change to the intent; the reconciler commits a generation"
  generation: Int!
  "An existing connection the user picked; null: the reconciler makes one (resources.connectionId)"
  connectionId: PHID
  "The drive the imported documents land in; null: the kind's default drive"
  targetDriveId: PHID
  "What to bring in, per kind and provider-neutral"
  source: IntegrationSource
  live: LiveIntent!
  backfill: BackfillIntent!
  "An archived integration's workflows are archived; its data stays"
  archived: Boolean!
}

union IntegrationSource = CalendarSource | EmailSource

type CalendarSource {
  "The calendars picked; empty while allOwned"
  calendars: [CalendarRef!]!
  "Every calendar the account owns, including ones added later"
  allOwned: Boolean!
}

type CalendarRef {
  "The provider's calendar id"
  id: String!
  name: String
}

type EmailSource {
  mailbox: String!
  folders: [String!]!
}

type LiveIntent {
  "The Live updates switch"
  enabled: Boolean!
  "How often to check for what is new"
  every: Interval!
}

type Interval {
  value: Int!
  unit: IntervalUnit!
}

enum IntervalUnit {
  MINUTES
  HOURS
  DAYS
}

type BackfillIntent {
  "The Backfill switch: the backfill workflow on or off"
  enabled: Boolean!
  "How much per run, and how often; null: the provider's default"
  batch: BackfillBatch
  "In the order they run"
  items: [BackfillItem!]!
  "Make active; null: the first unfinished item"
  pinnedId: OID
}

type BackfillBatch {
  size: Int!
  every: Interval!
}

type BackfillItem {
  id: OID!
  "e.g. 2023 to today"
  label: String!
  "Any backfill document type with an adapter"
  documentType: String!
  "Null until the reconciler has created it from the request"
  documentId: PHID
  "How to create it; null when an existing document was attached"
  request: BackfillRequest
}

union BackfillRequest = DateRangeBackfill | FolderListBackfill

type DateRangeBackfill {
  from: DateTime!
  to: DateTime!
  "The size of one slice"
  stepSeconds: Int!
}

type FolderListBackfill {
  folders: [String!]!
}

type IntegrationResources {
  "The connection the reconciler made, when the intent names none"
  connectionId: PHID
  liveWorkflowId: PHID
  backfillWorkflowId: PHID
  "The backfill item the backfill workflow points at now"
  pluggedItemId: OID
}

type IntegrationApplied {
  generation: Int!
  at: DateTime!
  host: String
}

type IntegrationCheck {
  at: DateTime!
  host: String
  "The intent generation this pass evaluated"
  generation: Int!
  "The check request it answered, if any"
  request: OID
  issues: [IntegrationIssue!]!
}

type IntegrationIssue {
  "Plugin-defined, e.g. NEEDS_SIGN_IN, LIVE_WORKFLOW_MISSING, COVERAGE_GAP"
  code: String!
  severity: IssueSeverity!
  "The workflow, backfill or connection it is about"
  subject: PHID
  "In the user's words"
  message: String!
  "False: only the user can fix it (Reconnect)"
  fixable: Boolean!
  since: DateTime!
}

enum IssueSeverity {
  INFO
  WARNING
  BLOCKING
}

type IntegrationCheckRequest {
  id: OID!
  requestedAt: DateTime!
  requestedBy: String
}

type IntegrationFix {
  at: DateTime!
  code: String!
  subject: PHID
  "Put back: ..."
  message: String!
}

type IntegrationRunner {
  reactorId: String!
  "The machine's name, e.g. Wouter's PC"
  label: String
}`;

const initialState = {
  kind: null,
  provider: null,
  providerOptions: null,
  intent: {
    generation: 0,
    connectionId: null,
    targetDriveId: null,
    source: null,
    live: { enabled: true, every: { value: 5, unit: "MINUTES" } },
    backfill: { enabled: true, batch: null, items: [], pinnedId: null },
    archived: false,
  },
  resources: {
    connectionId: null,
    liveWorkflowId: null,
    backfillWorkflowId: null,
    pluggedItemId: null,
  },
  applied: null,
  check: null,
  checkRequest: null,
  fixes: [],
  runner: null,
};

const err = (code, name, description) => ({
  id: id(),
  code,
  name,
  description,
  template: "",
});
const op = (name, schema, reducer, errors = []) => ({
  id: id(),
  name,
  description: "",
  schema,
  template: "",
  reducer,
  errors,
  examples: [],
  scope: "global",
});

const already = () =>
  err(
    "ALREADY_INITIALIZED",
    "AlreadyInitializedError",
    "The integration's kind and provider are set once",
  );
const wrongKind = () =>
  err(
    "WRONG_KIND",
    "WrongKindError",
    "This source belongs to another kind of integration",
  );
const badInterval = () =>
  err(
    "INVALID_INTERVAL",
    "InvalidIntervalError",
    "An interval is at least one unit",
  );
const dupItem = () =>
  err(
    "DUPLICATE_BACKFILL_ID",
    "DuplicateBackfillIdError",
    "A backfill with this id exists",
  );
const badRange = () =>
  err(
    "INVALID_RANGE",
    "InvalidRangeError",
    "A date range starts before it ends, in slices of at least a minute",
  );

const bump = "state.intent.generation += 1;";

const modules = [
  {
    id: id(),
    name: "setup",
    // The name is the document's own (header.name: set at creation, renamed
    // with the built-in SET_NAME), so the drive and the card always agree.
    description: "What the integration is: its kind, provider and source",
    operations: [
      op(
        "INITIALIZE",
        `input InitializeInput {
  kind: IntegrationKind!
  provider: String!
}`,
        `if (state.kind) throw new AlreadyInitializedError("The integration is set up already");
state.kind = action.input.kind;
state.provider = action.input.provider;`,
        [already()],
      ),
      op(
        "SET_CALENDAR_SOURCE",
        `input CalendarRefInput {
  id: String!
  name: String
}

input SetCalendarSourceInput {
  calendars: [CalendarRefInput!]!
  allOwned: Boolean!
}`,
        `if (state.kind !== "CALENDAR") throw new WrongKindError("Only a calendar integration has calendars");
state.intent.source = {
  calendars: action.input.allOwned
    ? []
    : action.input.calendars.map((c) => ({ id: c.id, name: c.name ?? null })),
  allOwned: action.input.allOwned,
};
${bump}`,
        [wrongKind()],
      ),
    ],
  },
  {
    id: id(),
    name: "live",
    description: "Live updates: on or off, and how often",
    operations: [
      op(
        "SET_LIVE_ENABLED",
        `input SetLiveEnabledInput {
  enabled: Boolean!
}`,
        `state.intent.live.enabled = action.input.enabled;
${bump}`,
      ),
      op(
        "SET_LIVE_INTERVAL",
        `input SetLiveIntervalInput {
  value: Int!
  unit: IntervalUnit!
}`,
        `if (!Number.isInteger(action.input.value) || action.input.value < 1) throw new InvalidIntervalError(\`\${action.input.value} is not a whole number of at least 1\`);
state.intent.live.every = { value: action.input.value, unit: action.input.unit };
${bump}`,
        [badInterval()],
      ),
    ],
  },
  {
    id: id(),
    name: "backfill",
    description: "Backfills: the switch and the history to bring in",
    operations: [
      op(
        "SET_BACKFILL_ENABLED",
        `input SetBackfillEnabledInput {
  enabled: Boolean!
}`,
        `state.intent.backfill.enabled = action.input.enabled;
${bump}`,
      ),
      op(
        "ADD_DATE_RANGE_BACKFILL",
        `input AddDateRangeBackfillInput {
  id: OID!
  label: String!
  documentType: String!
  from: DateTime!
  to: DateTime!
  stepSeconds: Int!
}`,
        `const i = action.input;
if (state.intent.backfill.items.some((b) => b.id === i.id)) throw new DuplicateBackfillIdError(\`A backfill \${i.id} exists\`);
if (!(Date.parse(i.from) < Date.parse(i.to)) || !Number.isInteger(i.stepSeconds) || i.stepSeconds < 60) throw new InvalidRangeError(\`\${i.from} to \${i.to} in \${i.stepSeconds} s slices\`);
state.intent.backfill.items.push({
  id: i.id,
  label: i.label,
  documentType: i.documentType,
  documentId: null,
  request: { from: i.from, to: i.to, stepSeconds: i.stepSeconds },
});
${bump}`,
        [dupItem(), badRange()],
      ),
    ],
  },
];

const spec = {
  id: "sektar/integration",
  name: "Integration",
  author: { name: "Sektar", website: "https://sektar.app" },
  extension: "intg",
  description:
    "An account Sektar keeps in sync (mail, bank, calendar, hours): what the user asked for, what the reconciler on the runner built for it, the generation it committed, and what it found on its last check.",
  specifications: [
    {
      version: 1,
      changeLog: [],
      state: {
        global: {
          schema: stateSchema,
          initialValue: JSON.stringify(initialState, null, 2),
          examples: [],
        },
        local: { schema: "", initialValue: "", examples: [] },
      },
      modules,
    },
  ],
};
fs.writeFileSync(
  "specs/integration.json",
  JSON.stringify(spec, null, 2) + "\n",
);
console.log(
  "specs/integration.json:",
  modules.reduce((n, m) => n + m.operations.length, 0),
  "operations",
);
