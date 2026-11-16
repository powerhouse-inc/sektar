import {
  preparationActive,
  type ModelPreparation,
} from "../models/contracts.js";
import { ModelsNotReady } from "../models/store.js";
import { prepareTestScanners } from "../test-support/models.js";
import {
  withLanguages,
  withMethod,
  withRecognition,
} from "../../pieces/docture/lib/profile.js";
prepareTestScanners(false);
import { convertManagedPdf } from "../../pieces/sektar-pdf/lib/convert-pdf.js";
import { publishPdf } from "../../pieces/sektar-pdf/lib/publish-rendition.js";
import { conversionGatewayResolvers } from "./gateway.js";
import { makePdf } from "../test-support/pdfs.js";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { HardenedPGliteDialect } from "@powerhousedao/reactor";
import { Kysely, sql } from "kysely";
import type { Action, PHDocument } from "document-model";
import {
  actions as fileActions,
  isFileDocument,
  reducer as fileReducer,
  utils as fileUtils,
} from "document-models/file";
import {
  actions as emailActions,
  isEmailDocument,
  reducer as emailReducer,
  utils as emailUtils,
} from "document-models/email";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_CONVERSION_KEY,
  attachmentRefSchema,
  type ArtifactDescriptor,
  type ConversionProfile,
  type ConversionScope,
  type PutConversionSettings,
  type RequestConversion,
} from "../contracts.js";
import { probeEngines } from "../engine/engines.js";
import { planPublication, resultOfPublication } from "../model-adapter.js";
import {
  encodePublication,
  MAX_PUBLICATION_MARKDOWN_BYTES,
  publicationManifestSchema,
  publicationRowId,
  PUBLICATION_MIME,
} from "../publication.js";
import { doctureManifestSchema } from "../../pieces/docture/lib/contracts.js";
import type { ReadyPdf } from "../../pieces/sektar-pdf/lib/contracts.js";
import { DEFAULT_LIMITS, scopeKey } from "./settings.js";
import {
  SettingsStore,
  type SettingsDatabase,
  type WorkflowBinding,
} from "./settings-store.js";
import {
  callerOf,
  type AccessPort,
  type AttachmentReader,
  type Caller,
  type DocumentReader,
  type WorkflowPort,
} from "./ports.js";
import { submissionSchema, type NativeRun } from "./run-view.js";
import { ConversionService } from "./service.js";
import { WorkflowRuntimeError } from "../workflow/bridge.js";
import {
  buildConversionWorkflow,
  conversionWorkflowDrift,
  conversionWorkflowSpec,
  readConversionWorkflowFacts,
} from "../workflow/template.js";
import {
  reducer as workflowReducer,
  utils as workflowUtils,
} from "@powerhousedao/workflow/document-models/workflow";

const AT = "2026-11-11T12:00:00.000Z";
const OWNER = callerOf("0xOWNER");
const OTHER = callerOf("0xother");
const FILES: ConversionScope = { kind: "files", driveId: "files" };
const MAIL: ConversionScope = {
  kind: "mail",
  driveId: "mail",
  account: "person@example.com",
};
const PDF = attachmentRefSchema.parse(`attachment://v1:${"a".repeat(64)}`);
const REPLACEMENT = attachmentRefSchema.parse(
  `attachment://v1:${"b".repeat(64)}`,
);
const DIGITAL: ConversionProfile = {
  reading: { kind: "digital" },
  pages: { kind: "all" },
};
const PROBE = probeEngines();
const databases: Kysely<SettingsDatabase>[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.destroy()));
});

