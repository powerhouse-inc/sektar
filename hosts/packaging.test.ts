// How conversion is packaged: the Docture piece that `ph-cli build` emits
// finds its engines where it is installed. Conversions run in the workflow
// runtime's piece workers.
//
// The checks of the built piece need a build that is newer than the piece's
// sources. Without one they are skipped; SEKTAR_REQUIRE_BUILT_PIECE=1 fails
// them instead, for a run that follows a build. SEKTAR_PACKAGE_DIR points
// them at another built copy of the package (an installed one, a desktop
// stack).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(process.env["SEKTAR_PACKAGE_DIR"] ?? project);
const pieceDir = join(built, "dist/node/pieces/docture");
const pieceEntry = join(pieceDir, "index.mjs");

type PackageJson = {
  dependencies?: Record<string, string>;
};
const readJson = (file: string) =>
  JSON.parse(readFileSync(file, "utf8")) as PackageJson;
const pkg = readJson(join(project, "package.json"));

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((file) => join(dir, file))
    .filter((file) => statSync(file).isFile());
}

/** Whether the built piece is there and no source of it is newer. */
function pieceIsBuilt(): boolean {
  if (!existsSync(pieceEntry)) return false;
  if (built !== project) return true;
  const builtAt = statSync(pieceEntry).mtimeMs;
  return [
    join(project, "pieces/index.ts"),
    ...filesUnder(join(project, "pieces/docture")),
    ...filesUnder(join(project, "conversions/engine")),
    ...filesUnder(join(project, "conversions/models")),
  ]
    .filter((file) => !/\.(test|spec)\.ts$/.test(file))
    .every((file) => statSync(file).mtimeMs <= builtAt);
}

const required = process.env["SEKTAR_REQUIRE_BUILT_PIECE"] === "1";
const builtIt = pieceIsBuilt() || required ? it : it.skip;

/** What the piece loads by name when it runs, without the bundler seeing it. */
const RESOLVED_AT_RUN_TIME = [
  "docture/loaders/pdfjs",
  "docture/loaders/tesseract",
  "docture/loaders/paddleocr",
  "docture/raster/canvas",
  "tesseract.js",
  "ppu-paddle-ocr",
  "onnxruntime-node",
];

describe("the package build", () => {
  it("downloads scanner weights explicitly instead of installing language packages", () => {
    expect(
      Object.keys(pkg.dependencies ?? {}).filter((name) =>
        name.startsWith("@tesseract.js-data/"),
      ),
    ).toEqual([]);
  });
  it("installs every engine package the piece loads by name", () => {
    for (const specifier of [
      "docture",
      "pdfjs-dist",
      "@napi-rs/canvas",
      ...RESOLVED_AT_RUN_TIME.filter((name) => !name.startsWith("docture/")),
    ]) {
      expect(pkg.dependencies?.[specifier], specifier).toBeDefined();
    }
  });
});

describe("the built Docture piece", () => {
  const declared = () =>
    readJson(join(pieceDir, "package.json")).dependencies ?? {};

  builtIt("is built, with the descriptor the workflow runtime reads", () => {
    expect(existsSync(pieceEntry)).toBe(true);
    expect(existsSync(join(pieceDir, "descriptor.json"))).toBe(true);
  });

  builtIt(
    "leaves the packages that need native code or WebAssembly outside its bundle, at the versions this package installs",
    () => {
      expect(Object.keys(declared())).toEqual(
        expect.arrayContaining(["@napi-rs/canvas", "pdfjs-dist"]),
      );
      for (const [name, version] of Object.entries(declared())) {
        expect(pkg.dependencies?.[name], name).toBe(version);
      }
    },
  );

  builtIt("finds every engine package from where it is installed", () => {
    const fromPiece = createRequire(pieceEntry);
    const missing = [
      ...Object.keys(declared()).map((name) => `${name}/package.json`),
      ...RESOLVED_AT_RUN_TIME,
    ].filter((specifier) => {
      try {
        fromPiece.resolve(specifier);
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });

  builtIt("carries no native binary of the machine that built it", () => {
    expect(
      filesUnder(pieceDir).filter((file) => file.endsWith(".node")),
    ).toEqual([]);
  });
});
