import {
  modelStore,
  ModelsNotReady,
  ModelDownloadError,
} from "../models/store.js";
import { profileAssets } from "../models/catalogue.js";
import {
  preparationActive,
  type ModelPreparation,
  type ModelProgress,
  type PreparationIntent,
} from "../models/contracts.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PHDocument } from "document-model";
import {
  APP_CONVERSION_KEY,
  requestConversionSchema,
  type RenewConversionAccess,
  type ConversionSettings,
  type ConversionProfile,
  type ConversionScope,
  type RequestConversion,
  type PutConversionSettings,
  type ConversionJobView,
  type ConversionAttachmentRef,
  type ConversionResult,
  type PreviewConversionBatch,
  type ConversionBatchPreview,
  type ConversionBatch,
  type RequestConversionBatch,
  type ResolvedSource,
  type SourceSelection,
} from "../contracts.js";
import { probeEngines, type EngineProbe } from "../engine/engines.js";
import {
  resolvePlan,
  PlanRefusal,
  sha256Hex,
  canonicalJson,
} from "../engine/plan.js";
import {
  type PreparePdfInput,
  type PreparedPdf,
  type ValidatePdfInput,
} from "../../pieces/sektar-pdf/lib/contracts.js";
import {
  listConversionRenditions,
  resultOfPublication,
  type PublicationInspection,
} from "../model-adapter.js";
import {
  inspectPublications,
  InvalidPublicationArtifactError,
} from "../read-publications.js";
import {
  MAX_PUBLICATION_MARKDOWN_BYTES,
  parsePublicationRowId,
  publicationRowId,
} from "../publication.js";
import { capabilitiesOf } from "./capabilities.js";
import { nextSettings, scopeKey, checkLimits } from "./settings.js";
import { ConversionRefusal, forbidden, notFound } from "./problems.js";
import type { SettingsStore } from "./settings-store.js";
import { type WorkflowBinding } from "./settings-store.js";
import {
  scopeOf,
  resolveSource,
  pdfSelectionsOf,
  normalizeAccount,
} from "./sources.js";
import {
  callerOf,
  type Caller,
  type AccessPort,
  type DocumentReader,
  type AttachmentReader,
  type WorkflowPort,
} from "./ports.js";
import { submissionSchema, viewOfRun, type NativeRun } from "./run-view.js";
import { WorkflowRuntimeError } from "../workflow/bridge.js";
import {
  localOcrOf,
  usesAppScanner,
} from "../../pieces/docture/lib/profile.js";
export { callerOf } from "./ports.js";
export type { Caller, AccessPort, DocumentReader } from "./ports.js";

