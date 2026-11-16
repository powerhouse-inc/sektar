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
  OcrSelection,
} from "../../../conversions/contracts.js";

export const READING_METHODS = ["smart", "digital", "ocr"] as const;
/** Smart, Digital only, OCR. */
export type ReadingMethod = (typeof READING_METHODS)[number];

/** The local OCR a profile falls back to when it names none. */
export const DEFAULT_LOCAL_OCR: OcrSelection = {
  kind: "ocr",
  engine: "tesseract",
  languages: ["eng"],
};

export function methodOf(profile: ConversionProfile): ReadingMethod {
  const reading = profile.reading;
  switch (reading.kind) {
    case "digital":
      return "digital";
    case "smart":
      return "smart";
    case "recognize":
      return "ocr";
    default: {
      const _exhaustive: never = reading;
      return _exhaustive;
    }
  }
}

/** The local OCR that recognizes pages under this profile: Smart's fallback, or OCR's engine. Null for Digital only. */
export function localOcrOf(profile: ConversionProfile): OcrSelection | null {
  const reading = profile.reading;
  if (reading.kind === "smart") return reading.fallback;
  if (reading.kind === "recognize") return reading.engine;
  return null;
}

/**
 * The profile read with another method. A local OCR choice carries over where
 * the new method has one. `ocr` is what a method that needs a local engine
 * uses when the profile carries none.
 */
export function withMethod(
  profile: ConversionProfile,
  method: ReadingMethod,
  ocr: OcrSelection = localOcrOf(profile) ?? DEFAULT_LOCAL_OCR,
): ConversionProfile {
  switch (method) {
    case "digital":
      return { ...profile, reading: { kind: "digital" } };
    case "smart":
      return { ...profile, reading: { kind: "smart", fallback: ocr } };
    case "ocr":
      return { ...profile, reading: { kind: "recognize", engine: ocr } };
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

/** The profile with `selection` recognizing its pages, where its method recognizes any. */
function withSelection(
  profile: ConversionProfile,
  selection: OcrSelection,
): ConversionProfile {
  const reading = profile.reading;
  if (reading.kind === "smart") {
    return { ...profile, reading: { ...reading, fallback: selection } };
  }
  if (reading.kind === "recognize") {
    return { ...profile, reading: { kind: "recognize", engine: selection } };
  }
  return profile;
}

/**
 * The profile with another engine recognizing its pages. A model belongs to
 * its engine, so another engine starts with its own default.
 */
export function withRecognition(
  profile: ConversionProfile,
  engine: LocalOcrEngine,
  languages: readonly string[] = localOcrOf(profile)?.languages ??
    DEFAULT_LOCAL_OCR.languages,
): ConversionProfile {
  const current = localOcrOf(profile);
  return withSelection(
    profile,
    current?.engine === engine
      ? { ...current, languages: [...languages] }
      : { kind: "ocr", engine, languages: [...languages] },
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
  const scanner = localOcrOf(app);
  if (method !== "digital" && !scanner) return null;
  const profile = withMethod(app, method, scanner ?? undefined);
  const kept = languages?.filter((code) => scanner?.languages.includes(code));
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
  const asked = localOcrOf(requested);
  const scanner = localOcrOf(app);
  if (!asked) return true;
  if (!scanner) return false;
  return (
    asked.engine === scanner.engine &&
    asked.model === scanner.model &&
    asked.languages.length > 0 &&
    asked.languages.every((code) => scanner.languages.includes(code))
  );
}
