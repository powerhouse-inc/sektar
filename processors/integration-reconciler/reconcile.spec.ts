import {
  reducer,
  utils,
  type IntegrationAction,
  type IntegrationDocument,
} from "document-models/integration/v1";
import { describe, expect, it } from "vitest";
import {
  createActions,
  defaultChoices,
} from "../../editors/sektar/kit/integrations.js";
import {
  connectionFor,
  GOOGLE_APP,
  reconcileIntegration,
  type ConnectionFacts,
  type ReconcileIO,
} from "./reconcile.js";
import type {
  RuntimeHealth,
  WorkflowAction,
  WorkflowFacts,
} from "./live-workflow.js";

const NOW = new Date(2026, 9, 28, 9, 30);
const PC = { reactorId: "switchboard@pc", label: "pc" };
const READ = "https://www.googleapis.com/auth/calendar.readonly";
const EVENTS = "https://www.googleapis.com/auth/calendar.events";

/** An integration as the create flow writes it, with the reconciler's IO faked. */
function world(access: "READ" | "READ_WRITE" = "READ") {
  let doc: IntegrationDocument = createActions(
    { ...defaultChoices("CALENDAR", "google-calendar", NOW), access },
    NOW,
    "bf-1",
  ).reduce((d, a) => reducer(d, a), utils.createDocument());
  const connections = new Map<
    string,
    ConnectionFacts & { config: Record<string, unknown> }
  >();
  const writes: string[] = [];
  const workflows = new Map<
    string,
    WorkflowFacts & { actions: WorkflowAction[] }
  >();
  let reactorConnection: string | null = "reactor-conn";
  const health = new Map<string, RuntimeHealth>();
  let n = 0;
  /** Applies workflow actions the way the workflow model would, as far as the facts go */
  const applyWorkflow = (id: string, list: WorkflowAction[]) => {
    const w = workflows.get(id)!;
    for (const a of list) {
      w.actions.push(a);
      const input = a.input as Record<string, unknown>;
      if (a.type === "SET_TRIGGER") {
        w.triggerName = input.triggerName as string;
        w.triggerConnectionId = input.connectionId as string;
        w.triggerConfig = input.config as Record<string, unknown>;
        w.version++;
      } else if (a.type === "SET_TRIGGER_CONFIG") {
        w.triggerConfig = input.config as Record<string, unknown>;
        w.version++;
      } else if (a.type === "SET_TRIGGER_CONNECTION") {
        w.triggerConnectionId = input.connectionId as string;
        w.version++;
      } else if (a.type === "PUBLISH_WORKFLOW") {
        w.publishedVersion = w.version;
      } else if (a.type === "SET_WORKFLOW_STATUS") {
        w.status = input.status as string;
      }
    }
  };
  const io = (me = PC): ReconcileIO => ({
    me,
    now: () => "2026-10-28T10:00:00.000Z",
    readConnection: (id) => Promise.resolve(connections.get(id) ?? null),
    createConnection: (spec) => {
      const id = `conn-${++n}`;
      connections.set(id, {
        status: "UNCONFIGURED",
        signedIn: false,
        scopes: spec.config.oauth_scopes as string[],
        config: spec.config,
      });
      writes.push(`create ${id} ${spec.connectorId}`);
      return Promise.resolve(id);
    },
    setConnectionConfig: (id, config) => {
      const c = connections.get(id)!;
      connections.set(id, {
        ...c,
        config,
        scopes: config.oauth_scopes as string[],
        signedIn: false,
        status: "UNCONFIGURED",
      });
      writes.push(`config ${id}`);
      return Promise.resolve();
    },
    deleteDocument: (id) => {
      connections.delete(id);
      writes.push(`delete ${id}`);
      return Promise.resolve();
    },
    deleteIntegration: () => {
      writes.push("delete integration");
      return Promise.resolve();
    },
    newId: () => `id-${++n}`,
    findReactorConnection: () => Promise.resolve(reactorConnection),
    readWorkflow: (id) => {
      const w = workflows.get(id);
      return Promise.resolve(w ? { ...w } : null);
    },
    createWorkflow: (name, list) => {
      const id = `wf-${++n}`;
      workflows.set(id, {
        status: "DISABLED",
        version: 0,
        publishedVersion: null,
        triggerName: null,
        triggerConnectionId: null,
        triggerConfig: null,
        actions: [],
      });
      applyWorkflow(id, list);
      writes.push(`create workflow ${id} ${name}`);
      return Promise.resolve(id);
    },
    workflowHealth: (id) => Promise.resolve(health.get(id) ?? null),
    updateWorkflow: (id, list) => {
      applyWorkflow(id, list);
      writes.push(`update ${id} ${list.map((a) => a.type).join(",")}`);
      return Promise.resolve();
    },
    dispatch: (list: IntegrationAction[]) => {
      for (const a of list) {
        doc = reducer(doc, a);
        writes.push(a.type);
        expect(doc.operations.global.at(-1)?.error).toBeFalsy();
      }
      return Promise.resolve();
    },
  });
  const pass = (me = PC) =>
    reconcileIntegration(
      {
        id: doc.header.id,
        name: "Personal Google Calendar",
        state: doc.state.global,
      },
      io(me),
    );
  return {
    pass,
    connections,
    workflows,
    writes,
    signIn: (id = "conn-1") => {
      const c = connections.get(id)!;
      connections.set(id, { ...c, status: "OK", signedIn: true });
    },
    noReactorConnection: () => {
      reactorConnection = null;
    },
    health,
    get doc() {
      return doc;
    },
    act: (a: IntegrationAction) => {
      doc = reducer(doc, a);
    },
  };
}

