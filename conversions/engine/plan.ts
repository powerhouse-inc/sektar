import { recognitionVersion } from "../models/catalogue.js";
import { createHash } from "node:crypto";
import { canonicalJson } from "../canonical-json.js";
export { canonicalJson } from "../canonical-json.js";
import type {
  ConversionProfile,
  ExecutableConversionPlan,
  RecognitionSelection,
  ResolvedConversionPlan,
  ResolvedModel,
  ResolvedRecognition,
} from "../contracts.js";
import {
  DEFAULT_PADDLE_MODEL,
  PADDLE_MODEL_PRESETS,
  type EngineAvailability,
  type EngineProbe,
} from "./engines.js";

export type IntegratedModelStatus =
  | { readonly kind: "available"; readonly model: ResolvedModel }
  | {
      readonly kind: "unavailable";
      readonly reason: string;
      readonly setup: string;
    };

export interface PlanInputs {
  readonly probe: EngineProbe;
  readonly integrated: IntegratedModelStatus;
}

export const planRefusalCodes = [
  "engine-unavailable",
  "ai-unavailable",
  "language-unavailable",
  "model-unavailable",
  "layout-not-applicable",
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

/** The prompt Docture's model reader or layout analyzer sends, by its version. */
export function promptVersion(
  probe: EngineProbe,
  role: "llm-ocr" | "llm-layout",
): string {
  return `docture@${probe.docture ?? "missing"}:${role}`;
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

function integratedModel(inputs: PlanInputs, purpose: string): ResolvedModel {
  if (inputs.integrated.kind === "unavailable") {
    throw new PlanRefusal(
      "ai-unavailable",
      `${purpose} isn't available. ${inputs.integrated.reason} ${inputs.integrated.setup}`.trim(),
    );
  }
  return inputs.integrated.model;
}

function resolveRecognition(
  selection: RecognitionSelection,
  inputs: PlanInputs,
): ResolvedRecognition {
  const { probe } = inputs;
  if (selection.kind === "ai") {
    return {
      kind: "ai",
      model: integratedModel(inputs, "AI transcription"),
      promptVersion: promptVersion(probe, "llm-ocr"),
    };
  }
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
  inputs: PlanInputs,
): ExecutableConversionPlan {
  const { probe } = inputs;
  const reading = profile.reading;
  let resolvedReading: ResolvedConversionPlan["reading"];
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
        fallback: resolveRecognition(reading.fallback, inputs),
      };
      break;
    case "recognize":
      resolvedReading = {
        kind: "recognize",
        engine: resolveRecognition(reading.engine, inputs),
      };
      break;
    default: {
      const unhandled: never = reading;
      throw new Error(`Unhandled reading ${JSON.stringify(unhandled)}`);
    }
  }
  if (
    profile.layout.kind === "ai" &&
    reading.kind === "recognize" &&
    reading.engine.kind === "ai"
  ) {
    throw new PlanRefusal(
      "layout-not-applicable",
      "AI layout works with Standard, Text only or Scan every page, not with AI transcription. Turn AI layout off.",
    );
  }
  const layout: ResolvedConversionPlan["layout"] =
    profile.layout.kind === "ai"
      ? {
          kind: "ai",
          model: integratedModel(inputs, "Improve layout with AI"),
          promptVersion: promptVersion(probe, "llm-layout"),
        }
      : { kind: "off" };
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
    layout,
    pages: profile.pages,
    output: { kind: "markdown" as const, pageMarkers: true },
  };
  return { ...unsigned, fingerprint: planFingerprint(unsigned) };
}

/** The local OCR the plan may run, if any. */
export function planOcr(
  plan: ResolvedConversionPlan,
): Extract<ResolvedRecognition, { kind: "ocr" }> | null {
  const reading = plan.reading;
  const recognition =
    reading.kind === "smart"
      ? reading.fallback
      : reading.kind === "recognize"
        ? reading.engine
        : null;
  return recognition?.kind === "ocr" ? recognition : null;
}
