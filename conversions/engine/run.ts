import { recognitionVersion } from "../models/catalogue.js";
import { modelStore, ModelsNotReady } from "../models/store.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DocumentConverter,
  inferForm,
  isAbortError,
  isDoctureError,
  silentLogger,
  withOcrFallback,
  type ConversionWarning as DoctureWarning,
  type DocumentLoader,
  type LoadedDocument,
  type LoadedPage,
  type PageOcrQuality,
  type RawDocument,
  type Rasterizer,
} from "docture";
import type {
  ConversionWarning,
  EngineProvenance,
  PageOutcome,
  ResolvedConversionPlan,
} from "../contracts.js";
import {
  paddleModelOf,
  prepareTessdata,
  probeEngines,
  type EngineProbe,
} from "./engines.js";
import {
  ExecutionFailure,
  type ArtifactBundle,
  type ExecutionRequest,
} from "./executor.js";
import {
  loadCanvasRasterizer,
  loadPaddleOcrLoader,
  loadPdfJsLoader,
  loadTesseract,
} from "./installed.js";
import { planOcr, converterVersion } from "./plan.js";

/** Below this many characters a page's text layer does not count as read. */
export const USABLE_TEXT_CHARACTERS = 20;
const BLANK_INK_FRACTION = 0.0005;
const BLANK_CHECK_DPI = 48;
const MAX_REASON_LENGTH = 300;
const AI_UNAVAILABLE =
  "AI transcription and AI layout aren't available yet. Choose a reading method that doesn't use AI, and leave AI layout off.";
const DAMAGED = "This file is damaged or is not a valid PDF.";
const MISSING_ENGINE =
  "A reading tool this conversion needs isn't installed on this host. Reinstall Sektar, or choose another reading method.";

type OcrPlan = NonNullable<ReturnType<typeof planOcr>>;

function reasonOf(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  return message.length > MAX_REASON_LENGTH
    ? `${message.slice(0, MAX_REASON_LENGTH - 1)}…`
    : message || "Unknown error";
}

function emptyPage(page: LoadedPage): LoadedPage {
  return { ...page, text: "", lines: [], blocks: [] };
}

async function preflight(bytes: Uint8Array): Promise<number> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    const document = await task.promise;
    return document.numPages;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException")
      throw new ExecutionFailure(
        "encrypted",
        "This PDF is protected by a password, so Sektar can't read it.",
      );
    if (name === "InvalidPDFException" || name === "FormatError")
      throw new ExecutionFailure("damaged", DAMAGED);
    throw new ExecutionFailure(
      "damaged",
      DAMAGED,
      `PDF.js could not open this file: ${reasonOf(error)}`,
    );
  } finally {
    await task.destroy();
  }
}

function requestedPages(
  plan: ResolvedConversionPlan,
  documentPages: number,
  maxPages: number,
): number[] {
  if (plan.pages.kind === "all") {
    if (documentPages > maxPages) {
      throw new ExecutionFailure(
        "too-many-pages",
        `This PDF has ${documentPages} pages, and Sektar converts at most ${maxPages} at a time. Choose the pages to convert.`,
      );
    }
    return Array.from({ length: documentPages }, (_, index) => index + 1);
  }
  const pages = [...new Set(plan.pages.pages)].sort((a, b) => a - b);
  const outside = pages.filter((page) => page > documentPages);
  if (outside.length > 0)
    throw new ExecutionFailure(
      "page-out-of-range",
      `This PDF has ${documentPages} pages, so page ${outside[0]} doesn't exist. Choose other pages.`,
    );
  if (pages.length > maxPages)
    throw new ExecutionFailure(
      "too-many-pages",
      `Sektar converts at most ${maxPages} pages at a time. Choose fewer pages.`,
    );
  return pages;
}

