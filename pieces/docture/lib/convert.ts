/**
 * Convert PDF to Markdown, as the workflow step does it: read the PDF it is
 * given in this process with Docture, store the Markdown and a manifest as
 * files, and hand on references to them with the page outcomes.
 *
 * The step knows nothing about where the PDF came from or where the Markdown
 * goes; Sektar's own steps choose the source and publish the rendition.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  attachmentRefSchema,
  conversionProfileSchema,
  defaultConversionProfile,
  localOcrEngineSchema,
  executableConversionPlanSchema,
  type ArtifactDescriptor,
  type ConversionProfile,
  type ConversionUsage,
  type ExecutableConversionPlan,
} from "../../../conversions/contracts.js";
import {
  probeEngines,
  type EngineProbe,
} from "../../../conversions/engine/engines.js";
import {
  planFingerprint,
  resolvePlan,
  type IntegratedModelStatus,
} from "../../../conversions/engine/plan.js";
import { runConversion } from "../../../conversions/engine/run.js";
import {
  DEFAULT_DOCTURE_LIMITS,
  DOCTURE_MANIFEST_KIND,
  doctureLimitsInputSchema,
  type DoctureConversionOutput,
  type DoctureLimits,
  type DoctureManifest,
} from "./contracts.js";
import {
  DEFAULT_LOCAL_OCR,
  parseLanguages,
  READING_METHODS,
  withAiLayout,
  withMethod,
  withRecognition,
  type LocalOcr,
} from "./profile.js";

/* ----------------------------------------------------------------- errors */

/** The step's inputs name no valid reading, plan or limits. */
export class ConversionInputError extends Error {
  override readonly name = "ConversionInputError";
}

/** Some pages could not be read, and the step was not told to continue with that. */
export class ConversionIncompleteError extends Error {
  override readonly name = "ConversionIncompleteError";
}

/** The host stored a file but did not answer with an attachment reference. */
export class ArtifactStoreError extends Error {
  override readonly name = "ArtifactStoreError";
}

/* ------------------------------------------------------------------ input */

/** The step's properties, as the workflow hands them over. */
export interface ConvertProps {
  method?: unknown;
  recognition?: unknown;
  languages?: unknown;
  paddleModel?: unknown;
  aiLayout?: unknown;
  pages?: unknown;
  onIncomplete?: unknown;
  resolvedPlan?: unknown;
  limits?: unknown;
}

/** What recognizes pages when Smart falls back to the integrated model. */
export const INTEGRATED_AI = "ai";

/**
 * A workflow step has no way to reach Sektar's integrated model yet: the
 * workflow runtime offers pieces no host AI capability, and a step must not
 * call a provider with credentials of its own.
 */
