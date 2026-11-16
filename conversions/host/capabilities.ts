import type { ConversionCapabilities } from "../contracts.js";
import {
  PADDLE_MODEL_PRESETS,
  type EngineAvailability,
  type EngineProbe,
} from "../engine/engines.js";
import { HOST_LIMITS } from "./settings.js";

const NO_CONVERTER: EngineAvailability = {
  status: "unavailable",
  reason: "Sektar's converter isn't installed on this host.",
  setup: "Reinstall Sektar.",
  detail: "docture is not installed.",
};

export function capabilitiesOf(probe: EngineProbe): ConversionCapabilities {
  const usable = (availability: EngineAvailability): EngineAvailability =>
    probe.docture === null ? NO_CONVERTER : availability;
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
    limits: HOST_LIMITS,
  };
}
