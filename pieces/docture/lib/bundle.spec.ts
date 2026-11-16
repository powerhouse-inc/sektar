import { prepareTestScanners } from "../../../conversions/test-support/models.js";
prepareTestScanners(false);
/**
 * The piece as `ph-cli build` ships it: bundled by the builder's own piece
 * config and external-dependency plugin, described by the builder's own
 * describe step, then run from the bundle. Guards the failure where a bundled
 * `import("docture/…")` left `init_locales is not defined` in the output.
 *
 * The bundle goes to a temporary folder whose `node_modules` points at this
 * project's, as `dist/node/pieces/docture` resolves them; the project's own
 * `dist` is never written.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPieceBuildConfig } from "@powerhousedao/shared/build-config";
import {
  createDetectionCache,
  describePieces,
  externalDepsPlugin,
  type ExternalDependency,
  type FileTrace,
} from "@powerhousedao/shared/build-pieces";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makePdf } from "../../../conversions/test-support/pdfs.js";
import { doctureConversionOutputSchema } from "./contracts.js";

const root = resolve(import.meta.dirname, "../../..");
const fromCli = createRequire(
  createRequire(join(root, "package.json")).resolve(
    "@powerhousedao/ph-cli/package.json",
  ),
);

type Build = (config: unknown) => Promise<unknown>;
type NodeFileTrace = (
  files: string[],
  options: { base: string; cache: object },
) => Promise<{
  fileList: Set<string>;
  reasons: Map<string, { parents: Set<string> }>;
}>;

let folder: string;
let bundle: string;
const external = new Map<string, ExternalDependency>();

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "docture-piece-bundle-"));
  await symlink(
    join(root, "node_modules"),
    join(folder, "node_modules"),
    "dir",
  );
  const { build } = (await import(
    pathToFileURL(fromCli.resolve("tsdown")).href
  )) as { build: Build };
  const { nodeFileTrace } = (await import(
    pathToFileURL(fromCli.resolve("@vercel/nft")).href
  )) as {
    nodeFileTrace: NodeFileTrace;
  };
  const cache = {};
  const trace = async (file: string): Promise<FileTrace> => {
    const { fileList, reasons } = await nodeFileTrace([file], {
      base: "/",
      cache,
    });
    const absolute = (path: string) => resolve("/", path);
    return {
      fileList: new Set([...fileList].map(absolute)),
      reasons: new Map(
        [...reasons].map(([path, reason]) => [
          absolute(path),
          { parents: new Set([...reason.parents].map(absolute)) },
        ]),
      ),
    };
  };
  const out = join(folder, "dist");
  const cwd = process.cwd();
  process.chdir(root);
  try {
    await build({
      ...buildPieceBuildConfig({
        entry: join(root, "pieces/docture/index.ts"),
        outDir: out,
        plugins: [
          externalDepsPlugin(trace, external, {
            root,
            cache: createDetectionCache(),
          }),
        ],
      }),
      logLevel: "silent",
    });
  } finally {
    process.chdir(cwd);
  }
  bundle = join(out, "index.mjs");
}, 120_000);

afterAll(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
});

describe("the Docture piece as the builder bundles it", () => {
  it("is described by the builder, with no native binary copied in", async () => {
    const list = join(folder, "list.mjs");
    await writeFile(
      list,
      `export const pieces = [{ name: "@powerhousedao/docture-piece", entry: ${JSON.stringify(bundle)} }];\n`,
    );
    const described = describePieces(root, list);
    expect(described.errors).toEqual([]);
    expect(described.pieces.map((piece) => piece.name)).toEqual([
      "@powerhousedao/docture-piece",
    ]);
    const files = await readdir(join(folder, "dist"), { recursive: true });
    expect(files.filter((file) => file.endsWith(".node"))).toEqual([]);
    expect(
      [...external.values()].map((dependency) => dependency.name).sort(),
    ).toEqual(["@napi-rs/canvas", "pdfjs-dist"]);
  });

  it("converts a digital and a scanned PDF from the bundle, storing through the file port", async () => {
    const loaded: unknown = await import(pathToFileURL(bundle).href);
    const piece = (
      loaded as {
        docture: {
          getAction(name: string): { run(context: unknown): Promise<unknown> };
        };
      }
    ).docture;
    const stored = new Map<string, Buffer>();
    const files = {
      upload: ({ data }: { fileName: string; data: Buffer }) => {
        const id = `attachment://v1:${createHash("sha256").update(data).digest("hex")}`;
        stored.set(id, data);
        return Promise.resolve({ id, url: id });
      },
    };
    const output = doctureConversionOutputSchema.parse(
      await piece.getAction("convert-pdf-to-markdown").run({
        propsValue: {
          file: {
            filename: "mixed.pdf",
            data: Buffer.from(
              makePdf([
                {
                  kind: "text",
                  lines: ["Northwind Supplies", "Invoice 2026-0042"],
                },
                { kind: "scan", lines: ["RECEIPT 7731", "Paid in full"] },
              ]),
            ),
          },
          method: "smart",
          onIncomplete: "stop",
        },
        files,
      }),
    );
    expect(
      output.pages.map((page) =>
        page.status === "read" ? page.method : page.status,
      ),
    ).toEqual(["digital", "ocr"]);
    const markdown = stored.get(output.markdown.ref)?.toString("utf8") ?? "";
    expect(markdown).toContain("Invoice 2026-0042");
    expect(markdown).toContain("RECEIPT 7731");
  }, 120_000);
});
