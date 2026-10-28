import {
  reducer,
  utils,
  type IntegrationDocument,
} from "document-models/integration/v1";
import { describe, expect, it } from "vitest";
import {
  accessOptions,
  cardView,
  hasBuiltAnything,
  removalPlan,
  createActions,
  DATE_RANGE_BACKFILL_TYPE,
  defaultChoices,
  defaultName,
  defaultSince,
  importRange,
  intervalLabel,
  kindInfo,
  providersFor,
  rangeLabel,
  type CreateChoices,
} from "./integrations.js";

// 28 Oct 2026, mid-morning
const NOW = new Date(2026, 9, 28, 9, 30);

const calendar = (patch: Partial<CreateChoices> = {}): CreateChoices => ({
  ...defaultChoices("CALENDAR", "google-calendar", NOW),
  ...patch,
});

function created(choices: CreateChoices = calendar()): IntegrationDocument {
  return createActions(choices, NOW, "bf-1").reduce(
    (doc, action) => reducer(doc, action),
    utils.createDocument(),
  );
}

describe("what the create flow offers", () => {
  it("offers Calendar with Google; the rest is coming", () => {
    expect(kindInfo("CALENDAR")?.available).toBe(true);
    expect(kindInfo("EMAIL")?.available).toBe(false);
    expect(providersFor("CALENDAR").map((p) => [p.id, p.available])).toEqual([
      ["google-calendar", true],
      ["microsoft-calendar", false],
      ["caldav", false],
    ]);
    expect(kindInfo(null)).toBeUndefined();
  });

  it("names it after the provider and kind, and defaults to since 1 Jan last year", () => {
    expect(defaultName("CALENDAR", "google-calendar")).toBe("Google Calendar");
    expect(defaultName("CALENDAR", "nope")).toBe("Calendar");
    expect(defaultSince(NOW)).toBe("2025-01-01");
    const c = calendar();
    expect(c.live).toBe(true);
    expect(c.every).toEqual({ value: 5, unit: "MINUTES" });
    expect(c.history).toEqual({ kind: "since", date: "2025-01-01" });
  });
});

describe("how much", () => {
  it("reaches 12 months ahead from today, whatever the history", () => {
    expect(importRange({ kind: "none" }, NOW)).toEqual({
      from: "2026-10-28T00:00:00.000Z",
      to: "2027-10-28T00:00:00.000Z",
    });
    expect(importRange({ kind: "since", date: "2025-01-01" }, NOW).from).toBe(
      "2025-01-01T00:00:00.000Z",
    );
    expect(importRange({ kind: "everything" }, NOW).from).toBe(
      "2000-01-01T00:00:00.000Z",
    );
  });

  it("treats a future or unreadable date as today", () => {
    expect(importRange({ kind: "since", date: "2030-05-01" }, NOW).from).toBe(
      "2026-10-28T00:00:00.000Z",
    );
    expect(importRange({ kind: "since", date: "" }, NOW).from).toBe(
      "2026-10-28T00:00:00.000Z",
    );
  });

  it("says the range and the interval in words", () => {
    expect(rangeLabel({ kind: "none" }, NOW)).toBe("Today to 12 months ahead");
    expect(rangeLabel({ kind: "everything" }, NOW)).toBe(
      "Everything to 12 months ahead",
    );
    expect(rangeLabel({ kind: "since", date: "2025-01-01" }, NOW)).toBe(
      "1 Jan 2025 to 12 months ahead",
    );
    expect(intervalLabel({ value: 5, unit: "MINUTES" })).toBe(
      "every 5 minutes",
    );
    expect(intervalLabel({ value: 1, unit: "HOURS" })).toBe("every hour");
    expect(intervalLabel({ value: 2, unit: "DAYS" })).toBe("every 2 days");
  });
});

describe("access", () => {
  it("offers read only first, then read and write, with the provider permission each asks for", () => {
    const [read, write] = accessOptions("google-calendar");
    expect(read).toMatchObject({ access: "READ" });
    expect(read.permission).toBe("Google: calendar.readonly");
    expect(write).toMatchObject({ access: "READ_WRITE" });
    expect(write.cannot).toEqual(["Delete events"]);
    expect(accessOptions("caldav")).toEqual([]);
    expect(accessOptions(null)).toEqual([]);
  });

  it("defaults to read only and writes the choice", () => {
    expect(calendar().access).toBe("READ");
    expect(
      created(calendar({ access: "READ_WRITE" })).state.global.intent.access,
    ).toBe("READ_WRITE");
  });
});

