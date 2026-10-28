import { utils, type IntegrationState } from "document-models/integration/v1";
import { describe, expect, it } from "vitest";
import {
  bringsMailFor,
  shortAgo,
  sortRows,
  syncRow,
  syncSummary,
  type SyncRow,
} from "./sync-status.js";
import type { TriggerState } from "./workflow-runtime.js";

const NOW = Date.parse("2026-10-28T15:00:00.000Z");

/** An email integration set up and live, its workflow `wf-<id>` */
function live(id = "a"): IntegrationState {
  const s = structuredClone(utils.createDocument().state.global);
  s.kind = "EMAIL";
  s.provider = "gmail";
  s.intent.generation = 1;
  s.intent.live = { enabled: true, every: { value: 5, unit: "MINUTES" } };
  s.resources.connectionId = "conn";
  s.resources.liveWorkflowId = `wf-${id}`;
  s.applied = { at: "2026-10-28T10:00:00.000Z", generation: 1, host: null };
  return s;
}

const trigger = (patch: Partial<TriggerState> = {}): TriggerState => ({
  workflowId: "wf-a",
  status: "ENABLED",
  lastPollAt: "2026-10-28T14:56:00.000Z",
  nextPollAt: null,
  lastError: null,
  ...patch,
});

describe("shortAgo", () => {
  it("says how long ago, short", () => {
    expect(shortAgo("2026-10-28T14:59:30.000Z", NOW)).toBe("now");
    expect(shortAgo("2026-10-28T14:56:00.000Z", NOW)).toBe("4 min");
    expect(shortAgo("2026-10-28T13:00:00.000Z", NOW)).toBe("2 h");
    expect(shortAgo("2026-10-25T15:00:00.000Z", NOW)).toBe("3 d");
    expect(shortAgo(null, NOW)).toBe("");
  });
});

describe("syncRow", () => {
  it("is up to date when the live workflow synced", () => {
    expect(syncRow("a", "Work mail", live(), trigger(), NOW)).toEqual({
      id: "a",
      name: "Work mail",
      dot: "ok",
      meta: "Up to date",
      when: "4 min",
      workflowId: "wf-a",
    });
  });

  it("says what is wrong, worst kinds as errors", () => {
    const parked = syncRow("a", "M", live(), trigger({ status: "PARKED" }), NOW);
    expect([parked?.dot, parked?.meta]).toEqual(["error", "Stopped"]);
    const failing = syncRow(
      "a",
      "M",
      live(),
      trigger({ status: "ERROR", lastError: "timeout" }),
      NOW,
    );
    expect([failing?.dot, failing?.meta]).toEqual(["warning", "Failing"]);
    const blocked = live();
    blocked.check = {
      at: "2026-10-28T14:00:00.000Z",
      generation: 1,
      host: null,
      issues: [
        {
          code: "CONSENT_EXPIRED",
          severity: "BLOCKING",
          message: "Bank consent expired",
          subject: null,
          fix: null,
        },
      ],
      requestId: null,
    } as unknown as IntegrationState["check"];
    const row = syncRow("a", "M", blocked, trigger(), NOW);
    expect([row?.dot, row?.meta]).toEqual(["error", "Bank consent expired"]);
  });

  it("is starting, setting up, waiting or paused before it syncs", () => {
    expect(
      syncRow("a", "M", live(), trigger({ lastPollAt: null }), NOW)?.meta,
    ).toBe("Starting");
    const applying = live();
    applying.intent.generation = 2;
    expect(syncRow("a", "M", applying, trigger(), NOW)?.meta).toBe(
      "Setting up",
    );
    const unsigned = live();
    unsigned.resources.connectionId = null;
    expect(syncRow("a", "M", unsigned, undefined, NOW)?.dot).toBe("warning");
    const off = live();
    off.intent.live.enabled = false;
    const paused = syncRow("a", "M", off, trigger(), NOW);
    expect([paused?.dot, paused?.meta, paused?.workflowId]).toEqual([
      "paused",
      "Live updates paused",
      null,
    ]);
  });

  it("leaves out one being removed", () => {
    const going = live();
    going.intent.archived = true;
    expect(syncRow("a", "M", going, trigger(), NOW)).toBeNull();
  });
});

describe("syncSummary", () => {
  const row = (name: string, dot: SyncRow["dot"]): SyncRow => ({
    id: name,
    name,
    dot,
    meta: "",
    when: "",
    workflowId: `wf-${name}`,
  });
  const polled = new Map([
    ["wf-a", trigger({ workflowId: "wf-a" })],
    [
      "wf-b",
      trigger({ workflowId: "wf-b", lastPollAt: "2026-10-28T14:58:00.000Z" }),
    ],
  ]);

  it("shows the worst state: attention, then syncing, then synced", () => {
    expect(syncSummary([row("a", "ok"), row("b", "error")], polled, false, NOW))
      .toEqual({
        dot: "error",
        label: "1 needs attention",
        attention: true,
        counts: "1 of 2 up to date",
      });
    expect(
      syncSummary([row("a", "warning"), row("b", "warning")], polled, false, NOW)
        ?.label,
    ).toBe("2 need attention");
    expect(
      syncSummary([row("a", "ok"), row("b", "running")], polled, false, NOW)
        ?.label,
    ).toBe("Syncing");
    expect(
      syncSummary([row("a", "ok"), row("b", "ok")], polled, true, NOW)?.label,
    ).toBe("Syncing");
    // The most recent sync among them
    expect(
      syncSummary([row("a", "ok"), row("b", "ok")], polled, false, NOW)?.label,
    ).toBe("Synced 2 min ago");
  });

  it("says paused when nothing is live, and stays away with nothing", () => {
    expect(
      syncSummary([row("a", "paused")], polled, false, NOW)?.label,
    ).toBe("Live updates paused");
    expect(syncSummary([], polled, false, NOW)).toBeNull();
  });

  it("sorts rows worst first, then by name", () => {
    expect(
      sortRows([
        row("c", "ok"),
        row("b", "paused"),
        row("a", "ok"),
        row("d", "error"),
      ]).map((r) => r.name),
    ).toEqual(["d", "a", "c", "b"]);
  });
});

describe("bringsMailFor", () => {
  const mail = (address: string | null) => {
    const s = live();
    s.intent.source = { mailbox: "Work", address, folders: [] } as never;
    return s;
  };
  it("matches the inbox's account, every email integration for All inboxes", () => {
    expect(bringsMailFor(mail("Jane+work@Acme.co"), "jane@acme.co")).toBe(true);
    expect(bringsMailFor(mail("jane@acme.co"), "john@acme.co")).toBe(false);
    expect(bringsMailFor(mail(null), "jane@acme.co")).toBe(false);
    expect(bringsMailFor(mail(null), null)).toBe(true);
    const calendar = live();
    calendar.kind = "CALENDAR";
    expect(bringsMailFor(calendar, null)).toBe(false);
  });
});
