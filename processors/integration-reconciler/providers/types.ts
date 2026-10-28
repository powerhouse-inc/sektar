/**
 * What a provider brings to an integration (integrations design §3a): the
 * connection to make, the live workflow's trigger and steps, and the steps a
 * backfill slice runs after the queue's for-every trigger. Everything else
 * (claiming, sign-in, queues, plugging, drift, health, teardown) is the
 * reconciler core's, the same for every kind.
 */
import type { IntegrationState } from "document-models/integration";
import type { DriftWords, StepSpec, TriggerSpec } from "../workflow-spec.js";

export type ConnectionSpec = {
  name: string;
  connectorId: string;
  config: Record<string, unknown>;
};

/** What the provider's workflows are built with. */
export type ProviderContext = {
  /** The integration's name */
  name: string;
  state: IntegrationState;
  /** The provider sign-in the reconciler made */
  connectionId: string;
  /** The switchboard's own connection, for steps that write documents */
  reactorConnectionId: string;
};

export interface ProviderAdapter {
  /** The integration's provider id, e.g. "google-calendar" */
  id: string;
  /** Whose sign-in, in words: "Google" */
  label: string;
  /** The connection to make; null when this setup cannot be served */
  connection(name: string, state: IntegrationState): ConnectionSpec | null;
  /** The live workflow: its name, trigger and steps */
  live(ctx: ProviderContext): {
    name: string;
    trigger: TriggerSpec;
    steps: StepSpec[];
    /** How a changed trigger config reads, e.g. "checked every hour, not every 15 minutes" */
    config: DriftWords["config"];
  };
  /** The steps one backfill slice runs; they read the window as {{trigger.payload.ranges.slice.from/to}} */
  backfillSteps(ctx: ProviderContext): StepSpec[];
}
