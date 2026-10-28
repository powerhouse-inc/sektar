import { describe, expect, it } from "vitest";
import {
  backfillWorkflowDrift,
  backfillWorkflowSpec,
  buildBackfillWorkflow,
} from "./backfill-workflow.js";
import type { WorkflowFacts } from "./live-workflow.js";

const AT = "2026-10-28T10:00:00.000Z";
const spec = backfillWorkflowSpec("Cal", true, "q-1", "conn-1", "reactor");
const ids = {
  trigger: "t",
  get: "g",
  map: "m",
  upsert: "u",
  e1: "e1",
  e2: "e2",
  e3: "e3",
};
const matching: WorkflowFacts = {
  status: "ENABLED",
  version: 2,
  publishedVersion: 2,
  triggerName: "for-every",
  triggerConnectionId: null,
  triggerConfig: { pollEverySeconds: 60, documentId: "q-1" },
  triggerReactorConnectionId: "reactor",
  steps: [
    { id: "g", key: "get_events", connectionId: "conn-1" },
    { id: "m", key: "map_events", connectionId: null },
  ],
};
const drift = (patch: Partial<WorkflowFacts>, s = spec) =>
  backfillWorkflowDrift(s, { ...matching, ...patch }, AT);

describe("the backfill workflow", () => {
  it("walks the plugged queue a slice a minute, asks Google for the slice, and maps and upserts like live", () => {
    const list = buildBackfillWorkflow(spec, ids, AT, "Cal");
    expect(list.map((a) => a.type)).toEqual([
      "SET_WORKFLOW_NAME",
      "SET_TRIGGER",
      "ADD_STEP",
      "ADD_STEP",
      "ADD_STEP",
      "ADD_EDGE",
      "ADD_EDGE",
      "ADD_EDGE",
      "PUBLISH_WORKFLOW",
      "SET_WORKFLOW_STATUS",
    ]);
    expect(list[0]?.input).toEqual({ name: "Cal · history" });
    expect(list[1]?.input).toMatchObject({
      pieceName: "@powerhousedao/distyra-piece",
      triggerName: "for-every",
      reactorConnectionId: "reactor",
      config: { documentId: "q-1", pollEverySeconds: 60 },
    });
    expect(list[2]?.input).toMatchObject({
      key: "get_events",
      actionName: "google_calendar_get_events",
      connectionId: "conn-1",
      config: {
        calendar_id: "primary",
        start_date: "{{trigger.payload.ranges.slice.from}}",
        end_date: "{{trigger.payload.ranges.slice.to}}",
        singleEvents: false,
      },
    });
    expect(list[3]?.input).toMatchObject({
      key: "map_events",
      config: { events: "{{steps.get_events.output.body}}" },
    });
    expect(list[4]?.input).toMatchObject({
      key: "upsert_events",
      reactorConnectionId: "reactor",
    });
    expect(list.slice(5, 8).map((a) => a.input)).toEqual([
      { id: "e1", from: "t", to: "g", port: "next" },
      { id: "e2", from: "g", to: "m", port: "next" },
      { id: "e3", from: "m", to: "u", port: "next" },
    ]);
    expect(list[9]?.input).toEqual({ status: "ENABLED" });
  });

  it("is left alone when it is the spec", () => {
    expect(drift({})).toEqual({ differences: [], actions: [] });
  });

  it("is pointed at the next queue, and re-published", () => {
    const next = backfillWorkflowSpec("Cal", true, "q-2", "conn-1", "reactor");
    const d = drift({}, next);
    expect(d.differences).toEqual([
      "the history workflow walked another backfill",
    ]);
    expect(d.actions.map((a) => [a.type, a.input])).toEqual([
      [
        "SET_TRIGGER_CONFIG",
        { config: { documentId: "q-2", pollEverySeconds: 60 } },
      ],
      ["PUBLISH_WORKFLOW", { publishedAt: AT }],
    ]);
  });

  it("puts back its pace, connections and status", () => {
    expect(
      drift({ triggerConfig: { documentId: "q-1", pollEverySeconds: 5 } })
        .differences,
    ).toEqual(["the history workflow's pace was changed"]);
    expect(
      drift({ triggerReactorConnectionId: "other" }).actions.map((a) => [
        a.type,
        a.input,
      ]),
    ).toEqual([
      [
        "SET_TRIGGER_CONNECTION",
        { connectionId: null, reactorConnectionId: "reactor" },
      ],
      ["PUBLISH_WORKFLOW", { publishedAt: AT }],
    ]);
    expect(
      drift({
        steps: [{ id: "g", key: "get_events", connectionId: "conn-old" }],
      }).actions.map((a) => [a.type, a.input]),
    ).toEqual([
      ["UPDATE_STEP", { id: "g", connectionId: "conn-1" }],
      ["PUBLISH_WORKFLOW", { publishedAt: AT }],
    ]);
    expect(drift({ version: 3 }).differences).toEqual([
      "the history workflow had unpublished changes",
    ]);
    const off = backfillWorkflowSpec("Cal", false, "q-1", "conn-1", "reactor");
    expect(drift({}, off).actions.map((a) => a.input)).toEqual([
      { status: "DISABLED" },
    ]);
    expect(drift({ status: "DISABLED" }).differences).toEqual([
      "the history workflow was off",
    ]);
  });
});