interface ServicePorts {
  store: SettingsStore;
  read: DocumentReader;
  access: AccessPort;
  attachments: AttachmentReader;
  workflows: WorkflowPort;
  probe?: () => EngineProbe;
  models?: Pick<
    typeof modelStore,
    "inspect" | "downloadMissingAssets" | "require"
  >;
  now?: () => Date;
  newId: () => string;
  maxFileBytes?: number;
}
const automaticEventSchema = z.object({
  documentId: z.string(),
  documentType: z.enum(["sektar/file", "sektar/email"]),
  action: z.object({
    type: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
  operation: z.object({
    timestampUtcMs: z.string(),
    index: z.number().optional(),
  }),
});
/** A byte count as a person reads it: "8 MB", "1.5 GB", "900 KB". */
function sizeText(size: number): string {
  const units = ["bytes", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("en")} ${units[unit]}`;
}

const tooLarge = (size: number, limit: number) =>
  new ConversionRefusal(
    422,
    "too-large",
    `This PDF is larger than the ${sizeText(limit)} limit for these files. Raise the limit in Settings → Document conversion, or convert a smaller PDF.`,
    false,
    `${size} bytes; the limit is ${limit} bytes.`,
  );
const replaced = () =>
  new ConversionRefusal(
    403,
    "forbidden",
    "The conversion settings for these files changed while this conversion waited. Convert again.",
    false,
  );

const normalizedScope = (scope: ConversionScope): ConversionScope =>
  scope.kind === "mail"
    ? { ...scope, account: normalizeAccount(scope.account) }
    : scope;
const selectionOf = (source: ResolvedSource): SourceSelection =>
  source.kind === "file"
    ? { kind: "file", documentId: source.documentId, expectedRef: source.ref }
    : {
        kind: "mail",
        documentId: source.documentId,
        attachmentId: source.attachmentId,
        expectedRef: source.ref,
      };

function requireAvailablePublications(
  inspections: readonly PublicationInspection[],
) {
  if (inspections.some((entry) => entry.kind === "pending"))
    throw new ConversionRefusal(
      503,
      "attachment-pending",
      "Saved conversion files are still arriving. Try again in a moment.",
      true,
    );
}

/** App-wide settings and native workflow adaptation. No run scheduler or recovery state. */
export class ConversionService {
  private closed = false;
  private readonly preparationWrites = new Set<Promise<void>>();
  private readonly preparing = new Set<string>();
  async close(): Promise<void> {
    this.closed = true;
    await this.preparationAdmission;
    await this.settingsWrite;
    await Promise.allSettled([...this.preparationWrites]);
    for (const id of this.preparing) {
      const stored = await this.ports.store.preparation(id);
      if (stored && preparationActive(stored.view))
        await this.ports.store.updatePreparation({
          ...stored.view,
          updatedAt: this.now(),
          progress: { ...stored.view.progress, phase: "failed" },
          error: {
            code: "interrupted",
            message:
              "The host restarted before setup finished. Retry to continue with verified files.",
            retryable: true,
          },
        });
    }
  }
  private isClosed() {
    return this.closed;
  }
  private requireOpen() {
    if (this.isClosed())
      throw new ConversionRefusal(
        503,
        "interrupted",
        "The conversion service restarted. Retry setup.",
        true,
      );
  }
  private preparationAdmission: Promise<void> = Promise.resolve();
  private readonly submittingBatches = new Set<string>();
  private batchAdmission: Promise<void> = Promise.resolve();
  private settingsWrite: Promise<void> = Promise.resolve();
  private readonly submissions = new Map<
    string,
    Promise<{ view: ConversionJobView; created: boolean }>
  >();
  constructor(private readonly ports: ServicePorts) {}
  private async configure<T>(work: () => Promise<T>): Promise<T> {
    const result = this.settingsWrite.then(work);
    this.settingsWrite = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async retireLegacyWorkflows(): Promise<void> {
    for (const binding of await this.ports.store.bindings()) {
      if (binding.scope_key === APP_CONVERSION_KEY) continue;
      try {
        await this.ports.workflows.disable(binding.workflow_id);
      } catch (error) {
        console.error(
          "[conversion] Could not disable a retired workflow",
          error,
        );
      }
    }
  }
  private now() {
    return (this.ports.now?.() ?? new Date()).toISOString();
  }
  private probe() {
    return this.ports.probe?.() ?? probeEngines();
  }
  private plan(profile: ConversionProfile) {
    try {
      return resolvePlan(profile, this.probe());
    } catch (error) {
      if (error instanceof PlanRefusal)
        throw new ConversionRefusal(422, error.code, error.message, false);
      throw error;
    }
  }
  private async effectiveSettings(): Promise<ConversionSettings> {
    return this.withRuntimeLimits(await this.ports.store.settings());
  }
  private withRuntimeLimits(settings: ConversionSettings): ConversionSettings {
    return {
      ...settings,
      limits: {
        ...settings.limits,
        maxBytes: Math.min(
          settings.limits.maxBytes,
          this.ports.maxFileBytes ?? 8 * 1024 * 1024,
        ),
      },
    };
  }
  capabilities(_caller: Caller) {
    const capabilities = capabilitiesOf(this.probe());
    return Promise.resolve({
      ...capabilities,
      execution: {
        kind: "workflow" as const,
        runningCancellation: false as const,
        pageProgress: false as const,
        maxFileBytes: this.ports.maxFileBytes ?? 8 * 1024 * 1024,
      },
    });
  }
  async settings(_caller: Caller): Promise<ConversionSettings> {
    this.ports.workflows.assertSetup();
    return this.ports.store.settings();
  }
  private async mayConfigure(caller: Caller): Promise<void> {
    if (!(await this.ports.access.canManageSettings(caller)))
      throw forbidden("change app-wide conversion settings");
  }
  private conflict(): never {
    throw new ConversionRefusal(
      409,
      "revision-conflict",
      "These settings changed. Reload them before saving.",
      true,
    );
  }
  private get models() {
    return this.ports.models ?? modelStore;
  }
  async modelReadiness(_caller: Caller, profile: ConversionProfile) {
    this.plan(profile);
    return this.models.inspect(profile);
  }
  async preparations(caller: Caller) {
    if (!(await this.ports.access.canManageSettings(caller))) return [];
    return this.ports.store.preparations(caller.identity);
  }
  async preparation(caller: Caller, id: string) {
    const row = await this.ports.store.preparation(id);
    if (!row || row.owner !== caller.identity) throw notFound();
    await this.mayConfigure(caller);
    return row.view;
  }
  /** A one-off profile, refused when it asks for a scanner Settings doesn't use. */
  private requested(
    profile: ConversionProfile | undefined,
    settings: ConversionSettings,
  ): ConversionProfile {
    if (!profile) return settings.profile;
    if (!usesAppScanner(profile, settings.profile))
      throw new ConversionRefusal(
        422,
        "scanner-not-in-settings",
        "This conversion asks for a scanner that isn't chosen in Settings. Change the scanner in Settings → Document conversion.",
        false,
      );
    return profile;
  }
  private async requireModels(profile: ConversionProfile) {
    try {
      await this.models.require(localOcrOf(profile));
    } catch (error) {
      if (error instanceof ModelsNotReady)
        throw new ConversionRefusal(
          409,
          "models-not-ready",
          error.message,
          true,
        );
      throw error;
    }
  }
  async putSettings(
    caller: Caller,
    put: PutConversionSettings,
  ): Promise<ConversionSettings | ModelPreparation> {
    await this.mayConfigure(caller);
    checkLimits(put.limits);
    if (put.activation === "off") return this.applySettings(caller, put);
    this.plan(put.profile);
    const { workflowGrant: _grant, requestId, ...settings } = put;
    if (!requestId && (await this.models.inspect(put.profile)).ready)
      return this.applySettings(caller, put);
    return this.prepareModels(
      caller,
      requestId ?? this.ports.newId(),
      { kind: "settings", settings },
      put.workflowGrant,
    );
  }
  private async prepareModels(
    caller: Caller,
    id: string,
    intent: PreparationIntent,
    credential?: string,
  ): Promise<ModelPreparation> {
    const admit = this.preparationAdmission.then(async () => {
      this.requireOpen();
      const fingerprint = sha256Hex(canonicalJson(intent));
      const previous = await this.ports.store.preparation(id);
      if (previous) {
        if (previous.owner !== caller.identity) throw notFound();
        if (previous.fingerprint !== fingerprint)
          throw new ConversionRefusal(
            409,
            "preparation-conflict",
            "This download request has changed. Review your choices and try again.",
            false,
          );
        if (
          preparationActive(previous.view) ||
          previous.view.progress.phase === "complete"
        )
          return previous.view;
      }
      if (this.preparing.size >= 4)
        throw new ConversionRefusal(
          429,
          "downloads-busy",
          "The host is preparing other scanners. Try again in a moment.",
          true,
        );
      await this.mayConfigure(caller);
      if (
        (await this.ports.store.settings()).revision !==
        intent.settings.expectedRevision
      )
        this.conflict();
      const profile = intent.settings.profile;
      const readiness = await this.models.inspect(profile);
      const view: ModelPreparation = {
        kind: "preparation",
        id,
        intent,
        updatedAt: this.now(),
        progress: {
          phase: "queued",
          file: null,
          transferredBytes: 0,
          totalBytes: readiness.missingBytes,
          totalFiles: readiness.files.length,
          readyFiles: readiness.files.filter((file) => file.ready).length,
        },
        error: null,
        result: null,
      };
      if (previous) await this.ports.store.updatePreparation(view);
      else
        await this.ports.store.createPreparation(
          caller.identity,
          fingerprint,
          view,
        );
      this.preparing.add(id);
      void this.finishPreparation(caller, view, profile, credential)
        .catch((error: unknown) =>
          console.error(
            "[conversion] Could not persist scanner preparation",
            error,
          ),
        )
        .finally(() => this.preparing.delete(id));
      return view;
    });
    this.preparationAdmission = admit.then(
      () => undefined,
      () => undefined,
    );
    return admit;
  }
  private async finishPreparation(
    caller: Caller,
    initial: ModelPreparation,
    profile: ConversionProfile,
    credential?: string,
  ) {
    let view = initial;
    let writes: Promise<void> = Promise.resolve();
    let lastWrite = 0;
    let persistenceError: unknown;
    const progress = (next: ModelProgress) => {
      if (this.isClosed()) return;
      view = { ...view, progress: next, updatedAt: this.now() };
      if (Date.now() - lastWrite < 150 && next.phase === "downloading") return;
      lastWrite = Date.now();
      const snapshot = view;
      writes = writes
        .then(() =>
          this.closed
            ? undefined
            : this.ports.store.updatePreparation(snapshot),
        )
        .catch((error: unknown) => {
          persistenceError = error;
        });
      const pending = writes;
      this.preparationWrites.add(pending);
      void pending.finally(() => this.preparationWrites.delete(pending));
    };
    try {
      await this.models.downloadMissingAssets(profileAssets(profile), progress);
      await writes;
      if (this.isClosed()) return;
      if (persistenceError)
        throw new Error("Scanner progress could not be stored", {
          cause: persistenceError,
        });
      await this.applySettings(
        caller,
        {
          ...view.intent.settings,
          ...(credential ? { workflowGrant: credential } : {}),
        },
        view,
      );
    } catch (error) {
      await writes.catch(() => undefined);
      if (this.isClosed()) return;
      const stored = await this.ports.store.preparation(view.id);
      if (stored?.view.progress.phase === "complete") return;
      const problem =
        error instanceof ConversionRefusal
          ? {
              ...error.problem,
              retryable:
                error.problem.code !== "revision-conflict" &&
                error.problem.retryable,
            }
          : {
              code: "download-failed",
              message:
                error instanceof ModelDownloadError
                  ? error.message
                  : "Scanner setup did not finish. Check your connection and retry; verified files will be reused.",
              retryable: true,
            };
      await this.ports.store.updatePreparation({
        ...view,
        updatedAt: this.now(),
        progress: { ...view.progress, phase: "failed" },
        error: {
          code: problem.code,
          message: problem.message,
          retryable: problem.retryable,
        },
      });
    }
  }
  private async applySettings(
    caller: Caller,
    put: PutConversionSettings,
    preparation?: ModelPreparation,
  ) {
    return this.configure(async () => {
      await this.mayConfigure(caller);
      const previous = await this.ports.store.settings();
      if (previous.revision !== put.expectedRevision) this.conflict();
      const settings = nextSettings(previous, put, caller.identity, this.now());
      if (settings.activation !== "off") {
        this.plan(settings.profile);
        await this.requireModels(settings.profile);
      }
      await this.saveConfiguration(
        caller,
        settings,
        put.expectedRevision,
        put.workflowGrant,
        preparation
          ? {
              ...preparation,
              updatedAt: this.now(),
              progress: { ...preparation.progress, phase: "complete" },
              result: { kind: "settings", settings },
            }
          : undefined,
      );
      if (settings.activation === "off") {
        try {
          const binding = await this.ports.store.appBinding();
          if (binding) await this.ports.workflows.disable(binding.workflow_id);
        } catch (error) {
          console.error(
            "[conversion] Conversion is Off; disabling its workflow failed.",
            error,
          );
        }
      }
      return settings;
    });
  }
  async renewAccess(caller: Caller, input: RenewConversionAccess) {
    return this.configure(async () => {
      await this.mayConfigure(caller);
      const saved = await this.ports.store.settings();
      if (saved.revision !== input.expectedRevision) this.conflict();
      this.enabled(saved);
      const next = nextSettings(
        saved,
        { ...saved, ...input },
        caller.identity,
        this.now(),
      );
      await this.saveConfiguration(
        caller,
        next,
        input.expectedRevision,
        input.workflowGrant,
      );
      return next;
    });
  }
  private async saveConfiguration(
    caller: Caller,
    settings: ConversionSettings,
    expectedRevision: number,
    grant?: string,
    preparation?: ModelPreparation,
  ): Promise<void> {
    const existing =
      settings.activation === "off"
        ? undefined
        : await this.ports.store.appBinding();
    let provisioned: WorkflowBinding | undefined;
    try {
      if (settings.activation !== "off")
        provisioned = await this.ports.workflows.ensure(
          settings,
          caller,
          grant,
          existing,
        );
      this.requireOpen();
      await this.mayConfigure(caller);
      if (
        !(await this.ports.store.putSettings(
          settings,
          expectedRevision,
          provisioned,
          preparation,
        ))
      )
        this.conflict();
    } catch (error) {
      try {
        // A failed acknowledgement can still have committed: recover from stored truth.
        const committed = await this.ports.store.appBinding();
        if (provisioned && provisioned.workflow_id !== committed?.workflow_id)
          await this.ports.workflows.disable(provisioned.workflow_id);
        await this.reconcileWorkflow();
      } catch (recoveryError) {
        for (const id of new Set([
          existing?.workflow_id,
          provisioned?.workflow_id,
        ])) {
          if (!id) continue;
          try {
            await this.ports.workflows.disable(id);
          } catch (disableError) {
            console.error(
              "[conversion] Could not disable the unreconciled workflow",
              disableError,
            );
          }
        }
        console.error(
          "[conversion] Could not reconcile the saved configuration",
          recoveryError,
        );
      }
      throw error;
    }
  }
  async reconcileWorkflow(): Promise<void> {
    const existing = await this.ports.store.appBinding();
    if (!existing) return;
    const settings = await this.ports.store.settings();
    if (settings.activation === "off" || settings.needsReview) {
      try {
        await this.ports.workflows.disable(existing.workflow_id);
      } catch (error) {
        console.error(
          "[conversion] Conversion is Off; disabling its workflow failed.",
          error,
        );
      }
      return;
    }
    try {
      await this.ensure(callerOf(existing.authorizer), settings);
    } catch (error) {
      await this.ports.workflows.disable(existing.workflow_id);
      console.error(
        "[conversion] Renew conversion access to update the managed workflow",
        error,
      );
    }
  }
  private async ensure(
    caller: Caller,
    settings: ConversionSettings,
    grant?: string,
  ): Promise<WorkflowBinding> {
    const existing = await this.ports.store.appBinding();
    const binding = await this.ports.workflows.ensure(
      settings,
      caller,
      grant,
      existing,
    );
    await this.ports.store.putBinding(binding);
    return binding;
  }
  private async resolve(caller: Caller, selection: SourceSelection) {
    if (!(await this.ports.access.canRead(caller, selection.documentId)))
      throw notFound();
    if (!(await this.ports.access.canWrite(caller, selection.documentId)))
      throw forbidden("save Markdown on this document");
    const document = await this.ports.read.get(selection.documentId);
    const parents = await this.ports.read.getIncomingRelationships(
      selection.documentId,
      "drive/child",
      undefined,
      { cursor: "", limit: 10 },
    );
    const driveId = parents.results.map((parent) => parent.header.id).sort()[0];
    if (!driveId)
      throw new ConversionRefusal(
        422,
        "not-in-drive",
        "This PDF isn't in a drive, so Sektar can't convert it. Move it into a drive and try again.",
        false,
      );
    const source = resolveSource(
      document,
      selection,
      scopeOf(document, driveId),
    );
    return { source, document };
  }
  private enabled(settings: ConversionSettings): void {
    if (settings.activation === "off")
      throw new ConversionRefusal(
        409,
        "conversion-off",
        "Document conversion is off for the app. Turn it on in Settings → Document conversion.",
        false,
      );
  }
  private async owner(caller: Caller) {
    const binding = await this.ports.store.appBinding();
    if (!binding)
      throw new ConversionRefusal(
        409,
        "conversion-setup",
        "Save your app-wide settings in Settings → Document conversion before converting PDFs.",
        false,
      );
    if (
      binding.authorizer !== "anonymous" &&
      binding.authorizer !== caller.identity
    )
      throw new ConversionRefusal(
        403,
        "workflow-owner",
        "Conversions here run as the person who set them up. Ask that person to convert, or choose Use my access only in Settings → Document conversion.",
        false,
      );
    await this.ports.workflows.validateBinding(binding);
    return binding;
  }
  async request(
    caller: Caller,
    input: RequestConversion,
    authorization?: string,
    batchId?: string,
  ) {
    const { source } = await this.resolve(caller, input.source);
    const settings = await this.effectiveSettings();
    this.enabled(settings);
    const profile = this.requested(input.profile, settings);
    const plan = this.plan(profile);
    await this.requireModels(profile);
    if (
      source.sizeBytes !== null &&
      source.sizeBytes > settings.limits.maxBytes
    )
      throw tooLarge(source.sizeBytes, settings.limits.maxBytes);
    const binding = await this.owner(caller);
    const { profile: override, ...request } = input;
    const admissionKey = sha256Hex(
      canonicalJson({
        caller: caller.identity,
        source,
        plan: plan.fingerprint,
        requestedProfile: input.profile ?? null,
        intent: input.intent,
        executionKey: input.executionKey ?? null,
        batchId: batchId ?? null,
      }),
    );
    const payload = submissionSchema.parse({
      admissionKey,
      documentId: source.documentId,
      request: {
        ...request,
        ...(override === undefined ? {} : { profile: override }),
        source: selectionOf(source),
      },
      admitted: { source, profile, plan },
      batchId,
    });
    const pending = this.submissions.get(admissionKey);
    if (pending) return pending;
    const submit = async () => {
      const previous = (
        batchId
          ? []
          : await this.ports.workflows.runs(binding.workflow_id, authorization)
      ).find((run) => {
        const parsed = submissionSchema.safeParse(run.triggerPayload);
        return (
          parsed.success &&
          parsed.data.admissionKey === admissionKey &&
          (input.intent.kind === "regenerate" ||
            !!input.executionKey ||
            ["PENDING", "RUNNING", "WAITING"].includes(run.status))
        );
      });
      if (previous)
        return {
          view: await this.job(caller, previous.id, authorization),
          created: false,
        };
      let id: string;
      try {
        this.requireOpen();
        id = await this.ports.workflows.fire(
          binding.workflow_id,
          payload,
          authorization,
        );
      } catch (error) {
        if (
          error instanceof ConversionRefusal ||
          error instanceof WorkflowRuntimeError
        )
          throw error;
        throw new ConversionRefusal(
          503,
          "workflow-answer-lost",
          "Sektar didn't hear back about this conversion. It may still be running, so wait a moment before you try again.",
          false,
        );
      }
      return { view: await this.job(caller, id, authorization), created: true };
    };
    const promise = submit();
    this.submissions.set(admissionKey, promise);
    try {
      return await promise;
    } finally {
      this.submissions.delete(admissionKey);
    }
  }
  async jobs(
    caller: Caller,
    documentId: string,
    authorization?: string,
  ): Promise<ConversionJobView[]> {
    if (!(await this.ports.access.canRead(caller, documentId)))
      throw notFound();
    const document = await this.ports.read.get(documentId);
    const selections = pdfSelectionsOf(document);
    if (!selections[0]) return [];
    const { source } = await this.resolveRead(caller, selections[0]);
    const bindings = (await this.ports.store.bindings()).filter(
      (binding) =>
        binding.scope_key === APP_CONVERSION_KEY ||
        binding.scope_key === scopeKey(source.scope),
    );
    const runs = await Promise.all(
      bindings.map((binding) =>
        this.ports.workflows.runs(binding.workflow_id, authorization),
      ),
    );
    return runs
      .flat()
      .map(viewOfRun)
      .filter(
        (view): view is ConversionJobView =>
          !!view && view.source.documentId === documentId,
      );
  }
  private async resolveRead(caller: Caller, selection: SourceSelection) {
    if (!(await this.ports.access.canRead(caller, selection.documentId)))
      throw notFound();
    const document = await this.ports.read.get(selection.documentId);
    const parents = await this.ports.read.getIncomingRelationships(
      selection.documentId,
      "drive/child",
      undefined,
      { cursor: "", limit: 10 },
    );
    const driveId = parents.results.map((parent) => parent.header.id).sort()[0];
    if (!driveId) throw notFound();
    return {
      document,
      source: resolveSource(document, selection, scopeOf(document, driveId)),
    };
  }
  private async nativeRun(
    caller: Caller,
    id: string,
    authorization?: string,
  ): Promise<NativeRun> {
    const run = await this.ports.workflows.run(id, authorization);
    if (!run || !(await this.ports.store.bindingForWorkflow(run.workflowId)))
      throw notFound();
    const view = viewOfRun(run);
    if (
      !view ||
      !(await this.ports.access.canRead(caller, view.source.documentId))
    )
      throw notFound();
    return run;
  }
  async job(
    caller: Caller,
    id: string,
    authorization?: string,
  ): Promise<ConversionJobView> {
    const view = viewOfRun(await this.nativeRun(caller, id, authorization));
    if (!view) throw notFound();
    return view;
  }
  async cancel(caller: Caller, id: string, authorization?: string) {
    const view = await this.job(caller, id, authorization);
    if (!(await this.ports.access.canWrite(caller, view.source.documentId)))
      throw forbidden("cancel this conversion");
    if (!view.cancellable)
      throw new ConversionRefusal(
        409,
        "cannot-cancel-running",
        "A conversion that has started can't be cancelled yet. To keep its result from being saved, turn conversion Off in Settings → Document conversion.",
        false,
      );
    try {
      await this.ports.workflows.cancel(id, authorization);
    } catch (error) {
      if (
        !(
          error instanceof WorkflowRuntimeError &&
          error.code === "graphql" &&
          (error.message.includes(
            "Cancelling a RUNNING run is not supported yet (#3226)",
          ) ||
            /^Run is \w+; only WAITING and PENDING runs can be cancelled$/.test(
              error.message,
            ))
        )
      )
        throw error;
      const current = await this.job(caller, id, authorization);
      if (current.cancellable) throw error;
      return current;
    }
    return this.job(caller, id, authorization);
  }
  async result(caller: Caller, id: string, authorization?: string) {
    const view = await this.job(caller, id, authorization);
    if (view.status !== "complete" && view.status !== "partial")
      throw new ConversionRefusal(
        409,
        "not-complete",
        "This conversion hasn't saved Markdown yet.",
        true,
      );
    const document = await this.ports.read.get(view.source.documentId);
    const inspections = await this.publications(document);
    const saved = inspections.find(
      (entry) =>
        entry.kind === "ready" &&
        entry.publication.manifest.generationId === view.result.jobId &&
        entry.publication.manifest.output.markdown.ref ===
          view.result.markdown.ref,
    );
    if (!saved || saved.kind !== "ready") {
      requireAvailablePublications(inspections);
      throw notFound();
    }
    return {
      result: resultOfPublication(saved.publication),
      markdown: await this.readArtifact(
        view.source.documentId,
        view.result.markdown.ref,
      ),
    };
  }
  async prepare(caller: Caller, input: PreparePdfInput): Promise<PreparedPdf> {
    const settings = await this.effectiveSettings();
    const binding = await this.owner(caller);
    if (input.workflowId !== binding.workflow_id) throw replaced();
    const submission = submissionSchema.safeParse(input.request);
    const manual = requestConversionSchema.safeParse(input.request);
    const request = submission.success
      ? submission.data.request
      : manual.success
        ? manual.data
        : null;
    if (!request) {
      const event = automaticEventSchema.safeParse(input.request);
      if (!event.success)
        return {
          kind: "skip",
          reason: "This event does not identify a newly stored PDF.",
        };
      if (
        settings.activation !== "automatic" ||
        !settings.automaticSince ||
        event.data.operation.timestampUtcMs < settings.automaticSince
      )
        return {
          kind: "skip",
          reason: "Automatic conversion is off for this event.",
        };
      const mail = event.data.documentType === "sektar/email";
      const action = event.data.action.type;
      if (
        mail
          ? action !== "ADD_ATTACHMENT"
          : !["SET_ATTACHMENT_SOURCE", "APPLY_DISK_VERSION"].includes(action)
      )
        return {
          kind: "skip",
          reason: "This operation does not store a PDF for this document type.",
        };
      const id = event.data.action.input.id;
      if (mail && typeof id !== "string")
        return {
          kind: "skip",
          reason: "This event does not identify a PDF attachment.",
        };
      if (
        event.data.action.type === "ADD_ATTACHMENT" &&
        parsePublicationRowId(id)
      )
        return { kind: "skip", reason: "This is a generated conversion file." };
      const selection: SourceSelection =
        event.data.action.type === "ADD_ATTACHMENT" && typeof id === "string"
          ? {
              kind: "mail",
              documentId: event.data.documentId,
              attachmentId: id,
            }
          : { kind: "file", documentId: event.data.documentId };
      try {
        return await this.prepareSource(
          caller,
          { source: selection, intent: { kind: "ensure" } },
          input.runId,
          true,
        );
      } catch (error) {
        if (
          error instanceof ConversionRefusal &&
          [
            "not-pdf",
            "not-a-file",
            "not-an-email",
            "placeholder",
            "no-source",
            "unsupported-reference",
          ].includes(error.code)
        )
          return { kind: "skip", reason: error.message };
        throw error;
      }
    }
    return this.prepareSource(caller, request, input.runId);
  }
  private async prepareSource(
    caller: Caller,
    request: RequestConversion,
    runId: string,
    automatic = false,
  ): Promise<PreparedPdf> {
    publicationRowId(runId, "markdown");
    const { source, document } = await this.resolve(caller, request.source);
    const settings = await this.effectiveSettings();
    this.enabled(settings);
    const inspections =
      automatic || request.intent.kind === "ensure"
        ? await this.publications(document)
        : [];
    if (
      automatic &&
      listConversionRenditions(document, selectionOf(source), inspections).some(
        (row) => !row.stale,
      )
    )
      return {
        kind: "skip",
        reason:
          "This PDF already has saved Markdown. Use Convert again to apply new reading settings.",
      };
    if (automatic) requireAvailablePublications(inspections);
    const plan = this.plan(this.requested(request.profile, settings));
    if (
      source.sizeBytes !== null &&
      source.sizeBytes > settings.limits.maxBytes
    )
      throw tooLarge(source.sizeBytes, settings.limits.maxBytes);
    const reuse =
      request.intent.kind === "ensure"
        ? this.reusable(document, source, plan.fingerprint, inspections)
        : null;
    return {
      kind: "ready",
      source,
      plan,
      limits: settings.limits,
      generationId: runId,
      createdAt: this.now(),
      file: source.ref,
      ...(reuse ? { reuse } : {}),
    };
  }
  async validate(caller: Caller, input: ValidatePdfInput) {
    const { source, document } = await this.resolve(
      caller,
      selectionOf(input.prepared.source),
    );
    if (scopeKey(source.scope) !== scopeKey(input.prepared.source.scope))
      throw new ConversionRefusal(
        409,
        "source-changed",
        "This PDF moved while it was being converted. Convert it again.",
        false,
      );
    this.enabled(await this.effectiveSettings());
    const binding = await this.owner(caller);
    if (input.workflowId !== binding.workflow_id) throw replaced();
    const reuse = input.prepared.reuse;
    if (reuse) {
      const inspections = await this.publications(document);
      const saved = inspections.find(
        (entry) =>
          entry.kind === "ready" &&
          entry.publication.manifest.generationId === reuse.jobId,
      );
      if (
        saved?.kind !== "ready" ||
        canonicalJson(resultOfPublication(saved.publication)) !==
          canonicalJson(reuse)
      ) {
        requireAvailablePublications(inspections);
        throw new ConversionRefusal(
          409,
          "reuse-unavailable",
          "The saved Markdown is no longer available as prepared. Start a new conversion.",
          false,
        );
      }
    }
    return { valid: true as const };
  }
  async extractionLimits(caller: Caller, input: ValidatePdfInput) {
    await this.validate(caller, input);
    const settings = await this.effectiveSettings();
    this.enabled(settings);
    return settings.limits;
  }
  private publications(document: PHDocument) {
    return inspectPublications({
      document,
      read: async ({ documentId, ref }) => {
        try {
          return await this.readArtifactBytes(documentId, ref);
        } catch (error) {
          if (
            error instanceof ConversionRefusal &&
            error.code === "artifact-too-large"
          )
            throw new InvalidPublicationArtifactError(error.message);
          throw error;
        }
      },
    });
  }
  private reusable(
    document: PHDocument,
    source: ResolvedSource,
    fingerprint: string,
    inspections: readonly PublicationInspection[],
  ): ConversionResult | null {
    const rows = listConversionRenditions(
      document,
      selectionOf(source),
      inspections,
    )
      .filter((row) => !row.stale && row.planFingerprint === fingerprint)
      .reverse();
    const row =
      rows.find((item) => item.completeness === "complete") ??
      (inspections.some((entry) => entry.kind === "pending")
        ? undefined
        : rows.at(0));
    if (!row) {
      requireAvailablePublications(inspections);
      return null;
    }
    const stored = inspections.find(
      (entry) =>
        entry.kind === "ready" &&
        entry.publication.manifest.generationId === row.jobId,
    );
    return stored?.kind === "ready"
      ? resultOfPublication(stored.publication)
      : null;
  }
  private async readArtifact(
    documentId: string,
    ref: ConversionAttachmentRef,
  ): Promise<string> {
    const bytes = await this.readArtifactBytes(documentId, ref);
    if (
      `attachment://v1:${createHash("sha256").update(bytes).digest("hex")}` !==
      ref
    )
      throw new ConversionRefusal(
        503,
        "artifact-mismatch",
        "The saved Markdown doesn't match what was converted. Convert again to save a new copy.",
        true,
      );
    return new TextDecoder().decode(bytes);
  }
  private async readArtifactBytes(
    documentId: string,
    ref: ConversionAttachmentRef,
  ): Promise<Uint8Array> {
    const response = await this.ports.attachments.download({ documentId, ref });
    if (response.header.status !== "available") {
      await response.body.cancel();
      throw new ConversionRefusal(
        503,
        "attachment-pending",
        "The saved Markdown is still arriving. Try again in a moment.",
        true,
      );
    }
    const max = MAX_PUBLICATION_MARKDOWN_BYTES;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > max)
          throw new ConversionRefusal(
            422,
            "artifact-too-large",
            "The saved Markdown is too large for Sektar to open.",
            false,
          );
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  async previewBatch(
    caller: Caller,
    input: PreviewConversionBatch,
  ): Promise<ConversionBatchPreview> {
    const scope = normalizedScope(input.scope);
    if (!(await this.ports.access.canWrite(caller, scope.driveId)))
      throw forbidden("convert these PDFs");
    const settings = await this.effectiveSettings();
    this.enabled(settings);
    this.plan(this.requested(input.profile, settings));
    const candidates: ResolvedSource[] = [];
    let oversized = 0;
    let arriving = 0;
    let converted = 0;
    let scanned = 0;
    let cursor = "";
    let truncated = false;
    scan: for (;;) {
      const page = await this.ports.read.drives.listNodes(
        scope.driveId,
        undefined,
        { cursor, limit: 200 },
      );
      for (const node of page.results) {
        if (candidates.length >= Math.min(input.limit, 90)) {
          truncated = true;
          break scan;
        }
        scanned++;
        if (
          node.kind !== "file" ||
          !["sektar/file", "sektar/email"].includes(node.documentType ?? "")
        )
          continue;
        if (!(await this.ports.access.canWrite(caller, node.id))) continue;
        const document = await this.ports.read.get(node.id);
        if (scopeKey(scopeOf(document, scope.driveId)) !== scopeKey(scope))
          continue;
        const inspections = await this.publications(document);
        if (inspections.some((entry) => entry.kind === "pending")) {
          arriving++;
          continue;
        }
        for (const selection of pdfSelectionsOf(document)) {
          if (candidates.length >= Math.min(input.limit, 90)) {
            truncated = true;
            break scan;
          }
          const source = resolveSource(document, selection, scope);
          if (
            source.sizeBytes !== null &&
            source.sizeBytes > settings.limits.maxBytes
          ) {
            oversized++;
            continue;
          }
          if (
            listConversionRenditions(document, selection, inspections).some(
              (row) => row.current && row.completeness === "complete",
            )
          )
            converted++;
          else candidates.push(source);
        }
      }
      if (
        !page.nextCursor ||
        cursor === page.nextCursor ||
        !page.results.length
      )
        break;
      cursor = page.nextCursor;
    }
    const preview = {
      id: this.ports.newId(),
      scope,
      expiresAt: new Date(Date.parse(this.now()) + 900000).toISOString(),
      candidates,
      scanned,
      truncated,
      warnings: truncated
        ? [
            {
              code: "truncated",
              message: `This batch holds the first ${candidates.length} PDFs. Convert the rest after it ends.`,
            },
          ]
        : [],
    };
    if (converted) {
      preview.warnings.push({
        code: "already-converted",
        message:
          converted === 1
            ? "1 PDF already has Markdown, so it's skipped."
            : `${converted} PDFs already have Markdown, so they're skipped.`,
      });
    }
    if (arriving) {
      const item = scope.kind === "mail" ? "email" : "file";
      preview.warnings.push({
        code: "attachment-pending",
        message:
          arriving === 1
            ? `1 ${item} is still syncing, so it's skipped.`
            : `${arriving} ${item}s are still syncing, so they're skipped.`,
      });
    }
    if (oversized) {
      const limit = sizeText(settings.limits.maxBytes);
      preview.warnings.push({
        code: "too-large",
        message:
          oversized === 1
            ? `1 PDF is larger than this source's ${limit} limit, so it's skipped.`
            : `${oversized} PDFs are larger than this source's ${limit} limit, so they're skipped.`,
      });
    }
    await this.ports.store.savePreview(caller.identity, preview, input.profile);
    return preview;
  }
  async createBatch(
    caller: Caller,
    input: RequestConversionBatch,
    authorization?: string,
  ): Promise<ConversionBatch> {
    const id = `batch-${sha256Hex(`${caller.identity}:${input.requestId}`)}`;
    const existing = await this.ports.store.batch(id);
    if (existing) {
      if (existing.preview_id !== input.previewId)
        throw new ConversionRefusal(
          409,
          "request-conflict",
          "This batch was already started from a different list of PDFs. Open the dialog again to start a new batch.",
          false,
        );
      return this.batch(caller, id, authorization);
    }
    const stored = await this.ports.store.preview(input.previewId);
    if (!stored || stored.owner !== caller.identity) throw notFound();
    if (stored.preview.expiresAt < this.now())
      throw new ConversionRefusal(
        409,
        "preview-expired",
        "This list of PDFs is out of date. Open the dialog again to see the current list.",
        true,
      );
    this.enabled(await this.effectiveSettings());
    const binding = await this.owner(caller);
    const admission = this.batchAdmission.then(async () => {
      if (await this.ports.store.batch(id)) return false;
      const runs = await this.ports.workflows.runs(
        binding.workflow_id,
        authorization,
      );
      const active = runs.some((run) => {
        const parsed = submissionSchema.safeParse(run.triggerPayload);
        return (
          parsed.success &&
          !!parsed.data.batchId &&
          ["PENDING", "RUNNING", "WAITING"].includes(run.status)
        );
      });
      if (this.submittingBatches.size > 0 || active)
        throw new ConversionRefusal(
          409,
          "batch-running",
          "A batch is still running. Start the next one when it ends.",
          true,
        );
      const created = await this.ports.store.saveBatch({
        id,
        owner: caller.identity,
        preview_id: input.previewId,
        workflow_id: binding.workflow_id,
        created_at: this.now(),
      });
      if (created) this.submittingBatches.add(id);
      return created;
    });
    this.batchAdmission = admission.then(
      () => undefined,
      () => undefined,
    );
    const created = await admission;
    if (created) {
      try {
        const results = await Promise.allSettled(
          stored.preview.candidates.map((source) =>
            this.request(
              caller,
              {
                source: selectionOf(source),
                profile: stored.profile,
                intent: { kind: "ensure" },
              },
              authorization,
              id,
            ),
          ),
        );
        const rejected = results.find((result) => result.status === "rejected");
        if (
          results.every((result) => result.status === "rejected") &&
          rejected?.status === "rejected" &&
          rejected.reason instanceof WorkflowRuntimeError
        )
          throw rejected.reason;
      } finally {
        this.submittingBatches.delete(id);
      }
    }
    return this.batch(caller, id, authorization);
  }
  async batch(
    caller: Caller,
    id: string,
    authorization?: string,
  ): Promise<ConversionBatch> {
    const stored = await this.ports.store.batch(id);
    if (!stored || stored.owner !== caller.identity) throw notFound();
    const preview = await this.ports.store.preview(stored.preview_id);
    if (!preview) throw notFound();
    const runs = (
      await this.ports.workflows.runs(stored.workflow_id, authorization)
    ).filter((run) => {
      const parsed = submissionSchema.safeParse(run.triggerPayload);
      return parsed.success && parsed.data.batchId === id;
    });
    const active =
      this.submittingBatches.has(id) ||
      runs.some((run) =>
        ["PENDING", "RUNNING", "WAITING"].includes(run.status),
      );
    return {
      id,
      scope: preview.preview.scope,
      createdAt: stored.created_at,
      status: active
        ? "running"
        : runs.some((run) => run.status === "CANCELLED")
          ? "cancelled"
          : "complete",
      jobIds: runs.map((run) => run.id),
    };
  }
  async cancelBatch(
    caller: Caller,
    id: string,
    authorization?: string,
  ): Promise<ConversionBatch> {
    const batch = await this.batch(caller, id, authorization);
    for (const runId of batch.jobIds) {
      const view = await this.job(caller, runId, authorization);
      if (view.cancellable) {
        try {
          await this.cancel(caller, runId, authorization);
        } catch (error) {
          if (
            !(
              error instanceof ConversionRefusal &&
              error.code === "cannot-cancel-running"
            )
          )
            throw error;
        }
      }
    }
    return this.batch(caller, id, authorization);
  }
}
