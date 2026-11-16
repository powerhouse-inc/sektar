// Conversion as the Files, Mail and Settings surfaces show it: the words for a
// method, a profile, a job's progress, page coverage and usage, which choices
// this host cannot run and why. Pure
// functions over the shared contract (conversions/contracts.ts); the profile
// edits themselves are the workflow step's (pieces/docture/lib/profile.ts).
import {
  defaultConversionProfile,
  isTerminalConversion,
  type ConversionCapabilities,
  type ConversionCompleteness,
  type ConversionJobView,
  type ConversionLimits,
  type ConversionSettings,
  type ConversionScope,
  type ConversionProfile,
  type ConversionProgress,
  type ConversionUsage,
  type ConversionWarning,
  type LocalOcrEngine,
  type PageOutcome,
  type RecognitionSelection,
  type ResolvedConversionPlan,
  type ResolvedRecognition,
  type SourceSelection,
} from "../../../conversions/contracts.js";
import {
  DEFAULT_LOCAL_OCR,
  localOcrOf,
  methodOf,
  oneOffProfile,
  withMethod,
  type LocalOcr,
  type ReadingMethod,
} from "../../../pieces/docture/lib/profile.js";
import { plural } from "./format.js";

/* ------------------------------------------------------------------ words */

/** A reading method by what it does for the person, not by the technique behind it. */
export const METHOD_LABEL: Record<ReadingMethod, string> = {
  smart: "Standard",
  digital: "Text only",
  ocr: "Scan every page",
  ai: "AI transcription",
};

export const METHOD_HELP: Record<ReadingMethod, string> = {
  smart:
    "Works for most PDFs. Copies the text in the PDF and reads pages that are pictures, like scanned paper.",
  digital:
    "Fastest. Copies only the text in the PDF and skips pages that are pictures, like scanned paper.",
  ocr: "Slower. Reads every page as a picture. Try it when text comes out jumbled or in the wrong order.",
  ai: "An AI model reads each page as a picture. It can misread or leave out words.",
};

/**
 * What a choice trades, as its card shows it: a rating of 1 to 5 against the
 * other choices of the same field, or a word. Comparisons, not measurements.
 */
export type ChoiceFact =
  | { label: string; level: number }
  | { label: string; text: string };

export const METHOD_FACTS: Record<ReadingMethod, readonly ChoiceFact[]> = {
  smart: [
    { label: "Speed", level: 3 },
    { label: "Scanned paper", text: "Read" },
  ],
  digital: [
    { label: "Speed", level: 5 },
    { label: "Scanned paper", text: "Skipped" },
  ],
  ocr: [
    { label: "Speed", level: 1 },
    { label: "Scanned paper", text: "Read" },
  ],
  ai: [
    { label: "Speed", level: 1 },
    { label: "Scanned paper", text: "Read" },
  ],
};

export type Activation = ConversionSettings["activation"];

export const ACTIVATION_LABEL: Record<Activation, string> = {
  off: "Off",
  manual: "When I ask",
  automatic: "Automatically",
};

export const ACTIVATION_HELP: Record<Activation, string> = {
  off: "Don't convert new PDFs. Markdown you already have stays.",
  manual: "Convert from a file, an attachment or a workflow step.",
  automatic:
    "Also convert new and replaced PDFs as they arrive, with the browser closed. Existing PDFs are left alone.",
};

const ENGINE_NAME: Partial<Record<string, string>> = {
  pdfjs: "PDF.js",
  tesseract: "Tesseract",
  paddleocr: "PaddleOCR",
};

export const INTEGRATED_AI_NAME = "Integrated AI";

/** What reads the pages that are pictures, by what it is good at. */
export const SCANNER_HELP: Record<LocalOcrEngine | "ai", string> = {
  tesseract: "Best for clean, printed pages, like typed letters and forms.",
  paddleocr:
    "Better with harder pages, like photos of paper or small print. Slower. Download the scanner once, then use it offline.",
  ai: "Your AI model reads the pages that are pictures. It can misread or leave out words.",
};

export const SCANNER_FACTS: Record<
  LocalOcrEngine | "ai",
  readonly ChoiceFact[]
> = {
  tesseract: [
    { label: "Speed", level: 4 },
    { label: "Photos & small print", level: 2 },
  ],
  paddleocr: [
    { label: "Speed", level: 2 },
    { label: "Photos & small print", level: 4 },
  ],
  ai: [
    { label: "Speed", level: 1 },
    { label: "Photos & small print", level: 4 },
  ],
};

