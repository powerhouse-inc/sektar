/**
 * The app-wide managed conversion workflow, as data: a native
 * document-event trigger on the sources' storing operations, then Resolve
 * (Sektar) → is it a PDF to convert → is its Markdown already saved → checked extraction
 * → Publish (Sektar). The same flow is fired by hand for a manual request.
 * Settings stay in Sektar's settings store; nothing here is a workflow
 * variable. Pure.
 */
import { actions as wf } from "@powerhousedao/workflow/document-models/workflow";
import { CORE_PIECE_NAME } from "@powerhousedao/pieces-framework/workflow";
import type { ConversionSettings } from "../contracts.js";

export const SEKTAR_PDF_PIECE = "@powerhousedao/sektar-pdf-piece";
export const SEKTAR_PDF_ACTIONS = {
  resolve: "resolve-pdf",
  publish: "publish-rendition",
  convert: "convert-pdf",
} as const;
export const DOCTURE_PIECE = "@powerhousedao/docture-piece";
/** This package's version: its pieces (pieces/index.ts) are published with it. */
export const SEKTAR_PIECE_VERSION = "1.0.9";
/**
 * The core and reactor pieces ship with the runtime and need its exact
 * version. The runtime's CORE_PIECE_VERSION is not importable here
 * (reactor-workflow is not a dependency of this package); a test pins this to
 * the installed host-shipped pieces.
 */
export const RUNTIME_PIECE_VERSION = "6.3.0-dev.2";
export const REACTOR_PIECE = "@powerhousedao/piece-reactor";
export const DOCUMENT_EVENT_TRIGGER = "document-event";

export const STEP_KEYS = {
  resolve: "resolve",
  isReady: "is_ready",
  hasSaved: "has_saved_markdown",
  convert: "convert",
  publish: "publish",
} as const;

const NO_RETRY = {
  maxAttempts: 1,
  backoff: "FIXED" as const,
  initialDelaySeconds: 0,
  maxDelaySeconds: 0,
  retryOn: [],
};

/** Longest conversion a host allows (HOST_LIMITS.maxDurationMs), and room to prepare and publish. */
const CONVERT_SECONDS = 2 * 60 * 60;
const DOMAIN_STEP_SECONDS = 5 * 60;

/**
 * One run at a time across the app, in order; no automatic retry, since a rerun is
 * an explicit request; a failed run is logged and does not park the trigger.
 */
export const CONVERSION_POLICY = {
  concurrency: "QUEUE" as const,
  defaultRetry: NO_RETRY,
  onFailure: "NOTIFY" as const,
  runTimeoutSeconds: CONVERT_SECONDS + 3 * DOMAIN_STEP_SECONDS,
};

export type WorkflowAction = ReturnType<
  | typeof wf.setWorkflowName
  | typeof wf.setWorkflowDescription
  | typeof wf.setWorkflowStatus
  | typeof wf.setTrigger
  | typeof wf.clearTrigger
  | typeof wf.addStep
  | typeof wf.removeStep
  | typeof wf.addEdge
  | typeof wf.removeEdge
  | typeof wf.publishWorkflow
  | typeof wf.setManagedBy
  | typeof wf.setPolicy
>;

export interface StepDefinition {
  readonly key: string;
  readonly name: string;
  readonly pieceName: string;
  readonly pieceVersion: string;
  readonly actionName: string;
  readonly config: Record<string, unknown>;
  readonly reactorConnectionId: string | null;
  readonly timeoutSeconds: number;
}

export interface EdgeDefinition {
  /** A step key, or null for the trigger. */
  readonly from: string | null;
  readonly to: string;
  readonly port: string;
}

export interface ConversionWorkflowSpec {
  readonly name: string;
  readonly description: string;
  readonly workflowsDriveId: string;
  readonly enabled: boolean;
  readonly trigger: {
    readonly pieceName: string;
    readonly pieceVersion: string;
    readonly triggerName: string;
    readonly config: Record<string, unknown>;
  };
  readonly steps: readonly StepDefinition[];
  readonly edges: readonly EdgeDefinition[];
}

const output = (path: string) =>
  `{{steps.${STEP_KEYS.resolve}.output.${path}}}`;
const converted = (path: string) =>
  `{{steps.${STEP_KEYS.convert}.output.${path}}}`;

