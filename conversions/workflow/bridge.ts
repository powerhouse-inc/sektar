/**
 * Sektar's side of the native workflow runtime, for document conversion:
 *
 * - `workflowRuntimeBridge`: fire, list, read and cancel runs through the
 *   runtime's own authenticated GraphQL, forwarding the verified request's
 *   original bearer to a same-host endpoint the host names. Nothing here
 *   names an actor: the runtime authenticates the bearer itself.
 * - `nativeRunSchema` / `nativeRunPayloadSchema`: the runs as served, for
 *   projection. Not a store.
 * - `conversionProvisioner`: keeps one canonical workflow for the app in the
 *   Workflows drive, published as its authorizer (authority.ts), the way the
 *   Integration reconciler keeps its workflows.
 */
import type { IProcessorHostModule } from "@powerhousedao/reactor-browser";
import {
  actions as connectionActions,
  utils as connectionUtils,
} from "@powerhousedao/workflow/document-models/connection";
import {
  actions as workflowActions,
  utils as workflowUtils,
} from "@powerhousedao/workflow/document-models/workflow";
import {
  signDelegatedAction,
  type DelegationClaims,
  type DelegationCredentialStatus,
  type IRenownCrypto,
} from "@renown/sdk/node";
import type { Action } from "document-model";
import { generateId } from "document-model";
import { z } from "zod";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isMissingDocument } from "../host/problems.js";
import type { ConversionSettings } from "../contracts.js";
import {
  judgeConversionAuthority,
  PUBLISH_WORKFLOW,
  type ConversionAuthority,
  type GrantGap,
  type HostAuthorizationPolicy,
} from "./authority.js";
import {
  buildConversionWorkflow,
  conversionWorkflowDrift,
  conversionWorkflowSpec,
  readConversionWorkflowFacts,
} from "./template.js";

/* ------------------------------------------------------------ the runs */

export const nativeRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "PARKED",
]);
export type NativeRunStatus = z.infer<typeof nativeRunStatusSchema>;

const nullableString = z.string().nullable();

export const nativeStepRunSchema = z.object({
  stepId: z.string(),
  stepKey: z.string(),
  path: nullableString,
  pieceName: z.string(),
  blockName: z.string(),
  status: z.string(),
  output: z.unknown(),
  port: nullableString,
  error: nullableString,
  errorName: nullableString,
  startedAt: nullableString,
  endedAt: nullableString,
});
export type NativeStepRun = z.infer<typeof nativeStepRunSchema>;

/** A WorkflowRunRecord as the runtime serves it. */
export const nativeRunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowVersion: z.number().int(),
  triggerKind: z.string(),
  triggerPayload: z.unknown(),
  status: nativeRunStatusSchema,
  error: nullableString,
  errorName: nullableString,
  startedAt: z.string(),
  endedAt: nullableString,
  rerunOf: nullableString,
  steps: z.array(nativeStepRunSchema),
});
export type NativeRun = z.infer<typeof nativeRunSchema>;

/** What fire and cancelRun answer. `status` is not limited to run statuses (e.g. REFUSED). */
export const nativeRunPayloadSchema = z.object({
  runId: nullableString,
  status: z.string(),
  error: nullableString,
  errorName: nullableString,
  steps: z.array(
    z.object({
      stepId: z.string(),
      key: z.string(),
      pieceName: z.string(),
      blockName: z.string(),
      status: z.string(),
      output: z.unknown(),
      port: nullableString,
      error: nullableString,
      errorName: nullableString,
    }),
  ),
});
export type NativeRunPayload = z.infer<typeof nativeRunPayloadSchema>;

const STEP_RUN_FIELDS =
  "stepId stepKey path pieceName blockName status output port error errorName startedAt endedAt";
const RUN_FIELDS = `id workflowId workflowVersion triggerKind triggerPayload status error errorName startedAt endedAt rerunOf steps { ${STEP_RUN_FIELDS} }`;
const PAYLOAD_FIELDS =
  "runId status error errorName steps { stepId key pieceName blockName status output port error errorName }";

