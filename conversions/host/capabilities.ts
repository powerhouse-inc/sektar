import type { ConversionCapabilities } from "../contracts.js";
import {
  PADDLE_MODEL_PRESETS,
  type EngineAvailability,
  type EngineProbe,
} from "../engine/engines.js";
import type { IntegratedModelStatus } from "../engine/plan.js";
import { HOST_LIMITS } from "./settings.js";

const NO_CONVERTER: EngineAvailability = {
  status: "unavailable",
  reason: "Sektar's converter isn't installed on this host.",
  setup: "Reinstall Sektar.",
  detail: "docture is not installed.",
};

export function capabilitiesOf(
  probe: EngineProbe,
  ai: IntegratedModelStatus,
): ConversionCapabilities {
  const usable = (availability: EngineAvailability): EngineAvailability =>
    probe.docture === null ? NO_CONVERTER : availability;
  const integrated: EngineAvailability =
    probe.docture === null
      ? NO_CONVERTER
      : ai.kind === "available"
        ? {
            status: "available",
            version: `${ai.model.provider}/${ai.model.modelId}`,
          }
        : probe.rasterizer.status === "unavailable"
          ? {
              status: "unavailable",
              reason: `AI transcription can't read pages. ${probe.rasterizer.reason}`,
              setup: probe.rasterizer.setup,
              ...(probe.rasterizer.detail
                ? { detail: probe.rasterizer.detail }
                : {}),
            }
          : { status: "unavailable", reason: ai.reason, setup: ai.setup };
  return {
    contractVersion: 1,
    digital: usable(probe.pdfjs),
    ocr: [
      {
        id: "tesseract",
        label: "Tesseract",
        availability: usable(probe.tesseract),
        languages: probe.tesseractLanguages.map((language) => language.code),
        models: [],
      },
      {
        id: "paddleocr",
        label: "PaddleOCR",
        availability: usable(probe.paddleocr),
        languages: [],
        models: PADDLE_MODEL_PRESETS.map((preset) => preset.id),
      },
    ],
    ai: {
      availability: integrated,
      model:
        ai.kind === "available" && integrated.status === "available"
          ? ai.model
          : null,
    },
    layout: { availability: integrated },
    limits: HOST_LIMITS,
  };
}
