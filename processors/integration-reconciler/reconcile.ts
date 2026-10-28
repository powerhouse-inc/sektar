/**
 * One reconcile pass over an integration, with its IO injected so it runs
 * the same in tests: claim the integration for this switchboard, make sure
 * its connection exists and asks for what the user chose, and report what
 * is left for the user (the sign-in). Later pilot steps add the workflows
 * and backfills here. Design: workspace/integrations-design.md, section 3.3.
 *
 * Every write is the reconciler's own operation (RECORD_*), never intent,
 * and a check is only written when what it says changed: the processor sees
 * its own writes, and an unchanged check must not make another pass.
 */
import {
  buildLiveWorkflow,
  liveWorkflowDrift,
  liveWorkflowSpec,
  runtimeIssue,
  type RuntimeHealth,
  type WorkflowAction,
  type WorkflowFacts,
} from "./live-workflow.js";
import {
  actions,
  type IntegrationAction,
  type IntegrationIssue,
  type IntegrationState,
} from "document-models/integration";

export type Host = { reactorId: string; label: string };

/** What a connection is, as far as a pass needs to know. */
export type ConnectionFacts = {
  /** The connection document's status: OK once a sign-in worked */
  status: string;
  /** It holds a token: someone signed in */
  signedIn: boolean;
  /** The scopes it asks for (config oauth_scopes) */
  scopes: string[];
};

export type ConnectionSpec = {
  name: string;
  connectorId: string;
  config: Record<string, unknown>;
};

export interface ReconcileIO {
  me: Host;
  now(): string;
  /** Null when the document is gone */
  readConnection(id: string): Promise<ConnectionFacts | null>;
  /** Creates the connection document; returns its id */
  createConnection(spec: ConnectionSpec): Promise<string>;
  /** Replaces the connection's config (new scopes after an access change) */
  setConnectionConfig(
    id: string,
    config: Record<string, unknown>,
  ): Promise<void>;
  dispatch(actions: IntegrationAction[]): Promise<void>;
  /** Deletes a document this integration built (its connection, its workflows) */
  deleteDocument(id: string): Promise<void>;
  /** Deletes the integration document itself, once everything it built is gone */
  deleteIntegration(): Promise<void>;
  /** A new object id */
  newId(): string;
  /** The switchboard's own reactor connection, for steps that write documents */
  findReactorConnection(): Promise<string | null>;
  /** Null when the workflow document is gone */
  readWorkflow(id: string): Promise<WorkflowFacts | null>;
  /** Creates a workflow document in the Workflows drive and applies the actions; returns its id */
  createWorkflow(name: string, actions: WorkflowAction[]): Promise<string>;
  updateWorkflow(id: string, actions: WorkflowAction[]): Promise<void>;
  /** How the workflow runtime holds the workflow; null where no runtime runs */
  workflowHealth(id: string): Promise<RuntimeHealth | null>;
}

/** The publisher's Google app (powerhouse.config.json workflows.oauthApps). */
export const GOOGLE_APP = "sektar-google";

const CALENDAR_READ = "https://www.googleapis.com/auth/calendar.readonly";
const CALENDAR_EVENTS = "https://www.googleapis.com/auth/calendar.events";

/** The connection a provider needs, for the access the user chose. */
export function connectionFor(
  name: string,
  state: IntegrationState,
): ConnectionSpec | null {
  if (state.provider === "google-calendar") {
    const scopes =
      state.intent.access === "READ_WRITE"
        ? [CALENDAR_READ, CALENDAR_EVENTS]
        : [CALENDAR_READ];
    return {
      name: `${name} · Google`,
      connectorId: "@activepieces/piece-google-calendar#google-calendar",
      config: { oauth_app: GOOGLE_APP, oauth_scopes: scopes },
    };
  }
  return null;
}

const sameScopes = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

/** The issues a check reports, compared on what the user sees. */
function sameIssues(
  a: readonly Pick<IntegrationIssue, "code" | "message" | "severity">[],
  b: readonly Pick<IntegrationIssue, "code" | "message" | "severity">[],
): boolean {
  const key = (i: Pick<IntegrationIssue, "code" | "message" | "severity">) =>
    `${i.code}|${i.severity}|${i.message}`;
  return a.map(key).sort().join("\n") === b.map(key).sort().join("\n");
}

