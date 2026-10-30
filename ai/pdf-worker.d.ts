// pdf.js ships no types for its worker bundle; pdf-pages.ts imports it to run
// the worker's code on the tab's own thread.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
