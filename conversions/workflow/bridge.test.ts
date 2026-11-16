import {
  reducer as connectionReducer,
  utils as connectionUtils,
} from "@powerhousedao/workflow/document-models/connection";
import {
  reducer as workflowReducer,
  type WorkflowDocument,
} from "@powerhousedao/workflow/document-models/workflow";
import {
  buildAndSignCredential,
  createDelegation,
  MemoryKeyStorage,
  RenownCryptoBuilder,
  type IRenownCrypto,
  type PowerhouseVerifiableCredential,
  type SignCredentialTypedData,
} from "@renown/sdk/node";
import type { Action, PHDocument } from "document-model";
import { buildSchema, parse, validate } from "graphql";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
import { beforeAll, describe, expect, it } from "vitest";
import { APP_CONVERSION_RESOURCE } from "../contracts.js";
import {
  conversionProvisioner,
  nativeRunSchema,
  RUNTIME_DOCUMENTS,
  workflowRuntimeBridge,
  WorkflowRuntimeError,
  type ConversionProvisioningIO,
  type EnsureResult,
} from "./bridge.js";

const ENDPOINT = "http://127.0.0.1:4001/graphql/workflow-runtime";

/* --------------------------------------------- against the served schema */

/** The workflow-runtime subgraph's own SDL, as the installed switchboard serves it. */
function servedSchema() {
  const dist = dirname(
    fileURLToPath(import.meta.resolve("@powerhousedao/switchboard")),
  );
  const file = readdirSync(dist).find((name) =>
    /^workflows-.*\.mjs$/.test(name),
  );
  const source = readFileSync(join(dist, file ?? "missing"), "utf8");
  const start =
    source.indexOf("const schema = gql`") + "const schema = gql`".length;
  const sdl = source.slice(start, source.indexOf("`", start));
  const declared = new Set(
    [...sdl.matchAll(/scalar (\w+)/g)].map((match) => match[1]),
  );
  const scalars = ["Unknown", "JSONObject", "DateTime"].filter(
    (name) => !declared.has(name),
  );
  return buildSchema(
    `${scalars.map((name) => `scalar ${name}`).join("\n")}\n${sdl}`,
    {
      assumeValidSDL: true,
    },
  );
}