export function conversionWorkflowSpec(input: {
  workflowsDriveId: string;
  activation: ConversionSettings["activation"];
  reactorConnectionId: string;
}): ConversionWorkflowSpec {
  const { workflowsDriveId, reactorConnectionId } = input;
  const domain = (
    key: string,
    name: string,
    actionName: string,
    config: Record<string, unknown>,
  ): StepDefinition => ({
    key,
    name,
    pieceName: SEKTAR_PDF_PIECE,
    pieceVersion: SEKTAR_PIECE_VERSION,
    actionName,
    config,
    reactorConnectionId,
    timeoutSeconds: DOMAIN_STEP_SECONDS,
  });
  const branch = (
    key: string,
    name: string,
    config: Record<string, unknown>,
  ): StepDefinition => ({
    key,
    name,
    pieceName: CORE_PIECE_NAME,
    pieceVersion: RUNTIME_PIECE_VERSION,
    actionName: "branch",
    config,
    reactorConnectionId: null,
    timeoutSeconds: 30,
  });
  return {
    name: "Document conversion",
    description:
      "Converts PDFs in Files and Mail using the app-wide Document conversion settings. Kept by Sektar.",
    workflowsDriveId,
    enabled: input.activation !== "off",
    trigger:
      input.activation === "automatic"
        ? {
            pieceName: REACTOR_PIECE,
            pieceVersion: RUNTIME_PIECE_VERSION,
            triggerName: DOCUMENT_EVENT_TRIGGER,
            config: {
              documentType: ["sektar/file", "sektar/email"],
              actionType: [
                "SET_ATTACHMENT_SOURCE",
                "APPLY_DISK_VERSION",
                "ADD_ATTACHMENT",
              ],
            },
          }
        : {
            pieceName: CORE_PIECE_NAME,
            pieceVersion: RUNTIME_PIECE_VERSION,
            triggerName: "manual",
            config: {},
          },
    steps: [
      domain(
        STEP_KEYS.resolve,
        "Resolve Sektar PDF",
        SEKTAR_PDF_ACTIONS.resolve,
        {
          request: "{{trigger.payload}}",
        },
      ),
      branch(STEP_KEYS.isReady, "Is there a PDF to convert?", {
        operator: "TEXT_EXACTLY_MATCHES",
        left: output("kind"),
        right: "ready",
        caseSensitive: true,
      }),
      branch(STEP_KEYS.hasSaved, "Is its Markdown already saved?", {
        operator: "EXISTS",
        left: output("reuse"),
      }),
      {
        key: STEP_KEYS.convert,
        name: "Convert PDF to Markdown",
        pieceName: SEKTAR_PDF_PIECE,
        pieceVersion: SEKTAR_PIECE_VERSION,
        actionName: SEKTAR_PDF_ACTIONS.convert,
        config: {
          file: output("file"),
          prepared: `{{steps.${STEP_KEYS.resolve}.output}}`,
        },
        reactorConnectionId,
        timeoutSeconds: CONVERT_SECONDS,
      },
      domain(
        STEP_KEYS.publish,
        "Save the Markdown",
        SEKTAR_PDF_ACTIONS.publish,
        {
          prepared: `{{steps.${STEP_KEYS.resolve}.output}}`,
          conversion: `{{steps.${STEP_KEYS.convert}.output}}`,
          markdownFile: converted("markdown.ref"),
          manifestFile: converted("artifacts.0.ref"),
        },
      ),
    ],
    edges: [
      { from: null, to: STEP_KEYS.resolve, port: "next" },
      { from: STEP_KEYS.resolve, to: STEP_KEYS.isReady, port: "next" },
      { from: STEP_KEYS.isReady, to: STEP_KEYS.hasSaved, port: "true" },
      { from: STEP_KEYS.hasSaved, to: STEP_KEYS.convert, port: "false" },
      { from: STEP_KEYS.convert, to: STEP_KEYS.publish, port: "next" },
    ],
  };
}

/** The document that keeps the workflow: the Workflows drive. Studio shows it read-only. */
export function managedByOf(spec: ConversionWorkflowSpec) {
  return {
    documentId: spec.workflowsDriveId,
    documentType: "powerhouse/document-drive",
    label: spec.name,
  };
}

