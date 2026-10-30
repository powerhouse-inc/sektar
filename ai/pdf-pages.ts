// Draws a PDF's first pages as images, in the tab, for the vision model.
//
// pdf.js runs on this thread here: its worker's code is imported like any other
// module and handed over through the global it looks for. A real worker needs a
// URL to its script, and no such URL survives both Vite's dependency pre-bundling
// and the package build. The cost is that a large page holds the tab for a moment
// while the chat is waiting anyway. Imported only when a PDF is read: it is large,
// and the module this is reached from also loads on hosts.
import type { PDFPageProxy } from "pdfjs-dist";

/** The longest edge of a page image, as for a photo attached to the chat. */
const MAX_EDGE = 2048;
/** A small page, such as a till receipt, gains nothing from more. */
const MAX_SCALE = 3;
const JPEG_QUALITY = 0.85;

export interface PageImage {
  /** `data:image/jpeg;base64,...` */
  dataUrl: string;
  mediaType: string;
}

export interface RenderedPdf {
  /** The pages the document has, shown or not. */
  total: number;
  pages: PageImage[];
}

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = {
    WorkerMessageHandler: worker.WorkerMessageHandler,
  };
  return pdfjs;
}

async function pageImage(page: PDFPageProxy): Promise<PageImage> {
  const size = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(MAX_EDGE / Math.max(size.width, size.height), MAX_SCALE),
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  page.cleanup();
  // Canvases hold their pixels until collected; a PDF has several.
  canvas.width = 0;
  canvas.height = 0;
  return { dataUrl, mediaType: "image/jpeg" };
}

/** The first `limit` pages of `file`, and how many it has. A file pdf.js cannot open throws. */
export async function renderPdfPages(
  file: Blob,
  limit: number,
  signal?: AbortSignal,
): Promise<RenderedPdf> {
  const { getDocument } = await loadPdfJs();
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const pages: PageImage[] = [];
    const shown = Math.min(pdf.numPages, limit);
    for (let number = 1; number <= shown; number += 1) {
      signal?.throwIfAborted();
      pages.push(await pageImage(await pdf.getPage(number)));
    }
    return { total: pdf.numPages, pages };
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name === "PasswordException") {
      throw new Error("it is protected by a password");
    }
    throw error;
  } finally {
    await task.destroy();
  }
}
