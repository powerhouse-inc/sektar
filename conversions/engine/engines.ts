import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { assetById, TESSERACT_LANGUAGES } from "../models/catalogue.js";
import { modelStore } from "../models/store.js";

const nodeRequire = createRequire(import.meta.url);

export type TesseractLanguage = (typeof TESSERACT_LANGUAGES)[number];

/** Versions docture 0.3 accepts for PaddleOCR (its ENGINE_RANGES). */
const PADDLE_OCR_VERSION = "6.3.0";
const ONNX_RUNTIME_VERSION = "1.27.0";

export const PADDLE_MODEL_PRESETS = [
  { id: "v6Small", label: "PP-OCRv6 small (balanced, 50+ languages)" },
  { id: "v6Medium", label: "PP-OCRv6 medium (most accurate, slower)" },
  { id: "v6Tiny", label: "PP-OCRv6 tiny (fastest)" },
] as const;
export type PaddleModelPreset = (typeof PADDLE_MODEL_PRESETS)[number]["id"];
export const DEFAULT_PADDLE_MODEL: PaddleModelPreset = "v6Small";

export function paddleModelOf(model: string | undefined): PaddleModelPreset {
  if (model === undefined) return DEFAULT_PADDLE_MODEL;
  const preset = PADDLE_MODEL_PRESETS.find((preset) => preset.id === model);
  if (!preset) throw new Error(`Unknown PaddleOCR model: ${model}`);
  return preset.id;
}

export type EngineAvailability =
  | { readonly status: "available"; readonly version: string }
  | {
      readonly status: "unavailable";
      readonly reason: string;
      readonly setup: string;
      readonly detail?: string;
    };

export interface TesseractLanguageData {
  readonly code: TesseractLanguage;
  readonly file: string;
  readonly version: string;
}

export interface EngineProbe {
  readonly docture: string | null;
  readonly pdfjs: EngineAvailability;
  readonly rasterizer: EngineAvailability;
  readonly tesseract: EngineAvailability;
  readonly tesseractLanguages: readonly TesseractLanguageData[];
  readonly paddleocr: EngineAvailability;
}

interface PackageJson {
  readonly name: string;
  readonly version: string;
}

function readPackageJson(file: string): PackageJson | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof parsed.name === "string" &&
      "version" in parsed &&
      typeof parsed.version === "string"
    ) {
      return { name: parsed.name, version: parsed.version };
    }
  } catch {}
  return null;
}

/** The installed package's manifest, also for packages that do not export it. */
export function installedPackage(
  name: string,
  from: NodeRequire = nodeRequire,
): (PackageJson & { file: string }) | null {
  try {
    const file = from.resolve(`${name}/package.json`);
    const manifest = readPackageJson(file);
    if (manifest) return { ...manifest, file };
  } catch {}
  let entry: string;
  try {
    entry = from.resolve(name);
  } catch {
    return null;
  }
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (!existsSync(file)) continue;
    const manifest = readPackageJson(file);
    if (manifest?.name === name) return { ...manifest, file };
  }
  return null;
}

const REINSTALL = "Reinstall Sektar.";

const missing = (
  reason: string,
  setup: string,
  detail?: string,
): EngineAvailability => ({
  status: "unavailable",
  reason,
  setup,
  ...(detail ? { detail } : {}),
});

/** An engine that needs the page renderer, which is unavailable. */
const needsRenderer = (
  engine: string,
  rasterizer: Extract<EngineAvailability, { status: "unavailable" }>,
): EngineAvailability =>
  missing(
    `${engine} can't scan pages. ${rasterizer.reason}`,
    rasterizer.setup,
    rasterizer.detail,
  );