describe("the documents the bridge sends", () => {
  it("settles an empty native HTTP response as a protocol failure", async () => {
    const http = createServer((_request, response) => {
      response.writeHead(204);
      response.end();
    });
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    try {
      const address = http.address();
      if (!address || typeof address === "string")
        throw new Error("No server address");
      await expect(
        workflowRuntimeBridge({
          endpoint: `http://127.0.0.1:${address.port}/graphql`,
          allowAnonymous: true,
        }).run(undefined, "run"),
      ).rejects.toMatchObject({ code: "http", status: 204 });
    } finally {
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  it("are valid against the runtime's served schema", () => {
    const schema = servedSchema();
    for (const [name, document] of Object.entries(RUNTIME_DOCUMENTS)) {
      expect([
        name,
        validate(schema, parse(document)).map((error) => error.message),
      ]).toEqual([name, []]);
    }
  });
});

/* ------------------------------------------------------------ forwarding */

const RUN = {
  id: "run-1",
  workflowId: "wf-1",
  workflowVersion: 3,
  triggerKind: "manual",
  triggerPayload: { request: { source: { kind: "file", documentId: "f-1" } } },
  status: "SUCCEEDED",
  error: null,
  errorName: null,
  startedAt: "2026-11-11T12:00:00.000Z",
  endedAt: "2026-11-11T12:00:03.000Z",
  rerunOf: null,
  steps: [
    {
      stepId: "s-5",
      stepKey: "publish",
      path: null,
      pieceName: "@powerhousedao/sektar-pdf-piece",
      blockName: "publish-rendition",
      status: "SUCCEEDED",
      output: { kind: "published" },
      port: "next",
      error: null,
      errorName: null,
      startedAt: "2026-11-11T12:00:02.000Z",
      endedAt: "2026-11-11T12:00:03.000Z",
    },
  ],
};

function server(
  answer: (body: {
    query: string;
    variables: Record<string, unknown>;
  }) => unknown,
  status = 200,
) {
  const requests: {
    url: string;
    headers: Record<string, string>;
    body: { query: string; variables: Record<string, unknown> };
  }[] = [];
  const fetch = (url: string, init: RequestInit & { body: string }) => {
    const body = JSON.parse(init.body) as {
      query: string;
      variables: Record<string, unknown>;
    };
    requests.push({
      url,
      headers: init.headers as Record<string, string>,
      body,
    });
    return Promise.resolve(Response.json(answer(body), { status }));
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

async function failure(
  promise: Promise<unknown>,
): Promise<WorkflowRuntimeError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof WorkflowRuntimeError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("forwarding to the native workflow runtime", () => {
  it("forwards the request's own bearer to the host's endpoint and parses runs", async () => {
    const host = server(() => ({
      data: {
        workflowRuntime: {
          runsPage: { items: [RUN], hasNextPage: true, cursor: "c-1" },
        },
      },
    }));
    const bridge = workflowRuntimeBridge({
      endpoint: ENDPOINT,
      fetch: host.fetch,
    });
    const page = await bridge.runsPage("token.abc-123", "wf-1", {
      limit: 500,
      cursor: "c-0",
    });
    expect(page).toEqual({
      items: [nativeRunSchema.parse(RUN)],
      hasNextPage: true,
      cursor: "c-1",
    });
    const request = host.requests.at(0);
    if (!request) throw new Error("nothing was sent");
    expect(request.url).toBe(ENDPOINT);
    expect(request.headers.authorization).toBe("Bearer token.abc-123");
    expect(request.body.variables).toEqual({
      workflowId: "wf-1",
      paging: { limit: 100, cursor: "c-0" },
    });
    expect(JSON.stringify(request.body)).not.toMatch(/actor|userId|address/);
  });

  it("fires with the payload as given and reads one run", async () => {
    const host = server((body) =>
      body.query.includes("fire(")
        ? {
            data: {
              workflowRuntime: {
                fire: {
                  runId: "run-1",
                  status: "SUCCEEDED",
                  error: null,
                  errorName: null,
                  steps: [],
                },
              },
            },
          }
        : { data: { workflowRuntime: { run: null } } },
    );
    const bridge = workflowRuntimeBridge({
      endpoint: ENDPOINT,
      fetch: host.fetch,
    });
    const payload = {
      request: {
        source: { kind: "file", documentId: "f-1" },
        intent: { kind: "ensure" },
      },
    };
    expect(await bridge.fire("t", "wf-1", payload)).toMatchObject({
      runId: "run-1",
      status: "SUCCEEDED",
    });
    expect(host.requests[0]?.body.variables).toEqual({
      workflowId: "wf-1",
      payload,
    });
    expect(await bridge.run("t", "missing")).toBeNull();
  });

  it("sends no authorization only when the host is open, and never a smuggled header", async () => {
    const host = server(() => ({
      data: { workflowRuntime: { cancelRun: null } },
    }));
    const closed = workflowRuntimeBridge({
      endpoint: ENDPOINT,
      fetch: host.fetch,
    });
    expect((await failure(closed.cancel(undefined, "run-1"))).code).toBe(
      "unauthenticated",
    );
    expect(
      (await failure(closed.cancel("t\r\nx-admin: 1", "run-1"))).code,
    ).toBe("unauthenticated");
    expect(host.requests).toHaveLength(0);

    const open = workflowRuntimeBridge({
      endpoint: ENDPOINT,
      fetch: host.fetch,
      allowAnonymous: true,
    });
    expect(await open.cancel(undefined, "run-1")).toBeNull();
    expect(host.requests[0]?.headers).not.toHaveProperty("authorization");
  });

  it("reports refusals and unexpected answers as what they are", async () => {
    const forbidden = server(() => ({
      errors: [
        {
          message: "Not allowed to read this workflow",
          extensions: { code: "FORBIDDEN" },
        },
      ],
    }));
    const error = await failure(
      workflowRuntimeBridge({ endpoint: ENDPOINT, fetch: forbidden.fetch }).run(
        "t",
        "r",
      ),
    );
    expect(error).toMatchObject({
      code: "forbidden",
      message: "Not allowed to read this workflow",
    });

    const unauthorized = server(() => ({}), 401);
    expect(
      (
        await failure(
          workflowRuntimeBridge({
            endpoint: ENDPOINT,
            fetch: unauthorized.fetch,
          }).run("t", "r"),
        )
      ).code,
    ).toBe("unauthenticated");
    const odd = server(() => ({
      data: { workflowRuntime: { run: { id: 1 } } },
    }));
    expect(
      (
        await failure(
          workflowRuntimeBridge({ endpoint: ENDPOINT, fetch: odd.fetch }).run(
            "t",
            "r",
          ),
        )
      ).code,
    ).toBe("malformed");
  });
});

/* ---------------------------------------------------------- provisioning */

// viem is the SDK's own dependency; Sektar does not declare it.
type Account = {
  address: `0x${string}`;
  signTypedData(args: unknown): Promise<`0x${string}`>;
};
const { privateKeyToAccount } = createRequire(
  import.meta.resolve("@renown/sdk/node"),
)("viem/accounts") as { privateKeyToAccount: (key: `0x${string}`) => Account };
// A well-known Anvil dev key; never used for anything real.
const PERSON = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const newKey = (): Promise<IRenownCrypto> =>
  new RenownCryptoBuilder().withKeyPairStorage(new MemoryKeyStorage()).build();

/** A processor module over in-memory documents, run through the real reducers. */
function hostWith(facts: { key: string; requiresPerson: boolean }) {
  const documents = new Map<string, PHDocument>();
  const executed: string[] = [];
  const module = {
    host: {
      key: facts.key,
      address: null,
      requiresPerson: facts.requiresPerson,
    },
    read: {
      waitForJob: (id: string) =>
        Promise.resolve({
          id,
          status: "READ_READY",
          result: { allApplied: true, actions: [] },
        }),
      get: (id: string) => {
        if (id === "workflows")
          return Promise.resolve({ header: { id: "workflows-drive" } });
        const document = documents.get(id);
        return document
          ? Promise.resolve(document)
          : Promise.reject(
              Object.assign(new Error("not found"), {
                name: "DocumentNotFoundError",
              }),
            );
      },
      find: ({ type }: { type: string }) =>
        Promise.resolve({
          results: [...documents.values()].filter(
            (document) => document.header.documentType === type,
          ),
        }),
      getOperations: (id: string) =>
        Promise.resolve({
          results: documents.get(id)?.operations.global ?? [],
        }),
    },
    dispatch: {
      createInDrive: (_drive: string, document: PHDocument) => {
        documents.set(document.header.id, document);
        return Promise.resolve({
          id: "create-job",
          status: "READ_READY",
          documentId: document.header.id,
        });
      },
      execute: (id: string, _branch: string, list: Action[]) => {
        let document = documents.get(id);
        if (!document) throw new Error(`No document ${id}`);
        for (const action of list) {
          document =
            document.header.documentType === "powerhouse/connection"
              ? connectionReducer(document as never, action as never)
              : workflowReducer(document as WorkflowDocument, action as never);
          const last = document.operations.global.at(-1);
          if (last?.error) throw new Error(`${action.type}: ${last.error}`);
        }
        documents.set(id, document);
        executed.push(id);
        return Promise.resolve({ id: "job", status: "COMPLETED" });
      },
    },
  };
  return {
    module: module as unknown as ConversionProvisioningIO["module"],
    documents,
    executed,
  };
}

const ready = (result: EnsureResult) => {
  if (result.kind !== "ready")
    throw new Error(`${result.kind}: ${result.message}`);
  return result;
};

describe("keeping one conversion workflow for the app", () => {
  let session: IRenownCrypto;
  let runner: IRenownCrypto;
  let hostKey: IRenownCrypto;
  let credential: PowerhouseVerifiableCredential;

  beforeAll(async () => {
    session = await newKey();
    runner = await newKey();
    hostKey = await newKey();
    credential = await buildAndSignCredential({
      signTypedData: ((args) =>
        PERSON.signTypedData(args)) as SignCredentialTypedData,
      address: PERSON.address,
      chainId: 1,
      app: "connect",
      appId: session.did,
    });
  });

  const io = (
    host: ReturnType<typeof hostWith>,
    overrides: Partial<ConversionProvisioningIO> = {},
  ): ConversionProvisioningIO => ({
    module: host.module,
    authorization: "ADMIN_ONLY",
    delegate: () => Promise.resolve(runner),
    credential: () => Promise.resolve("active"),
    now: () => new Date(),
    ...overrides,
  });
  const grant = () =>
    createDelegation({
      issuer: session.issuer,
      credential,
      delegate: runner.did,
      environment: hostKey.did,
      scope: { ops: ["PUBLISH_WORKFLOW"], res: APP_CONVERSION_RESOURCE },
    });
  const publishSigner = (document: PHDocument | undefined) =>
    document?.operations.global
      .filter((operation) => operation.action.type === "PUBLISH_WORKFLOW")
      .map(
        (operation) => operation.action.context?.signer?.user.address ?? null,
      );

  it("creates the reactor connection and a workflow published as the granting person, then changes nothing", async () => {
    const host = hostWith({ key: hostKey.did, requiresPerson: true });
    const provisioner = conversionProvisioner(io(host));
    const statement = await grant();
    const first = ready(
      await provisioner.ensure({
        settings: { activation: "automatic" },
        workflowId: null,
        grant: statement,
      }),
    );
    expect(first).toMatchObject({ created: true, publisher: PERSON.address });
    const connection = host.documents.get(first.reactorConnectionId);
    expect(connection?.state).toMatchObject({
      global: {
        connectorId: "@powerhousedao/reactor#reactor",
        authType: "REACTOR",
        status: "OK",
      },
    });
    const workflow = host.documents.get(first.workflowId);
    expect(publishSigner(workflow)).toEqual([PERSON.address]);
    expect(
      (workflow?.state as WorkflowDocument["state"] | undefined)?.global.status,
    ).toBe("ENABLED");

    host.executed.length = 0;
    const again = ready(
      await provisioner.ensure({
        settings: { activation: "automatic" },
        workflowId: first.workflowId,
        grant: statement,
      }),
    );
    expect(again).toMatchObject({
      workflowId: first.workflowId,
      reactorConnectionId: first.reactorConnectionId,
      created: false,
      changes: [],
    });
    expect(host.executed).toEqual([]);

    await provisioner.disable(first.workflowId);
    expect(host.documents.get(first.workflowId)?.state).toMatchObject({
      global: { status: "DISABLED" },
    });
    host.executed.length = 0;
    await provisioner.disable(first.workflowId);
    expect(host.executed).toEqual([]);
  });

  it("republishes as the person when a host-published workflow gets a grant", async () => {
    const host = hostWith({ key: hostKey.did, requiresPerson: false });
    const provisioner = conversionProvisioner(
      io(host, { authorization: "OPEN" }),
    );
    const asHost = ready(
      await provisioner.ensure({
        settings: { activation: "manual" },
        workflowId: null,
        grant: null,
      }),
    );
    expect(asHost).toMatchObject({
      publisher: null,
      authority: { kind: "host" },
    });
    expect(publishSigner(host.documents.get(asHost.workflowId))).toEqual([
      null,
    ]);

    const asPerson = ready(
      await provisioner.ensure({
        settings: { activation: "manual" },
        workflowId: asHost.workflowId,
        grant: await grant(),
      }),
    );
    expect(asPerson.publisher).toBe(PERSON.address);
    expect(publishSigner(host.documents.get(asHost.workflowId))).toEqual([
      null,
      PERSON.address,
    ]);
  });

  it("asks for a grant, or refuses an unproven audience, before writing anything", async () => {
    const host = hostWith({ key: hostKey.did, requiresPerson: true });
    expect(
      await conversionProvisioner(io(host)).ensure({
        settings: { activation: "automatic" },
        workflowId: null,
        grant: null,
      }),
    ).toMatchObject({ kind: "needs-grant", gap: "missing" });
    expect(
      await conversionProvisioner(
        io(host, { authorization: "DOCUMENT_PERMISSIONS" }),
      ).ensure({
        settings: { activation: "automatic" },
        workflowId: null,
        grant: await grant(),
      }),
    ).toMatchObject({ kind: "refused", code: "audience-unproven" });
    expect(host.documents.size).toBe(0);
  });

  it("makes the workflow again when the mapped one was deleted, and refuses a mapping to another document", async () => {
    const host = hostWith({ key: hostKey.did, requiresPerson: false });
    const provisioner = conversionProvisioner(
      io(host, { authorization: "OPEN" }),
    );
    expect(
      await provisioner.ensure({
        settings: { activation: "manual" },
        workflowId: "gone",
        grant: null,
      }),
    ).toMatchObject({ kind: "ready", created: true });
    const connection = connectionUtils.createDocument();
    host.documents.set(connection.header.id, connection);
    expect(
      await provisioner.ensure({
        settings: { activation: "manual" },
        workflowId: connection.header.id,
        grant: null,
      }),
    ).toMatchObject({ kind: "refused", code: "not-a-workflow" });
  });
});
