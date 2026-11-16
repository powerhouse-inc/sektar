import { z } from "zod";
import {
  conversionProfileSchema,
  requestConversionSchema,
  resolvedSourceSchema,
  resolvedConversionPlanSchema,
  type ConversionJobView,
  type ConversionProblem,
} from "../contracts.js";
import {
  preparedPdfSchema,
  publishedPdfSchema,
} from "../../pieces/sektar-pdf/lib/contracts.js";
import type {
  ConversionProfile,
  ResolvedConversionPlan,
  ResolvedRecognition,
} from "../contracts.js";
function profileOfPlan(plan: ResolvedConversionPlan): ConversionProfile {
  const recognition = ({ engine, languages, model }: ResolvedRecognition) => ({
    kind: "ocr" as const,
    engine,
    languages,
    ...(model ? { model } : {}),
  });
  const r = plan.reading;
  return {
    reading:
      r.kind === "digital"
        ? { kind: "digital" }
        : r.kind === "smart"
          ? { kind: "smart", fallback: recognition(r.fallback) }
          : { kind: "recognize", engine: recognition(r.engine) },
    pages: plan.pages,
  };
}

export const submissionSchema = z.object({
  admissionKey: z.string().optional(),
  documentId: z.string().optional(),
  request: requestConversionSchema,
  admitted: z.object({
    source: resolvedSourceSchema,
    profile: conversionProfileSchema,
    plan: resolvedConversionPlanSchema,
  }),
  batchId: z.string().optional(),
});
export interface NativeRun {
  id: string;
  workflowId: string;
  status: string;
  triggerPayload?: unknown;
  startedAt: string;
  endedAt?: string | null;
  error?: string | null;
  errorName?: string | null;
  steps: readonly {
    stepKey: string;
    status: string;
    output?: unknown;
    error?: string | null;
    errorName?: string | null;
  }[];
}

/**
 * The errors whose messages Sektar's steps write for the person converting
 * (pieces/sektar-pdf, conversions/engine). Any other step or runtime error is
 * shown as a plain sentence, with its own text kept as the detail.
 */
const PERSON_READABLE_ERRORS: ReadonlySet<string> = new Set([
  "SektarPdfRefusal",
  "ExecutionFailure",
  "PlanRefusal",
]);
const RUN_DEADLINE_EXCEEDED = "RunDeadlineExceeded";
const NOT_SAVED =
  "The conversion stopped before its Markdown was saved. Try again.";

function failureOf(run: NativeRun): ConversionProblem {
  const step = run.steps.find((candidate) => candidate.error);
  const failure = step ?? run;
  if (
    failure.error &&
    failure.errorName &&
    PERSON_READABLE_ERRORS.has(failure.errorName)
  )
    return {
      code: "workflow-failed",
      message: failure.error,
      retryable: true,
      ...(run.error && run.error !== failure.error
        ? { detail: run.error }
        : {}),
    };
  const skipped = run.steps
    .map((candidate) => preparedPdfSchema.safeParse(candidate.output))
    .find((item) => item.success && item.data.kind === "skip");
  const message =
    skipped?.success && skipped.data.kind === "skip"
      ? skipped.data.reason
      : NOT_SAVED;
  const detail = run.error ?? step?.error;
  return {
    code: "workflow-failed",
    message,
    retryable: true,
    ...(detail ? { detail } : {}),
  };
}
export function viewOfRun(run: NativeRun): ConversionJobView | null {
  const submission = submissionSchema.safeParse(run.triggerPayload);
  const prepared = run.steps
    .map((step) => preparedPdfSchema.safeParse(step.output))
    .find((item) => item.success && item.data.kind === "ready");
  const ready =
    prepared?.success && prepared.data.kind === "ready" ? prepared.data : null;
  const admitted = submission.success ? submission.data.admitted : null;
  const source = ready?.source ?? admitted?.source;
  const plan = ready?.plan ?? admitted?.plan;
  if (!source || !plan) return null;
  const result = run.steps
    .map((step) => publishedPdfSchema.safeParse(step.output))
    .find((item) => item.success && item.data.kind !== "skip");
  const saved =
    result?.success && result.data.kind !== "skip"
      ? result.data.result
      : ready?.reuse;
  const base = {
    id: run.id,
    workflowId: run.workflowId,
    source,
    plan,
    profile: ready
      ? profileOfPlan(plan)
      : (admitted?.profile ?? profileOfPlan(plan)),
    trigger: submission.success
      ? submission.data.batchId
        ? ("batch" as const)
        : ("manual" as const)
      : ("automatic" as const),
    createdAt: run.startedAt,
    updatedAt: run.endedAt ?? run.startedAt,
    warnings: saved?.warnings ?? [],
    cancellable: run.status === "PENDING" || run.status === "WAITING",
  };
  if (run.status === "CANCELLED")
    return {
      ...base,
      status: "cancelled",
      reason:
        run.errorName === RUN_DEADLINE_EXCEEDED
          ? "The conversion took too long and was stopped. Try converting fewer pages at a time."
          : run.error?.startsWith("Skipped:")
            ? "Sektar was too busy to start this conversion, so it was skipped. Try again in a moment."
            : "The conversion was cancelled.",
    };
  if (run.status === "SUCCEEDED" && saved)
    return { ...base, status: saved.completeness, result: saved };
  if (run.status === "FAILED" || run.status === "SUCCEEDED")
    return { ...base, status: "failed", error: failureOf(run) };
  if (run.status === "PENDING" || run.status === "WAITING")
    return { ...base, status: "queued" };
  const publishing = run.steps.some(
    (step) => step.stepKey === "publish" && step.status === "RUNNING",
  );
  return {
    ...base,
    status: publishing ? "publishing" : "running",
    progress: {
      stage: publishing ? "finalizing" : "reading",
      completedPages: null,
      totalPages: null,
    },
  };
}
