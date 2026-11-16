import type {
  ConversionWarning,
  EngineProvenance,
  PageOutcome,
  ResolvedConversionPlan,
} from "../contracts.js";

export interface ExecutionRequest {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly plan: ResolvedConversionPlan;
  readonly maxPages: number;
  readonly maxDurationMs: number;
}

export interface ArtifactBundle {
  readonly markdown: string;
  /** One outcome per requested page, ascending. */
  readonly pages: readonly PageOutcome[];
  readonly provenance: readonly EngineProvenance[];
  readonly warnings: readonly ConversionWarning[];
  readonly documentPages: number;
}

export const executionFailureCodes = [
  "encrypted",
  "damaged",
  "too-many-pages",
  "page-out-of-range",
  "no-content",
  "blank-document",
  "engine-unavailable",
  "timeout",
  "cancelled",
  "internal",
] as const;
export type ExecutionFailureCode = (typeof executionFailureCodes)[number];

/** A conversion that could not finish. `message` is a sentence for a person; `detail` is for support. */
export class ExecutionFailure extends Error {
  readonly code: ExecutionFailureCode;
  readonly detail: string | undefined;
  constructor(code: ExecutionFailureCode, message: string, detail?: string) {
    super(message);
    this.name = "ExecutionFailure";
    this.code = code;
    this.detail = detail;
  }
}

export function isExecutionFailureCode(
  value: unknown,
): value is ExecutionFailureCode {
  return (
    typeof value === "string" &&
    (executionFailureCodes as readonly string[]).includes(value)
  );
}