export const RUNTIME_DOCUMENTS = {
  fire: `mutation SektarConversionFire($workflowId: String!, $payload: Unknown) { workflowRuntime { fire(workflowId: $workflowId, payload: $payload) { ${PAYLOAD_FIELDS} } } }`,
  runsPage: `query SektarConversionRunsPage($workflowId: String!, $paging: WorkflowRunsPagingInput) { workflowRuntime { runsPage(workflowId: $workflowId, paging: $paging) { items { ${RUN_FIELDS} } hasNextPage cursor } } }`,
  run: `query SektarConversionRun($id: String!) { workflowRuntime { run(id: $id) { ${RUN_FIELDS} } } }`,
  cancel: `mutation SektarConversionCancel($runId: String!) { workflowRuntime { cancelRun(runId: $runId) { ${PAYLOAD_FIELDS} } } }`,
} as const;

/* ---------------------------------------------------------- the bridge */

export type WorkflowRuntimeErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "graphql"
  | "http"
  | "malformed";

export class WorkflowRuntimeError extends Error {
  override readonly name = "WorkflowRuntimeError";
  constructor(
    readonly code: WorkflowRuntimeErrorCode,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
  }
}

// Native fire waits for the queued run. Node fetch times out its response
// headers after five minutes, before a permitted conversion may finish.
function nativeRequest(endpoint: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const pending = request(
      url,
      {
        method: init.method,
        headers: Object.fromEntries(new Headers(init.headers)),
      },
      (response) => {
        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const status = response.statusCode ?? 502;
            resolve(
              new Response([204, 205, 304].includes(status) ? null : body, {
                status,
              }),
            );
          } catch (error) {
            reject(
              new Error(
                "The workflow runtime returned an invalid HTTP response.",
                { cause: error },
              ),
            );
          }
        });
      },
    );
    pending.on("error", reject);
    pending.end(init.body);
  });
}

export const nativeRunsPageSchema = z.object({
  items: z.array(nativeRunSchema),
  hasNextPage: z.boolean(),
  /** Pass back to read the next page; null for an empty page. */
  cursor: nullableString,
});
export type NativeRunsPage = z.infer<typeof nativeRunsPageSchema>;

/**
 * The request's bearer token, without its "Bearer " prefix; undefined when
 * the request carried none, which only an open host accepts.
 */
export type Bearer = string | undefined;

export interface WorkflowRuntimeBridge {
  /** Natively waits until the run ends or suspends; not an immediate acceptance. */
  fire(
    bearer: Bearer,
    workflowId: string,
    payload: unknown,
  ): Promise<NativeRunPayload>;
  /** Newest first, at most 100 a page (the runtime's cap); follow `cursor` for older runs. */
  runsPage(
    bearer: Bearer,
    workflowId: string,
    paging?: { readonly limit?: number; readonly cursor?: string | null },
  ): Promise<NativeRunsPage>;
  run(bearer: Bearer, runId: string): Promise<NativeRun | null>;
  /** The runtime cancels PENDING and WAITING runs only. */
  cancel(bearer: Bearer, runId: string): Promise<NativeRunPayload | null>;
}

export interface WorkflowRuntimeEndpoint {
  /** The host's own `${origin}/graphql/workflow-runtime`; never taken from a request. */
  readonly endpoint: string;
  /**
   * Forward a request without a bearer as unauthenticated. Only for a host
   * whose authorization policy is OPEN; otherwise a missing bearer is refused
   * here, before anything is sent.
   */
  readonly allowAnonymous?: boolean;
  readonly fetch?: typeof fetch;
}

/** Most runs the runtime returns in one page. */
export const RUNS_PAGE_LIMIT = 100;

/** A bearer as the request carried it; refused if it could smuggle a header. */
const BEARER = /^[A-Za-z0-9\-._~+/]+=*$/;

const graphqlAnswer = z.object({
  data: z.unknown().optional(),
  errors: z
    .array(
      z
        .object({
          message: z.string(),
          extensions: z
            .object({ code: z.string().optional() })
            .loose()
            .optional(),
        })
        .loose(),
    )
    .optional(),
});

const fieldOf = (field: string) =>
  z.object({ workflowRuntime: z.object({ [field]: z.unknown() }) });

