/**
 * What the integration index writes for a document.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { utils as integrationUtils } from "document-models/integration";
import { utils as queueUtils } from "document-models/original-source-queue";
import { describe, expect, it } from "vitest";
import { queueProgress, iterationOf, totalOf } from "../../editors/backfills/progress.js";
import {
  cleanIds,
  toConnectionRow,
  toIntegrationRow,
  toQueueRow,
} from "./queries.js";
import {
  connectionRow,
  integrationRow,
  parseResulting,
  queueRow,
  walkOf,
} from "./rows.js";

const AT = "2026-10-29T08:00:00.000Z";

/** An email integration, live, with two backfill items (one not created yet). */
function integration() {
  const s = structuredClone(integrationUtils.createDocument().state.global);
  s.kind = "EMAIL";
  s.provider = "gmail";
  s.intent.generation = 2;
  s.intent.source = { mailbox: "Work", address: "w@example.com", folders: [] };
  s.intent.live = { enabled: true, every: { value: 15, unit: "MINUTES" } };
  s.intent.backfill = {
    enabled: true,
    batch: null,
    pinnedId: null,
    items: [
      { id: "i1", label: "2025", documentType: "distyra/original-source-queue", documentId: "q1", request: null },
      { id: "i2", label: "2024", documentType: "distyra/original-source-queue", documentId: null, request: null },
    ],
  };
  s.resources = {
    connectionId: "conn-1",
    liveWorkflowId: "wf-live",
    backfillWorkflowId: "wf-back",
    pluggedItemId: "i1",
  };
  return s;
}

/** A queue walking two loops (52 weeks x 3 labels), a third of the way. */
function queue() {
  const s = structuredClone(queueUtils.createDocument().state.global);
  s.description = "Gmail, newest first";
  s.status = "IN_PROGRESS";
  s.progress = 1 / 3;
  s.cursors = [
    { id: "c1", name: "Week", description: null, first: 52, last: 1, step: 1, position: 17, current: 35, next: 34, finished: false, count: 52 },
    { id: "c2", name: "Label", description: null, collection: "col1", position: 0, current: 0, next: 1, finished: false, count: 3 },
  ];
  s.collections = [{ id: "col1", name: "Labels", values: ["INBOX", "SENT", "ARCHIVE"] }];
  s.errors = [
    { id: "e1", message: "rate limited", data: null, cursors: [] },
    { id: "e2", message: "timeout", data: null, cursors: [] },
  ];
  return s;
}

describe("an operation's resulting state", () => {
  it("gives the global scope and the header's name", () => {
    const json = JSON.stringify({ global: { kind: "EMAIL" }, local: {}, header: { id: "d1", name: "Work mail" } });
    expect(parseResulting(json)).toEqual({ state: { kind: "EMAIL" }, name: "Work mail" });
  });

  it("keeps the name unknown without a header, and takes a bare state as global", () => {
    expect(parseResulting(JSON.stringify({ kind: "EMAIL" }))).toEqual({ state: { kind: "EMAIL" }, name: null });
  });

  it("is null when absent or not JSON, so the row stays as it is", () => {
    expect(parseResulting(undefined)).toBeNull();
    expect(parseResulting("")).toBeNull();
    expect(parseResulting("{nope")).toBeNull();
  });
});

