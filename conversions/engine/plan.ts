import { recognitionVersion } from "../models/catalogue.js";
import { createHash } from "node:crypto";
import { canonicalJson } from "../canonical-json.js";
export { canonicalJson } from "../canonical-json.js";
import type {
  ConversionProfile,
  ExecutableConversionPlan,
  OcrSelection,
  ResolvedConversionPlan,
  ResolvedRecognition,
} from "../contracts.js";
import {
  DEFAULT_PADDLE_MODEL,
  PADDLE_MODEL_PRESETS,
  type EngineAvailability,
  type EngineProbe,
} from "./engines.js";

export const planRefusalCodes = [
  "engine-unavailable",
  "language-unavailable",
  "model-unavailable",
] as const;
export type PlanRefusalCode = (typeof planRefusalCodes)[number];

/** The profile asks for something this installation cannot run. */
export class PlanRefusal extends Error {
  override readonly name = "PlanRefusal";
  constructor(
    readonly code: PlanRefusalCode,
    message: string,
  ) {
    super(message);
  }
}

export const CONVERTER_CONTRACT = "sektar-conversion/2";

export function converterVersion(probe: EngineProbe): string {
  return `${CONVERTER_CONTRACT}+docture@${probe.docture ?? "missing"}`;
}

function requireEngine(
  label: string,
  availability: EngineAvailability,
): string {
  if (availability.status === "unavailable")
    throw new PlanRefusal(
      "engine-unavailable",
      `${label} isn't available on this host. ${availability.reason} ${availability.setup}`.trim(),
    );
  return availability.version;
}

function resolveRecognition(
  selection: OcrSelection,
  probe: EngineProbe,
): ResolvedRecognition {
  if (selection.engine === "tesseract") {
    const version = requireEngine("Tesseract", probe.tesseract);
    const languageVersions: Record<string, string> = {};
    for (const language of selection.languages) {
      const data = probe.tesseractLanguages.find(
        (candidate) => candidate.code === language,
      );
      if (!data) {
        throw new PlanRefusal(
          "language-unavailable",
          `Tesseract can't read the language "${language}" on this host. Choose another language in Settings → Document conversion.`,
        );
      }
      languageVersions[language] = data.version;
    }
    return {
      kind: "ocr",
      engine: "tesseract",
      languages: [...selection.languages],
      version: recognitionVersion(version, selection),
      languageVersions,
    };
  }
  const version = requireEngine("PaddleOCR", probe.paddleocr);
  const model = selection.model ?? DEFAULT_PADDLE_MODEL;
  if (!PADDLE_MODEL_PRESETS.some((preset) => preset.id === model)) {
    throw new PlanRefusal(
      "model-unavailable",
      `PaddleOCR has no model called "${model}". Choose another model in Settings → Document conversion.`,
    );
  }
  return {
    kind: "ocr",
    engine: "paddleocr",
    languages: [...selection.languages],
    model,
    version: recognitionVersion(version, selection),
    languageVersions: {},
  };
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** The fingerprint a plan carries: the hash of everything else in it. */
export function planFingerprint(
  plan: Omit<ResolvedConversionPlan, "fingerprint">,
): string {
  return sha256Hex(canonicalJson({ ...plan, fingerprint: undefined }));
}

/** Pins a profile to the engines and versions installed now. */
export function resolvePlan(
  profile: ConversionProfile,
  probe: EngineProbe,
): ExecutableConversionPlan {
  const reading = profile.reading;
  let resolvedReading: ExecutableConversionPlan["reading"];
  switch (reading.kind) {
    case "digital":
      resolvedReading = {
        kind: "digital",
        readerVersion: requireEngine("PDF.js", probe.pdfjs),
      };
      break;
    case "smart":
      resolvedReading = {
        kind: "smart",
        readerVersion: requireEngine("PDF.js", probe.pdfjs),
        fallback: resolveRecognition(reading.fallback, probe),
      };
      break;
    case "recognize":
      resolvedReading = {
        kind: "recognize",
        engine: resolveRecognition(reading.engine, probe),
      };
      break;
    default: {
      const unhandled: never = reading;
      throw new Error(`Unhandled reading ${JSON.stringify(unhandled)}`);
    }
  }
  if (probe.docture === null)
    throw new PlanRefusal(
      "engine-unavailable",
      "Sektar's converter isn't installed on this host. Reinstall Sektar.",
    );
  const unsigned = {
    contractVersion: 2 as const,
    renderer: {
      pdfjsVersion: requireEngine("PDF.js", probe.pdfjs),
      rasterizerVersion:
        reading.kind !== "digital"
          ? requireEngine("PDF rasterizer", probe.rasterizer)
          : probe.rasterizer.status === "available"
            ? probe.rasterizer.version
            : null,
    },
    converterVersion: converterVersion(probe),
    reading: resolvedReading,
    layout: { kind: "off" as const },
    pages: profile.pages,
    output: { kind: "markdown" as const, pageMarkers: true },
  };
  return { ...unsigned, fingerprint: planFingerprint(unsigned) };
}

/** The local OCR the plan may run, if any. */
export function planOcr(
  plan: ResolvedConversionPlan,
): ResolvedRecognition | null {
  const reading = plan.reading;
  return reading.kind === "smart"
    ? reading.fallback
    : reading.kind === "recognize"
      ? reading.engine
      : null;
}