export function workflowRuntimeBridge(
  options: WorkflowRuntimeEndpoint,
): WorkflowRuntimeBridge {
  const endpoint = new URL(options.endpoint).toString();
  const send = options.fetch ?? nativeRequest;

  async function call<T>(
    bearer: Bearer,
    query: string,
    variables: Record<string, unknown>,
    field: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    if (bearer === undefined ? !options.allowAnonymous : !BEARER.test(bearer)) {
      throw new WorkflowRuntimeError(
        "unauthenticated",
        "The request carried no usable sign-in.",
      );
    }
    const response = await send(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` }),
      },
      body: JSON.stringify({ query, variables }),
      redirect: "error",
    });
    if (response.status === 401)
      throw new WorkflowRuntimeError(
        "unauthenticated",
        "The workflow runtime did not accept this sign-in.",
        401,
      );
    if (response.status === 403)
      throw new WorkflowRuntimeError(
        "forbidden",
        "The workflow runtime refused this request.",
        403,
      );
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new WorkflowRuntimeError(
        "http",
        `The workflow runtime answered ${response.status} without JSON.`,
        response.status,
      );
    }
    const answer = graphqlAnswer.safeParse(json);
    if (!answer.success)
      throw new WorkflowRuntimeError(
        "malformed",
        "The workflow runtime's answer is not GraphQL.",
        response.status,
      );
    const errors = answer.data.errors ?? [];
    if (errors.length > 0) {
      const code = errors[0]?.extensions?.code;
      throw new WorkflowRuntimeError(
        code === "UNAUTHENTICATED"
          ? "unauthenticated"
          : code === "FORBIDDEN"
            ? "forbidden"
            : "graphql",
        errors.map((error) => error.message).join("; "),
        response.status,
      );
    }
    if (!response.ok)
      throw new WorkflowRuntimeError(
        "http",
        `The workflow runtime answered ${response.status}.`,
        response.status,
      );
    const data = fieldOf(field).safeParse(answer.data.data);
    if (!data.success)
      throw new WorkflowRuntimeError(
        "malformed",
        `The workflow runtime's answer has no ${field}.`,
        response.status,
      );
    const parsed = schema.safeParse(data.data.workflowRuntime[field]);
    if (!parsed.success)
      throw new WorkflowRuntimeError(
        "malformed",
        `The workflow runtime's ${field} is not in the expected form: ${z.prettifyError(parsed.error)}`,
        response.status,
      );
    return parsed.data;
  }

  return {
    fire: (bearer, workflowId, payload) =>
      call(
        bearer,
        RUNTIME_DOCUMENTS.fire,
        { workflowId, payload },
        "fire",
        nativeRunPayloadSchema,
      ),
    runsPage: (bearer, workflowId, paging = {}) =>
      call(
        bearer,
        RUNTIME_DOCUMENTS.runsPage,
        {
          workflowId,
          paging: {
            limit: Math.min(Math.max(1, paging.limit ?? 25), RUNS_PAGE_LIMIT),
            cursor: paging.cursor ?? null,
          },
        },
        "runsPage",
        nativeRunsPageSchema,
      ),
    run: (bearer, runId) =>
      call(
        bearer,
        RUNTIME_DOCUMENTS.run,
        { id: runId },
        "run",
        nativeRunSchema.nullable(),
      ),
    cancel: (bearer, runId) =>
      call(
        bearer,
        RUNTIME_DOCUMENTS.cancel,
        { runId },
        "cancelRun",
        nativeRunPayloadSchema.nullable(),
      ),
  };
}

/* ---------------------------------------------------------- provisioning */

type Module = Pick<IProcessorHostModule, "read" | "dispatch" | "host">;

export interface ConversionProvisioningIO {
  readonly module: Module;
  readonly authorization: HostAuthorizationPolicy;
  /** This environment's runner key (integration-reconciler/runner-key.ts); null when unreadable. */
  readonly delegate: () => Promise<IRenownCrypto | null>;
  readonly credential: (
    claims: DelegationClaims,
  ) => Promise<DelegationCredentialStatus>;
  /** A real proof that the Workflows drive's readers may read all app sources; absent: none. */
  readonly sameAudience?: () => Promise<boolean>;
  readonly now: () => Date;
  readonly newId?: () => string;
}

export interface EnsureInput {
  readonly settings: Pick<ConversionSettings, "activation">;
  /** The workflow the settings store maps the app to; null on first setup. */
  readonly workflowId: string | null;
  /** The signed PUBLISH_WORKFLOW delegation for `sektar/conversion:app`. */
  readonly grant: string | null;
}

export type EnsureResult =
  | {
      readonly kind: "ready";
      readonly workflowId: string;
      readonly reactorConnectionId: string;
      /** The person the workflow runs as; null for the host. */
      readonly publisher: string | null;
      readonly authority: Extract<
        ConversionAuthority,
        { kind: "host" | "delegated" }
      >;
      readonly created: boolean;
      readonly changes: readonly string[];
    }
  | {
      readonly kind: "needs-grant";
      readonly gap: GrantGap;
      readonly message: string;
      readonly endedAt?: string;
    }
  | {
      readonly kind: "refused";
      readonly code:
        | "audience-unproven"
        | "no-workflows-drive"
        | "not-a-workflow";
      readonly message: string;
      readonly detail?: string;
    };