export const WORKFLOW_AI: IntegratedModelStatus = {
  kind: "unavailable",
  reason: "Workflow steps cannot reach Sektar's integrated model yet.",
  setup:
    "Choose Digital only, OCR, or Smart with local OCR, and leave AI layout off.",
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** "1-3, 7" as the pages to convert; empty is every page. */
export function pagesOf(value: unknown): ConversionProfile["pages"] {
  const asked = text(value);
  if (!asked) return { kind: "all" };
  const pages = new Set<number>();
  for (const part of asked.split(/[\s,;]+/).filter(Boolean)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    const first = Number(match?.[1]);
    const last = Number(match?.[2] ?? match?.[1]);
    if (
      !match ||
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first < 1 ||
      last < first ||
      last - first >= 10000
    ) {
      throw new ConversionInputError(
        `"${part}" is not a page or a range of pages, such as 3 or 1-5.`,
      );
    }
    for (let page = first; page <= last; page += 1) pages.add(page);
  }
  return { kind: "selected", pages: [...pages].sort((a, b) => a - b) };
}

/** The reading the step's form asks for. */
export function profileOf(props: ConvertProps): ConversionProfile {
  const asked = text(props.method) || "smart";
  const method = READING_METHODS.find((candidate) => candidate === asked);
  if (!method) {
    throw new ConversionInputError(`"${asked}" is not a reading method.`);
  }
  const recognition = text(props.recognition) || DEFAULT_LOCAL_OCR.engine;
  const engine = localOcrEngineSchema.safeParse(recognition);
  const recognizes = method === "smart" || method === "ocr";
  if (recognizes && !engine.success) {
    if (recognition !== INTEGRATED_AI) {
      throw new ConversionInputError(
        `"${recognition}" is not something that recognizes pages.`,
      );
    }
    if (method === "ocr") {
      throw new ConversionInputError(
        "OCR recognizes pages with a local engine. Choose Tesseract or PaddleOCR, or the AI transcription method.",
      );
    }
  }
  const languages = parseLanguages(text(props.languages));
  const paddleModel = text(props.paddleModel);
  const ocr: LocalOcr = {
    kind: "ocr",
    engine: engine.success ? engine.data : DEFAULT_LOCAL_OCR.engine,
    languages:
      languages.length > 0 ? languages : [...DEFAULT_LOCAL_OCR.languages],
    ...(engine.success && engine.data === "paddleocr" && paddleModel
      ? { model: paddleModel }
      : {}),
  };
  let profile = withMethod(
    { ...defaultConversionProfile, reading: { kind: "digital" } },
    method,
    ocr,
  );
  if (method === "smart") {
    profile = withRecognition(
      profile,
      engine.success ? engine.data : INTEGRATED_AI,
      ocr.languages,
    );
  }
  profile = withAiLayout(profile, props.aiLayout === true);
  const valid = conversionProfileSchema.safeParse({
    ...profile,
    pages: pagesOf(props.pages),
  });
  if (!valid.success) {
    throw new ConversionInputError(
      `The reading options are not valid: ${z.prettifyError(valid.error)}`,
    );
  }
  return valid.data;
}

function jsonInput(value: unknown, label: string): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new ConversionInputError(`${label} is not JSON.`);
  }
}

const absent = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "");

/**
 * The plan the step reads with: the pinned plan when one is given, otherwise
 * the form's reading pinned to the engines installed now.
 */
export function planOf(
  props: ConvertProps,
  probe: EngineProbe,
): ExecutableConversionPlan {
  if (absent(props.resolvedPlan)) {
    return resolvePlan(profileOf(props), { probe, integrated: WORKFLOW_AI });
  }
  const parsed = executableConversionPlanSchema.safeParse(
    jsonInput(props.resolvedPlan, "Resolved plan"),
  );
  if (!parsed.success) {
    throw new ConversionInputError(
      `Resolved plan is not a conversion plan: ${z.prettifyError(parsed.error)}`,
    );
  }
  if (planFingerprint(parsed.data) !== parsed.data.fingerprint) {
    throw new ConversionInputError(
      "Resolved plan was changed after it was resolved: its fingerprint does not match.",
    );
  }
  return parsed.data;
}

export function limitsOf(props: ConvertProps): DoctureLimits {
  if (absent(props.limits)) return DEFAULT_DOCTURE_LIMITS;
  const parsed = doctureLimitsInputSchema.safeParse(
    jsonInput(props.limits, "Limits"),
  );
  if (!parsed.success) {
    throw new ConversionInputError(
      `Limits are not valid: ${z.prettifyError(parsed.error)}`,
    );
  }
  return { ...DEFAULT_DOCTURE_LIMITS, ...parsed.data };
}

/* ----------------------------------------------------------------- output */

/** Where the step stores its files: the workflow's `ctx.files`. */
export interface ArtifactStore {
  upload(file: { fileName: string; data: Buffer }): Promise<{ id: string }>;
}

