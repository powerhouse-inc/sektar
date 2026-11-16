import { beforeAll } from "vitest";
import { modelStore } from "../models/store.js";
import { recognitionAssets } from "../models/catalogue.js";

export function prepareTestScanners(paddle = false) {
  beforeAll(async () => {
    await modelStore.downloadMissingAssets(
      recognitionAssets({
        kind: "ocr",
        engine: "tesseract",
        languages: ["eng"],
      }),
      () => undefined,
    );
    if (paddle)
      await modelStore.downloadMissingAssets(
        recognitionAssets({
          kind: "ocr",
          engine: "paddleocr",
          model: "v6Small",
          languages: [],
        }),
        () => undefined,
      );
  }, 120_000);
}
