import { randomUUID } from "node:crypto";
import type { IReactorClient } from "@powerhousedao/reactor";
import {
  AuthorizationPolicy,
  createCanonicalDocumentIdResolver,
  type IAuthorizationService,
  type IHttpScope,
  type ScopedRouteHandle,
  type GraphQLManager,
} from "@powerhousedao/reactor-api";
import type { IProcessorHostModule } from "@powerhousedao/reactor-browser";
import type { IRelationalDb } from "@powerhousedao/shared/processors";
import { loadRunnerKey } from "../../processors/integration-reconciler/runner-key.js";
import {
  CredentialWatch,
  credentialStatusOn,
} from "../../processors/integration-reconciler/grant.js";
import {
  conversionProvisioner,
  workflowRuntimeBridge,
} from "../workflow/bridge.js";
import {
  judgeConversionAuthority,
  type HostAuthorizationPolicy,
} from "../workflow/authority.js";
import { conversionGatewayResolvers } from "./gateway.js";
import { registerConversionRoutes } from "./http.js";
import { ConversionService } from "./service.js";
import { SettingsStore, type SettingsDatabase } from "./settings-store.js";
import { ConversionRefusal, isMissingDocument } from "./problems.js";
import { type AccessPort, type WorkflowPort, ANONYMOUS } from "./ports.js";
import { APP_CONVERSION_KEY } from "../contracts.js";

export interface SubgraphHalf {
  http: IHttpScope;
  authorizationService: IAuthorizationService;
  reactorClient: IReactorClient;
  relationalDb: IRelationalDb;
  graphqlManager: GraphQLManager;
}
export type ProcessorHalf = Pick<
  IProcessorHostModule,
  "relationalDb" | "attachments" | "read" | "dispatch" | "host"
>;

export function authorizationAccess(
  authorization: IAuthorizationService,
  read: IReactorClient,
): AccessPort {
  const resolve = createCanonicalDocumentIdResolver(read);
  const allowed = async (
    address: string | undefined,
    documentId: string,
    write: boolean,
  ) => {
    if (authorization.isSupremeAdmin(address)) return true;
    if (
      authorization.config.policy !== AuthorizationPolicy.DOCUMENT_PERMISSIONS
    )
      return false;
    let canonical;
    try {
      canonical = await resolve(documentId);
    } catch (error) {
      if (isMissingDocument(error)) throw error;
      throw new ConversionRefusal(
        503,
        "authorization-unavailable",
        "Sektar couldn't check your access to this document. Try again in a moment.",
        true,
      );
    }
    return write
      ? authorization.canWrite(canonical, address)
      : authorization.canRead(canonical, address);
  };
  return {
    canManageSettings: (caller) =>
      Promise.resolve(authorization.isSupremeAdmin(caller.address)),
    canRead: (caller, id) => allowed(caller.address, id, false),
    canWrite: (caller, id) => allowed(caller.address, id, true),
  };
}

const GRANT_OWNER = () =>
  new ConversionRefusal(
    403,
    "grant-owner",
    "Another person's permission is set up to convert these files. Choose Use my access only in Settings → Document conversion to convert as you.",
    false,
  );

function workflowPort(
  subgraph: SubgraphHalf,
  module: ProcessorHalf,
): WorkflowPort {
  const authorization: HostAuthorizationPolicy =
    subgraph.authorizationService.config.policy;
  const endpoint = () =>
    new URL(
      `${subgraph.graphqlManager.getBasePath().replace(/\/$/, "")}/graphql/workflow-runtime`,
      subgraph.http.baseUrl,
    ).href;
  const bridge = () =>
    workflowRuntimeBridge({
      endpoint: endpoint(),
      allowAnonymous: authorization === "OPEN",
    });
  const watch = new CredentialWatch(process.env.RENOWN_URL);
  const credential = credentialStatusOn(process.env.RENOWN_SOURCE, watch);
  const delegate = () => loadRunnerKey();
  const provisioner = conversionProvisioner({
    module,
    authorization,
    delegate,
    credential,
    now: () => new Date(),
  });
  const bearer = (header?: string) => header?.replace(/^Bearer\s+/i, "");
  const assertSetup = () => {
    if (authorization === "DOCUMENT_PERMISSIONS")
      throw new ConversionRefusal(
        422,
        "workflow-audience",
        "Sektar can't convert PDFs on a host that sets access document by document yet. Run Sektar with open or admin-only access to convert.",
        false,
      );
  };
  return {
    assertSetup,
    disable: (workflowId) => provisioner.disable(workflowId),
    async ensure(settings, caller, grant, existing) {
      assertSetup();
      const statement = grant ?? existing?.grant ?? null;
      const key = statement ? await delegate() : null;
      const authority = await judgeConversionAuthority({
        statement,
        host: {
          environment: module.host?.key ?? null,
          address: module.host?.address ?? null,
          requiresPerson: module.host?.requiresPerson ?? false,
        },
        authorization,
        delegate: key?.did ?? null,
        now: Math.floor(Date.now() / 1000),
        credential,
      });
      if (authority.kind === "needs-grant" || authority.kind === "refused")
        throw new ConversionRefusal(
          403,
          "workflow-grant",
          authority.message,
          false,
        );
      if (
        authority.kind === "delegated" &&
        authority.person.address.toLowerCase() !== caller.identity
      )
        throw GRANT_OWNER();
      const result = await provisioner.ensure({
        settings,
        workflowId: existing?.workflow_id ?? null,
        grant: statement,
      });
      if (result.kind !== "ready")
        throw new ConversionRefusal(
          422,
          result.kind === "needs-grant"
            ? `workflow-grant-${result.gap}`
            : result.code,
          result.message,
          false,
          result.kind === "refused" ? result.detail : undefined,
        );
      const authorizer = result.publisher?.toLowerCase() ?? ANONYMOUS;
      if (
        result.authority.kind === "delegated" &&
        authorizer !== caller.identity
      )
        throw GRANT_OWNER();
      return {
        scope_key: APP_CONVERSION_KEY,
        workflow_id: result.workflowId,
        authorizer,
        grant: statement,
      };
    },
    async validateBinding(binding) {
      assertSetup();
      const key = binding.grant ? await delegate() : null;
      const authority = await judgeConversionAuthority({
        statement: binding.grant,
        host: {
          environment: module.host?.key ?? null,
          address: module.host?.address ?? null,
          requiresPerson: module.host?.requiresPerson ?? false,
        },
        authorization,
        delegate: key?.did ?? null,
        now: Math.floor(Date.now() / 1000),
        credential,
      });
      if (authority.kind === "needs-grant" || authority.kind === "refused")
        throw new ConversionRefusal(
          403,
          "workflow-grant",
          authority.message,
          false,
        );
      const publisher =
        authority.kind === "delegated"
          ? authority.person.address.toLowerCase()
          : ANONYMOUS;
      if (binding.authorizer !== publisher)
        throw new ConversionRefusal(
          403,
          "workflow-grant",
          "The permission to convert these files changed. Choose Use my access only in Settings → Document conversion.",
          false,
        );
    },
    fire: async (id, payload, auth) => {
      const result = await bridge().fire(bearer(auth), id, payload);
      if (!result.runId)
        throw new ConversionRefusal(
          409,
          "workflow-not-started",
          "Sektar couldn't start this conversion. Try again in a moment.",
          true,
          result.error ?? undefined,
        );
      return result.runId;
    },
    async runs(id, auth) {
      const runs = [];
      let cursor: string | undefined;
      for (;;) {
        const page = await bridge().runsPage(bearer(auth), id, {
          limit: 100,
          cursor,
        });
        runs.push(...page.items);
        if (!page.hasNextPage || !page.cursor || page.cursor === cursor)
          return runs;
        cursor = page.cursor;
      }
    },
    run: (id, auth) => bridge().run(bearer(auth), id),
    cancel: async (id, auth) => {
      await bridge().cancel(bearer(auth), id);
    },
  };
}