describe("the live workflow", () => {
  it("is built once signed in: trigger on the connection, mapping, upsert into the Calendar drive; then the integration commits", async () => {
    const w = world();
    await w.pass();
    expect(w.workflows.size).toBe(0);
    w.signIn();
    w.writes.length = 0;
    await w.pass();
    const s = w.doc.state.global;
    const id = s.resources.liveWorkflowId!;
    expect(w.writes).toEqual([
      `create workflow ${id} Personal Google Calendar · new events`,
      "RECORD_RESOURCES",
      "RECORD_CHECK",
    ]);
    const wf = w.workflows.get(id)!;
    expect(wf.actions.map((a) => a.type)).toEqual([
      "SET_WORKFLOW_NAME",
      "SET_TRIGGER",
      "ADD_STEP",
      "ADD_STEP",
      "ADD_EDGE",
      "ADD_EDGE",
      "PUBLISH_WORKFLOW",
      "SET_WORKFLOW_STATUS",
    ]);
    expect(wf).toMatchObject({
      status: "ENABLED",
      triggerName: "new_or_updated_event",
      triggerConnectionId: "conn-1",
      triggerConfig: { calendar_id: "primary", expandRecurringEvent: false },
    });
    const upsert = wf.actions.find(
      (a) =>
        a.type === "ADD_STEP" &&
        (a.input as { actionName: string }).actionName === "upsert-documents",
    )!;
    expect(upsert.input).toMatchObject({
      reactorConnectionId: "reactor-conn",
      config: { documentType: "sektar/calendar-event", driveId: "calendar" },
    });
    expect(s.applied?.generation).toBe(s.intent.generation);
    expect(s.check?.issues).toEqual([]);

    // Settled: the next passes write nothing
    const before = w.writes.length;
    await w.pass();
    await w.pass();
    expect(w.writes.length).toBe(before);
  });

  it("applies the user's own change quietly, and puts back one nobody asked for", async () => {
    const w = world();
    await w.pass();
    w.signIn();
    await w.pass();
    const id = w.doc.state.global.resources.liveWorkflowId!;
    const { actions } = await import("document-models/integration/v1");

    // The user turns live updates off: applied, no fix logged
    w.act(actions.setLiveEnabled({ enabled: false }));
    await w.pass();
    expect(w.workflows.get(id)?.status).toBe("DISABLED");
    expect(w.doc.state.global.fixes).toEqual([]);
    expect(w.doc.state.global.applied?.generation).toBe(
      w.doc.state.global.intent.generation,
    );

    // Someone turns the workflow on in Studio: put back, and logged
    w.workflows.get(id)!.status = "ENABLED";
    w.writes.length = 0;
    await w.pass();
    expect(w.writes).toEqual([
      `update ${id} SET_WORKFLOW_STATUS`,
      "RECORD_CHECK",
    ]);
    expect(w.workflows.get(id)?.status).toBe("DISABLED");
    expect(w.doc.state.global.fixes).toEqual([
      expect.objectContaining({
        code: "LIVE_WORKFLOW_DRIFT",
        subject: id,
        message: "Put back: the workflow was on",
      }),
    ]);
  });

  it("says so when the runtime parked it after a failed run, and stops saying so once it runs again", async () => {
    const w = world();
    await w.pass();
    w.signIn();
    await w.pass();
    const id = w.doc.state.global.resources.liveWorkflowId!;
    w.health.set(id, {
      trigger: { status: "DISABLED", lastError: null, consecutiveFailures: 0 },
      park: { reason: 'Step "map_events" failed: no action', parkedAt: "t" },
    });
    await w.pass();
    expect(w.doc.state.global.check?.issues).toEqual([
      expect.objectContaining({
        code: "LIVE_WORKFLOW_PARKED",
        severity: "BLOCKING",
        subject: id,
        message:
          'Live updates stopped after a failed run: Step "map_events" failed: no action',
      }),
    ]);
    // Committed before the park: it stays applied, the issue is what shows
    expect(w.doc.state.global.applied?.generation).toBe(
      w.doc.state.global.intent.generation,
    );

    // A failing poll that has not parked warns
    w.health.set(id, {
      trigger: {
        status: "ERROR",
        lastError: "registry timeout",
        consecutiveFailures: 2,
      },
      park: null,
    });
    await w.pass();
    expect(
      w.doc.state.global.check?.issues.map((i) => [i.code, i.severity]),
    ).toEqual([["LIVE_WORKFLOW_FAILING", "WARNING"]]);

    w.health.set(id, {
      trigger: { status: "ENABLED", lastError: null, consecutiveFailures: 0 },
      park: null,
    });
    await w.pass();
    expect(w.doc.state.global.check?.issues).toEqual([]);
  });

  it("is built again when its workflow was deleted", async () => {
    const w = world();
    await w.pass();
    w.signIn();
    await w.pass();
    const first = w.doc.state.global.resources.liveWorkflowId!;
    w.workflows.delete(first);
    const { actions } = await import("document-models/integration/v1");
    w.act(
      actions.requestCheck({
        id: "r1",
        requestedAt: "2026-10-28T10:01:00.000Z",
      }),
    );
    await w.pass();
    const second = w.doc.state.global.resources.liveWorkflowId!;
    expect(second).not.toBe(first);
    expect(w.workflows.has(second)).toBe(true);
  });

  it("waits, blocked, when the switchboard has no connection to write documents with", async () => {
    const w = world();
    w.noReactorConnection();
    await w.pass();
    w.signIn();
    await w.pass();
    const s = w.doc.state.global;
    expect(w.workflows.size).toBe(0);
    expect(s.applied).toBeNull();
    expect(s.check?.issues.map((i) => [i.code, i.severity])).toEqual([
      ["NO_REACTOR_CONNECTION", "BLOCKING"],
    ]);
  });
});

