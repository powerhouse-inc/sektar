/**
 * A conversion profile as a person picks it: one reading method and, where the
 * method recognizes pages, one engine. The workflow step and the Sektar forms
 * (editors/sektar/kit/conversion-model.ts) edit profiles through these, so
 * both produce the same `ConversionProfile` for the same choices.
 *
 * Pure and Zod-only: this file is bundled into the piece and into the browser.
 */
import type {
  ConversionProfile,
  LocalOcrEngine,
  RecognitionSelection,
} from "../../../conversions/contracts.js";

export const READING_METHODS = ["smart", "digital", "ocr", "ai"] as const;
/** Smart, Digital only, OCR, AI transcription. */
export type ReadingMethod = (typeof READING_METHODS)[number];

/** What recognizes a page: a local OCR engine, or the integrated model. */
export type RecognitionChoice = LocalOcrEngine | "ai";

export type LocalOcr = Extract<RecognitionSelection, { kind: "ocr" }>;

/** The local OCR a profile falls back to when it names none. */
export const DEFAULT_LOCAL_OCR: LocalOcr = {
  kind: "ocr",
  engine: "tesseract",
  languages: ["eng"],
};

const INTEGRATED_AI = { kind: "ai", model: "integrated" } as const;

export function methodOf(profile: ConversionProfile): ReadingMethod {
  const reading = profile.reading;
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

/** What recognizes pages under this profile: Smart's fallback, or OCR's engine. Null where nothing is chosen. */
export function recognitionOf(
  profile: ConversionProfile,
): RecognitionSelection | null {
  const reading = profile.reading;
  if (reading.kind === "smart") return reading.fallback;
  if (reading.kind === "recognize" && reading.engine.kind === "ocr") {
    return reading.engine;
  }
  return null;
}

/** The local OCR engine and languages the profile carries, if any. */
export function localOcrOf(profile: ConversionProfile): LocalOcr | null {
  const recognition = recognitionOf(profile);
  return recognition?.kind === "ocr" ? recognition : null;
}

/** Whether running this profile calls the integrated model at all. */
export function usesAi(profile: ConversionProfile): boolean {
  return (
    profile.layout.kind === "ai" ||
    recognitionOf(profile)?.kind === "ai" ||
    methodOf(profile) === "ai"
  );
}

/**
 * The profile read with another method. A local OCR choice and the layout
 * option carry over where the new method has them; AI
 * transcription reads pixels, so it never keeps AI layout. `ocr` is what a
 * method that needs a local engine uses when the profile carries none.
 */
export function withMethod(
  profile: ConversionProfile,
  method: ReadingMethod,
  ocr: LocalOcr = localOcrOf(profile) ?? DEFAULT_LOCAL_OCR,
): ConversionProfile {
  switch (method) {
    case "digital":
      return { ...profile, reading: { kind: "digital" } };
    case "smart":
      return {
        ...profile,
        reading: { kind: "smart", fallback: recognitionOf(profile) ?? ocr },
      };
    case "ocr":
      return { ...profile, reading: { kind: "recognize", engine: ocr } };
    case "ai":
      return {
        ...profile,
        reading: { kind: "recognize", engine: INTEGRATED_AI },
        layout: { kind: "off" },
      };
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

/** The profile with `selection` recognizing its pages, where its method lets it. */
function withSelection(
  profile: ConversionProfile,
  selection: RecognitionSelection,
): ConversionProfile {
  const reading = profile.reading;
  if (reading.kind === "smart") {
    return { ...profile, reading: { ...reading, fallback: selection } };
  }
  if (
    reading.kind === "recognize" &&
    reading.engine.kind === "ocr" &&
    selection.kind === "ocr"
  ) {
    return { ...profile, reading: { kind: "recognize", engine: selection } };
  }
  return profile;
}

/**
 * The profile with another engine recognizing its pages. Only Smart may fall
 * back to the integrated model: OCR with the model is AI transcription, a
 * different method, so asking for it there changes nothing. A model belongs
 * to its engine, so another engine starts with its own default.
 */
export function withRecognition(
  profile: ConversionProfile,
  choice: RecognitionChoice,
  languages: readonly string[] = localOcrOf(profile)?.languages ??
    DEFAULT_LOCAL_OCR.languages,
): ConversionProfile {
  if (choice === "ai") return withSelection(profile, INTEGRATED_AI);
  const current = localOcrOf(profile);
  return withSelection(
    profile,
    current?.engine === choice
      ? { ...current, languages: [...languages] }
      : { kind: "ocr", engine: choice, languages: [...languages] },
  );
}

/** The profile with other OCR languages, where a local engine reads pages. */
export function withLanguages(
  profile: ConversionProfile,
  languages: readonly string[],
): ConversionProfile {
  const ocr = localOcrOf(profile);
  if (!ocr || languages.length === 0) return profile;
  return withSelection(profile, { ...ocr, languages: [...languages] });
}

/** The profile with another model of its local OCR engine; null is the engine's default. */
export function withOcrModel(
  profile: ConversionProfile,
  model: string | null,
): ConversionProfile {
  const ocr = localOcrOf(profile);
  if (!ocr) return profile;
  const { model: _previous, ...engine } = ocr;
  return withSelection(profile, model ? { ...engine, model } : engine);
}

/** The profile with AI layout on or off. AI transcription never has it. */
export function withAiLayout(
  profile: ConversionProfile,
  on: boolean,
): ConversionProfile {
  return {
    ...profile,
    layout:
      on && methodOf(profile) !== "ai"
        ? { kind: "ai", model: "integrated" }
        : { kind: "off" },
  };
}

/** Language codes from free text: "eng, spa", "eng+spa" or "eng spa". */
export function parseLanguages(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;+]+/)
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * The profile one PDF is read with when the app's is `app` and the person
 * picked `method` for it: the app's scanner, reading a subset of its
 * languages when `languages` names some. Null when the method needs a
 * scanner the app's profile doesn't have.
 */
export function oneOffProfile(
  app: ConversionProfile,
  method: ReadingMethod,
  languages?: readonly string[],
): ConversionProfile | null {
  const scanner = recognitionOf(app);
  const local = localOcrOf(app);
  if (method === "smart" && !scanner) return null;
  if (method === "ocr" && !local) return null;
  const profile = withMethod(app, method, local ?? undefined);
  const kept = languages?.filter((code) => local?.languages.includes(code));
  return kept?.length ? withLanguages(profile, kept) : profile;
}

/**
 * Whether a one-off request uses only the app's scanner: any method, the
 * app's engine and model, and some of its languages.
 */
export function usesAppScanner(
  requested: ConversionProfile,
  app: ConversionProfile,
): boolean {
  const asked = recognitionOf(requested);
  const scanner = recognitionOf(app);
  if (!asked) return true;
  if (!scanner) return false;
  if (asked.kind === "ai" || scanner.kind === "ai")
    return asked.kind === scanner.kind;
  return (
    asked.engine === scanner.engine &&
    asked.model === scanner.model &&
    asked.languages.length > 0 &&
    asked.languages.every((code) => scanner.languages.includes(code))
  );
}