class ConversionRuntime {
  #subgraph: SubgraphHalf | null = null;
  #processor: ProcessorHalf | null = null;
  #service: ConversionService | null = null;
  #routes: ScopedRouteHandle[] = [];
  #building: Promise<void> | null = null;
  #closing: Promise<void> = Promise.resolve();
  private retireService(): void {
    const service = this.#service;
    this.#service = null;
    if (!service) return;
    const closing = service.close();
    this.#closing = Promise.all([this.#closing, closing])
      .then(() => undefined)
      .catch((error: unknown) =>
        console.error("[conversion] Could not interrupt scanner setup", error),
      );
  }
  gatewayResolvers() {
    return conversionGatewayResolvers(
      () => this.#service,
      (error) => console.error("[conversion]", error),
    );
  }
  attachSubgraph(half: SubgraphHalf): void {
    for (const route of this.#routes) route.dispose();
    this.retireService();
    this.#subgraph = half;
    this.#routes = registerConversionRoutes(
      half.http,
      () => this.#service,
      (error) => console.error("[conversion]", error),
    );
    this.compose();
  }
  attachProcessor(half: ProcessorHalf): void {
    if (this.#processor !== half) this.retireService();
    this.#processor = half;
    this.compose();
  }
  async detachSubgraph(half: SubgraphHalf): Promise<void> {
    if (this.#subgraph !== half) return;
    for (const route of this.#routes) route.dispose();
    this.#routes = [];
    this.#subgraph = null;
    this.retireService();
    await this.#closing;
    await this.#building;
  }
  private compose(): void {
    if (this.#building || this.#service || !this.#subgraph || !this.#processor)
      return;
    const subgraph = this.#subgraph;
    const processor = this.#processor;
    this.#building = (async () => {
      await this.#closing;
      const store = new SettingsStore(
        await subgraph.relationalDb.createNamespace<SettingsDatabase>(
          "sektar_conversion",
        ),
      );
      await store.initialize();
      const service = new ConversionService({
        maxFileBytes: (() => {
          const configured = Number(
            process.env.PH_WORKFLOWS_PIECE_MAX_FILE_BYTES,
          );
          return Number.isFinite(configured) && configured > 0
            ? Math.floor(configured)
            : 8 * 1024 * 1024;
        })(),
        store,
        read: processor.read,
        attachments: processor.attachments,
        access: authorizationAccess(
          subgraph.authorizationService,
          subgraph.reactorClient,
        ),
        workflows: workflowPort(subgraph, processor),
        newId: randomUUID,
      });
      await service.retireLegacyWorkflows();
      await service.reconcileWorkflow();
      if (subgraph === this.#subgraph && processor === this.#processor)
        this.#service = service;
      else await service.close();
    })()
      .catch((error: unknown) =>
        console.error("[conversion] workflow adapter could not start", error),
      )
      .finally(() => {
        this.#building = null;
        if (subgraph !== this.#subgraph || processor !== this.#processor)
          this.compose();
      });
  }
}
const RUNTIME = Symbol.for("@powerhousedao/sektar/conversion-workflow-runtime");
const globals = globalThis as typeof globalThis & {
  [RUNTIME]?: ConversionRuntime;
};
export function conversionRuntime(): ConversionRuntime {
  return (globals[RUNTIME] ??= new ConversionRuntime());
}
