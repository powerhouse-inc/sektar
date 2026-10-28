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
  // Not set up yet, or on its way out (removal is a later pilot step).
  if (!s.kind || s.intent.archived) return;

  // Ours, or nobody's yet: claim it. Another switchboard's: leave it alone.
  if (s.runner && s.runner.reactorId !== io.me.reactorId) return;
  if (!s.runner || s.runner.label !== io.me.label) {
    await io.dispatch([actions.recordRunner(io.me)]);
  }

  const spec = connectionFor(doc.name, s);
  const issues: IntegrationIssue[] = [];
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
    }
  }

  const pending = s.checkRequest?.id ?? null;
  const last = s.check;
  const unchanged =
    !!last &&
    last.generation === s.intent.generation &&
    sameIssues(last.issues, issues) &&
    pending === null;
  if (unchanged) return;
  await io.dispatch([
    actions.recordCheck({
      at: io.now(),
      host: io.me.label,
      generation: s.intent.generation,
      request: pending,
      issues: issues.map((i) => ({ ...i, subject: i.subject ?? undefined })),
      fixes: [],
      // The workflows come in pilot step 4: until then nothing is committed.
      committed: false,
    }),
  ]);
}