function definitionActions(
  spec: ConversionWorkflowSpec,
  newId: () => string,
): WorkflowAction[] {
  const triggerId = newId();
  const ids = new Map(spec.steps.map((step) => [step.key, newId()]));
  const idOf = (key: string) => {
    const id = ids.get(key);
    if (!id) throw new Error(`No step ${key} in the conversion workflow`);
    return id;
  };
  return [
    wf.setTrigger({ id: triggerId, ...spec.trigger }),
    ...spec.steps.map((step) =>
      wf.addStep({
        id: idOf(step.key),
        key: step.key,
        name: step.name,
        pieceName: step.pieceName,
        pieceVersion: step.pieceVersion,
        actionName: step.actionName,
        config: step.config,
        timeoutSeconds: step.timeoutSeconds,
        ...(step.reactorConnectionId
          ? { reactorConnectionId: step.reactorConnectionId }
          : {}),
      }),
    ),
    ...spec.edges.map((edge) =>
      wf.addEdge({
        id: newId(),
        from: edge.from === null ? triggerId : idOf(edge.from),
        to: idOf(edge.to),
        port: edge.port,
      }),
    ),
    wf.setPolicy(CONVERSION_POLICY),
  ];
}

const statusAction = (spec: ConversionWorkflowSpec) =>
  wf.setWorkflowStatus({ status: spec.enabled ? "ENABLED" : "DISABLED" });

/** Everything a new workflow document needs, publish and status last. */
export function buildConversionWorkflow(
  spec: ConversionWorkflowSpec,
  newId: () => string,
  now: string,
): WorkflowAction[] {
  return [
    wf.setWorkflowName({ name: spec.name }),
    wf.setWorkflowDescription({ description: spec.description }),
    wf.setManagedBy(managedByOf(spec)),
    ...definitionActions(spec, newId),
    wf.publishWorkflow({ publishedAt: now }),
    statusAction(spec),
  ];
}

/* ------------------------------------------------------------- reading */

/** The published workflow, reduced to what the spec decides. */
export interface ConversionWorkflowFacts {
  readonly status: string;
  readonly version: number;
  readonly publishedVersion: number | null;
  /** The draft's step and edge ids, to replace the definition in place. */
  readonly draft: {
    readonly stepIds: readonly string[];
    readonly edgeIds: readonly string[];
  };
  /** The published definition in spec form; null: never published or unreadable. */
  readonly published: Omit<ConversionWorkflowSpec, "workflowsDriveId"> | null;
  readonly policy: Record<string, unknown> | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const ids = (value: unknown): string[] =>
  list(value).flatMap((entry) =>
    isRecord(entry) && typeof entry.id === "string" ? [entry.id] : [],
  );

/** Reads a workflow document's global state; nothing in it is trusted to have a shape. */
export function readConversionWorkflowFacts(
  global: unknown,
): ConversionWorkflowFacts {
  const state = isRecord(global) ? global : {};
  const published = isRecord(state.published) ? state.published : null;
  const draft = { stepIds: ids(state.steps), edgeIds: ids(state.edges) };
  if (!published) {
    return {
      status: stringOr(state.status, "DISABLED"),
      version: typeof state.version === "number" ? state.version : 0,
      publishedVersion: null,
      draft,
      published: null,
      policy: null,
    };
  }
  const steps = list(published.steps).filter(isRecord);
  const keyOf = new Map(
    steps.map((step) => [stringOr(step.id, ""), stringOr(step.key, "")]),
  );
  const trigger = isRecord(published.trigger) ? published.trigger : null;
  return {
    status: stringOr(state.status, "DISABLED"),
    version: typeof state.version === "number" ? state.version : 0,
    publishedVersion:
      typeof published.version === "number" ? published.version : null,
    draft,
    policy: isRecord(published.policy) ? published.policy : null,
    published: {
      name: stringOr(state.name, ""),
      description: stringOr(state.description, ""),
      enabled: state.status === "ENABLED",
      trigger: {
        pieceName: stringOr(trigger?.pieceName, ""),
        pieceVersion: stringOr(trigger?.pieceVersion, ""),
        triggerName: stringOr(trigger?.triggerName, ""),
        config: isRecord(trigger?.config) ? trigger.config : {},
      },
      steps: steps.map((step) => ({
        key: stringOr(step.key, ""),
        name: stringOr(step.name, ""),
        pieceName: stringOr(step.pieceName, ""),
        pieceVersion: stringOr(step.pieceVersion, ""),
        actionName: stringOr(step.actionName, ""),
        config: isRecord(step.config) ? step.config : {},
        reactorConnectionId:
          typeof step.reactorConnectionId === "string"
            ? step.reactorConnectionId
            : null,
        timeoutSeconds:
          typeof step.timeoutSeconds === "number" ? step.timeoutSeconds : 0,
      })),
      edges: list(published.edges)
        .filter(isRecord)
        .map((edge) => ({
          from: keyOf.get(stringOr(edge.from, "")) ?? null,
          to: keyOf.get(stringOr(edge.to, "")) ?? "",
          port: stringOr(edge.port, ""),
        })),
    },
  };
}

/* --------------------------------------------------------------- drift */

export const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sorted(entry)]),
    );
  }
  return value;
}

