/**
 * The integration reconciler: on the switchboard that runs an integration,
 * makes the system match what the integration document asks for, and writes
 * back what it built and found (reconcile.ts). It acts on re-read state, one
 * pass per integration at a time, never on an operation's payload: a replay
 * cannot do anything twice. Passes run when an integration changes, at
 * startup, and every minute (a sign-in finishes on the connection, which this
 * processor does not watch; REQUEST_CHECK asks for an immediate pass).
 */
import type {
  IProcessor,
  IProcessorHostModule,
  OperationWithContext,
} from "@powerhousedao/reactor-browser";
import {
  actions as connectionActions,
  utils as connectionUtils,
} from "@powerhousedao/workflow/document-models/connection";
import { utils as workflowUtils } from "@powerhousedao/workflow/document-models/workflow";
import { generateId } from "document-model";
import type { IntegrationState } from "document-models/integration";
import { hostname } from "node:os";
import type { WorkflowFacts } from "./live-workflow.js";
import {
  reconcileIntegration,
  type ConnectionFacts,
  type ReconcileIO,
} from "./reconcile.js";

export const INTEGRATION_TYPE = "sektar/integration";
/** The switchboard's own reactor connection: steps that write documents use it. */
const REACTOR_CONNECTOR = "@powerhousedao/reactor#reactor";
const SWEEP_MS = 60_000;
const STARTUP_MS = 5_000;

type Module = Pick<IProcessorHostModule, "read" | "dispatch">;

export class IntegrationReconciler implements IProcessor {
  private queue: Promise<void> = Promise.resolve();
  private readonly waiting = new Set<string>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private stopped = false;
  private readonly me = {
    reactorId: `switchboard@${hostname()}`,
    label: hostname(),
  };

  constructor(
    private readonly driveId: string,
    private readonly module: Module,
  ) {}

  /** Starts the startup pass and the minute sweep. */
  start(): void {
    const startup = setTimeout(() => this.sweep(), STARTUP_MS);
    const sweep = setInterval(() => this.sweep(), SWEEP_MS);
    startup.unref?.();
    sweep.unref?.();
    this.timers = [startup, sweep];
  }

  onOperations(operations: OperationWithContext[]): Promise<void> {
    for (const { context } of operations) {
      if (context.documentType === INTEGRATION_TYPE) {
        this.consider(context.documentId);
      }
    }
    return Promise.resolve();
  }

  onDisconnect(): Promise<void> {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    return Promise.resolve();
  }

  private sweep(): void {
    if (this.stopped) return;
    void this.module.read
      .find({ type: INTEGRATION_TYPE, parentId: this.driveId })
      .then((page) => {
        for (const doc of page.results) this.consider(doc.header.id);
      })
      .catch((error: unknown) =>
        console.warn(`[integration-reconciler] sweep failed: ${String(error)}`),
      );
  }

  /** Queues one pass for the integration, unless one is already waiting. */
  private consider(id: string): void {
    if (this.stopped || this.waiting.has(id)) return;
    this.waiting.add(id);
    this.queue = this.queue.then(async () => {
      this.waiting.delete(id);
      try {
        await this.pass(id);
      } catch (error) {
        console.warn(
          `[integration-reconciler] ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  private async pass(id: string): Promise<void> {
    let doc;
    try {
      doc = await this.module.read.get(id);
    } catch {
      return; // deleted
    }
    await reconcileIntegration(
      {
        id,
        name: doc.header.name,
        state: (doc.state as unknown as { global: IntegrationState }).global,
      },
      this.io(id),
    );
  }

  private io(integrationId: string): ReconcileIO {
    const { read, dispatch } = this.module;
    return {
      me: this.me,
      now: () => new Date().toISOString(),
      readConnection: async (id) => {
        let doc;
        try {
          doc = await read.get(id);
        } catch {
          return null;
        }
        const g = (
          doc.state as unknown as {
            global: {
              status: string;
              secretRefs: { name: string }[];
              config: Record<string, unknown> | null;
            };
          }
        ).global;
        const raw = g.config?.oauth_scopes;
        const facts: ConnectionFacts = {
          status: g.status,
          signedIn: g.secretRefs.some((r) => r.name === "token"),
          scopes: Array.isArray(raw)
            ? raw.filter((x): x is string => typeof x === "string")
            : [],
        };
        return facts;
      },
      createConnection: async (spec) => {
        const workflows = await read.get("workflows");
        const document = connectionUtils.createDocument();
        document.header.name = spec.name;
        const created = await dispatch.createInDrive(
          workflows.header.id,
          document,
        );
        const id = created.documentId || document.header.id;
        await dispatch.execute(id, "main", [
          connectionActions.setConnectionName({ name: spec.name }),
          connectionActions.setConnector({
            connectorId: spec.connectorId,
            authType: "OAUTH2",
          }),
          connectionActions.setConfig({ config: spec.config }),
        ]);
        return id;
      },
      setConnectionConfig: async (id, config) => {
        await dispatch.execute(id, "main", [
          connectionActions.setConfig({ config }),
        ]);
      },
      dispatch: async (list) => {
        await dispatch.execute(integrationId, "main", list);
      },
      deleteDocument: async (id) => {
        try {
          await dispatch.deleteDocument(id);
        } catch (error) {
          // Already gone is what removal wants.
          if (!/not found/i.test(String(error))) throw error;
        }
      },
      deleteIntegration: async () => {
        await dispatch.deleteDocument(integrationId);
      },
      newId: () => generateId(),
      findReactorConnection: async () => {
        const page = await read.find({ type: "powerhouse/connection" });
        const found = page.results.find((doc) => {
          const g = (
            doc.state as unknown as {
              global: { connectorId?: string; authType?: string };
            }
          ).global;
          return (
            g.connectorId === REACTOR_CONNECTOR && g.authType === "REACTOR"
          );
        });
        return found?.header.id ?? null;
      },
      readWorkflow: async (id) => {
        let doc;
        try {
          doc = await read.get(id);
        } catch {
          return null;
        }
        const g = (
          doc.state as unknown as {
            global: {
              status: string;
              version: number;
              published: {
                version: number;
                trigger: {
                  triggerName: string;
                  connectionId: string | null;
                  config: Record<string, unknown>;
                } | null;
              } | null;
            };
          }
        ).global;
        const trigger = g.published?.trigger ?? null;
        const facts: WorkflowFacts = {
          status: g.status,
          version: g.version,
          publishedVersion: g.published?.version ?? null,
          triggerName: trigger?.triggerName ?? null,
          triggerConnectionId: trigger?.connectionId ?? null,
          triggerConfig: trigger?.config ?? null,
        };
        return facts;
      },
      createWorkflow: async (name, list) => {
        const workflows = await read.get("workflows");
        const document = workflowUtils.createDocument();
        document.header.name = name;
        const created = await dispatch.createInDrive(
          workflows.header.id,
          document,
        );
        const id = created.documentId || document.header.id;
        await dispatch.execute(id, "main", list);
        return id;
      },
      updateWorkflow: async (id, list) => {
        await dispatch.execute(id, "main", list);
      },
    };
  }
}
