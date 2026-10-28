import {
  addDateRangeBackfill,
  recordCheck,
  recordResources,
  recordRunner,
  requestCheck,
  archive,
  setAccess,
  initialize,
  isIntegrationDocument,
  reducer,
  setBackfillEnabled,
  setCalendarSource,
  setLiveEnabled,
  setLiveInterval,
  utils,
  type IntegrationDocument,
} from "document-models/integration/v1";
import { describe, expect, it } from "vitest";

const OSQ = "distyra/original-source-queue";

type Action = Parameters<typeof reducer>[1];
const apply = (doc: IntegrationDocument, ...actions: Action[]) =>
  actions.reduce((d, a) => reducer(d, a), doc);
const lastError = (doc: IntegrationDocument) =>
  doc.operations.global.at(-1)?.error;
/** Applies one action that must fail, and checks the state did not move. */
function rejects(doc: IntegrationDocument, action: Action, message: RegExp) {
  const before = JSON.stringify(doc.state.global);
  const next = reducer(doc, action);
  expect(lastError(next)).toMatch(message);
  expect(JSON.stringify(next.state.global)).toBe(before);
  return next;
}

/** A calendar integration as the create flow writes it, in one batch. */
function created() {
  return apply(
    utils.createDocument(),
    initialize({ kind: "CALENDAR", provider: "google-calendar" }),
    setCalendarSource({ calendars: [], allOwned: true }),
    setLiveEnabled({ enabled: true }),
    setLiveInterval({ value: 5, unit: "MINUTES" }),
    addDateRangeBackfill({
      id: "bf-1",
      label: "1 Jan 2025 to 12 months ahead",
      documentType: OSQ,
      from: "2025-01-01T00:00:00.000Z",
      to: "2027-10-28T00:00:00.000Z",
      stepSeconds: 7 * 24 * 3600,
    }),
  );
}