/** Refuses a plan this host cannot run as planned, so a result never claims engines it did not use. */
function checkPlan(plan: ResolvedConversionPlan, probe: EngineProbe): void {
  const stale = (planned: string, installed: string | null) => {
    throw new ExecutionFailure(
      "engine-unavailable",
      "The reading tools on this host changed after this conversion was asked for. Convert again.",
      `Planned with ${planned}; this host now has ${installed ?? "nothing installed"}.`,
    );
  };
  if (plan.contractVersion !== 2)
    throw new ExecutionFailure(
      "engine-unavailable",
      "This saved plan uses an older converter. Start a new conversion; its saved Markdown remains available.",
    );
  const rasterizerVersion =
    probe.rasterizer.status === "available" ? probe.rasterizer.version : null;
  if (plan.renderer.rasterizerVersion !== rasterizerVersion)
    stale(
      plan.renderer.rasterizerVersion ?? "no rasterizer",
      rasterizerVersion,
    );
  if (
    probe.pdfjs.status === "available" &&
    plan.renderer.pdfjsVersion !== probe.pdfjs.version
  )
    stale(plan.renderer.pdfjsVersion, probe.pdfjs.version);
  const reading = plan.reading;
  const recognition =
    reading.kind === "smart"
      ? reading.fallback
      : reading.kind === "recognize"
        ? reading.engine
        : null;
  if (recognition?.kind === "ai" || plan.layout.kind === "ai")
    throw new ExecutionFailure("engine-unavailable", AI_UNAVAILABLE);
  if (probe.pdfjs.status !== "available")
    throw new ExecutionFailure(
      "engine-unavailable",
      `${probe.pdfjs.reason} ${probe.pdfjs.setup}`,
      probe.pdfjs.detail,
    );
  if (
    reading.kind !== "recognize" &&
    probe.pdfjs.version !== reading.readerVersion
  )
    stale(reading.readerVersion, probe.pdfjs.version);
  if (recognition) {
    const installed =
      recognition.engine === "tesseract" ? probe.tesseract : probe.paddleocr;
    if (installed.status !== "available")
      throw new ExecutionFailure(
        "engine-unavailable",
        `${installed.reason} ${installed.setup}`,
        installed.detail,
      );
    if (
      recognitionVersion(installed.version, recognition) !== recognition.version
    )
      stale(
        recognition.version,
        recognitionVersion(installed.version, recognition),
      );
    if (recognition.engine === "tesseract") {
      for (const language of recognition.languages) {
        const data = probe.tesseractLanguages.find(
          (candidate) => candidate.code === language,
        );
        if (!data)
          throw new ExecutionFailure(
            "engine-unavailable",
            `Tesseract can't read the language "${language}" on this host. Choose another language in Settings → Document conversion.`,
          );
        if (data.version !== recognition.languageVersions[language])
          stale(
            recognition.languageVersions[language] ?? language,
            data.version,
          );
      }
    }
  }
  if (
    probe.docture === null ||
    plan.converterVersion !== converterVersion(probe)
  )
    stale(plan.converterVersion, converterVersion(probe));
}

async function isConfirmedBlank(
  rasterizer: Rasterizer,
  raw: RawDocument,
  page: number,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const rendered = (
      await rasterizer.rasterize(
        raw,
        { pages: [page], dpi: BLANK_CHECK_DPI, format: "png" },
        { signal, logger: silentLogger },
      )
    ).at(0);
    if (!rendered) return false;
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const image = await loadImage(Buffer.from(rendered.bytes));
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, image.width, image.height);
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let dark = 0;
    for (let index = 0; index + 2 < data.length; index += 4) {
      const luma =
        0.299 * Number(data[index]) +
        0.587 * Number(data[index + 1]) +
        0.114 * Number(data[index + 2]);
      if (luma < 128) dark += 1;
    }
    return dark / (image.width * image.height) < BLANK_INK_FRACTION;
  } catch (error) {
    if (signal.aborted) throw error;
    return false;
  }
}

async function ocrLoader(
  ocr: OcrPlan,
  rasterizer: Rasterizer,
  workDir: string,
  probe: EngineProbe,
): Promise<DocumentLoader> {
  let assets;
  try {
    assets = await modelStore.require(ocr);
  } catch (error) {
    if (error instanceof ModelsNotReady)
      throw new ExecutionFailure("engine-unavailable", error.message);
    throw error;
  }
  if (ocr.engine === "tesseract") {
    const langPath = await prepareTessdata(
      probe,
      join(workDir, "tessdata"),
      ocr.languages,
    );
    if (!langPath)
      throw new ExecutionFailure(
        "engine-unavailable",
        "Download a Tesseract language in Settings → Document conversion before scanning.",
      );
    const DocumentLoaderTesseract = await loadTesseract();
    return new DocumentLoaderTesseract({
      rasterizer,
      languages: [...ocr.languages],
      langPath,
      cachePath: join(workDir, "tesseract-cache"),
      concurrency: 1,
    });
  }
  const detection = assets.at(0);
  const recognition = assets.at(1);
  const charactersDictionary = assets.at(2);
  if (!detection || !recognition || !charactersDictionary)
    throw new ExecutionFailure(
      "engine-unavailable",
      "The selected scanner is not supported.",
    );
  const DocumentLoaderPaddleOcr = await loadPaddleOcrLoader();
  return new DocumentLoaderPaddleOcr({
    rasterizer,
    model: {
      detection: modelStore.path(detection),
      recognition: modelStore.path(recognition),
      charactersDictionary: modelStore.path(charactersDictionary),
    },
    concurrency: 1,
  });
}

