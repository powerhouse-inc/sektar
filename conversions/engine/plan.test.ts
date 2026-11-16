import { PADDLE_MODELS } from "docture/loaders/paddleocr";
import { describe, expect, it } from "vitest";
import {
  defaultConversionProfile,
  type ConversionProfile,
} from "../contracts.js";
import { PADDLE_MODEL_PRESETS, probeEngines } from "./engines.js";
import { resolvePlan, type PlanRefusal } from "./plan.js";

const probe = probeEngines();

function refusal(profile: ConversionProfile): PlanRefusal {
  try {
    resolvePlan(profile, probe);
  } catch (error) {
    return error as PlanRefusal;
  }
  throw new Error("expected the plan to be refused");
}

describe("pinning a profile to the installed engines", () => {
  it("pins the default profile to the installed PDF.js, Tesseract and Docture versions", () => {
    const plan = resolvePlan(defaultConversionProfile, probe);
    expect(plan.reading).toMatchObject({
      kind: "smart",
      readerVersion:
        probe.pdfjs.status === "available" ? probe.pdfjs.version : "",
      fallback: { kind: "ocr", engine: "tesseract", languages: ["eng"] },
    });
    expect(plan.converterVersion).toContain(`docture@${probe.docture}`);
    // The stored format's layout field, always off, so earlier plans keep their fingerprints.
    expect(plan.layout).toEqual({ kind: "off" });
    expect(plan.renderer).toEqual({
      pdfjsVersion:
        probe.pdfjs.status === "available" ? probe.pdfjs.version : "",
      rasterizerVersion:
        probe.rasterizer.status === "available"
          ? probe.rasterizer.version
          : null,
    });
  });

  it.each(["pdfjs", "rasterizer"] as const)(
    "invalidates OCR reuse when %s changes",
    (engine) => {
      const profile: ConversionProfile = {
        ...defaultConversionProfile,
        reading: {
          kind: "recognize",
          engine: { kind: "ocr", engine: "tesseract", languages: ["eng"] },
        },
      };
      const before = resolvePlan(profile, probe);
      const after = resolvePlan(profile, {
        ...probe,
        [engine]: { status: "available", version: "new-renderer" },
      });
      expect(after.reading).toEqual(before.reading);
      expect(after.fingerprint).not.toBe(before.fingerprint);
    },
  );

  it("refuses language data the host lacks", () => {
    expect(
      refusal({
        ...defaultConversionProfile,
        reading: {
          kind: "recognize",
          engine: { kind: "ocr", engine: "tesseract", languages: ["xyz"] },
        },
      }).code,
    ).toBe("language-unavailable");
  });

  it("offers only PaddleOCR presets Docture knows, and pins the default", () => {
    for (const preset of PADDLE_MODEL_PRESETS)
      expect(Object.keys(PADDLE_MODELS)).toContain(preset.id);
    const paddle: ConversionProfile = {
      ...defaultConversionProfile,
      reading: {
        kind: "recognize",
        engine: { kind: "ocr", engine: "paddleocr", languages: ["en"] },
      },
    };
    if (probe.paddleocr.status === "unavailable") {
      expect(refusal(paddle).code).toBe("engine-unavailable");
      return;
    }
    const plan = resolvePlan(paddle, probe);
    expect(
      plan.reading.kind === "recognize" && plan.reading.engine,
    ).toMatchObject({
      engine: "paddleocr",
      model: "v6Small",
    });
    expect(
      refusal({
        ...paddle,
        reading: {
          kind: "recognize",
          engine: {
            kind: "ocr",
            engine: "paddleocr",
            languages: ["en"],
            model: "custom",
          },
        },
      }).code,
    ).toBe("model-unavailable");
  });
});