const WORKFLOWS_DRIVE = "workflows";
/** The switchboard's own reactor connection: steps that read and write documents use it. */
const REACTOR_CONNECTOR = "@powerhousedao/reactor#reactor";
/** As the Integration grant step names it (editors/sektar/kit/reactor-grant.ts). */
const REACTOR_CONNECTION_NAME = "Reactor access";

/** The switchboard's reactor connection that works; a revoked one grants nothing. */
async function findReactorConnection(
  read: Module["read"],
): Promise<string | null> {
  const page = await read.find({ type: "powerhouse/connection" });
  const found = page.results.find((doc) => {
    const global: unknown = (doc.state as { global?: unknown }).global;
    if (typeof global !== "object" || global === null) return false;
    const g = global as {
      connectorId?: unknown;
      authType?: unknown;
      status?: unknown;
    };
    return (
      g.connectorId === REACTOR_CONNECTOR &&
      g.authType === "REACTOR" &&
      g.status !== "REVOKED"
    );
  });
  return found?.header.id ?? null;
}
const WORKFLOW_TYPE = "powerhouse/workflow";
/** How a delegate's signature labels itself; a label and no more. */
const RUNNER_APP = "sektar-runner";

/** The workflow's latest applied publish signer, as the runtime reads the run user. */
async function latestPublisher(
  read: Module["read"],
  workflowId: string,
  hostKey: string | undefined,
): Promise<string | null> {
  let page = await read.getOperations(
    workflowId,
    { scopes: ["global"] },
    { actionTypes: [PUBLISH_WORKFLOW] },
  );
  let latest: { index: number; context: Action["context"] } | undefined;
  for (;;) {
    for (const { action, error, index } of page.results) {
      if (action.type !== PUBLISH_WORKFLOW || error !== undefined) continue;
      if (!latest || index > latest.index)
        latest = { index, context: action.context };
    }
    if (!page.next || page.results.length === 0) break;
    page = await page.next();
  }
  const signer = latest?.context?.signer;
  if (!signer?.signatures.length || signer.app.key === hostKey) return null;
  return signer.user.address || null;
}