/**
 * What OCR did, page by page, as the loaders below record it while Docture's
 * `withOcrFallback` drives them.
 */
interface OcrRecord {
  /** Pages the OCR engine read. */
  readonly attempted: Set<number>;
  /** Pages that looked blank, so OCR never ran on them. */
  readonly blank: Set<number>;
  /** Pages whose OCR threw, with the engine's reason. */
  readonly failed: Map<number, string>;
  /** Pages whose OCR text replaced the original. */
  readonly accepted: Set<number>;
  missingEngine: string | null;
}

/**
 * The OCR loader as `withOcrFallback` sees it: a page that renders blank is
 * not sent to OCR, so specks never become text, and every page OCR returns is
 * remembered so `assess` can tell it from the original.
 */
function recordedOcr(
  ocr: DocumentLoader,
  rasterizer: Rasterizer,
  record: OcrRecord,
  recognized: WeakSet<LoadedPage>,
): DocumentLoader {
  return {
    name: ocr.name,
    capabilities: ocr.capabilities,
    async load(document, ctx) {
      const page = ctx.request?.pages?.[0];
      if (page === undefined)
        throw new Error("OCR is asked for one page at a time.");
      if (await isConfirmedBlank(rasterizer, document, page, ctx.signal)) {
        record.blank.add(page);
        return { pages: [], text: "", form: inferForm([]), loader: ocr.name };
      }
      record.attempted.add(page);
      try {
        const loaded = await ocr.load(document, ctx);
        for (const candidate of loaded.pages) recognized.add(candidate);
        return loaded;
      } catch (error) {
        if (isDoctureError(error, "MISSING_ENGINE"))
          record.missingEngine ??= error.message;
        record.failed.set(page, reasonOf(error));
        throw error;
      }
    },
    async dispose(scope) {
      await ocr.dispose?.(scope);
    },
  };
}

/**
 * Page quality for `withOcrFallback`. An original page is worth its text
 * length (nothing, when every page is to be recognized). An OCR page replaces
 * it whenever OCR found text and at least as much as the original had, so a
 * short scanned page ("Page 5") is kept instead of falling under the threshold.
 */
function ocrQuality(
  recognized: WeakSet<LoadedPage>,
  record: OcrRecord,
  recognizeEvery: boolean,
): (page: LoadedPage) => PageOcrQuality {
  const original = new Map<number, number>();
  return (page) => {
    const characters = page.text.trim().length;
    if (!recognized.has(page)) {
      const quality = recognizeEvery ? 0 : characters;
      original.set(page.pageNumber, quality);
      return { kind: "text", quality };
    }
    const accepted =
      characters > 0 && characters >= (original.get(page.pageNumber) ?? 0);
    if (accepted) record.accepted.add(page.pageNumber);
    return {
      kind: "text",
      quality: accepted ? USABLE_TEXT_CHARACTERS + characters : 0,
    };
  };
}

interface PageResult {
  readonly outcome: PageOutcome;
  readonly page: LoadedPage;
}

async function outcomesOf(
  loaded: LoadedDocument,
  raw: RawDocument,
  record: OcrRecord | null,
  rasterizer: Rasterizer | null,
  recognizeEvery: boolean,
  signal: AbortSignal,
): Promise<PageResult[]> {
  const results: PageResult[] = [];
  for (const page of [...loaded.pages].sort(
    (a, b) => a.pageNumber - b.pageNumber,
  )) {
    const number = page.pageNumber;
    const characters = page.text.trim().length;
    if (record?.accepted.has(number)) {
      results.push({
        outcome: { status: "read", page: number, method: "ocr", characters },
        page,
      });
    } else if (
      !recognizeEvery &&
      characters > 0 &&
      (!record || characters >= USABLE_TEXT_CHARACTERS)
    ) {
      results.push({
        outcome: {
          status: "read",
          page: number,
          method: "digital",
          characters,
        },
        page,
      });
    } else if (
      record
        ? record.blank.has(number)
        : rasterizer !== null &&
          (await isConfirmedBlank(rasterizer, raw, number, signal))
    ) {
      results.push({
        outcome: {
          status: "blank",
          page: number,
          method: recognizeEvery ? "ocr" : "digital",
        },
        page: emptyPage(page),
      });
    } else if (!record) {
      results.push({
        outcome: {
          status: "unresolved",
          page: number,
          reason:
            "No text layer; this page needs recognition, which Digital only does not run.",
        },
        page,
      });
    } else {
      const failure = record.failed.get(number);
      results.push({
        outcome: failure
          ? { status: "failed", page: number, reason: `OCR failed: ${failure}` }
          : {
              status: "unresolved",
              page: number,
              reason: "OCR found no text on this page.",
            },
        page: recognizeEvery ? emptyPage(page) : page,
      });
    }
  }
  return results;
}

