import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { DocumentLoaderPaddleOcr } from "docture/loaders/paddleocr";
import type { DocumentLoaderPdfJs } from "docture/loaders/pdfjs";
import type { DocumentLoaderTesseract } from "docture/loaders/tesseract";
import type { NapiCanvasRasterizer } from "docture/raster/canvas";

/**
 * Docture's engine subpaths, loaded from the installed package when they are
 * first needed, never from the piece bundle:
 *
 * - The piece builder bundles into one file. A bundled `import("docture/…")`
 *   becomes a lazily initialized chunk sharing zod with the eagerly bundled
 *   pieces framework, and the output then calls `init_*` functions it never
 *   defines (`init_locales is not defined` when the piece is described).
 * - Tesseract locates its worker and WASM beside its package, and the canvas
 *   rasterizer and ONNX Runtime own platform native addons: all must resolve
 *   where installed.
 *
 * The specifier is resolved at run time, so the bundler neither follows nor
 * copies it.
 */
async function installed(subpath: string, name: string): Promise<unknown> {
  const url = pathToFileURL(
    createRequire(import.meta.url).resolve(subpath),
  ).href;
  const loaded: unknown = await import(/* @vite-ignore */ url);
  const value: unknown =
    typeof loaded === "object" && loaded !== null && name in loaded
      ? (loaded as Record<string, unknown>)[name]
      : undefined;
  if (typeof value !== "function") {
    throw new Error(
      `The installed ${subpath} has no ${name}; reinstall Docture.`,
    );
  }
  return value;
}

export const loadPdfJsLoader = async () =>
  (await installed(
    "docture/loaders/pdfjs",
    "DocumentLoaderPdfJs",
  )) as typeof DocumentLoaderPdfJs;
export const loadTesseract = async () =>
  (await installed(
    "docture/loaders/tesseract",
    "DocumentLoaderTesseract",
  )) as typeof DocumentLoaderTesseract;
export const loadPaddleOcrLoader = async () =>
  (await installed(
    "docture/loaders/paddleocr",
    "DocumentLoaderPaddleOcr",
  )) as typeof DocumentLoaderPaddleOcr;
export const loadCanvasRasterizer = async () =>
  (await installed(
    "docture/raster/canvas",
    "NapiCanvasRasterizer",
  )) as typeof NapiCanvasRasterizer;