function probeRasterizer(pdfjs: EngineAvailability): EngineAvailability {
  if (pdfjs.status !== "available")
    return missing(
      "Sektar can't draw PDF pages without its PDF reader.",
      REINSTALL,
      "pdfjs-dist is not installed.",
    );
  const canvas = installedPackage("@napi-rs/canvas");
  if (!canvas)
    return missing(
      "Sektar's page renderer isn't installed on this host.",
      REINSTALL,
      "@napi-rs/canvas is not installed.",
    );
  try {
    const binding: unknown = nodeRequire("@napi-rs/canvas");
    if (
      typeof binding === "object" &&
      binding !== null &&
      "createCanvas" in binding &&
      typeof binding.createCanvas === "function"
    ) {
      return {
        status: "available",
        version: `pdfjs-dist@${pdfjs.version}+@napi-rs/canvas@${canvas.version}`,
      };
    }
  } catch (error) {
    return missing(
      "Sektar's page renderer doesn't work on this computer.",
      "Reinstall the Sektar build for this operating system and processor.",
      `@napi-rs/canvas could not load: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
  return missing(
    "Sektar's page renderer didn't start.",
    REINSTALL,
    "@napi-rs/canvas has no createCanvas.",
  );
}

function probeTesseractLanguages(): TesseractLanguageData[] {
  return TESSERACT_LANGUAGES.map((code) => {
    const asset = assetById(`tesseract-${code}`);
    return {
      code,
      file: modelStore.path(asset),
      version: `tessdata@4.0.0:sha256:${asset.sha256}`,
    };
  });
}

function probeTesseract(rasterizer: EngineAvailability): EngineAvailability {
  const tesseract = installedPackage("tesseract.js");
  if (!tesseract)
    return missing(
      "Tesseract is not installed on this host.",
      REINSTALL,
      "Install tesseract.js@7.0.0 with Sektar.",
    );
  const core = installedPackage(
    "tesseract.js-core",
    createRequire(tesseract.file),
  );
  if (!core)
    return missing(
      "Tesseract isn't fully installed on this host.",
      REINSTALL,
      "tesseract.js-core is not installed.",
    );
  if (rasterizer.status !== "available")
    return needsRenderer("Tesseract", rasterizer);
  return {
    status: "available",
    version: `tesseract.js@${tesseract.version}+core@${core.version}`,
  };
}

function probePaddle(rasterizer: EngineAvailability): EngineAvailability {
  const paddle = installedPackage("ppu-paddle-ocr");
  const onnx = installedPackage("onnxruntime-node");
  if (!paddle || !onnx) {
    return missing(
      "PaddleOCR is not installed on this host.",
      REINSTALL,
      "ppu-paddle-ocr or onnxruntime-node is not installed.",
    );
  }
  if (
    paddle.version !== PADDLE_OCR_VERSION ||
    onnx.version !== ONNX_RUNTIME_VERSION
  ) {
    return missing(
      "The PaddleOCR installed on this host is a version Sektar can't use.",
      REINSTALL,
      `Found ppu-paddle-ocr@${paddle.version} and onnxruntime-node@${onnx.version}; install ppu-paddle-ocr@${PADDLE_OCR_VERSION} and onnxruntime-node@${ONNX_RUNTIME_VERSION}.`,
    );
  }
  if (rasterizer.status !== "available")
    return needsRenderer("PaddleOCR", rasterizer);
  return {
    status: "available",
    version: `ppu-paddle-ocr@${paddle.version}+onnxruntime-node@${onnx.version}`,
  };
}

export function probeEngines(): EngineProbe {
  const docture = installedPackage("docture")?.version ?? null;
  const pdfjsPackage = installedPackage("pdfjs-dist");
  const pdfjs: EngineAvailability = pdfjsPackage
    ? { status: "available", version: `pdfjs-dist@${pdfjsPackage.version}` }
    : missing(
        "Sektar's PDF reader isn't installed on this host.",
        REINSTALL,
        "pdfjs-dist is not installed.",
      );
  const rasterizer = probeRasterizer(
    pdfjs.status === "available" && pdfjsPackage
      ? { status: "available", version: pdfjsPackage.version }
      : pdfjs,
  );
  const tesseractLanguages = probeTesseractLanguages();
  return {
    docture,
    pdfjs,
    rasterizer,
    tesseract: probeTesseract(rasterizer),
    tesseractLanguages,
    paddleocr: probePaddle(rasterizer),
  };
}

/** Gathers the installed Tesseract language data in one folder, as Tesseract expects it. */
export async function prepareTessdata(
  probe: EngineProbe,
  directory: string,
  languages?: readonly string[],
): Promise<string | null> {
  const selected = probe.tesseractLanguages.filter(
    (language) => !languages || languages.includes(language.code),
  );
  if (selected.length === 0) return null;
  await mkdir(directory, { recursive: true });
  for (const language of selected) {
    const target = join(directory, `${language.code}.traineddata.gz`);
    const asset = assetById(`tesseract-${language.code}`);
    await modelStore.require({
      kind: "ocr",
      engine: "tesseract",
      languages: [language.code],
    });
    await copyFile(modelStore.path(asset), target);
  }
  return directory;
}