export async function reconcileIntegration(
  doc: { id: string; name: string; state: IntegrationState },
  io: ReconcileIO,
): Promise<void> {
  const s = doc.state;
  // The user removed it: on its runner (or with none yet), take down what
  // it built, then the integration itself. The data it brought in stays.
  if (s.intent.archived) {
    if (s.runner && s.runner.reactorId !== io.me.reactorId) return;
    const built = [
      s.resources.liveWorkflowId,
      s.resources.backfillWorkflowId,
      s.resources.connectionId,
    ].filter((id): id is string => Boolean(id));
    for (const id of built) await io.deleteDocument(id);
    await io.deleteIntegration();
    return;
  }
  // Not set up yet.
  if (!s.kind) return;

  // Ours, or nobody's yet: claim it. Another switchboard's: leave it alone.
  if (s.runner && s.runner.reactorId !== io.me.reactorId) return;
  if (!s.runner || s.runner.label !== io.me.label) {
    await io.dispatch([actions.recordRunner(io.me)]);
  }

  const spec = connectionFor(doc.name, s);
  const issues: IntegrationIssue[] = [];
  const fixes: {
    at: string;
    code: string;
    subject?: string;
    message: string;
  }[] = [];
  let built = false;
  const since = (code: string) =>
    s.check?.issues.find((i) => i.code === code)?.since ?? io.now();

  if (!spec) {
    issues.push({
      code: "PROVIDER_UNSUPPORTED",
      severity: "BLOCKING",
      subject: null,
      message: `${s.provider ?? "This provider"} is not supported on this computer yet`,
      fixable: false,
      since: since("PROVIDER_UNSUPPORTED"),
    });
  } else {
    let connectionId = s.resources.connectionId;
    let facts = connectionId ? await io.readConnection(connectionId) : null;
    // None yet, or deleted: make one and record it before anything else, so
    // a pass that fails later never makes a second one.
    if (!connectionId || !facts) {
      connectionId = await io.createConnection(spec);
      await io.dispatch([actions.recordResources({ connectionId })]);
      facts = { status: "UNCONFIGURED", signedIn: false, scopes: [] };
    }
    const wanted = spec.config.oauth_scopes as string[];
    // The access changed: ask for the new scopes, which takes a new sign-in.
    if (facts.scopes.length > 0 && !sameScopes(facts.scopes, wanted)) {
      await io.setConnectionConfig(connectionId, spec.config);
      facts = { ...facts, signedIn: false };
    }
    if (!facts.signedIn || facts.status !== "OK") {
      issues.push({
        code: "NEEDS_SIGN_IN",
        severity: "BLOCKING",
        subject: connectionId,
        message: `Sign in to Google on ${io.me.label} to finish`,
        fixable: false,
        since: since("NEEDS_SIGN_IN"),
      });
    } else {
      built = await reconcileLiveWorkflow(
        doc,
        connectionId,
        io,
        issues,
        fixes,
        since,
      );
    }
  }

  const pending = s.checkRequest?.id ?? null;
  const last = s.check;
  // Everything this pass can do for the generation is done: commit it.
  const committed = built && issues.every((i) => i.severity !== "BLOCKING");
  const unchanged =
    !!last &&
    last.generation === s.intent.generation &&
    sameIssues(last.issues, issues) &&
    pending === null &&
    fixes.length === 0 &&
    (s.applied?.generation === s.intent.generation) === committed;
  if (unchanged) return;
  await io.dispatch([
    actions.recordCheck({
      at: io.now(),
      host: io.me.label,
      generation: s.intent.generation,
      request: pending,
      issues: issues.map((i) => ({ ...i, subject: i.subject ?? undefined })),
      fixes,
      committed,
    }),
  ]);
}

/**
 * Builds the live workflow, or puts it back to what the integration asks
 * for. A difference the user's own change explains (a generation not yet
 * committed) is applied quietly; one nobody asked for is put back and
 * logged. Returns whether the workflow now is what the spec says.
 */
async function reconcileLiveWorkflow(
  doc: { id: string; name: string; state: IntegrationState },
  connectionId: string,
  io: ReconcileIO,
  issues: IntegrationIssue[],
  fixes: { at: string; code: string; subject?: string; message: string }[],
  since: (code: string) => string,
): Promise<boolean> {
  const s = doc.state;
  const reactorConnectionId = await io.findReactorConnection();
  if (!reactorConnectionId) {
    issues.push({
      code: "NO_REACTOR_CONNECTION",
      severity: "BLOCKING",
      subject: null,
      message:
        "This computer has no connection for workflows to write documents with",
      fixable: false,
      since: since("NO_REACTOR_CONNECTION"),
    });
    return false;
  }
  const spec = liveWorkflowSpec(doc.name, s, connectionId, reactorConnectionId);
  const id = s.resources.liveWorkflowId;
  const facts = id ? await io.readWorkflow(id) : null;
  if (!id || !facts) {
    const now = io.now();
    const workflowId = await io.createWorkflow(
      spec.name,
      buildLiveWorkflow(
        spec,
        {
          trigger: io.newId(),
          map: io.newId(),
          upsert: io.newId(),
          e1: io.newId(),
          e2: io.newId(),
        },
        now,
        doc.name,
      ),
    );
    await io.dispatch([
      actions.recordResources({ liveWorkflowId: workflowId }),
    ]);
    return true;
  }
  const drift = liveWorkflowDrift(spec, facts, io.now());
  if (drift.actions.length === 0) {
    // The workflow is what the integration asks for: is it running?
    const problem = runtimeIssue(await io.workflowHealth(id));
    if (problem) {
      issues.push({
        ...problem,
        subject: id,
        fixable: false,
        since: since(problem.code),
      });
    }
    return true;
  }
  await io.updateWorkflow(id, drift.actions);
  // Asked for: the user changed the integration and this applies it.
  const asked = s.applied?.generation !== s.intent.generation;
  if (!asked) {
    const at = io.now();
    for (const difference of drift.differences) {
      fixes.push({
        at,
        code: "LIVE_WORKFLOW_DRIFT",
        subject: id,
        message: `Put back: ${difference}`,
      });
    }
  }
  return true;
}
