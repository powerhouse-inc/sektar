import { reducer, utils } from "document-models/integration/v1";
import { actions } from "document-models/integration";
import { describe, expect, it } from "vitest";
import {
  aboutDuration,
  backfillPace,
  backfillRows,
  broughtIn,
  broughtLine,
  lastSynced,
  missedSlices,
  nextCheck,
  paceLine,
  runFeed,
  setupRows,
  sliceLabel,
  slicesLeft,
  sourceBadge,
  stuckSince,
  type RunRecord,
} from "./integration-detail.js";
import { createActions, defaultChoices } from "./integrations.js";

/** 28 Oct 2026 at h:m, local time (the feed shows local clock times) */
const at = (h: number, m: number) => new Date(2026, 9, 28, h, m).toISOString();
const NOW = Date.parse(at(21, 30));

function run(patch: Partial<RunRecord>): RunRecord {
  return {
    id: "r",
    status: "SUCCEEDED",
    error: null,
    startedAt: at(21, 20),
    endedAt: new Date(Date.parse(at(21, 20)) + 9000).toISOString(),
    triggerKind: "schedule",
    steps: [],
    ...patch,
  };
}

const upsert = (created: number, updated = 0, failed = 0) => ({
  stepKey: "upsert_emails",
  status: "SUCCEEDED",
  output: {
    created: Array.from({ length: created }, (_, i) => ({ index: i })),
    updated: Array.from({ length: updated }, (_, i) => ({ index: i })),
    failed: Array.from({ length: failed }, (_, i) => ({ index: i })),
    skipped: [],
  },
});

const slice = (from: string) => ({
  documentId: "q-1",
  ranges: { day: { from, to: from } },
});

/** Ids bf-1, bf-2, … */
function ids() {
  let n = 0;
  return () => `bf-${++n}`;
}

const mail = () =>
  createActions(
    defaultChoices("EMAIL", "gmail", new Date(NOW)),
    new Date(NOW),
    ids(),
  ).reduce((d, a) => reducer(d, a), utils.createDocument()).state.global;

describe("what a run brought in", () => {
  it("counts new items and leaves a mail check's matches out", () => {
    const b = broughtIn([
      { stepKey: "search_email", status: "SUCCEEDED", output: { found: true } },
      upsert(3, 100),
    ]);
    expect(b).toEqual({ created: 3, updated: 100, failed: 0 });
    expect(broughtLine(b!, "EMAIL")).toBe("3 new messages");
    expect(broughtLine({ created: 1, updated: 0, failed: 0 }, "EMAIL")).toBe(
      "1 new message",
    );
    expect(broughtLine({ created: 0, updated: 100, failed: 0 }, "EMAIL")).toBe(
      "Nothing new",
    );
  });

  it("says a calendar's updates, which are changes, and what was not written", () => {
    expect(broughtLine({ created: 1, updated: 2, failed: 1 }, "CALENDAR")).toBe(
      "1 new event · 2 updated · 1 not written",
    );
  });

  it("sums a bank's imports over its accounts", () => {
    const b = broughtIn([
      { stepKey: "pull", status: "SUCCEEDED", output: { transactions: [] } },
      { stepKey: "import_1", status: "SUCCEEDED", output: { imported: 2 } },
      { stepKey: "import_2", status: "SUCCEEDED", output: { imported: 1 } },
    ]);
    expect(broughtLine(b!, "TRANSACTIONS")).toBe("3 new transactions");
  });

  it("is unknown for a run that wrote nothing", () => {
    expect(
      broughtIn([{ stepKey: "a", status: "FAILED", output: null }]),
    ).toBeNull();
  });
});

describe("the Recent runs feed", () => {
  it("says what each run did, newest first", () => {
    const rows = runFeed(
      [
        run({ id: "a", steps: [upsert(2)] }),
        run({ id: "b", steps: [upsert(0, 100)], triggerKind: "manual" }),
        run({
          id: "c",
          status: "FAILED",
          error: 'Step "search_email" failed: Google said no',
        }),
        run({
          id: "d",
          status: "CANCELLED",
          error: "Skipped: this workflow is PARKED",
        }),
        run({ id: "e", status: "RUNNING", endedAt: null }),
      ],
      "EMAIL",
      NOW,
    );
    expect(rows.map((r) => [r.text, r.sub, r.problem, r.bold])).toEqual([
      ["2 new messages", "Scheduled check · took 9 s", false, true],
      ["Nothing new", "Started by hand · took 9 s", false, false],
      ["Failed", "Google said no", true, true],
      ["Skipped", "this workflow is PARKED", true, false],
      ["Running", "since 21:20", false, false],
    ]);
    expect(rows[0]?.time).toBe("21:20");
  });
});