export function conversionProvisioner(io: ConversionProvisioningIO): {
  ensure(input: EnsureInput): Promise<EnsureResult>;
  disable(workflowId: string): Promise<void>;
} {
  const { read, dispatch } = io.module;
  const newId = io.newId ?? generateId;

  async function committed(result: { id: string; status: string }) {
    const job = await read.waitForJob(result.id, AbortSignal.timeout(30_000));
    if (String(job.status) === "FAILED" || job.result?.allApplied === false)
      throw new Error(
        "The reactor could not apply the conversion workflow setup.",
      );
  }
  async function execute(id: string, branch: string, actions: Action[]) {
    await committed(await dispatch.execute(id, branch, actions));
  }

  async function signed<A extends Action>(
    workflowId: string,
    list: readonly A[],
    authority: Extract<ConversionAuthority, { kind: "host" | "delegated" }>,
  ): Promise<A[]> {
    if (authority.kind !== "delegated") return [...list];
    const crypto = await io.delegate();
    if (!crypto) throw new Error("The runner key cannot be read");
    return Promise.all(
      list.map(async (action) =>
        action.type === PUBLISH_WORKFLOW
          ? ((await signDelegatedAction({
              action,
              target: { documentId: workflowId, branch: "main" },
              crypto,
              appName: RUNNER_APP,
              user: authority.person,
              statement: authority.statement,
            })) as A)
          : action,
      ),
    );
  }

  async function workflowsDriveId(): Promise<string | null> {
    try {
      return (await read.get(WORKFLOWS_DRIVE)).header.id;
    } catch (error) {
      if (isMissingDocument(error)) return null;
      throw error;
    }
  }

  /**
   * The local reactor connection, made as the Integration grant step makes it:
   * the global grant already authorizes runs that read and write documents
   * through it, as the run user.
   */
  async function createReactorConnection(driveId: string): Promise<string> {
    const document = connectionUtils.createDocument();
    document.header.name = REACTOR_CONNECTION_NAME;
    const created = await dispatch.createInDrive(driveId, document);
    await committed(created);
    const id = created.documentId || document.header.id;
    await execute(id, "main", [
      connectionActions.setConnectionName({ name: REACTOR_CONNECTION_NAME }),
      connectionActions.setConnector({
        connectorId: REACTOR_CONNECTOR,
        authType: "REACTOR",
      }),
      connectionActions.setConfig({ config: { endpoint: "local" } }),
      connectionActions.recordCheckResult({
        status: "OK",
        checkedAt: io.now().toISOString(),
      }),
    ]);
    return id;
  }

  async function existing(workflowId: string | null) {
    if (!workflowId) return null;
    try {
      return await read.get(workflowId);
    } catch (error) {
      if (isMissingDocument(error)) return null;
      throw error;
    }
  }

  return {
    async disable(workflowId) {
      const document = await existing(workflowId);
      if (!document) return;
      if (document.header.documentType !== WORKFLOW_TYPE)
        throw new Error("The conversion settings do not name a workflow.");
      if (
        "global" in document.state &&
        readConversionWorkflowFacts(document.state.global).status === "DISABLED"
      )
        return;
      await execute(workflowId, "main", [
        workflowActions.setWorkflowStatus({ status: "DISABLED" }),
      ]);
    },
    async ensure(input) {
      const host = io.module.host;
      const sameAudience = io.sameAudience;
      const key = input.grant ? await io.delegate() : null;
      const authority = await judgeConversionAuthority({
        statement: input.grant,
        host: {
          environment: host?.key ?? null,
          address: host?.address ?? null,
          requiresPerson: host?.requiresPerson ?? false,
        },
        authorization: io.authorization,
        delegate: key?.did ?? null,
        now: Math.floor(io.now().getTime() / 1000),
        credential: (claims) => io.credential(claims),
        ...(sameAudience ? { sameAudience } : {}),
      });
      if (authority.kind === "needs-grant" || authority.kind === "refused")
        return authority;

      const workflowsDrive = await workflowsDriveId();
      if (!workflowsDrive) {
        return {
          kind: "refused",
          code: "no-workflows-drive",
          message:
            "Sektar hasn't finished setting up on this host. Restart Sektar, then try again.",
          detail:
            "The Workflows drive is not on this host yet, so the conversion workflow has nowhere to live.",
        };
      }
      const reactorConnectionId =
        (await findReactorConnection(read)) ??
        (await createReactorConnection(workflowsDrive));
      const spec = conversionWorkflowSpec({
        activation: input.settings.activation,
        workflowsDriveId: workflowsDrive,
        reactorConnectionId,
      });
      const now = io.now().toISOString();
      const publisher =
        authority.kind === "delegated" ? authority.person.address : null;
      const ready = (
        workflowId: string,
        created: boolean,
        changes: readonly string[],
      ): EnsureResult => ({
        kind: "ready",
        workflowId,
        reactorConnectionId,
        publisher,
        authority,
        created,
        changes,
      });

      const document = await existing(input.workflowId);
      if (document && document.header.documentType !== WORKFLOW_TYPE) {
        return {
          kind: "refused",
          code: "not-a-workflow",
          message:
            "The conversion setup for these files is damaged. Ask your Sektar administrator to repair it.",
          detail: `The conversion settings name ${document.header.id}, which is not a workflow.`,
        };
      }
      if (document) {
        const workflowId = document.header.id;
        const actual = await latestPublisher(read, workflowId, host?.key);
        const facts = readConversionWorkflowFacts(
          (document.state as { global?: unknown }).global,
        );
        const drift = conversionWorkflowDrift(
          spec,
          facts,
          newId,
          now,
          (actual?.toLowerCase() ?? null) !==
            (publisher?.toLowerCase() ?? null),
        );
        if (drift.actions.length > 0) {
          await execute(
            workflowId,
            "main",
            await signed(workflowId, drift.actions, authority),
          );
        }
        return ready(workflowId, false, drift.differences);
      }

      const created = workflowUtils.createDocument();
      created.header.name = spec.name;
      const result = await dispatch.createInDrive(workflowsDrive, created);
      await committed(result);
      const workflowId = result.documentId || created.header.id;
      await execute(
        workflowId,
        "main",
        await signed(
          workflowId,
          buildConversionWorkflow(spec, newId, now),
          authority,
        ),
      );
      return ready(workflowId, true, ["the conversion workflow was created"]);
    },
  };
}