/**
 * The scanner models by the trade they make, from faster to more accurate,
 * for the ids the host offers (conversions/engine/engines.ts).
 */
const OCR_MODEL_CHOICES: readonly {
  id: string;
  label: string;
  description: string;
  facts: readonly ChoiceFact[];
}[] = [
  {
    id: "v6Tiny",
    label: "Fastest",
    description: "Quickest, but may miss more words.",
    facts: [
      { label: "Speed", level: 5 },
      { label: "Accuracy", level: 2 },
    ],
  },
  {
    id: "v6Small",
    label: "Balanced",
    description: "Recommended. Good speed and accuracy, in 50+ languages.",
    facts: [
      { label: "Speed", level: 3 },
      { label: "Accuracy", level: 4 },
    ],
  },
  {
    id: "v6Medium",
    label: "Most accurate",
    description: "Misses the fewest words, but takes longer.",
    facts: [
      { label: "Speed", level: 1 },
      { label: "Accuracy", level: 5 },
    ],
  },
];

/**
 * Scanner models for a person, from faster to more accurate; a model this
 * app has no name for stays its id, last.
 */
export function ocrModelChoices(ids: readonly string[]): {
  id: string;
  label: string;
  description?: string;
  facts: readonly ChoiceFact[];
}[] {
  const known = OCR_MODEL_CHOICES.filter((choice) => ids.includes(choice.id));
  const unknown = ids
    .filter((id) => !OCR_MODEL_CHOICES.some((choice) => choice.id === id))
    .map((id) => ({ id, label: id, facts: [] }));
  return [...known, ...unknown];
}

const LANGUAGE_NAME: Partial<Record<string, string>> = {
  eng: "English",
  spa: "Spanish",
  deu: "German",
  fra: "French",
};

/** An OCR language for a person; a code this app has no name for stays a code. */
export function languageName(code: string): string {
  return LANGUAGE_NAME[code] ?? code;
}

/** An engine's name: the host's own label for it once its capabilities are known. */
export function engineName(
  id: string,
  capabilities?: ConversionCapabilities | null,
): string {
  const known = capabilities?.ocr.find((engine) => engine.id === id);
  return known?.label || (ENGINE_NAME[id] ?? id);
}

type Recognizer = { kind: "ocr"; engine: string } | { kind: "ai" };

/** What a profile and a job's fixed plan both say about how pages are read. */
interface Readable {
  reading:
    | { kind: "digital" }
    | { kind: "smart"; fallback: Recognizer }
    | { kind: "recognize"; engine: Recognizer };
  layout: { kind: "off" } | { kind: "ai" };
}

function recognizerName(
  recognizer: Recognizer,
  capabilities?: ConversionCapabilities | null,
): string {
  return recognizer.kind === "ai"
    ? INTEGRATED_AI_NAME
    : engineName(recognizer.engine, capabilities);
}

/** A profile or a plan in a few words: "PDF.js + Tesseract · AI layout". */
export function profileLabel(
  readable: Readable,
  capabilities?: ConversionCapabilities | null,
): string {
  const reading = readable.reading;
  let how: string;
  switch (reading.kind) {
    case "digital":
      how = engineName("pdfjs", capabilities);
      break;
    case "smart":
      how = `${engineName("pdfjs", capabilities)} + ${recognizerName(reading.fallback, capabilities)}`;
      break;
    case "recognize":
      how = recognizerName(reading.engine, capabilities);
      break;
    default: {
      const _exhaustive: never = reading;
      return _exhaustive;
    }
  }
  return readable.layout.kind === "ai" ? `${how} · AI layout` : how;
}

/**
 * How a profile reads, by method name and the languages it scans in:
 * "Standard, English", "Text only", "Scan every page, English, Spanish, AI layout".
 */
export function readingSummary(profile: ConversionProfile): string {
  const parts = [
    METHOD_LABEL[methodOf(profile)],
    ...(localOcrOf(profile)?.languages.map(languageName) ?? []),
  ];
  if (profile.layout.kind === "ai") parts.push("AI layout");
  return parts.join(", ");
}

/** Whether this host can run any AI: transcription, an AI scanner or AI layout. */
export function aiOffered(capabilities: ConversionCapabilities): boolean {
  return (
    capabilities.ai.availability.status === "available" ||
    capabilities.layout.availability.status === "available"
  );
}