function provenanceOf(
  plan: ResolvedConversionPlan,
  outcomes: readonly PageOutcome[],
  record: OcrRecord | null,
): EngineProvenance[] {
  const entries: EngineProvenance[] = [];
  const reading = plan.reading;
  if (
    reading.kind !== "recognize" &&
    outcomes.some(
      (outcome) =>
        (outcome.status === "read" || outcome.status === "blank") &&
        outcome.method === "digital",
    )
  )
    entries.push({
      role: "digital",
      engine: "pdfjs",
      version: reading.readerVersion,
      model: null,
    });
  const ocr = planOcr(plan);
  if (ocr && record && record.attempted.size > 0)
    entries.push({
      role: "ocr",
      engine: ocr.engine,
      version: ocr.version,
      model:
        ocr.engine === "paddleocr"
          ? paddleModelOf(ocr.model)
          : ocr.languages.join("+"),
    });
  return entries;
}

function sanitizeReason(reason: string): string {
  return reason.replaceAll("--", "—").replace(/\s+/g, " ").trim();
}

function warningOf(warning: DoctureWarning): ConversionWarning {
  return {
    code: warning.code,
    message: warning.message,
    ...(warning.pageNumber === undefined ? {} : { page: warning.pageNumber }),
  };
}

const PAGE_MARKER = /^<!-- page: \d+ -->\n*/;

function assembleMarkdown(
  fragments: ReadonlyMap<number, string>,
  outcomes: readonly PageOutcome[],
  pageMarkers: boolean,
): string {
  const parts: string[] = [];
  for (const outcome of outcomes) {
    let fragment = (
      fragments.get(outcome.page) ?? `<!-- page: ${outcome.page} -->\n\n`
    ).trimEnd();
    if (!pageMarkers) fragment = fragment.replace(PAGE_MARKER, "");
    if (outcome.status === "unresolved" || outcome.status === "failed") {
      const note = `<!-- page ${outcome.page} not read: ${sanitizeReason(outcome.reason)} -->`;
      fragment = fragment ? `${fragment}\n\n${note}` : note;
    }
    if (fragment) parts.push(fragment);
  }
  return `${parts.join("\n\n")}\n`;
}

function failureOf(
  error: unknown,
  signal: AbortSignal,
  timeout: AbortSignal,
  maxDurationMs: number,
): ExecutionFailure {
  if (error instanceof ExecutionFailure) return error;
  if (timeout.aborted)
    return new ExecutionFailure(
      "timeout",
      `The conversion did not finish within ${Math.round(maxDurationMs / 1000)} seconds.`,
    );
  if (signal.aborted || isAbortError(error))
    return new ExecutionFailure("cancelled", "The conversion was cancelled.");
  if (isDoctureError(error, "MISSING_ENGINE"))
    return new ExecutionFailure(
      "engine-unavailable",
      MISSING_ENGINE,
      error.message,
    );
  return new ExecutionFailure(
    "internal",
    "Sektar ran into a problem reading this PDF. Try again, or choose another reading method.",
    reasonOf(error),
  );
}

/**
 * Reads the requested pages with PDF.js and, as the plan says, OCR: Docture's
 * `withOcrFallback` sends each page whose text layer is too thin to OCR
 * (Smart), or every page (OCR), and `DocumentConverter` writes the Markdown.
 */