describe("a reconcile pass", () => {
  it("claims a new integration, makes its connection read-only, and asks for the sign-in", async () => {
    const w = world();
    await w.pass();
    const s = w.doc.state.global;
    expect(s.runner).toEqual(PC);
    expect(s.resources.connectionId).toBe("conn-1");
    expect(w.connections.get("conn-1")?.config).toEqual({
      oauth_app: GOOGLE_APP,
      oauth_scopes: [READ],
    });
    expect(s.check?.issues).toEqual([
      expect.objectContaining({
        code: "NEEDS_SIGN_IN",
        severity: "BLOCKING",
        subject: "conn-1",
        message: "Sign in to Google on pc to finish",
        fixable: false,
      }),
    ]);
    expect(s.applied).toBeNull();
    expect(w.writes).toEqual([
      "RECORD_RUNNER",
      "create conn-1 @activepieces/piece-google-calendar#google-calendar",
      "RECORD_RESOURCES",
      "RECORD_CHECK",
    ]);
  });

  it("writes nothing when nothing changed, so its own writes do not loop", async () => {
    const w = world();
    await w.pass();
    const before = w.writes.length;
    await w.pass();
    await w.pass();
    expect(w.writes.length).toBe(before);
  });

  it("clears the sign-in once the connection holds a token, keeping the issue's first date otherwise", async () => {
    const w = world();
    await w.pass();
    const since = w.doc.state.global.check?.issues[0]?.since;
    w.act({
      ...(await import("document-models/integration/v1")).actions.requestCheck({
        id: "r1",
        requestedAt: "2026-10-28T10:01:00.000Z",
      }),
    } as IntegrationAction);
    await w.pass();
    expect(w.doc.state.global.check?.issues[0]?.since).toBe(since);
    expect(w.doc.state.global.checkRequest).toBeNull();
    w.signIn();
    await w.pass();
    expect(w.doc.state.global.check?.issues).toEqual([]);
  });

  it("leaves another switchboard's integration alone", async () => {
    const w = world();
    await w.pass({ reactorId: "switchboard@cloud", label: "cloud" });
    const writes = w.writes.length;
    await w.pass();
    expect(w.writes.length).toBe(writes);
    expect(w.doc.state.global.runner?.reactorId).toBe("switchboard@cloud");
  });

  it("asks for edit access and a new sign-in when the access changes", async () => {
    const w = world();
    await w.pass();
    const c = w.connections.get("conn-1")!;
    w.connections.set("conn-1", { ...c, status: "OK", signedIn: true });
    const { actions } = await import("document-models/integration/v1");
    w.act(actions.setAccess({ access: "READ_WRITE" }));
    await w.pass();
    expect(w.connections.get("conn-1")?.scopes.sort()).toEqual(
      [EVENTS, READ].sort(),
    );
    expect(w.doc.state.global.check?.issues.map((i) => i.code)).toEqual([
      "NEEDS_SIGN_IN",
    ]);
  });

  it("makes a new connection when its connection was deleted", async () => {
    const w = world();
    await w.pass();
    w.connections.delete("conn-1");
    w.act(
      (await import("document-models/integration/v1")).actions.setLiveEnabled({
        enabled: false,
      }),
    );
    await w.pass();
    expect(w.doc.state.global.resources.connectionId).toBe("conn-2");
  });

  it("does nothing for an integration that is not set up", async () => {
    const empty = utils.createDocument();
    const writes: string[] = [];
    const io = {
      me: PC,
      now: () => "",
      dispatch: () => {
        writes.push("x");
        return Promise.resolve();
      },
    } as unknown as ReconcileIO;
    await reconcileIntegration(
      { id: "x", name: "x", state: empty.state.global },
      io,
    );
    expect(writes).toEqual([]);
  });

  it("takes down what a removed integration built, then the integration", async () => {
    const w = world();
    await w.pass();
    const { actions } = await import("document-models/integration/v1");
    w.act(actions.archive({}));
    w.writes.length = 0;
    await w.pass();
    expect(w.writes).toEqual(["delete conn-1", "delete integration"]);
    expect(w.connections.size).toBe(0);
  });

  it("leaves a removed integration to the switchboard that runs it", async () => {
    const w = world();
    await w.pass({ reactorId: "switchboard@cloud", label: "cloud" });
    const { actions } = await import("document-models/integration/v1");
    w.act(actions.archive({}));
    w.writes.length = 0;
    await w.pass();
    expect(w.writes).toEqual([]);
  });

  it("removes one that never got a runner or built anything", async () => {
    const w = world();
    const { actions } = await import("document-models/integration/v1");
    w.act(actions.archive({}));
    await w.pass();
    expect(w.writes).toEqual(["delete integration"]);
  });

  it("reports a provider it cannot connect", async () => {
    const w = world();
    const s = structuredClone(w.doc.state.global);
    s.provider = "microsoft-calendar";
    expect(connectionFor("x", s)).toBeNull();
    const out: IntegrationAction[] = [];
    await reconcileIntegration(
      { id: "x", name: "x", state: s },
      {
        me: PC,
        now: () => "2026-10-28T10:00:00.000Z",
        readConnection: () => Promise.resolve(null),
        createConnection: () => Promise.reject(new Error("no")),
        setConnectionConfig: () => Promise.resolve(),
        deleteDocument: () => Promise.resolve(),
        deleteIntegration: () => Promise.resolve(),
        newId: () => "x",
        findReactorConnection: () => Promise.resolve(null),
        readWorkflow: () => Promise.resolve(null),
        createWorkflow: () => Promise.reject(new Error("no")),
        updateWorkflow: () => Promise.resolve(),
        workflowHealth: () => Promise.resolve(null),
        dispatch: (l) => {
          out.push(...l);
          return Promise.resolve();
        },
      },
    );
    const check = out.find((a) => a.type === "RECORD_CHECK");
    expect(JSON.stringify(check)).toContain("PROVIDER_UNSUPPORTED");
  });
});