describe("an integration's row", () => {
  it("takes the switches, the workflows, the account and the queues", () => {
    const row = integrationRow("i-1", integration(), "Work mail", AT);
    expect(row).toMatchObject({
      document_id: "i-1",
      name: "Work mail",
      kind: "EMAIL",
      provider: "gmail",
      archived: false,
      live_enabled: true,
      backfill_enabled: true,
      live_workflow_id: "wf-live",
      backfill_workflow_id: "wf-back",
      connection_id: "conn-1",
      mailbox: "Work",
      address: "w@example.com",
      updated_at: AT,
    });
    expect(JSON.parse(row.queue_ids)).toEqual(["q1"]);
  });

  it("keeps the whole state, so the kit's pure functions read it as the document", () => {
    const state = integration();
    const row = integrationRow("i-1", state, "Work mail", AT);
    expect(JSON.parse(row.state)).toEqual(state);
    const listed = toIntegrationRow(row);
    expect(listed).toMatchObject({ id: "i-1", liveEnabled: true, queueIds: ["q1"], mailbox: "Work" });
    expect(JSON.parse(listed.state)).toEqual(state);
  });

  it("copes with a document nothing has been applied to", () => {
    const row = integrationRow("i-2", {}, null, AT);
    expect(row).toMatchObject({
      kind: null,
      archived: false,
      live_enabled: false,
      connection_id: null,
      queue_ids: "[]",
    });
  });
});

describe("a queue's row", () => {
  it("counts the walk as progress.ts does", () => {
    const s = queue();
    const row = queueRow("q1", s, "Mail 2025", AT);
    const p = queueProgress(s);
    expect(row).toMatchObject({
      document_id: "q1",
      name: "Mail 2025",
      status: "IN_PROGRESS",
      description: "Gmail, newest first",
      loops: 2,
      total: totalOf(s),
      iteration: iterationOf(s),
      done: p.done,
      finished: p.finished,
      error_count: 2,
      last_error: "timeout",
      awaiting_values: false,
    });
    expect(row.total).toBe(156);
  });

  it("agrees with progress.ts in every status", () => {
    for (const status of ["DRAFT", "IN_PROGRESS", "PAUSED", "FINISHED"] as const) {
      for (const progress of [0, 0.004, 0.5, 0.999]) {
        const s = { ...queue(), status, progress };
        const walk = walkOf(s);
        expect({ total: walk.total, done: walk.done, finished: walk.finished }).toEqual(queueProgress(s));
        expect(walk.iteration).toBe(iterationOf(s));
      }
    }
    expect(walkOf({ ...queue(), cursors: [] })).toEqual({ total: 0, iteration: 0, done: 0, finished: false });
  });

  it("builds a lower-cased search haystack of names", () => {
    const text = queueRow("q1", queue(), "Mail 2025", AT).search_text;
    for (const word of ["mail 2025", "gmail", "week", "label", "labels"]) expect(text).toContain(word);
    expect(text).toBe(text.toLowerCase());
  });

  it("maps to the list's vocabulary", () => {
    expect(toQueueRow(queueRow("q1", queue(), "Mail 2025", AT))).toMatchObject({
      id: "q1",
      name: "Mail 2025",
      loops: 2,
      total: 156,
      errorCount: 2,
      lastError: "timeout",
      awaitingValues: false,
    });
  });
});

describe("a connection's row", () => {
  it("says who signed in and how it went, never the config or secrets", () => {
    const state = {
      name: "Gmail (Work)",
      connectorId: "@activepieces/piece-gmail#gmail",
      accountLabel: "w@example.com",
      status: "OK",
      lastCheckedAt: "2026-10-29T07:00:00.000Z",
      lastError: null,
      authType: "OAUTH2",
      config: { client: "x" },
      secretRefs: [{ id: "s1", name: "token", ref: "vault:1" }],
    };
    const row = connectionRow("conn-1", state, null, AT);
    expect(row).toEqual({
      document_id: "conn-1",
      name: "Gmail (Work)",
      connector_id: "@activepieces/piece-gmail#gmail",
      account_label: "w@example.com",
      status: "OK",
      last_checked_at: "2026-10-29T07:00:00.000Z",
      last_error: null,
      updated_at: AT,
    });
    expect(JSON.stringify(row)).not.toContain("vault");
    expect(toConnectionRow(row)).toMatchObject({ id: "conn-1", accountLabel: "w@example.com", status: "OK" });
  });
});

describe("asked ids", () => {
  it("are distinct and non-empty", () => {
    expect(cleanIds(["a", "", "b", "a"])).toEqual(["a", "b"]);
    expect(cleanIds(null)).toEqual([]);
  });
});