export async function runConversion(
  request: ExecutionRequest,
  cancel: AbortSignal,
): Promise<ArtifactBundle> {
  const timeout = AbortSignal.timeout(request.maxDurationMs);
  const signal = AbortSignal.any([cancel, timeout]);
  const { plan } = request;
  const disposables: { dispose?(): Promise<void> }[] = [];
  const workDir = await mkdtemp(join(tmpdir(), "docture-conversion-"));
  try {
    const probe = probeEngines();
    checkPlan(plan, probe);
    const documentPages = await preflight(request.bytes);
    signal.throwIfAborted();
    const pages = requestedPages(plan, documentPages, request.maxPages);
    const raw: RawDocument = {
      bytes: request.bytes,
      mimeType: "application/pdf",
      fileName: request.fileName,
    };
    const ocr = planOcr(plan);
    const recognizeEvery = plan.reading.kind === "recognize";
    let rasterizer: Rasterizer | null = null;
    if (probe.rasterizer.status === "available") {
      const NapiCanvasRasterizer = await loadCanvasRasterizer();
      rasterizer = new NapiCanvasRasterizer();
      disposables.push(rasterizer);
    } else if (ocr) {
      throw new ExecutionFailure(
        "engine-unavailable",
        `${probe.rasterizer.reason} ${probe.rasterizer.setup}`,
        probe.rasterizer.detail,
      );
    }
    const DocumentLoaderPdfJs = await loadPdfJsLoader();
    const pdf = new DocumentLoaderPdfJs();
    let loader: DocumentLoader = pdf;
    let record: OcrRecord | null = null;
    if (ocr && rasterizer) {
      record = {
        attempted: new Set(),
        blank: new Set(),
        failed: new Map(),
        accepted: new Set(),
        missingEngine: null,
      };
      const recognized = new WeakSet<LoadedPage>();
      loader = withOcrFallback(
        pdf,
        recordedOcr(
          await ocrLoader(ocr, rasterizer, workDir, probe),
          rasterizer,
          record,
          recognized,
        ),
        {
          assess: ocrQuality(recognized, record, recognizeEvery),
          threshold: USABLE_TEXT_CHARACTERS,
        },
      );
    }
    disposables.push(loader);
    let loaded: LoadedDocument;
    try {
      loaded = await loader.load(raw, {
        signal,
        logger: silentLogger,
        request: { pages, layout: true },
      });
    } catch (error) {
      if (isAbortError(error) || signal.aborted) throw error;
      if (isDoctureError(error, "MISSING_ENGINE"))
        throw new ExecutionFailure(
          "engine-unavailable",
          MISSING_ENGINE,
          error.message,
        );
      throw new ExecutionFailure(
        "damaged",
        "Sektar couldn't read the text of this PDF. It may be damaged. Try Scan every page.",
        `The PDF's text could not be read: ${reasonOf(error)}`,
      );
    }
    if (record?.missingEngine)
      throw new ExecutionFailure(
        "engine-unavailable",
        MISSING_ENGINE,
        record.missingEngine,
      );
    const results = await outcomesOf(
      loaded,
      raw,
      record,
      rasterizer,
      recognizeEvery,
      signal,
    );
    const outcomes = results.map((result) => result.outcome);
    if (!outcomes.some((outcome) => outcome.status === "read")) {
      if (outcomes.every((outcome) => outcome.status === "blank"))
        throw new ExecutionFailure(
          "blank-document",
          "Every page converted is blank.",
        );
      const reasons = [
        ...new Set(
          outcomes.flatMap((outcome) =>
            outcome.status === "unresolved" || outcome.status === "failed"
              ? [outcome.reason]
              : [],
          ),
        ),
      ];
      throw new ExecutionFailure(
        "no-content",
        `No text was recovered. ${reasons.slice(0, 2).join(" ")}`.trim(),
      );
    }
    const kept = results.map((result) => result.page);
    const converted = await new DocumentConverter({}).convert(
      {
        loaded: {
          pages: kept,
          text: kept.map((page) => page.text).join("\f"),
          form: inferForm(kept.map((page) => page.text.trim().length)),
          loader: "sektar-pages",
        },
        mimeType: "application/pdf",
        fileName: request.fileName,
      },
      { format: "markdown", assets: "omit", signal },
    );
    const fragments = new Map(
      converted.pages.map((page) => [page.pageNumber, page.content]),
    );
    const unreadPages = new Set(
      outcomes
        .filter((outcome) => outcome.status !== "read")
        .map((outcome) => outcome.page),
    );
    const warnings = converted.warnings
      .filter(
        (warning) =>
          !(
            warning.code === "LAYOUT_DEGRADED" &&
            warning.pageNumber !== undefined &&
            unreadPages.has(warning.pageNumber)
          ),
      )
      .map(warningOf);
    return {
      markdown: assembleMarkdown(fragments, outcomes, plan.output.pageMarkers),
      pages: outcomes,
      provenance: provenanceOf(plan, outcomes, record),
      warnings,
      documentPages,
    };
  } catch (error) {
    throw failureOf(error, cancel, timeout, request.maxDurationMs);
  } finally {
    await Promise.allSettled(
      disposables.map(async (component) => {
        await component.dispose?.();
      }),
    );
    await rm(workDir, { recursive: true, force: true });
  }
}