async function store(
  files: ArtifactStore,
  role: ArtifactDescriptor["role"],
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<ArtifactDescriptor> {
  const uploaded = await files.upload({ fileName, data });
  const ref = attachmentRefSchema.safeParse(uploaded.id);
  if (!ref.success) {
    throw new ArtifactStoreError(
      `The workflow stored ${fileName} without an attachment reference, so later steps could not read it.`,
    );
  }
  const digest = createHash("sha256").update(data).digest("hex");
  return {
    id: `${role}-${digest.slice(0, 16)}`,
    role,
    ref: ref.data,
    fileName,
    mimeType,
    sizeBytes: data.byteLength,
  };
}

function stemOf(fileName: string): string {
  const stem = fileName.replace(/\.pdf$/i, "").trim();
  return stem || "document";
}

const NO_AI_USAGE: ConversionUsage = {
  kind: "known",
  inputTokens: 0,
  outputTokens: 0,
  requests: 0,
  aiPages: 0,
  costUsd: 0,
};

/** The pages named in a sentence, the first few of a long list. */
function pagesText(pages: readonly number[]): string {
  const NAMED = 12;
  const named = pages.slice(0, NAMED).join(", ");
  return pages.length > NAMED
    ? `${named} and ${pages.length - NAMED} more`
    : named;
}

/* ------------------------------------------------------------------- step */

export interface ConvertPdfInput {
  readonly file: { readonly filename: string; readonly data: Buffer };
  readonly props: ConvertProps;
  readonly files: ArtifactStore;
  readonly signal?: AbortSignal;
}

/**
 * Converts the PDF and stores what came of it. A step that would hand on a
 * partial result without being told to fails before anything is stored.
 */
export async function convertPdf(
  input: ConvertPdfInput,
): Promise<DoctureConversionOutput> {
  const { file, props, files } = input;
  const limits = limitsOf(props);
  if (file.data.byteLength > limits.maxBytes) {
    throw new ConversionInputError(
      `${file.filename} is ${file.data.byteLength} bytes; this step converts at most ${limits.maxBytes}.`,
    );
  }
  const plan = planOf(props, probeEngines());
  const bundle = await runConversion(
    {
      bytes: new Uint8Array(file.data),
      fileName: file.filename,
      plan,
      maxPages: limits.maxPages,
      maxDurationMs: limits.maxDurationMs,
    },
    input.signal ?? new AbortController().signal,
  );
  const unread = bundle.pages
    .filter((page) => page.status === "unresolved" || page.status === "failed")
    .map((page) => page.page);
  if (unread.length > 0 && text(props.onIncomplete) !== "continue") {
    throw new ConversionIncompleteError(
      `${unread.length} of ${bundle.pages.length} pages of ${file.filename} could not be read (${unread.length === 1 ? "page" : "pages"} ${pagesText(unread)}). Choose "Continue with a partial result" to pass on the rest.`,
    );
  }
  const completeness = unread.length > 0 ? "partial" : "complete";
  const stem = stemOf(file.filename);
  const markdown = await store(
    files,
    "markdown",
    `${stem}.md`,
    "text/markdown",
    Buffer.from(bundle.markdown, "utf8"),
  );
  const manifestBody: DoctureManifest = {
    kind: DOCTURE_MANIFEST_KIND,
    version: 2,
    sourceFileName: file.filename,
    plan,
    completeness,
    documentPages: bundle.documentPages,
    pages: [...bundle.pages],
    provenance: [...bundle.provenance],
    warnings: [...bundle.warnings],
    usage: NO_AI_USAGE,
    markdown,
  };
  const manifest = await store(
    files,
    "manifest",
    `${stem}.conversion.json`,
    "application/json",
    Buffer.from(`${JSON.stringify(manifestBody, null, 2)}\n`, "utf8"),
  );
  return {
    markdown,
    artifacts: [manifest],
    completeness,
    pages: manifestBody.pages,
    warnings: manifestBody.warnings,
    provenance: manifestBody.provenance,
    usage: NO_AI_USAGE,
    plan,
    documentPages: bundle.documentPages,
  };
}
