import { describe, expect, it } from "vitest";
import {
  humanSeconds,
  liveWorkflowDrift,
  type LiveWorkflowSpec,
  type WorkflowFacts,
} from "./live-workflow.js";

const AT = "2026-10-28T10:00:00.000Z";
const spec: LiveWorkflowSpec = {
  name: "Cal · new events",
  enabled: true,
  connectionId: "conn-1",
  reactorConnectionId: "reactor",
  triggerConfig: {
    calendar_id: "primary",
    expandRecurringEvent: false,
    pollEverySeconds: 900,
  },
};
const matching: WorkflowFacts = {
  status: "ENABLED",
  version: 3,
  publishedVersion: 3,
  triggerName: "new_or_updated_event",
  triggerConnectionId: "conn-1",
  // Same config, keys in another order
  triggerConfig: {
    pollEverySeconds: 900,
    expandRecurringEvent: false,
    calendar_id: "primary",
  },
};

const types = (facts: Partial<WorkflowFacts>) =>
  liveWorkflowDrift(spec, { ...matching, ...facts }, AT).actions.map(
    (a) => a.type,
  );

describe("live workflow drift", () => {
  it("is empty when the published workflow is the spec", () => {
    expect(liveWorkflowDrift(spec, matching, AT)).toEqual({
      differences: [],
      actions: [],
    });
  });

  it("puts the trigger back and re-publishes", () => {
    const drift = liveWorkflowDrift(
      spec,
      {
        ...matching,
        triggerConfig: { ...matching.triggerConfig, pollEverySeconds: 3600 },
        triggerConnectionId: "other",
      },
      AT,
    );
    expect(drift.differences).toEqual([
      "the workflow checked every hour, not every 15 minutes",
      "the workflow used another Google sign-in",
    ]);
    expect(drift.actions.map((a) => a.type)).toEqual([
      "SET_TRIGGER_CONFIG",
      "SET_TRIGGER_CONNECTION",
      "PUBLISH_WORKFLOW",
    ]);
    expect(
      liveWorkflowDrift(
        spec,
        { ...matching, triggerConfig: { calendar_id: "work" } },
        AT,
      ).differences,
    ).toEqual(["the workflow watched calendar work"]);
    expect(
      liveWorkflowDrift(
        spec,
        {
          ...matching,
          triggerConfig: {
            ...matching.triggerConfig,
            expandRecurringEvent: true,
          },
        },
        AT,
      ).differences,
    ).toEqual(["the workflow's trigger settings were changed"]);
  });

  it("publishes unpublished edits, and switches the status", () => {
    expect(types({ version: 4 })).toEqual(["PUBLISH_WORKFLOW"]);
    expect(types({ publishedVersion: null })).toEqual(["PUBLISH_WORKFLOW"]);
    expect(types({ status: "DISABLED" })).toEqual(["SET_WORKFLOW_STATUS"]);
    expect(
      liveWorkflowDrift({ ...spec, enabled: false }, matching, AT).differences,
    ).toEqual(["the workflow was on"]);
  });

  it("says intervals the way people do", () => {
    expect([30, 60, 120, 3600, 7200, 86400, 172800].map(humanSeconds)).toEqual([
      "30 seconds",
      "minute",
      "2 minutes",
      "hour",
      "2 hours",
      "day",
      "2 days",
    ]);
  });
});