describe("integration document", () => {
  it("starts empty, with live updates and backfill on by default", () => {
    const doc = utils.createDocument();
    expect(isIntegrationDocument(doc)).toBe(true);
    const s = doc.state.global;
    expect(s.kind).toBeNull();
    expect(s.intent.generation).toBe(0);
    expect(s.intent.live).toEqual({
      enabled: true,
      every: { value: 5, unit: "MINUTES" },
    });
    expect(s.intent.backfill.enabled).toBe(true);
    expect(s.runner).toBeNull();
    expect(s.fixes).toEqual([]);
  });

  it("records what the create flow asked for, raising the generation per change", () => {
    const s = created().state.global;
    expect(s.kind).toBe("CALENDAR");
    expect(s.provider).toBe("google-calendar");
    expect(s.intent.source).toEqual({ calendars: [], allOwned: true });
    expect(s.intent.backfill.items).toEqual([
      {
        id: "bf-1",
        label: "1 Jan 2025 to 12 months ahead",
        documentType: OSQ,
        documentId: null,
        request: {
          from: "2025-01-01T00:00:00.000Z",
          to: "2027-10-28T00:00:00.000Z",
          stepSeconds: 604800,
        },
      },
    ]);
    // INITIALIZE does not count; the four intent changes do
    expect(s.intent.generation).toBe(4);
    expect(s.resources.liveWorkflowId).toBeNull();
    expect(s.applied).toBeNull();
  });

  it("keeps picked calendars, and empties the list when all owned calendars are wanted", () => {
    let doc = apply(
      created(),
      setCalendarSource({
        calendars: [
          { id: "primary", name: "Wouter" },
          { id: "team@group.calendar.google.com" },
        ],
        allOwned: false,
      }),
    );
    expect(doc.state.global.intent.source).toEqual({
      calendars: [
        { id: "primary", name: "Wouter" },
        { id: "team@group.calendar.google.com", name: null },
      ],
      allOwned: false,
    });
    doc = apply(
      doc,
      setCalendarSource({ calendars: [{ id: "primary" }], allOwned: true }),
    );
    expect(doc.state.global.intent.source).toEqual({
      calendars: [],
      allOwned: true,
    });
  });

  it("switches, each a new generation", () => {
    const doc = apply(
      created(),
      setLiveEnabled({ enabled: false }),
      setLiveInterval({ value: 1, unit: "HOURS" }),
      setBackfillEnabled({ enabled: false }),
    );
    const s = doc.state.global;
    expect(s.intent.live).toEqual({
      enabled: false,
      every: { value: 1, unit: "HOURS" },
    });
    expect(s.intent.backfill.enabled).toBe(false);
    expect(s.intent.generation).toBe(7);
  });

  it("refuses what would make the intent wrong, leaving the state as it was", () => {
    let doc = created();
    doc = rejects(
      doc,
      initialize({ kind: "EMAIL", provider: "gmail" }),
      /set up already/,
    );
    doc = rejects(
      doc,
      setLiveInterval({ value: 0, unit: "MINUTES" }),
      /at least 1/,
    );
    doc = rejects(
      doc,
      setLiveInterval({ value: 2.5, unit: "MINUTES" }),
      /whole number/,
    );
    const range = {
      documentType: OSQ,
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-06-01T00:00:00.000Z",
      stepSeconds: 3600,
    };
    doc = rejects(
      doc,
      addDateRangeBackfill({ ...range, id: "bf-1", label: "again" }),
      /exists/,
    );
    doc = rejects(
      doc,
      addDateRangeBackfill({
        ...range,
        id: "bf-2",
        label: "backwards",
        from: range.to,
        to: range.from,
      }),
      /slices/,
    );
    doc = rejects(
      doc,
      addDateRangeBackfill({
        ...range,
        id: "bf-3",
        label: "too fine",
        stepSeconds: 30,
      }),
      /slices/,
    );
    rejects(
      doc,
      addDateRangeBackfill({
        ...range,
        id: "bf-4",
        label: "fractional",
        stepSeconds: 90.5,
      }),
      /slices/,
    );
  });

  it("refuses calendars before the kind is set, and on another kind", () => {
    rejects(
      utils.createDocument(),
      setCalendarSource({ calendars: [], allOwned: true }),
      /calendar integration/,
    );
    const mail = apply(
      utils.createDocument(),
      initialize({ kind: "EMAIL", provider: "gmail" }),
    );
    rejects(
      mail,
      setCalendarSource({ calendars: [], allOwned: true }),
      /calendar integration/,
    );
  });

  it("records the access the user chose, and only after the kind is set", () => {
    const doc = apply(created(), setAccess({ access: "READ" }));
    expect(doc.state.global.intent.access).toBe("READ");
    expect(utils.createDocument().state.global.intent.access).toBeNull();
    rejects(
      utils.createDocument(),
      setAccess({ access: "READ_WRITE" }),
      /Set up/,
    );
  });

  it("refuses every intent change before INITIALIZE, so a failed create leaves an empty document", () => {
    let doc = utils.createDocument();
    doc = rejects(doc, setLiveEnabled({ enabled: false }), /Set up/);
    doc = rejects(
      doc,
      setLiveInterval({ value: 15, unit: "MINUTES" }),
      /Set up/,
    );
    doc = rejects(doc, setBackfillEnabled({ enabled: false }), /Set up/);
    rejects(
      doc,
      addDateRangeBackfill({
        id: "bf-1",
        label: "x",
        documentType: OSQ,
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-06-01T00:00:00.000Z",
        stepSeconds: 3600,
      }),
      /Set up/,
    );
  });

  it("archives once: asking again changes nothing", () => {
    const doc = apply(created(), archive({}));
    expect(doc.state.global.intent.archived).toBe(true);
    const generation = doc.state.global.intent.generation;
    const again = apply(doc, archive({}));
    expect(again.state.global.intent.generation).toBe(generation);
  });

  describe("what the reconciler writes back", () => {
    const AT = "2026-10-28T12:00:00.000Z";
    const PC = { reactorId: "switchboard@pc", label: "pc" };
    const signIn = {
      code: "NEEDS_SIGN_IN",
      severity: "BLOCKING" as const,
      subject: "conn-1",
      message: "Sign in to Google on pc to finish",
      fixable: false,
      since: AT,
    };

    it("is claimed once: the runner can rename itself, nobody else can take it", () => {
      let doc = apply(created(), recordRunner(PC));
      expect(doc.state.global.runner).toEqual(PC);
      doc = apply(doc, recordRunner({ reactorId: "switchboard@pc" }));
      expect(doc.state.global.runner).toEqual({
        reactorId: "switchboard@pc",
        label: null,
      });
      rejects(
        doc,
        recordRunner({ reactorId: "switchboard@cloud" }),
        /switchboard@pc runs/,
      );
    });

    it("records what it built, one resource at a time, without a new generation", () => {
      const before = created().state.global.intent.generation;
      const doc = apply(
        created(),
        recordResources({ connectionId: "conn-1" }),
        recordResources({ liveWorkflowId: "wf-live", pluggedItemId: "bf-1" }),
        recordResources({ backfillWorkflowId: "wf-bf" }),
      );
      expect(doc.state.global.resources).toEqual({
        connectionId: "conn-1",
        liveWorkflowId: "wf-live",
        backfillWorkflowId: "wf-bf",
        pluggedItemId: "bf-1",
      });
      expect(doc.state.global.intent.generation).toBe(before);
    });

    it("records a check, answers the request it was asked for, and keeps the latest 20 fixes", () => {
      let doc = apply(
        created(),
        requestCheck({ id: "req-1", requestedAt: AT, requestedBy: "app" }),
      );
      expect(doc.state.global.checkRequest).toEqual({
        id: "req-1",
        requestedAt: AT,
        requestedBy: "app",
      });
      const fix = (n: number) => ({
        at: AT,
        code: "SCHEDULE_DRIFT",
        message: `Put back ${n}`,
      });
      doc = apply(
        doc,
        recordCheck({
          at: AT,
          host: "pc",
          generation: 4,
          request: "req-1",
          issues: [signIn],
          fixes: Array.from({ length: 15 }, (_, n) => fix(n)),
          committed: false,
        }),
        recordCheck({
          at: AT,
          generation: 4,
          issues: [{ ...signIn, subject: undefined }],
          fixes: Array.from({ length: 10 }, (_, n) => fix(100 + n)),
          committed: false,
        }),
      );
      const s = doc.state.global;
      expect(s.checkRequest).toBeNull();
      expect(s.check).toMatchObject({
        host: null,
        request: null,
        generation: 4,
      });
      expect(s.check?.issues[0]).toMatchObject({
        code: "NEEDS_SIGN_IN",
        subject: null,
      });
      expect(s.fixes).toHaveLength(20);
      expect(s.fixes[0]).toMatchObject({
        message: "Put back 100",
        subject: null,
      });
      expect(s.applied).toBeNull();
      // A request that is not the one pending stays pending
      doc = apply(
        doc,
        requestCheck({ id: "req-2", requestedAt: AT }),
        recordCheck({
          at: AT,
          generation: 4,
          request: "req-1",
          issues: [],
          fixes: [],
          committed: false,
        }),
      );
      expect(doc.state.global.checkRequest?.id).toBe("req-2");
    });

    it("commits the generation it evaluated, unless the user changed something meanwhile", () => {
      let doc = apply(
        created(),
        recordCheck({
          at: AT,
          host: "pc",
          generation: 4,
          issues: [],
          fixes: [],
          committed: true,
        }),
      );
      expect(doc.state.global.applied).toEqual({
        generation: 4,
        at: AT,
        host: "pc",
      });
      doc = apply(
        doc,
        setLiveEnabled({ enabled: false }),
        recordCheck({
          at: AT,
          generation: 4,
          issues: [],
          fixes: [],
          committed: true,
        }),
      );
      expect(doc.state.global.applied?.generation).toBe(4);
      expect(doc.state.global.intent.generation).toBe(5);
    });
  });
});
