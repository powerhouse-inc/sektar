import { PADDLE_MODELS } from "docture/loaders/paddleocr";
import { describe, expect, it } from "vitest";
import {
  defaultConversionProfile,
  type ConversionProfile,
} from "../contracts.js";
import { PADDLE_MODEL_PRESETS, probeEngines } from "./engines.js";
import {
  resolvePlan,
  type IntegratedModelStatus,
  type PlanRefusal,
} from "./plan.js";

const probe = probeEngines();
const noAi: IntegratedModelStatus = {
  kind: "unavailable",
  reason: "No model is configured.",
  setup: "Configure one.",
};

function refusal(profile: ConversionProfile, integrated = noAi): PlanRefusal {
  try {
    resolvePlan(profile, { probe, integrated });
  } catch (error) {
    return error as PlanRefusal;
  }
  throw new Error("expected the plan to be refused");
}

describe("pinning a profile to the installed engines", () => {
  it("pins the default profile to the installed PDF.js, Tesseract and Docture versions", () => {
    const plan = resolvePlan(defaultConversionProfile, {
      probe,
      integrated: noAi,
    });
    expect(plan.reading).toMatchObject({
      kind: "smart",
      readerVersion:
        probe.pdfjs.status === "available" ? probe.pdfjs.version : "",
      fallback: { kind: "ocr", engine: "tesseract", languages: ["eng"] },
    });
    expect(plan.converterVersion).toContain(`docture@${probe.docture}`);
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
      const before = resolvePlan(profile, { probe, integrated: noAi });
      const after = resolvePlan(profile, {
        probe: {
          ...probe,
          [engine]: { status: "available", version: "new-renderer" },
        },
        integrated: noAi,
      });
      expect(after.reading).toEqual(before.reading);
      expect(after.fingerprint).not.toBe(before.fingerprint);
    },
  );

  it("refuses AI without the integrated model, and language data the host lacks", () => {
    expect(
      refusal({
        ...defaultConversionProfile,
        reading: {
          kind: "recognize",
          engine: { kind: "ai", model: "integrated" },
        },
      }).code,
    ).toBe("ai-unavailable");
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

  it("refuses AI layout without the integrated model", () => {
    expect(
      refusal({
        ...defaultConversionProfile,
        layout: { kind: "ai", model: "integrated" },
      }).code,
    ).toBe("ai-unavailable");
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
    const plan = resolvePlan(paddle, { probe, integrated: noAi });
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