describe("removal", () => {
  it("removes right away what never built anything", () => {
    const plan = removalPlan(created().state.global);
    expect(plan.immediate).toBe(true);
    expect(plan.keeps).toContain("stays in Sektar");
    expect(hasBuiltAnything(created().state.global)).toBe(false);
  });

  it("hands built things to the runner to take down first", () => {
    const s = structuredClone(created().state.global);
    s.resources.liveWorkflowId = "wf";
    const plan = removalPlan(s);
    expect(plan.immediate).toBe(false);
    expect(plan.steps.join(" ")).toContain("signs out of Google");
    const backfillOnly = structuredClone(created().state.global);
    backfillOnly.intent.backfill.items[0]!.documentId = "osq";
    expect(hasBuiltAnything(backfillOnly)).toBe(true);
  });

  it("names the kind and account generically when they are unknown", () => {
    const plan = removalPlan(utils.createDocument().state.global);
    expect(plan.keeps).toBe(
      "Everything already brought in stays in Sektar. The account itself is not changed.",
    );
    expect(removalPlan(created().state.global).keeps).toContain(
      "Your Google account itself",
    );
  });

  it("calls a document whose setup never finished incomplete", () => {
    expect(cardView(utils.createDocument().state.global)).toMatchObject({
      state: "incomplete",
      line: "Its setup did not finish. Remove it and add it again.",
    });
  });

  it("shows Removing once archived", () => {
    const s = structuredClone(created().state.global);
    s.intent.archived = true;
    expect(cardView(s).state).toBe("removing");
  });
});

describe("Create", () => {
  it("writes the intent in one batch the model accepts", () => {
    const doc = created();
    expect(doc.operations.global.every((op) => !op.error)).toBe(true);
    const s = doc.state.global;
    expect(s.kind).toBe("CALENDAR");
    expect(s.provider).toBe("google-calendar");
    expect(s.intent.source).toEqual({ calendars: [], allOwned: true });
    expect(s.intent.live).toEqual({
      enabled: true,
      every: { value: 5, unit: "MINUTES" },
    });
    expect(s.intent.backfill.items).toEqual([
      expect.objectContaining({
        id: "bf-1",
        label: "1 Jan 2025 to 12 months ahead",
        documentType: DATE_RANGE_BACKFILL_TYPE,
        request: {
          from: "2025-01-01T00:00:00.000Z",
          to: "2027-10-28T00:00:00.000Z",
          stepSeconds: 2592000,
        },
      }),
    ]);
  });
});

describe("cardView", () => {
  const withState = (
    doc: IntegrationDocument,
    patch: (s: IntegrationDocument["state"]["global"]) => void,
  ) => {
    const s = structuredClone(doc.state.global);
    patch(s);
    return s;
  };

  it("waits for sign-in until the runner has a connection", () => {
    const view = cardView(created().state.global);
    expect(view.state).toBe("waiting-for-sign-in");
    expect(view.line).toBe(
      "Sign in on the computer that runs Sektar to finish",
    );
    const named = cardView(
      withState(created(), (s) => {
        s.runner = { reactorId: "r1", label: "Wouter's PC" };
      }),
    );
    expect(named.line).toBe("Sign in on Wouter's PC to finish");
  });

  it("keeps waiting while the runner reports that a sign-in is needed", () => {
    const view = cardView(
      withState(created(), (s) => {
        s.resources.connectionId = "conn";
        s.check = {
          at: "2026-10-28T10:00:00.000Z",
          host: "pc",
          generation: 4,
          request: null,
          issues: [
            {
              code: "NEEDS_SIGN_IN",
              severity: "BLOCKING",
              subject: "conn",
              message: "Sign in",
              fixable: false,
              since: "2026-10-28T10:00:00.000Z",
            },
          ],
        };
      }),
    );
    expect(view.state).toBe("waiting-for-sign-in");
  });

  it("applies, then goes live or paused once the generation is committed", () => {
    const signedIn = withState(created(), (s) => {
      s.resources.connectionId = "conn";
    });
    expect(cardView(signedIn).state).toBe("applying");
    const committed = {
      ...signedIn,
      applied: {
        generation: signedIn.intent.generation,
        at: "2026-10-28T10:00:00.000Z",
        host: "pc",
      },
    };
    expect(cardView(committed)).toEqual({
      state: "live",
      badge: { label: "Live", tone: "success", dot: true },
      line: "Checks for changes every 5 minutes",
    });
    const paused = structuredClone(committed);
    paused.intent.live.enabled = false;
    expect(cardView(paused).state).toBe("paused");
  });

  it("puts a blocking problem first, in the runner's words", () => {
    const view = cardView(
      withState(created(), (s) => {
        s.resources.connectionId = "conn";
        s.check = {
          at: "2026-10-28T10:00:00.000Z",
          host: "pc",
          generation: 4,
          request: null,
          issues: [
            {
              code: "CONNECTION_REVOKED",
              severity: "BLOCKING",
              subject: "conn",
              message: "Google access was removed. Reconnect.",
              fixable: false,
              since: "2026-10-28T10:00:00.000Z",
            },
          ],
        };
      }),
    );
    expect(view).toEqual({
      state: "attention",
      badge: { label: "Needs attention", tone: "danger", dot: true },
      line: "Google access was removed. Reconnect.",
    });
  });
});
