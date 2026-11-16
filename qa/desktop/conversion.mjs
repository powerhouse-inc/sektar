// Whether a packaged stack can read a PDF: the Docture piece is in it, and the
// engines that piece loads at run time resolve from where it sits and read a
// PDF's text. Conversions run in the workflow runtime's own piece workers, so
// nothing here starts a worker of Sektar's; a whole workflow run is the
// acceptance check's, not this one's. It ends with what integrated AI needs
// of the stack, which fails until upstream ships it.
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
for (const name of ["docture/loaders/tesseract", "tesseract.js"]) {
  assert.doesNotThrow(
    () => fromPiece.resolve(name),
    `The desktop bundle must include ${name} for OCR`,
  );
}

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

// Integrated AI and AI layout stay unavailable until the stack carries what
// they need; these two hold the packaged check back until it does.
const docture = await load("docture");
assert.equal(
  typeof docture.applyLayoutAnnotations,
  "function",
  "The desktop bundle must include Docture's AI layout validator",
);
const { createAiPlugin } = await import(
  pathToFileURL(
    createRequire(join(stack, "package.json")).resolve(
      "@powerhousedao/switchboard/plugins/ai",
    ),
  )
);
assert.equal(
  typeof createAiPlugin({
    upstreamUrl: "http://127.0.0.1:1",
    defaultModel: "qa/offline",
  }).hooks?.transformServerOptions,
  "function",
  "The desktop bundle must include host inference support",
);