/**
 * An engine as a finished conversion recorded it on its document
 * (`role:engine@version`, conversions/model-adapter.ts). The version is the
 * host's own, package names and all (`pdfjs-dist@6.4.299`); an engine's id
 * holds no `@`.
 */
function recordedEngine(
  method: string,
): { role: string; engine: string; version: string } | null {
  const match = /^(digital|ocr|transcription|layout):([^@]*)@(.*)$/.exec(
    method,
  );
  if (!match) return null;
  const [, role, engine, version] = match;
  return { role, engine, version };
}

/** What read the pages, by name: "PDF.js", "Tesseract", "AI transcription". */
export function provenanceLabel(
  method: string,
  capabilities?: ConversionCapabilities | null,
): string {
  const recorded = recordedEngine(method);
  if (!recorded) return method;
  if (recorded.role === "transcription") return "AI transcription";
  if (recorded.role === "layout") return "AI layout";
  return engineName(recorded.engine, capabilities);
}

/** The same with the exact version that ran: "PDF.js (pdfjs-dist@6.4.299)". */
export function provenanceDetail(
  method: string,
  capabilities?: ConversionCapabilities | null,
): string {
  const recorded = recordedEngine(method);
  const name = provenanceLabel(method, capabilities);
  return recorded?.version ? `${name} (${recorded.version})` : name;
}

/* --------------------------------------------------------------- blockers */

/** A choice this host cannot run, in the host's own words. */
export interface SetupBlocker {
  /** What cannot run: an engine's name, or the integrated model */
  what: string;
  reason: string;
  /** What to do about it */
  setup: string;
}

type Availability = ConversionCapabilities["ai"]["availability"];

function blockerOf(
  what: string,
  availability: Availability | undefined,
): SetupBlocker | null {
  if (!availability) {
    return {
      what,
      reason: `${what} is not offered by this Sektar host.`,
      setup: "Choose another engine.",
    };
  }
  return availability.status === "available"
    ? null
    : { what, reason: availability.reason, setup: availability.setup };
}

function recognitionBlockers(
  recognition: RecognitionSelection,
  capabilities: ConversionCapabilities,
): (SetupBlocker | null)[] {
  if (recognition.kind === "ai") {
    return [blockerOf(INTEGRATED_AI_NAME, capabilities.ai.availability)];
  }
  const engine = capabilities.ocr.find((e) => e.id === recognition.engine);
  const what = engineName(recognition.engine, capabilities);
  if (engine?.availability.status !== "available") {
    return [blockerOf(what, engine?.availability)];
  }
  // An engine that lists no languages (or no models) has none to choose.
  const missing =
    engine.languages.length > 0
      ? recognition.languages.filter((code) => !engine.languages.includes(code))
      : [];
  const model = recognition.model;
  return [
    missing.length > 0
      ? {
          what,
          reason: `${what} has no language data for ${missing.map(languageName).join(", ")} on this host.`,
          setup: `Install it on the host, or use ${engine.languages.map(languageName).join(", ")}.`,
        }
      : null,
    model !== undefined &&
    engine.models.length > 0 &&
    !engine.models.includes(model)
      ? {
          what,
          reason: `${what} has no model "${model}".`,
          setup: `Choose ${engine.models.join(", ")}.`,
        }
      : null,
  ];
}

/**
 * Why this host cannot run a profile: one entry per engine or model it
 * names that is missing or needs setup. Empty when it can run as chosen.
 * Nothing is swapped for another engine.
 */
export function blockersOf(
  profile: ConversionProfile,
  capabilities: ConversionCapabilities,
): SetupBlocker[] {
  const found: (SetupBlocker | null)[] = [];
  const reading = profile.reading;
  if (reading.kind !== "recognize") {
    found.push(
      blockerOf(engineName("pdfjs", capabilities), capabilities.digital),
    );
  }
  const recognition =
    reading.kind === "smart"
      ? reading.fallback
      : reading.kind === "recognize"
        ? reading.engine
        : null;
  if (recognition)
    found.push(...recognitionBlockers(recognition, capabilities));
  if (profile.layout.kind === "ai") {
    found.push(blockerOf("AI layout", capabilities.layout.availability));
  }
  return found.filter((blocker) => blocker !== null);
}