async function host(
  maxFileBytes?: number,
  models?: ConstructorParameters<typeof ConversionService>[0]["models"],
) {
  const db = new Kysely<SettingsDatabase>({
    dialect: new HardenedPGliteDialect(new PGlite()),
  });
  databases.push(db);
  const store = new SettingsStore(db);
  await store.initialize();
  const documents = new Map<string, PHDocument>();
  const parents = new Map<string, string>();
  const readers = new Map<string, Set<string>>();
  const writers = new Map<string, Set<string>>();
  const grant = (caller: Caller, id: string, write = true) => {
    const read = readers.get(id) ?? new Set<string>();
    read.add(caller.identity);
    readers.set(id, read);
    if (write) {
      const entries = writers.get(id) ?? new Set<string>();
      entries.add(caller.identity);
      writers.set(id, entries);
    }
  };
  grant(OWNER, FILES.driveId);
  grant(OWNER, MAIL.driveId);
  const admins = new Set([OWNER.identity]);
  const access: AccessPort = {
    canManageSettings: (caller) => Promise.resolve(admins.has(caller.identity)),
    canRead: (caller, id) =>
      Promise.resolve(readers.get(id)?.has(caller.identity) ?? false),
    canWrite: (caller, id) =>
      Promise.resolve(writers.get(id)?.has(caller.identity) ?? false),
  };
  const read: DocumentReader = {
    get: (id) => {
      const document = documents.get(id);
      return document
        ? Promise.resolve(document)
        : Promise.reject(new Error("No document"));
    },
    getIncomingRelationships: (id) => {
      const parent = parents.get(id);
      const stub = fileUtils.createDocument();
      return Promise.resolve({
        results: parent
          ? [{ ...stub, header: { ...stub.header, id: parent } }]
          : [],
      });
    },
    drives: {
      listNodes: (drive, _folder, paging) => {
        const all = [...documents.values()].filter(
          (document) => parents.get(document.header.id) === drive,
        );
        const offset = Number(paging.cursor || 0);
        const slice = all.slice(offset, offset + paging.limit);
        return Promise.resolve({
          results: slice.map((document) => ({
            id: document.header.id,
            kind: "file",
            documentType: document.header.documentType,
          })),
          ...(offset + paging.limit < all.length
            ? { nextCursor: String(offset + paging.limit) }
            : {}),
        });
      },
    },
  };
  const bytes = new Map<string, Uint8Array>();
  const artifacts = new Map<string, ArtifactDescriptor>();
  const saveArtifact = (role: ArtifactDescriptor["role"], value: string) => {
    const data = new TextEncoder().encode(value);
    const ref = attachmentRefSchema.parse(
      `attachment://v1:${createHash("sha256").update(data).digest("hex")}`,
    );
    const descriptor: ArtifactDescriptor = {
      id: role,
      role,
      ref,
      fileName: role === "markdown" ? "source.md" : "source.json",
      mimeType: role === "markdown" ? "text/markdown" : "application/json",
      sizeBytes: data.length,
    };
    bytes.set(ref, data);
    artifacts.set(ref, descriptor);
    return descriptor;
  };
  const attachments: AttachmentReader = {
    download: ({ ref }) => {
      const data = bytes.get(ref),
        artifact = artifacts.get(ref);
      if (!data || !artifact)
        return Promise.reject(new Error("Missing attachment"));
      return Promise.resolve({
        body: new Blob([data.slice()]).stream(),
        header: {
          hash: ref.slice("attachment://v1:".length),
          mimeType: artifact.mimeType,
          fileName: artifact.fileName,
          sizeBytes: data.length,
          extension: null,
          status: "available",
          source: "local",
          createdAtUtc: AT,
          lastAccessedAtUtc: AT,
          expiresAtUtc: null,
        },
      });
    },
  };
  const runs = new Map<string, NativeRun>();
  const fires: {
    workflowId: string;
    payload: unknown;
    authorization?: string;
  }[] = [];
  const cancelled: string[] = [];
  const ensured: WorkflowBinding[] = [];
  let sequence = 0,
    now = new Date(AT);
  const workflows: WorkflowPort = {
    assertSetup() {},
    disable: () => Promise.resolve(),
    ensure: (_settings, caller, delegation, existing) => {
      const binding = {
        scope_key: APP_CONVERSION_KEY,
        workflow_id: existing?.workflow_id ?? "workflow-app",
        authorizer: caller.identity,
        grant: delegation ?? existing?.grant ?? null,
      };
      ensured.push(binding);
      return Promise.resolve(binding);
    },
    validateBinding: () => Promise.resolve(),
    fire: (workflowId, payload, authorization) => {
      const id = `run-${++sequence}`;
      fires.push({ workflowId, payload, authorization });
      runs.set(id, {
        id,
        workflowId,
        status: "PENDING",
        triggerPayload: payload,
        startedAt: now.toISOString(),
        steps: [],
      });
      return Promise.resolve(id);
    },
    runs: (workflowId) =>
      Promise.resolve(
        [...runs.values()].filter((run) => run.workflowId === workflowId),
      ),
    run: (id) => Promise.resolve(runs.get(id) ?? null),
    cancel: (id) => {
      cancelled.push(id);
      const run = runs.get(id);
      if (!run) return Promise.reject(new Error("No run"));
      runs.set(id, { ...run, status: "CANCELLED", endedAt: now.toISOString() });
      return Promise.resolve();
    },
  };
  const service = new ConversionService({
    store,
    read,
    access,
    attachments,
    workflows,
    probe: () => PROBE,
    now: () => now,
    newId: () => `id-${++sequence}`,
    maxFileBytes,
    models,
  });
  const apply = (id: string, actions: Action[]) => {
    let document = documents.get(id);
    if (!document) throw new Error("No document");
    for (const action of actions) {
      if (isFileDocument(document)) document = fileReducer(document, action);
      else if (isEmailDocument(document))
        document = emailReducer(document, action);
      else throw new Error("Unexpected model");
      const error = document.operations.global.at(-1)?.error;
      if (error !== undefined) throw new Error(error);
    }
    documents.set(id, document);
  };
  const addFile = (
    fileName = "source.pdf",
    ref = PDF,
    drive = FILES.driveId,
  ) => {
    const document = fileReducer(
      fileUtils.createDocument(),
      fileActions.setAttachmentSource({
        ref,
        fileName,
        sizeBytes: 100,
        setAt: AT,
      }),
    );
    documents.set(document.header.id, document);
    parents.set(document.header.id, drive);
    grant(OWNER, document.header.id);
    return document.header.id;
  };
  const addMail = (account = "person@example.com") => {
    let document = emailUtils.createDocument();
    document = emailReducer(
      document,
      emailActions.setAccount({ address: account }),
    );
    document = emailReducer(
      document,
      emailActions.addAttachment({
        id: "pdf",
        fileName: "source.pdf",
        ref: PDF,
        sizeBytes: 100,
      }),
    );
    document = emailReducer(
      document,
      emailActions.addAttachment({
        id: "image",
        fileName: "image.png",
        ref: REPLACEMENT,
        sizeBytes: 100,
      }),
    );
    documents.set(document.header.id, document);
    parents.set(document.header.id, MAIL.driveId);
    grant(OWNER, document.header.id);
    return document.header.id;
  };
  const put = (patch: Partial<PutConversionSettings> = {}, caller = OWNER) =>
    service.putSettings(caller, {
      activation: "manual",
      profile: DIGITAL,
      limits: DEFAULT_LIMITS,
      expectedRevision: 0,
      ...patch,
    });
  const request = (
    id: string,
    patch: Partial<RequestConversion> = {},
    caller = OWNER,
  ) =>
    service.request(
      caller,
      {
        source: { kind: "file", documentId: id, expectedRef: PDF },
        profile: DIGITAL,
        intent: { kind: "ensure" },
        ...patch,
      },
      "Bearer caller-token",
    );
  const prepare = (id: string, runId = "prepare-run") =>
    service.prepare(OWNER, {
      workflowId: "workflow-app",
      request: {
        source: { kind: "file", documentId: id, expectedRef: PDF },
        profile: DIGITAL,
        intent: { kind: "ensure" },
      },
      runId,
    });
  const saveResult = (prepared: ReadyPdf, text = "# Invoice\n\nTotal 42\n") => {
    const markdown = saveArtifact("markdown", text);
    const content = {
      plan: prepared.plan,
      markdown,
      completeness: "complete",
      pages: [{ status: "read", page: 1, method: "digital", characters: 19 }],
      warnings: [],
      provenance: [
        { role: "digital", engine: "pdfjs", version: "1", model: null },
      ],
      usage: {
        kind: "known",
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        aiPages: 0,
        costUsd: 0,
      },
      documentPages: 1,
    };
    const manifest = publicationManifestSchema.parse({
      kind: "sektar-pdf-publication",
      version: prepared.plan.contractVersion,
      generationId: prepared.generationId,
      source: prepared.source,
      createdAt: prepared.createdAt,
      output: doctureManifestSchema.parse({
        ...content,
        kind: "docture-conversion-manifest",
        version: prepared.plan.contractVersion,
        sourceFileName: "source.pdf",
      }),
    });
    const artifact = {
      ...saveArtifact(
        "manifest",
        new TextDecoder().decode(encodePublication(manifest)),
      ),
      mimeType: PUBLICATION_MIME,
    };
    const document = documents.get(prepared.source.documentId);
    if (!document) throw new Error("Expected source document");
    const planned = planPublication({
      document,
      manifest,
      manifestArtifact: artifact,
    });
    if (planned.kind !== "append")
      throw new Error("Expected a new publication");
    apply(prepared.source.documentId, planned.actions);
    return resultOfPublication({ manifest, artifact });
  };
  return {
    db,
    store,
    service,
    documents,
    read,
    parents,
    bytes,
    artifacts,
    readers,
    writers,
    workflows,
    runs,
    fires,
    cancelled,
    ensured,
    grant,
    admins,
    addFile,
    addMail,
    apply,
    put,
    request,
    prepare,
    saveResult,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe("workflow-owned conversion service", () => {
  it.each(["before commit", "after commit"])(
    "recovers the stored workflow mode when saving fails %s",
    async (failure) => {
      const h = await host();
      let workflow = workflowUtils.createDocument();
      const ensure = h.workflows.ensure.bind(h.workflows);
      let sequence = 0;
      h.workflows.ensure = async (...args) => {
        const spec = conversionWorkflowSpec({
          activation: args[0].activation,
          workflowsDriveId: "workflows",
          reactorConnectionId: "reactor",
        });
        const newId = () => `step-${++sequence}`;
        const actions = workflow.state.global.published
          ? conversionWorkflowDrift(
              spec,
              readConversionWorkflowFacts(workflow.state.global),
              newId,
              AT,
            ).actions
          : buildConversionWorkflow(spec, newId, AT);
        for (const action of actions) {
          workflow = workflowReducer(workflow, action);
          expect(workflow.operations.global.at(-1)?.error).toBeUndefined();
        }
        return ensure(...args);
      };
      await h.put({ activation: "automatic" });
      const put = h.store.putSettings.bind(h.store);
      vi.spyOn(h.store, "putSettings").mockImplementationOnce(
        async (...args) => {
          if (failure === "after commit") await put(...args);
          throw new Error("Lost database acknowledgement");
        },
      );
      await expect(
        h.put({ activation: "manual", expectedRevision: 1 }),
      ).rejects.toThrow("Lost database acknowledgement");
      const committed = failure === "after commit";
      expect((await h.store.settings()).activation).toBe(
        committed ? "manual" : "automatic",
      );
      expect(workflow.state.global.published?.trigger?.triggerName).toBe(
        committed ? "manual" : "document-event",
      );
    },
  );

  it("restores the saved authorizer and grant after a failed access takeover", async () => {
    const h = await host();
    await h.put({ workflowGrant: "original-grant" });
    const binding = await h.store.appBinding();
    h.admins.add(OTHER.identity);
    vi.spyOn(h.store, "putSettings").mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );
    await expect(
      h.service.renewAccess(OTHER, {
        expectedRevision: 1,
        workflowGrant: "replacement-grant",
      }),
    ).rejects.toThrow("Storage unavailable");
    expect((await h.store.settings()).authorizingIdentity).toBe(OWNER.identity);
    expect(await h.store.appBinding()).toEqual(binding);
    expect(h.ensured.at(-1)).toEqual(binding);
  });

  it("rolls back settings when their binding cannot be stored", async () => {
    const h = await host();
    await h.put();
    const previous = await h.store.settings();
    const binding = await h.store.appBinding();
    if (!binding) throw new Error("Expected app binding");
    await h.store.putBinding({
      ...binding,
      scope_key: "legacy",
      workflow_id: "legacy-workflow",
    });
    await expect(
      h.store.putSettings(
        {
          ...previous,
          revision: previous.revision + 1,
          activation: "automatic",
        },
        previous.revision,
        { ...binding, workflow_id: "legacy-workflow" },
      ),
    ).rejects.toThrow();
    expect(await h.store.settings()).toEqual(previous);
    expect(await h.store.appBinding()).toEqual(binding);
  });

  it("disables a newly provisioned workflow if its first settings commit fails", async () => {
    const h = await host();
    const disable = vi.spyOn(h.workflows, "disable");
    vi.spyOn(h.store, "putSettings").mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );
    await expect(h.put()).rejects.toThrow("Storage unavailable");
    expect(await h.store.appBinding()).toBeUndefined();
    expect(disable).toHaveBeenCalledWith("workflow-app");
  });

  it("disables the changed workflow when saved settings cannot be read during recovery", async () => {
    const h = await host();
    await h.put({ activation: "automatic" });
    const disable = vi.spyOn(h.workflows, "disable");
    vi.spyOn(h.store, "putSettings").mockImplementationOnce(() => {
      vi.spyOn(h.store, "settings").mockRejectedValueOnce(
        new Error("Database offline"),
      );
      return Promise.reject(new Error("Write failed"));
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        h.put({ activation: "manual", expectedRevision: 1 }),
      ).rejects.toThrow("Write failed");
      expect(disable).toHaveBeenCalledWith("workflow-app");
    } finally {
      log.mockRestore();
    }
  });

  it.each(["one row", "both rows", "stored bytes", "metadata"])(
    "rechecks a prepared reuse after losing %s",
    async (loss) => {
      const h = await host();
      const id = h.addFile();
      await h.put();
      const first = await h.prepare(id, "first");
      if (first.kind !== "ready") throw new Error("Expected PDF");
      const saved = h.saveResult(first);
      const second = await h.prepare(id, "second");
      if (second.kind !== "ready" || !second.reuse)
        throw new Error("Expected saved Markdown");
      const input = {
        prepared: second,
        workflowId: "workflow-app",
        runId: "second",
      };
      const gateway = conversionGatewayResolvers(
        () => h.service,
        (error) => {
          throw error;
        },
      );
      const publish = () =>
        publishPdf({
          input,
          files: {
            upload: () => Promise.reject(new Error("Reuse must not upload")),
          },
          reactor: {
            get: (id) => h.read.get(id),
            execute: () => Promise.reject(new Error("Reuse must not write")),
            getOperations: () => Promise.resolve({ results: [] }),
            query: async (request) => ({
              data: {
                conversion: {
                  validate: await gateway.ConversionGateway.validate(
                    {},
                    request.variables,
                    { user: { address: OWNER.identity } },
                  ),
                },
              },
            }),
          },
        });
      await expect(publish()).resolves.toMatchObject({
        kind: "reused",
        result: saved,
      });
      if (loss === "stored bytes") h.bytes.delete(saved.markdown.ref);
      else if (loss === "metadata")
        second.reuse = {
          ...second.reuse,
          createdAt: "2026-11-12T12:00:00.000Z",
        };
      else {
        h.apply(id, [
          fileActions.removeRendition({
            id: publicationRowId("first", "markdown"),
          }),
        ]);
        if (loss === "both rows")
          h.apply(id, [
            fileActions.removeRendition({
              id: publicationRowId("first", "manifest"),
            }),
          ]);
      }
      await expect(publish()).rejects.toMatchObject({
        code:
          loss === "stored bytes" ? "attachment-pending" : "reuse-unavailable",
      });
    },
  );

  it("stores Off even when the native workflow cannot be disabled, without renewing its grant", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put({ activation: "automatic" });
    h.grant(OTHER, FILES.driveId);
    h.admins.add(OTHER.identity);
    h.workflows.ensure = () => Promise.reject(new Error("Expired permission"));
    const disable = vi
      .spyOn(h.workflows, "disable")
      .mockRejectedValue(new Error("Workflow storage unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        await h.put({ activation: "off", expectedRevision: 1 }, OTHER),
      ).toMatchObject({ activation: "off" });
      expect(disable).toHaveBeenCalledOnce();
      await expect(h.request(id)).rejects.toMatchObject({
        code: "conversion-off",
      });
      await expect(h.service.reconcileWorkflow()).resolves.toBeUndefined();
      expect(disable).toHaveBeenCalledTimes(2);
      disable.mockResolvedValue(undefined);
      await h.service.reconcileWorkflow();
      expect(disable).toHaveBeenCalledTimes(3);
    } finally {
      log.mockRestore();
    }
  });

  it("reads run history for batch admission and status, not once per PDF", async () => {
    const h = await host();
    for (let i = 0; i < 5; i++) h.addFile(`source-${i}.pdf`);
    await h.put();
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    const reads = vi.spyOn(h.workflows, "runs");
    const batch = await h.service.createBatch(OWNER, {
      previewId: preview.id,
      requestId: "fresh",
    });
    expect(batch.jobIds).toHaveLength(5);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("counts the PDFs a batch skips because they already have complete Markdown", async () => {
    const h = await host();
    const done = h.addFile("done.pdf");
    h.addFile("todo.pdf");
    await h.put();
    const prepared = await h.prepare(done);
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    h.saveResult(prepared);
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    expect(preview.candidates.map((source) => source.fileName)).toEqual([
      "todo.pdf",
    ]);
    expect(preview.warnings).toContainEqual({
      code: "already-converted",
      message: "1 PDF already has Markdown, so it's skipped.",
    });
  });

  it("continues cancelling other waiting runs when one starts during cancellation", async () => {
    const h = await host();
    h.addFile("first.pdf");
    h.addFile("second.pdf");
    await h.put();
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    const batch = await h.service.createBatch(OWNER, {
      previewId: preview.id,
      requestId: "cancel-race",
    });
    const first = h.runs.get(batch.jobIds[0]);
    if (!first) throw new Error("Expected a native run");
    const cancel = h.workflows.cancel.bind(h.workflows);
    h.workflows.cancel = (id) => {
      if (id !== first.id) return cancel(id);
      h.runs.set(id, { ...first, status: "RUNNING" });
      return Promise.reject(
        new WorkflowRuntimeError(
          "graphql",
          "Cancelling a RUNNING run is not supported yet (#3226)",
        ),
      );
    };
    expect((await h.service.cancelBatch(OWNER, batch.id)).status).toBe(
      "running",
    );
    expect(h.cancelled).toEqual([batch.jobIds[1]]);
    h.workflows.cancel = () =>
      Promise.reject(new WorkflowRuntimeError("forbidden", "Refused"));
    const second = h.runs.get(batch.jobIds[1]);
    if (!second) throw new Error("Expected a native run");
    h.runs.set(second.id, { ...second, status: "PENDING" });
    await expect(h.service.cancelBatch(OWNER, batch.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
  it("lists and cancels a batch while its first native fire is still waiting for completion", async () => {
    const h = await host();
    h.addFile("one.pdf");
    h.addFile("two.pdf");
    await h.put();
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    const input = { previewId: preview.id, requestId: "one-batch" };
    const releases: (() => void)[] = [];
    const fire = h.workflows.fire.bind(h.workflows);
    h.workflows.fire = async (...args) => {
      const id = await fire(...args);
      await new Promise<void>((resolve) => releases.push(resolve));
      return id;
    };
    const first = h.service.createBatch(OWNER, input);
    for (let n = 0; n < 100 && releases.length < 2; n++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    expect(releases).toHaveLength(2);
    const observed = await h.service.createBatch(OWNER, input);
    expect(observed.status).toBe("running");
    expect(observed.jobIds).toHaveLength(2);
    await h.service.cancelBatch(OWNER, observed.id);
    expect(h.cancelled).toHaveLength(2);
    releases.forEach((release) => release());
    expect((await first).status).toBe("cancelled");
    expect(h.fires).toHaveLength(2);
  });

  it("leaves oversized PDFs out of previews using the effective native file ceiling", async () => {
    const h = await host(),
      good = h.addFile("small.pdf"),
      big = h.addFile("large.pdf");
    h.apply(big, [
      fileActions.setAttachmentSource({
        ref: PDF,
        fileName: "large.pdf",
        sizeBytes: 8 * 1024 * 1024 + 1,
        setAt: AT,
      }),
    ]);
    await h.put();
    expect((await h.service.capabilities(OWNER)).execution.maxFileBytes).toBe(
      8 * 1024 * 1024,
    );
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    expect(preview.candidates.map((source) => source.documentId)).toEqual([
      good,
    ]);
    expect(preview.warnings).toContainEqual({
      code: "too-large",
      message:
        "1 PDF is larger than this source's 8 MB limit, so it's skipped.",
    });
    await expect(h.request(big)).rejects.toMatchObject({ code: "too-large" });
  });

  it("coalesces overlapping requests and finds an accepted run after its answer is lost", async () => {
    const h = await host(),
      id = h.addFile();
    await h.put();
    const fire = h.workflows.fire.bind(h.workflows);
    h.workflows.fire = async (...args) => {
      await fire(...args);
      throw new Error("connection lost after admission");
    };
    const intent = { kind: "regenerate" as const, requestId: "one-click" };
    const results = await Promise.allSettled([
      h.request(id, { intent }),
      h.request(id, { intent }),
    ]);
    expect(h.fires).toHaveLength(1);
    expect(results.some((result) => result.status === "rejected")).toBe(true);
    h.workflows.fire = fire;
    const retry = await h.request(id, { intent });
    expect(retry).toMatchObject({ created: false, view: { status: "queued" } });
    expect(h.fires).toHaveLength(1);
    const original = h.runs.get(retry.view.id);
    if (!original) throw new Error("Expected accepted native run");
    h.runs.set(original.id, { ...original, status: "FAILED", error: "failed" });
    expect((await h.request(id, { intent })).created).toBe(false);
    await h.request(id, {
      intent: { kind: "regenerate", requestId: "new-click" },
    });
    expect(h.fires).toHaveLength(2);
  });

  it("refuses a superseded managed workflow at both source and publication checks", async () => {
    const h = await host(),
      id = h.addFile();
    await h.put();
    const prepared = await h.prepare(id);
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    await expect(
      h.service.prepare(OWNER, {
        runId: "orphan-run",
        workflowId: "orphan-flow",
        request: {
          source: { kind: "file", documentId: id },
          intent: { kind: "ensure" },
        },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      h.service.validate(OWNER, {
        prepared,
        runId: "orphan-run",
        workflowId: "orphan-flow",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("uses renewed access for a batch without changing saved preferences", async () => {
    const h = await host();
    h.addFile();
    await h.put({ workflowGrant: "old-grant" });
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    const renewed = await h.service.renewAccess(OWNER, {
      expectedRevision: 1,
      workflowGrant: "fresh-grant",
    });
    expect(renewed).toMatchObject({
      activation: "manual",
      profile: DIGITAL,
      limits: DEFAULT_LIMITS,
      revision: 2,
    });
    const batch = await h.service.createBatch(OWNER, {
      previewId: preview.id,
      requestId: "batch-click",
    });
    expect(batch.jobIds).toHaveLength(1);
    expect((await h.store.appBinding())?.grant).toBe("fresh-grant");
  });

  it("persists app settings with compare-and-swap", async () => {
    const h = await host();
    const first = await h.put({ activation: "automatic" });
    expect(first).toMatchObject({
      revision: 1,
      authorizingIdentity: OWNER.identity,
      automaticSince: AT,
    });
    await expect(h.put()).rejects.toMatchObject({ code: "revision-conflict" });
    const off = await h.put({ activation: "off", expectedRevision: 1 });
    expect(off).toMatchObject({
      revision: 2,
      activation: "off",
      automaticSince: null,
    });
    expect((await new SettingsStore(h.db).settings()).revision).toBe(2);
  });

  it("keeps a losing concurrent settings writer from changing the winning workflow authorizer", async () => {
    const h = await host();
    h.grant(OTHER, FILES.driveId);
    h.admins.add(OTHER.identity);
    const results = await Promise.allSettled([
      h.put({}, OWNER),
      h.put({}, OTHER),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const settings = await h.store.settings();
    const binding = await h.store.appBinding();
    expect(binding?.authorizer).toBe(settings.authorizingIdentity);
  });

  it("requires source write access and the configured publisher for manual requests", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put();
    h.grant(OTHER, id, false);
    await expect(h.request(id, {}, OTHER)).rejects.toMatchObject({
      code: "forbidden",
    });
    h.grant(OTHER, id);
    await expect(h.request(id, {}, OTHER)).rejects.toMatchObject({
      code: "workflow-owner",
    });
    await expect(h.prepare(id)).resolves.toMatchObject({ kind: "ready" });
    expect(h.fires).toEqual([]);
  });

  it("pins expectedRef and forwards credentials only to native fire", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put();
    await expect(
      h.request(id, {
        source: { kind: "file", documentId: id, expectedRef: REPLACEMENT },
      }),
    ).rejects.toMatchObject({ code: "source-changed" });
    const response = await h.request(id);
    expect(response.view).toMatchObject({
      status: "queued",
      workflowId: "workflow-app",
      cancellable: true,
      source: { ref: PDF },
    });
    expect(h.fires).toHaveLength(1);
    expect(h.fires[0].authorization).toBe("Bearer caller-token");
    expect(
      submissionSchema.parse(h.fires[0].payload).request.source.expectedRef,
    ).toBe(PDF);
    expect(JSON.stringify(h.fires[0].payload)).not.toMatch(
      /caller-token|delegation-proof/,
    );
    expect(await h.service.jobs(OWNER, id)).toEqual([response.view]);
  });

  it("projects native progress and only permits waiting or pending cancellation", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put();
    const response = await h.request(id),
      run = h.runs.get(response.view.id);
    if (!run) throw new Error("Expected native run");
    h.runs.set(run.id, {
      ...run,
      status: "RUNNING",
      steps: [{ stepKey: "publish", status: "RUNNING" }],
    });
    expect(await h.service.job(OWNER, run.id)).toMatchObject({
      status: "publishing",
      cancellable: false,
    });
    await expect(h.service.cancel(OWNER, run.id)).rejects.toMatchObject({
      code: "cannot-cancel-running",
    });
    expect(h.cancelled).toEqual([]);
    h.runs.set(run.id, { ...run, status: "WAITING" });
    expect(await h.service.cancel(OWNER, run.id)).toMatchObject({
      status: "cancelled",
    });
    expect(h.cancelled).toEqual([run.id]);
  });

  it.each(["file", "mail"] satisfies ("file" | "mail")[])(
    "reuses a verified saved manifest on the real %s model",
    async (kind) => {
      const h = await host();
      const id = kind === "file" ? h.addFile() : h.addMail();
      await h.put();
      const request = {
        source:
          kind === "file"
            ? { kind, documentId: id, expectedRef: PDF }
            : { kind, documentId: id, attachmentId: "pdf", expectedRef: PDF },
        intent: { kind: "ensure" },
      };
      const input = { workflowId: "workflow-app", request, runId: "first" };
      const first = await h.service.prepare(OWNER, input);
      if (first.kind !== "ready") throw new Error("Expected PDF");
      const saved = h.saveResult(first);
      h.runs.set("completed", {
        id: "completed",
        workflowId: "workflow-app",
        status: "SUCCEEDED",
        startedAt: AT,
        endedAt: AT,
        steps: [
          { stepKey: "resolve", status: "SUCCEEDED", output: first },
          {
            stepKey: "publish",
            status: "SUCCEEDED",
            output: { kind: "published", result: saved },
          },
        ],
      });
      expect(await h.service.job(OWNER, "completed")).toMatchObject({
        status: "complete",
        result: saved,
      });
      expect(await h.service.result(OWNER, "completed")).toEqual({
        result: saved,
        markdown: "# Invoice\n\nTotal 42\n",
      });
      h.runs.clear();
      const next = await h.service.prepare(OWNER, {
        ...input,
        runId: "second",
      });
      expect(next).toMatchObject({
        kind: "ready",
        reuse: {
          renditionId: saved.renditionId,
          markdown: { ref: saved.markdown.ref },
          pages: saved.pages,
        },
      });
      const fresh = await h.service.prepare(OWNER, {
        ...input,
        runId: "third",
        request: {
          ...request,
          intent: { kind: "regenerate", requestId: "fresh" },
        },
      });
      expect(fresh).toMatchObject({ kind: "ready", generationId: "third" });
      expect(fresh.kind === "ready" && fresh.reuse).toBeUndefined();
    },
  );

  it("refuses publication after Off or a PDF replacement and ignores corrupt saved metadata", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put();
    const prepared = await h.prepare(id);
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    await expect(
      h.service.validate(OWNER, {
        prepared,
        runId: "run",
        workflowId: "workflow-app",
      }),
    ).resolves.toEqual({ valid: true });
    const saved = h.saveResult(prepared);
    const manifest = saved.artifacts[0];
    h.bytes.set(manifest.ref, new TextEncoder().encode("changed"));
    const withoutReuse = await h.prepare(id);
    expect(withoutReuse.kind === "ready" && withoutReuse.reuse).toBeUndefined();
    await h.put({ activation: "off", expectedRevision: 1 });
    await expect(
      h.service.validate(OWNER, {
        prepared,
        runId: "run",
        workflowId: "workflow-app",
      }),
    ).rejects.toMatchObject({ code: "conversion-off" });
    await h.put({ expectedRevision: 2 });
    h.apply(id, [
      fileActions.setAttachmentSource({
        ref: REPLACEMENT,
        fileName: "replacement.pdf",
        setAt: AT,
      }),
    ]);
    await expect(
      h.service.validate(OWNER, {
        prepared,
        runId: "run",
        workflowId: "workflow-app",
      }),
    ).rejects.toMatchObject({ code: "source-changed" });
  });

  it("accepts the native document-event payload for a new Mail PDF", async () => {
    const h = await host(),
      id = h.addMail();
    await h.put({ activation: "automatic" });
    const operation = h.documents
      .get(id)
      ?.operations.global.find(
        (entry) => entry.action.type === "ADD_ATTACHMENT",
      );
    if (!operation) throw new Error("Expected real Email operation");
    const payload = {
      documentId: id,
      documentType: "sektar/email",
      branch: "main",
      scope: "global",
      action: { type: operation.action.type, input: operation.action.input },
      operation: { index: operation.index, timestampUtcMs: AT },
    };
    expect(
      await h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        request: payload,
        runId: "native-mail",
      }),
    ).toMatchObject({
      kind: "ready",
      source: { kind: "mail", documentId: id, attachmentId: "pdf", ref: PDF },
    });
  });

  it("skips both generated Mail rows before trying to resolve a source", async () => {
    const h = await host();
    await h.put({ activation: "automatic" });
    for (const role of ["markdown", "manifest"] as const) {
      await expect(
        h.service.prepare(OWNER, {
          workflowId: "workflow-app",
          request: {
            documentId: "does-not-exist",
            documentType: "sektar/email",
            action: {
              type: "ADD_ATTACHMENT",
              input: { id: publicationRowId("generation", role) },
            },
            operation: { timestampUtcMs: AT },
          },
          runId: `skip-${role}`,
        }),
      ).resolves.toMatchObject({ kind: "skip" });
    }
  });

  it("reuses saved Markdown above 16 MiB when the host's native file cap allows it", async () => {
    const h = await host(50 * 1024 * 1024);
    const id = h.addFile();
    await h.put();
    const prepared = await h.prepare(id);
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    const saved = h.saveResult(prepared, "x".repeat(16 * 1024 * 1024 + 1));
    const next = await h.prepare(id, "reuse-large");
    expect(next.kind === "ready" && next.reuse?.markdown.ref).toBe(
      saved.markdown.ref,
    );
  });

  it("ignores oversized stored bytes with an understated row size instead of waiting forever", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put();
    const prepared = await h.prepare(id);
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    const saved = h.saveResult(prepared);
    h.bytes.set(
      saved.markdown.ref,
      new Uint8Array(MAX_PUBLICATION_MARKDOWN_BYTES + 1),
    );
    const next = await h.prepare(id, "replace-invalid");
    expect(next.kind).toBe("ready");
    expect(next.kind === "ready" && next.reuse).toBeUndefined();
  });

  it("waits for saved metadata instead of reconverting or offering it in a batch", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put();
    const prepared = await h.prepare(id);
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    const saved = h.saveResult(prepared);
    for (const artifact of saved.artifacts) h.bytes.delete(artifact.ref);
    await expect(h.prepare(id)).rejects.toMatchObject({
      code: "attachment-pending",
    });
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    expect(preview.candidates).toHaveLength(0);
    expect(preview.warnings).toContainEqual({
      code: "attachment-pending",
      message: "1 file is still syncing, so it's skipped.",
    });
    const regenerated = await h.service.prepare(OWNER, {
      workflowId: "workflow-app",
      request: {
        source: { kind: "file", documentId: id, expectedRef: PDF },
        profile: DIGITAL,
        intent: { kind: "regenerate", requestId: "replace-missing-result" },
      },
      runId: "fresh-result",
    });
    expect(regenerated.kind).toBe("ready");
    if (regenerated.kind !== "ready") throw new Error("Expected PDF");
    expect(regenerated.reuse).toBeUndefined();
    const fresh = h.saveResult(regenerated);
    const reused = await h.prepare(id, "reuse-fresh-result");
    expect(reused.kind === "ready" && reused.reuse?.jobId).toBe(fresh.jobId);
  });

  it("ignores automatic history and unrelated operations, and includes newly connected Mail accounts", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put({ activation: "automatic" });
    const event = {
      documentId: id,
      documentType: "sektar/file",
      branch: "main",
      scope: "global",
      action: { type: "SET_ATTACHMENT_SOURCE", input: { ref: PDF } },
      operation: { index: 0, timestampUtcMs: "2026-11-11T11:59:59.000Z" },
    };
    expect(
      await h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        request: event,
        runId: "old",
      }),
    ).toMatchObject({ kind: "skip" });
    expect(
      await h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        request: {
          ...event,
          operation: { index: 1, timestampUtcMs: AT },
          action: { type: "SET_NAME", input: { name: "renamed" } },
        },
        runId: "rename",
      }),
    ).toMatchObject({ kind: "skip" });
    expect(
      await h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        request: { ...event, operation: { index: 1, timestampUtcMs: AT } },
        runId: "new",
      }),
    ).toMatchObject({ kind: "ready", source: { ref: PDF } });
    const wrong = h.addMail("someone-else@example.com");
    expect(
      await h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        request: {
          documentId: wrong,
          documentType: "sektar/email",
          branch: "main",
          scope: "global",
          action: { type: "ADD_ATTACHMENT", input: { id: "pdf" } },
          operation: { index: 1, timestampUtcMs: AT },
        },
        runId: "new-account",
      }),
    ).toMatchObject({
      kind: "ready",
      source: { scope: { account: "someone-else@example.com" } },
    });
  });

  it("bounds historical batches, pins their previews and filters non-PDF or unreadable sources", async () => {
    const h = await host();
    await h.put();
    h.addFile("image.png");
    const denied = h.addFile();
    h.writers.delete(denied);
    for (let i = 0; i < 92; i++) h.addFile(`invoice-${i}.pdf`);
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    expect(preview.candidates).toHaveLength(90);
    expect(preview.truncated).toBe(true);
    expect(preview.warnings).toContainEqual({
      code: "truncated",
      message:
        "This batch holds the first 90 PDFs. Convert the rest after it ends.",
    });
    expect(preview.candidates.every((source) => source.ref === PDF)).toBe(true);
    const small = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 2,
    });
    const batch = await h.service.createBatch(
      OWNER,
      { previewId: small.id, requestId: "batch" },
      "Bearer batch-token",
    );
    expect(batch.status).toBe("running");
    expect(batch.jobIds).toHaveLength(2);
    expect(
      h.fires.every((fire) => fire.authorization === "Bearer batch-token"),
    ).toBe(true);
    await h.service.createBatch(OWNER, {
      previewId: small.id,
      requestId: "batch",
    });
    expect(h.fires).toHaveLength(2);
    expect(await h.service.cancelBatch(OWNER, batch.id)).toMatchObject({
      status: "cancelled",
    });
    await expect(h.service.batch(OTHER, batch.id)).rejects.toMatchObject({
      code: "not-found",
    });
    h.advance(900001);
    await expect(
      h.service.createBatch(OWNER, {
        previewId: preview.id,
        requestId: "expired",
      }),
    ).rejects.toMatchObject({ code: "preview-expired" });
  });

  it("shows a step's own words only when Sektar wrote them for people", async () => {
    const h = await host();
    await h.put();
    const native = h.runs.get((await h.request(h.addFile())).view.id);
    if (!native) throw new Error("Expected run");
    const failing = (error: string, errorName: string) => ({
      ...native,
      status: "FAILED",
      error: `Step "convert" failed: ${error}`,
      errorName,
      steps: [
        ...native.steps,
        { stepKey: "convert", status: "FAILED", error, errorName },
      ],
    });
    h.runs.set(
      native.id,
      failing(
        "This PDF is protected by a password, so Sektar can't read it.",
        "ExecutionFailure",
      ),
    );
    expect(await h.service.job(OWNER, native.id)).toMatchObject({
      status: "failed",
      error: {
        message:
          "This PDF is protected by a password, so Sektar can't read it.",
        detail:
          'Step "convert" failed: This PDF is protected by a password, so Sektar can\'t read it.',
      },
    });
    h.runs.set(
      native.id,
      failing("ENOENT: no such file, open '/tmp/x.pdf'", "Error"),
    );
    const failed = await h.service.job(OWNER, native.id);
    expect(failed).toMatchObject({
      status: "failed",
      error: {
        message:
          "The conversion stopped before its Markdown was saved. Try again.",
        detail: `Step "convert" failed: ENOENT: no such file, open '/tmp/x.pdf'`,
      },
    });
    h.runs.set(native.id, {
      ...native,
      status: "CANCELLED",
      error: "Run exceeded its runTimeoutSeconds and was cancelled",
      errorName: "RunDeadlineExceeded",
    });
    expect(await h.service.job(OWNER, native.id)).toMatchObject({
      status: "cancelled",
      reason:
        "The conversion took too long and was stopped. Try converting fewer pages at a time.",
    });
  });

  it("does not mistake unrelated native runs for this conversion", async () => {
    const h = await host();
    await h.put();
    h.runs.set("foreign", {
      id: "foreign",
      workflowId: "other-workflow",
      status: "SUCCEEDED",
      startedAt: AT,
      steps: [],
    });
    await expect(h.service.job(OWNER, "foreign")).rejects.toMatchObject({
      code: "not-found",
    });
    const id = h.addFile(),
      requested = await h.request(id),
      native = h.runs.get(requested.view.id);
    if (!native) throw new Error("Expected run");
    h.runs.set(native.id, {
      ...native,
      status: "FAILED",
      error: "Docture could not read the PDF",
    });
    expect(await h.service.job(OWNER, native.id)).toMatchObject({
      status: "failed",
      error: {
        code: "workflow-failed",
        message:
          "The conversion stopped before its Markdown was saved. Try again.",
        detail: "Docture could not read the PDF",
      },
    });
    await expect(h.service.job(OTHER, native.id)).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

describe("one configuration for the app", () => {
  it("requires explicit setup and an app admin even when a caller can write a source", async () => {
    const h = await host();
    const id = h.addFile();
    expect(await h.service.settings(OWNER)).toMatchObject({
      revision: 0,
      activation: "manual",
      needsReview: false,
    });
    await expect(h.request(id)).rejects.toMatchObject({
      code: "conversion-setup",
    });
    expect(h.ensured).toEqual([]);
    h.grant(OTHER, id);
    h.grant(OTHER, FILES.driveId);
    await expect(h.put({}, OTHER)).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      h.service.renewAccess(OTHER, { expectedRevision: 0 }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect((await h.store.settings()).revision).toBe(0);
    expect(h.ensured).toEqual([]);
    await h.put();
    await expect(h.request(id)).resolves.toMatchObject({ created: true });
    expect(h.ensured).toHaveLength(1);
  });

  it("applies automatic settings to Files, Mail, and sources connected after saving", async () => {
    const h = await host();
    await h.put({
      activation: "automatic",
      limits: { ...DEFAULT_LIMITS, maxPages: 7 },
    });
    const file = h.addFile("new.pdf", PDF, "new-drive");
    const mail = h.addMail("new-account@example.com");
    for (const [documentId, documentType, action] of [
      [
        file,
        "sektar/file",
        { type: "SET_ATTACHMENT_SOURCE", input: { ref: PDF } },
      ],
      [
        file,
        "sektar/file",
        { type: "APPLY_DISK_VERSION", input: { ref: PDF } },
      ],
      [mail, "sektar/email", { type: "ADD_ATTACHMENT", input: { id: "pdf" } }],
    ] as const) {
      const prepared = await h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        runId: `new-${action.type}`,
        request: {
          documentId,
          documentType,
          action,
          operation: { timestampUtcMs: AT },
        },
      });
      expect(prepared).toMatchObject({
        kind: "ready",
        limits: { maxPages: 7 },
        plan: { reading: { kind: "digital" } },
      });
      if (prepared.kind !== "ready") throw new Error("Expected ready PDF");
      expect(prepared.source.scope).toEqual(
        documentId === file
          ? { kind: "files", driveId: "new-drive" }
          : { ...MAIL, account: "new-account@example.com" },
      );
    }
    expect(h.ensured).toHaveLength(1);
    for (const [documentId, documentType, type] of [
      [file, "sektar/file", "ADD_ATTACHMENT"],
      [mail, "sektar/email", "SET_ATTACHMENT_SOURCE"],
      [mail, "sektar/file", "APPLY_DISK_VERSION"],
    ]) {
      await expect(
        h.service.prepare(OWNER, {
          workflowId: "workflow-app",
          runId: "unrelated",
          request: {
            documentId,
            documentType,
            action: { type, input: { id: "pdf" } },
            operation: { timestampUtcMs: AT },
          },
        }),
      ).resolves.toMatchObject({ kind: "skip" });
    }
  });

  it("resolves queued defaults from current settings while preserving one-off choices", async () => {
    const h = await host();
    const first = h.addFile();
    await h.put();
    await h.request(first, { profile: undefined });
    await h.request(first, { profile: DIGITAL });
    const defaultRequest = submissionSchema.parse(h.fires[0].payload);
    const explicitRequest = submissionSchema.parse(h.fires[1].payload);
    expect(
      JSON.parse(JSON.stringify(defaultRequest.request)),
    ).not.toHaveProperty("profile");
    expect(explicitRequest.request.profile).toEqual(DIGITAL);
    const limited: ConversionProfile = {
      ...DIGITAL,
      pages: { kind: "selected", pages: [1] },
    };
    await h.put({
      expectedRevision: 1,
      profile: limited,
      limits: { ...DEFAULT_LIMITS, maxPages: 3 },
    });
    for (const [request, pages] of [
      [defaultRequest, limited.pages],
      [explicitRequest, DIGITAL.pages],
    ] as const) {
      await expect(
        h.service.prepare(OWNER, {
          workflowId: "workflow-app",
          runId: "queued",
          request,
        }),
      ).resolves.toMatchObject({
        kind: "ready",
        plan: { pages },
        limits: { maxPages: 3 },
      });
    }
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    await h.service.createBatch(OWNER, {
      previewId: preview.id,
      requestId: "global-batch",
    });
    expect(
      submissionSchema.parse(h.fires.at(-1)?.payload).request,
    ).not.toHaveProperty("profile");
    expect((await h.store.settings()).profile).toEqual(limited);
    await h.put({ expectedRevision: 2, activation: "off" });
    await expect(
      h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        runId: "off",
        request: explicitRequest,
      }),
    ).rejects.toMatchObject({ code: "conversion-off" });
    await expect(
      h.service.createBatch(OWNER, {
        previewId: preview.id,
        requestId: "off-batch",
      }),
    ).rejects.toMatchObject({ code: "conversion-off" });
  });

  it("returns saved limits and clamps execution separately to the current host cap", async () => {
    const h = await host(1024);
    const id = h.addFile();
    await h.put({ limits: { ...DEFAULT_LIMITS, maxBytes: 4096 } });
    expect((await h.service.settings(OWNER)).limits.maxBytes).toBe(4096);
    await expect(h.prepare(id)).resolves.toMatchObject({
      limits: { maxBytes: 1024 },
    });
    await h.put({
      expectedRevision: 1,
      limits: { ...DEFAULT_LIMITS, maxBytes: 50 },
    });
    await expect(h.request(id, { profile: DIGITAL })).rejects.toMatchObject({
      code: "too-large",
    });
    await expect(h.prepare(id)).rejects.toMatchObject({ code: "too-large" });
  });

  it("resets legacy policies once, retains historical results, and rejects retired workflow IDs", async () => {
    const h = await host();
    const id = h.addFile();
    await h.put({ workflowGrant: "legacy-grant" });
    const prepared = await h.prepare(id, "historical-run");
    if (prepared.kind !== "ready") throw new Error("Expected PDF");
    const saved = h.saveResult(prepared);
    await h.db.deleteFrom("conversion_workflows").execute();
    await h.store.putBinding({
      scope_key: scopeKey(FILES),
      workflow_id: "legacy-workflow",
      authorizer: OWNER.identity,
      grant: "legacy-grant",
    });
    h.runs.set("historical-run", {
      id: "historical-run",
      workflowId: "legacy-workflow",
      status: "SUCCEEDED",
      startedAt: AT,
      endedAt: AT,
      steps: [
        { stepKey: "resolve", status: "SUCCEEDED", output: prepared },
        {
          stepKey: "publish",
          status: "SUCCEEDED",
          output: { kind: "published", result: saved },
        },
      ],
    });
    await h.db.deleteFrom("conversion_settings").execute();
    for (const scope of [FILES, MAIL]) {
      await sql`insert into conversion_policies (scope_key, scope, revision, activation, profile, limits, authorizing_identity, updated_at)
        values (${scopeKey(scope)}, ${JSON.stringify(scope)}, 9, 'automatic', ${JSON.stringify(DIGITAL)}, ${JSON.stringify(DEFAULT_LIMITS)}, ${OWNER.identity}, ${AT})`.execute(
        h.db,
      );
    }
    await h.store.initialize();
    expect(await h.store.settings()).toMatchObject({
      activation: "off",
      revision: 0,
      needsReview: true,
    });
    expect(await h.store.appBinding()).toBeUndefined();
    const disable = vi.spyOn(h.workflows, "disable");
    await h.service.retireLegacyWorkflows();
    expect(disable).toHaveBeenCalledWith("legacy-workflow");
    expect((await h.service.jobs(OWNER, id)).map((job) => job.id)).toContain(
      "historical-run",
    );
    expect(await h.service.result(OWNER, "historical-run")).toMatchObject({
      result: saved,
    });
    await expect(h.request(id)).rejects.toMatchObject({
      code: "conversion-off",
    });
    await h.put({ activation: "manual" });
    expect((await h.store.appBinding())?.grant).toBeNull();
    expect(await h.store.settings()).toMatchObject({
      activation: "manual",
      revision: 1,
      needsReview: false,
    });
    await h.store.initialize();
    expect(await h.store.settings()).toMatchObject({
      activation: "manual",
      revision: 1,
      needsReview: false,
    });
    await expect(
      h.service.prepare(OWNER, {
        workflowId: "legacy-workflow",
        runId: "retired",
        request: {
          source: { kind: "file", documentId: id },
          intent: { kind: "ensure" },
        },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      h.service.validate(OWNER, {
        workflowId: "legacy-workflow",
        runId: "retired",
        prepared,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect((await h.store.binding(scopeKey(FILES)))?.workflow_id).toBe(
      "legacy-workflow",
    );
  });
});

describe("conversion review regressions", () => {
  it("reconciles an existing managed workflow on startup without changing settings", async () => {
    const h = await host();
    await h.put();
    const before = await h.store.settings();
    const ensure = vi.spyOn(h.workflows, "ensure");
    await h.service.reconcileWorkflow();
    expect(ensure).toHaveBeenCalledWith(
      before,
      expect.objectContaining({ identity: OWNER.identity }),
      undefined,
      expect.objectContaining({ workflow_id: "workflow-app" }),
    );
    expect(await h.store.settings()).toEqual(before);
    ensure.mockRejectedValue(new Error("Grant expired"));
    const disable = vi.spyOn(h.workflows, "disable");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await h.service.reconcileWorkflow();
      expect(disable).toHaveBeenCalledWith("workflow-app");
      expect(await h.store.settings()).toEqual(before);
    } finally {
      log.mockRestore();
    }
  });

  it("finds PDFs beyond 5,000 unrelated nodes", async () => {
    const h = await host();
    await h.put();
    const id = h.addFile("last.pdf");
    const nodes = [
      ...Array.from({ length: 5000 }, (_, i) => ({
        id: `unrelated-${i}`,
        kind: "file",
        documentType: "sektar/invoice",
      })),
      { id, kind: "file", documentType: "sektar/file" },
    ];
    h.read.drives.listNodes = (_drive, _folder, paging) => {
      const offset = Number(paging.cursor || 0);
      return Promise.resolve({
        results: nodes.slice(offset, offset + paging.limit),
        ...(offset + paging.limit < nodes.length
          ? { nextCursor: String(offset + paging.limit) }
          : {}),
      });
    };
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    expect(preview.scanned).toBe(5001);
    expect(preview.candidates.map((source) => source.documentId)).toEqual([id]);
    expect(preview.truncated).toBe(false);
  });

  it("admits only one simultaneous batch and admits the next after its runs finish", async () => {
    const h = await host();
    await h.put();
    h.addFile();
    const preview = await h.service.previewBatch(OWNER, {
      scope: FILES,
      limit: 90,
    });
    const results = await Promise.allSettled(
      ["browser1", "browser2"].map((requestId) =>
        h.service.createBatch(OWNER, { previewId: preview.id, requestId }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const refusal = results.find((result) => result.status === "rejected");
    expect(refusal).toMatchObject({
      status: "rejected",
      reason: { code: "batch-running" },
    });
    expect(h.fires).toHaveLength(1);
    await expect(
      h.service.createBatch(OWNER, {
        previewId: preview.id,
        requestId: "browser3",
      }),
    ).rejects.toMatchObject({ code: "batch-running" });
    for (const [id, run] of h.runs)
      h.runs.set(id, { ...run, status: "SUCCEEDED" });
    await expect(
      h.service.createBatch(OWNER, {
        previewId: preview.id,
        requestId: "browser3",
      }),
    ).resolves.toMatchObject({ status: "running" });
    expect(h.fires).toHaveLength(2);
  });

  it("checks current global limits on extraction with replayed preparation", async () => {
    const h = await host();
    await h.put();
    const id = h.addFile();
    const prepared = await h.prepare(id);
    if (prepared.kind !== "ready") throw new Error("Expected ready PDF");
    const gateway = conversionGatewayResolvers(
      () => h.service,
      (error) => {
        throw error;
      },
    );
    const uploads: Buffer[] = [];
    const run = () =>
      convertManagedPdf({
        input: { prepared, workflowId: "workflow-app", runId: "retry" },
        reactor: {
          query: async (request) => ({
            data: {
              conversion: {
                extractionLimits:
                  await gateway.ConversionGateway.extractionLimits(
                    {},
                    request.variables,
                    { user: { address: OWNER.identity } },
                  ),
              },
            },
          }),
        },
        file: {
          filename: "two-pages.pdf",
          data: Buffer.from(
            makePdf([
              { kind: "text", lines: ["APPROVED"] },
              { kind: "text", lines: ["APPROVED"] },
            ]),
          ),
        },
        files: {
          upload: ({ data }) => {
            uploads.push(data);
            return Promise.resolve({
              id: `attachment://v1:${createHash("sha256").update(data).digest("hex")}`,
            });
          },
        },
      });
    await h.put({
      expectedRevision: 1,
      limits: { ...DEFAULT_LIMITS, maxPages: 1 },
    });
    await expect(run()).rejects.toMatchObject({ code: "too-many-pages" });
    expect(uploads).toHaveLength(0);
    await h.put({
      expectedRevision: 2,
      limits: { ...DEFAULT_LIMITS, maxPages: 2 },
    });
    await expect(run()).resolves.toMatchObject({
      documentPages: 2,
      completeness: "complete",
    });
    expect(uploads).toHaveLength(2);
    await h.put({ expectedRevision: 3, activation: "off" });
    await expect(run()).rejects.toMatchObject({ code: "conversion-off" });
    expect(uploads).toHaveLength(2);
  });
});

function controlledModels() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let ready = false;
  const prepare = vi.fn<
    NonNullable<
      ConstructorParameters<typeof ConversionService>[0]["models"]
    >["downloadMissingAssets"]
  >(async (_assets, report) => {
    report({
      phase: "downloading",
      transferredBytes: 25,
      totalBytes: 100,
      readyFiles: 0,
      totalFiles: 1,
      file: "English",
    });
    await gate;
    ready = true;
    report({
      phase: "applying",
      transferredBytes: 100,
      totalBytes: 100,
      readyFiles: 1,
      totalFiles: 1,
      file: null,
    });
  });
  const models: NonNullable<
    ConstructorParameters<typeof ConversionService>[0]["models"]
  > = {
    inspect: () =>
      Promise.resolve({
        files: [{ id: "english", label: "English", bytes: 100, ready }],
        ready,
        missingBytes: ready ? 0 : 100,
        totalBytes: 100,
      }),
    downloadMissingAssets: prepare,
    require: () =>
      ready ? Promise.resolve([]) : Promise.reject(new ModelsNotReady()),
  };
  return {
    models,
    release,
    prepare,
    setReady: (value: boolean) => {
      ready = value;
    },
  };
}
async function settledPreparation(
  service: ConversionService,
  id: string,
): Promise<ModelPreparation> {
  await vi.waitFor(async () =>
    expect(preparationActive(await service.preparation(OWNER, id))).toBe(false),
  );
  return service.preparation(OWNER, id);
}
describe("explicit scanner preparation", () => {
  it("keeps active settings until verified, records progress, activates on host, and deduplicates", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    const put = {
      activation: "manual" as const,
      profile: DIGITAL,
      limits: DEFAULT_LIMITS,
      expectedRevision: 0,
      requestId: "scanner-save",
      workflowGrant: "private-grant",
    };
    const started = await h.service.putSettings(OWNER, put);
    expect(started).toMatchObject({ kind: "preparation" });
    expect((await h.store.settings()).revision).toBe(0);
    await vi.waitFor(async () =>
      expect(
        (await h.service.preparation(OWNER, "scanner-save")).progress
          .transferredBytes,
      ).toBe(25),
    );
    expect(JSON.stringify(await h.service.preparations(OWNER))).not.toContain(
      "private-grant",
    );
    await h.service.putSettings(OWNER, put);
    expect(scanner.prepare).toHaveBeenCalledTimes(1);
    scanner.release();
    expect(
      (await settledPreparation(h.service, "scanner-save")).result,
    ).toMatchObject({ kind: "settings", settings: { revision: 1 } });
    await h.service.putSettings(OWNER, put);
    expect((await h.store.settings()).revision).toBe(1);
    await expect(
      h.service.putSettings(OWNER, { ...put, activation: "automatic" }),
    ).rejects.toMatchObject({ problem: { code: "preparation-conflict" } });
  });
  it("Off wins over a pending save and revoked manager permission prevents activation", async () => {
    for (const revoke of [false, true]) {
      const scanner = controlledModels();
      const h = await host(undefined, scanner.models);
      await h.put({ requestId: "waiting" });
      if (revoke) h.admins.delete(OWNER.identity);
      else await h.put({ activation: "off" });
      scanner.release();
      await vi.waitFor(async () =>
        expect(
          (await h.store.preparation("waiting"))?.view.progress.phase,
        ).toBe("failed"),
      );
      expect((await h.store.settings()).revision).toBe(revoke ? 0 : 1);
      expect((await h.store.preparation("waiting"))?.view.error?.code).toBe(
        revoke ? "forbidden" : "revision-conflict",
      );
    }
  });
  it("interrupts pending setup on restart without saving credentials and retries with the same identity", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    await h.put({ requestId: "restart", workflowGrant: "secret" });
    await vi.waitFor(async () =>
      expect((await h.store.preparation("restart"))?.view.progress.phase).toBe(
        "downloading",
      ),
    );
    await h.store.initialize();
    expect((await h.store.preparation("restart"))?.view.error?.code).toBe(
      "interrupted",
    );
    expect(JSON.stringify(await h.store.preparation("restart"))).not.toContain(
      "secret",
    );
    scanner.release();
    await settledPreparation(h.service, "restart");
  });
  it("retires a service while its download continues without letting the old intent activate", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    await h.put({ requestId: "retired" });
    await h.service.close();
    expect((await h.store.preparation("retired"))?.view.error?.code).toBe(
      "interrupted",
    );
    await h.store.initialize();
    scanner.release();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect((await h.store.preparation("retired"))?.view.error?.code).toBe(
      "interrupted",
    );
    expect((await h.store.settings()).revision).toBe(0);
  });
  it("records a transient progress write failure without an unhandled rejection or activation", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    vi.spyOn(h.store, "updatePreparation").mockRejectedValueOnce(
      new Error("storage unavailable"),
    );
    await h.put({ requestId: "write-failure" });
    await new Promise((resolve) => setTimeout(resolve, 15));
    scanner.release();
    const ended = await settledPreparation(h.service, "write-failure");
    expect(ended.progress.phase).toBe("failed");
    expect((await h.store.settings()).revision).toBe(0);
  });
  it("rejects invalid limits before any download", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    await expect(
      h.put({
        requestId: "bad",
        limits: { ...DEFAULT_LIMITS, maxPages: 999999 },
      }),
    ).rejects.toMatchObject({ problem: { code: "limit-too-high" } });
    expect(scanner.prepare).not.toHaveBeenCalled();
  });
  it("converts on demand only with the scanner from Settings and never downloads for it", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    scanner.setReady(true);
    const app = withMethod(DIGITAL, "smart", {
      kind: "ocr",
      engine: "tesseract",
      languages: ["eng", "deu"],
    });
    await h.put({ profile: app });
    const documentId = h.addFile();
    const before = await h.store.settings();

    await expect(
      h.request(documentId, {
        profile: withRecognition(app, "paddleocr"),
      }),
    ).rejects.toMatchObject({ problem: { code: "scanner-not-in-settings" } });
    await expect(
      h.request(documentId, {
        profile: withLanguages(app, ["eng", "fra"]),
      }),
    ).rejects.toMatchObject({ problem: { code: "scanner-not-in-settings" } });
    expect(h.fires).toHaveLength(0);

    await h.request(documentId, {
      profile: withLanguages(withMethod(app, "ocr"), ["deu"]),
    });
    expect(h.fires).toHaveLength(1);
    expect(scanner.prepare).not.toHaveBeenCalled();
    expect(await h.store.settings()).toEqual(before);
    expect(await h.service.preparations(OWNER)).toEqual([]);

    // A run replayed after Settings changed scanner reads with neither.
    await expect(
      h.service.prepare(OWNER, {
        workflowId: "workflow-app",
        request: {
          source: { kind: "file", documentId, expectedRef: PDF },
          profile: withRecognition(app, "paddleocr"),
          intent: { kind: "regenerate", requestId: "replayed" },
        },
        runId: "replayed-run",
      }),
    ).rejects.toMatchObject({ problem: { code: "scanner-not-in-settings" } });
  });
  it("refuses an on-demand conversion while the scanner from Settings isn't downloaded", async () => {
    const scanner = controlledModels();
    const h = await host(undefined, scanner.models);
    scanner.setReady(true);
    const app = withMethod(DIGITAL, "smart");
    await h.put({ profile: app });
    scanner.setReady(false);
    const documentId = h.addFile();
    const refused: unknown = await h
      .request(documentId, { profile: app })
      .catch((error: unknown) => error);
    expect(refused).toMatchObject({
      problem: {
        code: "models-not-ready",
        message:
          "The scanner in Settings isn't downloaded on this host yet. Download it in Settings → Document conversion.",
      },
    });
    expect(scanner.prepare).not.toHaveBeenCalled();
    expect(h.fires).toHaveLength(0);
  });
});
