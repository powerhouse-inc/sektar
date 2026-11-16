// Whether a packaged stack can read a PDF: the Docture piece is in it, the
// engines that piece loads at run time resolve from where it sits, their
// native parts load, and PDF.js reads a PDF's text. Conversions run in the
// workflow runtime's own piece workers, so nothing here starts a worker of
// Sektar's; a whole workflow run is the acceptance check's, not this one's.
//
//   node qa/desktop/conversion.mjs --stack <the app's stack folder>
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { stack: { type: "string" } } });
assert.ok(values.stack, "--stack is required");
const stack = resolve(values.stack);

const pieceDir = join(stack, "dist/node/pieces/docture");
const pieceEntry = join(pieceDir, "index.mjs");
assert.ok(
  existsSync(pieceEntry),
  "The desktop bundle must include the built Docture piece",
);
assert.ok(
  !existsSync(join(stack, "dist/node/conversion-worker")),
  "The desktop bundle must not carry the removed conversion worker",
);

// As the piece resolves them: from its own file, through the stack's packages.
const fromPiece = createRequire(pieceEntry);
const load = (specifier) => import(pathToFileURL(fromPiece.resolve(specifier)));
const declared = JSON.parse(
  readFileSync(join(pieceDir, "package.json"), "utf8"),
).dependencies;
for (const name of Object.keys(declared ?? {})) {
  assert.doesNotThrow(
    () => fromPiece.resolve(`${name}/package.json`),
    `The desktop bundle must include ${name}, which the Docture piece leaves outside its bundle`,
  );
}
for (const name of [
  "docture/loaders/tesseract",
  "tesseract.js",
  "docture/loaders/paddleocr",
  "ppu-paddle-ocr",
  "onnxruntime-node",
  "docture/raster/canvas",
]) {
  assert.doesNotThrow(
    () => fromPiece.resolve(name),
    `The desktop bundle must include ${name} for OCR`,
  );
}

// Both scanners load, with their native parts: PaddleOCR runs on ONNX
// Runtime, and scanned pages are rendered with @napi-rs/canvas first.
const { DocumentLoaderTesseract } = await load("docture/loaders/tesseract");
const { createWorker } = await load("tesseract.js");
assert.equal(typeof DocumentLoaderTesseract, "function");
assert.equal(typeof createWorker, "function");
const { DocumentLoaderPaddleOcr } = await load("docture/loaders/paddleocr");
const { PaddleOcrService } = await load("ppu-paddle-ocr");
assert.equal(typeof DocumentLoaderPaddleOcr, "function");
assert.equal(typeof PaddleOcrService, "function");
const ort = await load("onnxruntime-node");
assert.ok(
  ort.listSupportedBackends().some((backend) => backend.name === "cpu"),
  "The desktop bundle's ONNX Runtime must load its native CPU backend for PaddleOCR",
);
const { createCanvas } = await load("@napi-rs/canvas");
assert.equal(
  createCanvas(8, 8).width,
  8,
  "The desktop bundle's @napi-rs/canvas must load to render scanned pages",
);
console.log("ok   the packaged OCR engines and the page rasterizer load");

const text = "Sektar desktop conversion smoke 2026";
const content = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, body] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
  .join(
    "",
  )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const { DocumentLoaderPdfJs } = await load("docture/loaders/pdfjs");
const reader = new DocumentLoaderPdfJs();
try {
  const loaded = await reader.load(
    {
      bytes: new Uint8Array(Buffer.from(pdf)),
      mimeType: "application/pdf",
      fileName: "desktop-smoke.pdf",
    },
    { signal: AbortSignal.timeout(30_000), request: { pages: [1] } },
  );
  assert.equal(loaded.pages.length, 1);
  assert.match(loaded.pages[0].text, /Sektar desktop conversion smoke 2026/);
  console.log(
    "ok   the packaged Docture piece's engines resolve and read a PDF's text",
  );
} finally {
  await reader.dispose?.();
}