/** Whether the host can run any profile that reads with this method. */
export function methodAvailable(
  method: ReadingMethod,
  capabilities: ConversionCapabilities,
): boolean {
  const available = (a: Availability) => a.status === "available";
  const digital = available(capabilities.digital);
  const ocr = capabilities.ocr.some((e) => available(e.availability));
  switch (method) {
    case "digital":
      return digital;
    case "smart":
      return digital && (ocr || available(capabilities.ai.availability));
    case "ocr":
      return ocr;
    case "ai":
      return available(capabilities.ai.availability);
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

/* ------------------------------------------------------------------- jobs */

/** Whether a job is of this source: its owner document and, for mail, its attachment. */
export function isJobOf(
  job: ConversionJobView,
  source: SourceSelection,
): boolean {
  if (job.source.documentId !== source.documentId) return false;
  if (source.expectedRef && job.source.ref !== source.expectedRef) return false;
  if (source.kind === "mail") {
    return (
      job.source.kind === "mail" &&
      job.source.attachmentId === source.attachmentId
    );
  }
  return job.source.kind === "file";
}

/** A source's jobs, newest first. */
export function jobsOf(
  jobs: readonly ConversionJobView[],
  source: SourceSelection,
): ConversionJobView[] {
  return jobs
    .filter((job) => isJobOf(job, source))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The job still being worked on, if any (the newest when the host holds several). */
export function activeJobOf(
  jobs: readonly ConversionJobView[],
): ConversionJobView | undefined {
  return jobs.find((job) => !isTerminalConversion(job));
}

/**
 * Whether the host says this run can be cancelled now. Only its word counts:
 * a view that does not say so is not cancellable, whatever its status.
 */
export function isCancellable(job: ConversionJobView): boolean {
  return job.cancellable === true;
}

/** Whether a job is past waiting: the host is working on it. */
export function isRunning(job: ConversionJobView): boolean {
  return job.status === "running" || job.status === "publishing";
}

const STAGE_LABEL: Record<ConversionProgress["stage"], string> = {
  "waiting-for-bytes": "Waiting for the file",
  preflight: "Checking the PDF",
  reading: "Reading text",
  rendering: "Rendering pages",
  recognizing: "Recognizing pages",
  layout: "Improving the layout",
  staging: "Saving the result",
  uploading: "Saving the Markdown",
  finalizing: "Finishing",
};

/** A workflow run reports the step it is at, not what the engine does within it. */
const WORKFLOW_STAGE_LABEL: Record<ConversionProgress["stage"], string> = {
  "waiting-for-bytes": "Waiting for the file",
  preflight: "Checking the PDF and its settings",
  reading: "Converting the PDF",
  rendering: "Converting the PDF",
  recognizing: "Converting the PDF",
  layout: "Converting the PDF",
  staging: "Saving the Markdown",
  uploading: "Saving the Markdown",
  finalizing: "Saving the Markdown",
};

/**
 * Where a job that is not finished stands, from what the host reports: the
 * stage (the workflow's step, for a workflow run), and page counts only when
 * the host gives them. No percentage and no time left are made up.
 */
export function progressText(job: ConversionJobView): string {
  if (job.status === "queued") return "Waiting to start";
  if (
    job.status !== "waiting-for-bytes" &&
    job.status !== "running" &&
    job.status !== "publishing"
  ) {
    return "";
  }
  const { stage, completedPages, totalPages } = job.progress;
  const label = (
    job.workflowId === undefined ? STAGE_LABEL : WORKFLOW_STAGE_LABEL
  )[stage];
  if (completedPages !== null && totalPages !== null) {
    return `${label} · ${completedPages} of ${plural(totalPages, "page")}`;
  }
  if (totalPages !== null) return `${label} · ${plural(totalPages, "page")}`;
  if (completedPages !== null)
    return `${label} · ${plural(completedPages, "page")} done`;
  return label;
}

/* --------------------------------------------------------------- coverage */

/** Page numbers as a person reads them: "3 to 5, 9". */
export function pageList(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (sorted[i + 1] === end + 1) end = sorted[++i];
    runs.push(
      end === start
        ? `${start}`
        : end === start + 1
          ? `${start}, ${end}`
          : `${start} to ${end}`,
    );
  }
  return runs.join(", ");
}

export interface Coverage {
  /** Pages asked for */
  total: number;
  read: number;
  /** Pages found deliberately blank: processed, with nothing on them */
  blank: number;
  /** Pages that could not be read, in order */
  unread: number[];
}

export function coverageOf(pages: readonly PageOutcome[]): Coverage {
  const coverage: Coverage = {
    total: pages.length,
    read: 0,
    blank: 0,
    unread: [],
  };
  for (const page of pages) {
    switch (page.status) {
      case "read":
        coverage.read++;
        break;
      case "blank":
        coverage.blank++;
        break;
      case "unresolved":
      case "failed":
        coverage.unread.push(page.page);
        break;
      default: {
        const _exhaustive: never = page;
        void _exhaustive;
      }
    }
  }
  coverage.unread.sort((a, b) => a - b);
  return coverage;
}

/** Page counts as a finished conversion keeps them on its document. */
export interface PageCounts {
  pageCount: number;
  readPages: number;
  blankPages: number;
  unresolvedPages: number;
  failedPages: number;
}

/**
 * How much of the PDF was read: "1 page", "All 12 pages, 1 blank",
 * "10 of 12 pages read, pages 3, 7 missing". `unread` names the pages when
 * they are known; the document itself keeps only how many there are.
 */
export function coverageText(
  counts: PageCounts,
  unread?: readonly number[],
): string {
  const missing = counts.unresolvedPages + counts.failedPages;
  const blank = counts.blankPages > 0 ? `, ${counts.blankPages} blank` : "";
  if (missing === 0) {
    const all = counts.pageCount > 1 ? "All " : "";
    return `${all}${plural(counts.pageCount, "page")}${blank}`;
  }
  const processed = counts.pageCount - missing;
  const which =
    unread && unread.length > 0
      ? `${unread.length === 1 ? "page" : "pages"} ${pageList(unread)} missing`
      : `${missing} missing`;
  return `${processed} of ${plural(counts.pageCount, "page")} read${blank}, ${which}`;
}

export function countsOf(pages: readonly PageOutcome[]): PageCounts {
  const coverage = coverageOf(pages);
  return {
    pageCount: coverage.total,
    readPages: coverage.read,
    blankPages: coverage.blank,
    unresolvedPages: pages.filter((p) => p.status === "unresolved").length,
    failedPages: pages.filter((p) => p.status === "failed").length,
  };
}

/* ------------------------------------------------------------------ usage */

/**
 * What a conversion spent on the integrated model. An unknown price is said,
 * never shown as zero; neither are counts nobody recorded.
 */
export function usageText(usage: ConversionUsage): string {
  const sent = `${plural(usage.requests, "model request")} for ${plural(usage.aiPages, "page")}`;
  if (usage.kind === "unknown") {
    return usage.requests === 0 && usage.aiPages === 0
      ? "Unknown"
      : `Unknown · ${sent} sent`;
  }
  if (usage.requests === 0 && usage.aiPages === 0) return "No model calls";
  const tokens = `${usage.inputTokens.toLocaleString("en")} tokens in, ${usage.outputTokens.toLocaleString("en")} out`;
  const cost =
    usage.costUsd === null
      ? "cost unknown"
      : `$${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`;
  return `${sent} · ${tokens} · ${cost}`;
}

/* ------------------------------------------------------------------ files */

/** The name a result downloads under: a partial result says so in its name. */
export function downloadName(
  fileName: string,
  completeness: ConversionCompleteness,
): string {
  if (completeness === "complete" || /\.partial(\.[^.]+)?$/i.test(fileName)) {
    return fileName;
  }
  const dot = fileName.lastIndexOf(".");
  return dot > 0
    ? `${fileName.slice(0, dot)}.partial${fileName.slice(dot)}`
    : `${fileName}.partial`;
}

/** The account identity recorded on Mail sources and batch selections. */
export function mailAccountKey(address: string | null | undefined): string {
  return (address ?? "").trim().toLowerCase() || "unknown-account";
}

/** Stable identity for source provenance and historical batch selection. */
export function scopeKey(scope: ConversionScope): string {
  return scope.kind === "files"
    ? `files:${scope.driveId}`
    : `mail:${scope.driveId}:${scope.account.trim().toLowerCase()}`;
}

/* --------------------------------------------------------------- settings */

/** The app-wide preferences a person can change. */
export interface SettingsDraft {
  activation: Activation;
  profile: ConversionProfile;
  limits: ConversionLimits;
}

/**
 * The saved global settings, as the host gave them. Before a response, use
 * defaults (On demand, Smart, Tesseract fallback, AI layout off) with the
 * host's ceilings for size, pages and time, and no AI allowance: saving
 * never grants AI that the person did not type in.
 */
export function draftOf(
  settings: ConversionSettings | undefined,
  hostLimits: ConversionLimits,
): SettingsDraft {
  if (settings) {
    return {
      activation: settings.activation,
      profile: settings.profile,
      limits: settings.limits,
    };
  }
  return {
    activation: "manual",
    profile: defaultConversionProfile,
    limits: {
      ...hostLimits,
      maxAiPages: 0,
      maxAiRequests: 0,
      automaticAiPagesPerDay: 0,
    },
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/** Whether two drafts choose the same thing, however their objects were built. */
export function sameDraft(a: SettingsDraft, b: SettingsDraft): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export type LimitName = keyof ConversionLimits;

/** The least each limit may be: a page, or none for the AI allowances. */
const LEAST: Record<LimitName, number> = {
  maxBytes: 1,
  maxPages: 1,
  maxDurationMs: 1,
  maxAiPages: 0,
  maxAiRequests: 0,
  automaticAiPagesPerDay: 0,
};
const LIMIT_NAMES: readonly LimitName[] = [
  "maxBytes",
  "maxPages",
  "maxDurationMs",
  "maxAiPages",
  "maxAiRequests",
  "automaticAiPagesPerDay",
];

/**
 * What is wrong with a draft's limits: each must be a whole number, at least
 * what the contract asks (a page, or none for the AI allowances) and no more
 * than the host's own ceiling.
 */
export function limitProblems(
  limits: ConversionLimits,
  hostLimits: ConversionLimits,
): Partial<Record<LimitName, string>> {
  const problems: Partial<Record<LimitName, string>> = {};
  for (const name of LIMIT_NAMES) {
    const value = limits[name];
    if (!Number.isInteger(value) || value < LEAST[name]) {
      problems[name] =
        LEAST[name] === 0
          ? "A whole number, 0 or more."
          : "A whole number, 1 or more.";
    } else if (value > hostLimits[name]) {
      problems[name] =
        `This host allows at most ${hostLimits[name].toLocaleString("en")}.`;
    }
  }
  return problems;
}

/* ---------------------------------------------------------------- results */

/** The reading method a finished conversion's fixed plan ran with. */
export function methodOfPlan(plan: ResolvedConversionPlan): ReadingMethod {
  const reading = plan.reading;
  switch (reading.kind) {
    case "digital":
      return "digital";
    case "smart":
      return "smart";
    case "recognize":
      return reading.engine.kind === "ai" ? "ai" : "ocr";
    default: {
      const _exhaustive: never = reading;
      return _exhaustive;
    }
  }
}

function selectionOf(recognition: ResolvedRecognition): RecognitionSelection {
  if (recognition.kind === "ai") return { kind: "ai", model: "integrated" };
  return {
    kind: "ocr",
    engine: recognition.engine,
    languages: recognition.languages,
    ...(recognition.model === undefined ? {} : { model: recognition.model }),
  };
}

/** The choices a plan was made from: what reads a PDF the same way again. */
export function profileOfPlan(plan: ResolvedConversionPlan): ConversionProfile {
  const reading = plan.reading;
  return {
    reading:
      reading.kind === "digital"
        ? { kind: "digital" }
        : reading.kind === "smart"
          ? { kind: "smart", fallback: selectionOf(reading.fallback) }
          : { kind: "recognize", engine: selectionOf(reading.engine) },
    layout:
      plan.layout.kind === "ai"
        ? { kind: "ai", model: "integrated" }
        : { kind: "off" },
    pages: plan.pages,
  };
}

/**
 * The profile that reads the pages a plan left out by scanning them with the
 * scanner from Settings: Standard after Text only, else Scan every page, over
 * the plan's pages. Null when Settings has no scanner.
 */
export function scanningProfile(
  plan: ResolvedConversionPlan,
  app: ConversionProfile,
): ConversionProfile | null {
  const profile = oneOffProfile(
    app,
    methodOfPlan(plan) === "digital" ? "smart" : "ocr",
  );
  return profile && { ...profile, pages: plan.pages };
}

type MissingPage = Extract<PageOutcome, { status: "unresolved" | "failed" }>;

/** Why a page wasn't read, for a person: from its outcome and the method that ran. */
export function missingPageReason(
  outcome: MissingPage,
  ran: ReadingMethod,
): string {
  if (outcome.status === "failed") return "Scanning it failed.";
  switch (ran) {
    case "digital":
      return "It looks like a scan, and text-only conversion skips scans.";
    case "ai":
      return "The model returned no text for it.";
    case "smart":
    case "ocr":
      return "Scanning found no text on it.";
    default: {
      const _exhaustive: never = ran;
      return _exhaustive;
    }
  }
}

/** How many pages were read, for a partial result's header: "1 of 2 pages read". */
export function pagesReadText(counts: PageCounts): string {
  const missing = counts.unresolvedPages + counts.failedPages;
  return `${counts.pageCount - missing} of ${plural(counts.pageCount, "page")} read`;
}

/** What a known converter warning means for the person reading the result. */
const WARNING_NOTES: readonly { matches: RegExp; note: string }[] = [
  {
    matches: /^LAYOUT_DEGRADED$|loader-provided layout blocks/,
    note: "Headings and columns may show as plain text on scanned pages.",
  },
  {
    matches: /^AMBIGUOUS_READING_ORDER$|no unambiguous order/,
    note: "Some text may be out of order where blocks overlap.",
  },
  {
    matches: /^UNCLASSIFIED_GROUP$/,
    note: "Some text could not be sorted into headings, lists or tables.",
  },
];

/**
 * A result's warnings in one plain sentence, or null when it has none. A
 * warning this app has no words for points to the technical details.
 */
export function warningNote(
  warnings: readonly ConversionWarning[],
): string | null {
  if (warnings.length === 0) return null;
  for (const warning of warnings) {
    const known = WARNING_NOTES.find(
      ({ matches }) =>
        matches.test(warning.code) || matches.test(warning.message),
    );
    if (known) return known.note;
  }
  return "The converter left notes about this result, under Technical details.";
}

/**
 * A result's warnings as the converter wrote them, each once: a warning it
 * gave for several pages is one line naming them ("Pages 1 to 6"), any
 * other repeat gets a count.
 */
export function warningLines(warnings: readonly ConversionWarning[]): string[] {
  const groups = new Map<
    string,
    { text: string; pages: number[]; count: number }
  >();
  for (const warning of warnings) {
    const prefix = warning.page === undefined ? null : `Page ${warning.page} `;
    const paged = prefix !== null && warning.message.startsWith(prefix);
    const text = paged ? warning.message.slice(prefix.length) : warning.message;
    const key = `${warning.code}\n${paged ? "page" : "doc"}\n${text}`;
    const group = groups.get(key) ?? { text, pages: [], count: 0 };
    if (paged && warning.page !== undefined) group.pages.push(warning.page);
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].map(({ text, pages, count }) => {
    if (pages.length > 0) {
      const which = `${pages.length === 1 ? "Page" : "Pages"} ${pageList(pages)}`;
      return `${which}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    return count > 1 ? `${text} (${count} times)` : text;
  });
}

/* ------------------------------------------------------------------ times */

const timeOf = (date: Date) =>
  date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/ /g, " ");

/** A moment in a row or a picker: "12 Nov at 1:58 PM". */
export function shortWhen(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${timeOf(date)}`;
}

/** A moment in details: "12 Nov 2026, 1:58 PM". */
export function fullWhen(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${timeOf(date)}`;
}

/** A version's time in a picker: the time today, else the day and time. */
export function versionWhen(iso: string, now: number): string {
  const date = new Date(iso);
  return date.toDateString() === new Date(now).toDateString()
    ? timeOf(date)
    : shortWhen(iso);
}

/** How long ago something started: "just now", "20 s ago", "3 min ago", else when. */
export function startedAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return shortWhen(iso);
}

/* --------------------------------------------------------------- versions */

/**
 * A source's results as they are listed: the one to read first (the
 * current one, else the newest while no saved files are still arriving),
 * then the others, newest first.
 */
export function versionsOf<T extends { current: boolean }>(
  views: readonly T[],
  pending: boolean,
): { latest: T | undefined; earlier: T[] } {
  const latest =
    views.find((view) => view.current) ?? (pending ? undefined : views.at(-1));
  return {
    latest,
    earlier: views.filter((view) => view !== latest).reverse(),
  };
}