describe("the live facts", () => {
  it("says when it last synced and what that brought in", () => {
    expect(
      lastSynced(at(21, 25), [run({ steps: [upsert(0, 9)] })], "EMAIL", NOW),
    ).toEqual({ when: "5 min ago", detail: "21:25 · nothing new" });
    expect(lastSynced(null, [], "EMAIL", NOW)).toBeNull();
  });

  it("says when the next check is", () => {
    expect(nextCheck(at(21, 33), NOW)).toBe("in 3 min");
    expect(
      nextCheck(new Date(Date.parse(at(21, 30)) + 10000).toISOString(), NOW),
    ).toBe("now");
    expect(nextCheck(null, NOW)).toBe("");
  });

  it("names the source in a badge", () => {
    expect(sourceBadge(mail())).toBe("All mail");
  });

  it("calls a run stuck once it has gone on for half an hour", () => {
    const runs = [
      run({ status: "PENDING", startedAt: at(21, 29) }),
      run({ status: "PENDING", startedAt: at(21, 28) }),
      run({ status: "RUNNING", startedAt: at(20, 50) }),
    ];
    expect(stuckSince(runs, NOW)).toEqual({ since: "20:50", waiting: 2 });
    expect(stuckSince(runs.slice(0, 2), NOW)).toBeNull();
  });
});

describe("the backfill", () => {
  it("finds the slices that were refused and never brought in, oldest first", () => {
    const newestFirst = [
      run({ id: "6", triggerPayload: slice("2014-02-06") }),
      run({
        id: "5",
        status: "CANCELLED",
        error: "Skipped: this workflow is PARKED",
        triggerPayload: slice("2014-02-05"),
      }),
      run({
        id: "4",
        status: "CANCELLED",
        error: "Skipped: this firing waited past its runTimeoutSeconds",
        triggerPayload: slice("2014-02-04"),
      }),
      // Brought in later by hand
      run({
        id: "3b",
        triggerKind: "manual",
        triggerPayload: slice("2014-02-03"),
      }),
      run({
        id: "3",
        status: "CANCELLED",
        error: "Skipped: this workflow is PARKED",
        triggerPayload: slice("2014-02-03"),
      }),
      // Failures are Try again's
      run({ id: "2", status: "FAILED", triggerPayload: slice("2014-02-02") }),
    ];
    const missed = missedSlices(newestFirst);
    expect(missed.map((r) => r.id)).toEqual(["4", "5"]);
    expect(sliceLabel(missed[0])).toBe("4 Feb 2014");
  });

  it("reads the pace from the slices it finished, and what is left", () => {
    const ends = ["21:20", "21:18", "21:16", "21:14"].map((t) =>
      run({ endedAt: at(Number(t.slice(0, 2)), Number(t.slice(3))) }),
    );
    const pace = backfillPace(ends);
    expect(pace).toEqual({ msPerSlice: 120_000 });
    expect(paceLine(pace!.msPerSlice, 86_400)).toBe("a day every 2 min");
    expect(paceLine(50_000, 7 * 86_400)).toBe("a week every minute");
    expect(aboutDuration(120_000 * 90)).toBe("about 3 hours");
    expect(aboutDuration(60_000 * 30)).toBe("about 30 min");
    expect(aboutDuration(3_600_000 * 72)).toBe("about 3 days");
    expect(backfillPace(ends.slice(0, 2))).toBeNull();
  });

  it("shows each backfill with its progress, the active one and gaps", () => {
    let state = mail();
    const [first] = state.intent.backfill.items;
    state = {
      ...state,
      intent: {
        ...state.intent,
        backfill: {
          ...state.intent.backfill,
          items: [
            { ...first, documentId: "q-1" },
            {
              id: "gap",
              label: "Gap: 18 Jul 2024 – 1 Jan 2026",
              documentType: "distyra/original-source-queue",
              documentId: "q-2",
              request: null,
            },
          ],
        },
      },
      resources: { ...state.resources, pluggedItemId: first.id },
    };
    const progress = new Map([
      ["q-1", { done: 30, total: 120, finished: false }],
      ["q-2", { done: 0, total: 532, finished: false }],
    ]);
    const rows = backfillRows(state, progress, "days");
    expect(
      rows.map((r) => [r.label, r.badge, r.meta, r.status, r.percent]),
    ).toEqual([
      [first.label, "Date range", "30 of 120 days", "active", 25],
      ["18 Jul 2024 – 1 Jan 2026", "Gap", "0 of 532 days", "waiting", 0],
    ]);
    expect(slicesLeft(state, progress)).toBe(90 + 532);
  });
});

describe("Setup", () => {
  it("says all is well, and what the reconciler put back", () => {
    let doc = utils.createDocument();
    doc = reducer(
      doc,
      actions.recordCheck({
        at: at(21, 2),
        generation: 0,
        issues: [],
        fixes: [
          {
            at: at(21, 2),
            code: "LIVE_WORKFLOW_DRIFT",
            message: "Put back: the workflow was off",
          },
        ],
        committed: true,
      }),
    );
    const rows = setupRows(doc.state.global, NOW);
    expect(rows.map((r) => [r.text, r.problem, r.time])).toEqual([
      ["Everything is set up as you asked", false, ""],
      ["Put back: the workflow was off", false, "21:02"],
    ]);
  });

  it("says what is wrong and who can fix it", () => {
    const doc = reducer(
      utils.createDocument(),
      actions.recordCheck({
        at: at(21, 2),
        generation: 0,
        issues: [
          {
            code: "NEEDS_SIGN_IN",
            severity: "BLOCKING",
            message: "Sign in to Google again",
            fixable: false,
            since: at(20, 0),
          },
        ],
        fixes: [],
        committed: false,
      }),
    );
    expect(
      setupRows(doc.state.global, NOW).map((r) => [r.text, r.sub, r.problem]),
    ).toEqual([["Sign in to Google again", "Only you can fix this", true]]);
  });
});