const definitionOf = (
  spec: Omit<ConversionWorkflowSpec, "workflowsDriveId">,
) => ({
  trigger: spec.trigger,
  steps: spec.steps,
  edges: [...spec.edges].sort((a, b) =>
    `${a.from ?? ""}>${a.to}`.localeCompare(`${b.from ?? ""}>${b.to}`),
  ),
});

function policyDiffers(policy: Record<string, unknown> | null): boolean {
  if (!policy) return true;
  return Object.entries(CONVERSION_POLICY).some(
    ([key, value]) => !sameJson(policy[key], value),
  );
}

export interface ConversionDrift {
  /** In words, for a log. */
  readonly differences: readonly string[];
  /** Includes a publish when `republish`; signs nothing itself. */
  readonly actions: readonly WorkflowAction[];
  readonly republish: boolean;
}

/**
 * What to change so the published workflow is the spec again. A different
 * definition is replaced whole, in place: the draft is cleared, rebuilt, and
 * published. `forcePublish` republishes an unchanged one, which is how a new
 * authorizer becomes the run user.
 */
export function conversionWorkflowDrift(
  spec: ConversionWorkflowSpec,
  facts: ConversionWorkflowFacts,
  newId: () => string,
  now: string,
  forcePublish = false,
): ConversionDrift {
  if (!spec.enabled)
    return {
      differences:
        facts.status === "DISABLED" ? [] : ["conversion is off for the app"],
      actions: facts.status === "DISABLED" ? [] : [statusAction(spec)],
      republish: false,
    };
  const differences: string[] = [];
  const actions: WorkflowAction[] = [];
  const unpublished =
    facts.publishedVersion === null || facts.publishedVersion !== facts.version;
  const definitionChanged =
    unpublished ||
    !facts.published ||
    !sameJson(definitionOf(facts.published), definitionOf(spec));
  if (definitionChanged) {
    differences.push(
      facts.published
        ? "the conversion workflow's steps were changed"
        : "the conversion workflow was never published",
    );
    actions.push(
      ...facts.draft.edgeIds.map((id) => wf.removeEdge({ id })),
      ...facts.draft.stepIds.map((id) => wf.removeStep({ id })),
      wf.clearTrigger({}),
      ...definitionActions(spec, newId),
    );
  } else if (policyDiffers(facts.policy)) {
    differences.push(
      "the conversion workflow ran under another queue or retry policy",
    );
    actions.push(wf.setPolicy(CONVERSION_POLICY));
  }
  if (facts.published && facts.published.name !== spec.name) {
    actions.unshift(wf.setWorkflowName({ name: spec.name }));
  }
  const republish = actions.length > 0 || unpublished || forcePublish;
  if (republish) {
    if (actions.length === 0 && unpublished)
      differences.push("the conversion workflow had unpublished changes");
    if (actions.length === 0 && !unpublished)
      differences.push(
        "the conversion workflow is published again by its authorizer",
      );
    actions.push(wf.publishWorkflow({ publishedAt: now }));
  }
  if (facts.status !== "ENABLED") {
    differences.push("the conversion workflow was off");
    actions.push(statusAction(spec));
  }
  return { differences, actions, republish };
}
