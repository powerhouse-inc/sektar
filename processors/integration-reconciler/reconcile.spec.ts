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
  let n = 0;
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
    writes,
    get doc() {
      return doc;
    },
    act: (a: IntegrationAction) => {
      doc = reducer(doc, a);
    },
  };
}

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
    const c = w.connections.get("conn-1")!;
    w.connections.set("conn-1", { ...c, status: "OK", signedIn: true });
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

  it("does nothing for an integration that is not set up or is being removed", async () => {
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
    const w = world();
    w.act((await import("document-models/integration/v1")).actions.archive({}));
    await w.pass();
    expect(writes).toEqual([]);
    expect(w.writes).toEqual([]);
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
