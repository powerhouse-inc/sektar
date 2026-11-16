import { prepareTestScanners } from "../../../conversions/test-support/models.js";
prepareTestScanners(false);
/**
 * The step as the workflow editor describes it, and as it runs: real PDFs
 * read by the installed Docture and PDF.js in this process. Only
 * the workflow's file store is a stand-in, answering as the host's attachment
 * store does: a content-addressed attachment:// reference per file.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  defaultConversionProfile,
  type ResolvedConversionPlan,
} from "../../../conversions/contracts.js";
import { probeEngines } from "../../../conversions/engine/engines.js";
import {
  planFingerprint,
  resolvePlan,
} from "../../../conversions/engine/plan.js";
import {
  makePdf,
  type PdfPage,
} from "../../../conversions/test-support/pdfs.js";
import { pieces } from "../../index.js";
import { docture } from "../index.js";
import {
  doctureConversionOutputSchema,
  doctureManifestSchema,
  type DoctureConversionOutput,
} from "./contracts.js";
import {
  ArtifactStoreError,
  ConversionIncompleteError,
  ConversionInputError,
  convertPdf,
  pagesOf,
  planOf,
  type ArtifactStore,
  type ConvertProps,
} from "./convert.js";
import { convertPdfToMarkdownAction } from "./convert-pdf-to-markdown.js";

const INVOICE = [
  "Northwind Supplies",
  "Invoice 2026-0042",
  "Total due 1,250.00 EUR",
];
const SCAN = ["RECEIPT 7731", "Paid in full", "Thank you"];

/** The workflow's ctx.files, as the host answers: one reference per stored file. */
function fileStore() {
  const stored = new Map<string, { fileName: string; data: Buffer }>();
  const files: ArtifactStore = {
    upload({ fileName, data }) {
      const ref = `attachment://v1:${createHash("sha256").update(data).digest("hex")}`;
      stored.set(ref, { fileName, data });
      return Promise.resolve({ id: ref });
    },
  };
  const read = (ref: string) => {
    const file = stored.get(ref);
    if (!file) throw new Error(`Nothing stored as ${ref}`);
    return file.data.toString("utf8");
  };
  return { files, stored, read };
}

function pdf(pages: readonly PdfPage[], filename = "invoice.pdf") {
  return { filename, data: Buffer.from(makePdf(pages)) };
}

async function convert(pages: readonly PdfPage[], props: ConvertProps = {}) {
  const store = fileStore();
  const output = await convertPdf({
    file: pdf(pages),
    props,
    files: store.files,
  });
  return { output: doctureConversionOutputSchema.parse(output), ...store };
}

async function refusal(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("expected the step to fail");
}

const statuses = (output: DoctureConversionOutput) =>
  output.pages.map((page) =>
    page.status === "read" || page.status === "blank"
      ? `${page.page}:${page.status}/${page.method}`
      : `${page.page}:${page.status}`,
  );

/* ------------------------------------------------------------ the form */

describe("Docture in the workflow editor", () => {
  it("is a registered piece with one action that needs no connection and no reactor", () => {
    expect(pieces).toContainEqual({
      name: "@powerhousedao/docture-piece",
      entry: "dist/node/pieces/docture/index.mjs",
    });
    expect(Object.keys(docture.actions())).toEqual(["convert-pdf-to-markdown"]);
    expect(convertPdfToMarkdownAction.requireAuth).toBe(false);
    expect(convertPdfToMarkdownAction.requireReactor).toBeUndefined();
  });

  it("asks for a PDF and how to read it, with a pinned plan and limits as advanced options", () => {
    const form: Record<
      string,
      Record<string, unknown>
    > = convertPdfToMarkdownAction.props;
    expect(Object.keys(form)).toEqual([
      "file",
      "method",
      "recognition",
      "paddleModel",
      "languages",
      "pages",
      "onIncomplete",
      "resolvedPlan",
      "limits",
    ]);
    expect(form.file).toMatchObject({ type: "FILE", required: true });
    expect(form.method).toMatchObject({
      required: true,
      defaultValue: "smart",
    });
    expect(form.resolvedPlan).toMatchObject({
      type: "JSON",
      required: false,
      advanced: true,
    });
    expect(form.limits).toMatchObject({
      type: "JSON",
      required: false,
      advanced: true,
    });
  });
});

/* ------------------------------------------------------------- running */

describe("converting in the step", () => {
  it("reads a digital PDF and hands on stored Markdown and manifest, not the text", async () => {
    const { output, read, stored } = await convert([
      { kind: "text", lines: INVOICE },
    ]);
    expect(output.completeness).toBe("complete");
    expect(output.plan.reading).toMatchObject({
      kind: "smart",
      fallback: { kind: "ocr", engine: "tesseract", languages: ["eng"] },
    });
    expect(output.markdown).toMatchObject({
      role: "markdown",
      fileName: "invoice.md",
      mimeType: "text/markdown",
    });
    const markdown = read(output.markdown.ref);
    expect(markdown).toContain("Invoice 2026-0042");
    expect(output.markdown.sizeBytes).toBe(Buffer.byteLength(markdown));
    expect(JSON.stringify(output)).not.toContain("Northwind");

    expect(output.artifacts).toHaveLength(1);
    const [manifestFile] = output.artifacts;
    expect(manifestFile).toMatchObject({
      role: "manifest",
      fileName: "invoice.conversion.json",
    });
    const manifest = doctureManifestSchema.parse(
      JSON.parse(read(output.artifacts[0].ref)),
    );
    expect(manifest.markdown).toEqual(output.markdown);
    expect(manifest.plan).toEqual(output.plan);
    expect(stored.size).toBe(2);
  });

  it("stops without storing anything when pages cannot be read, unless told to continue", async () => {
    const pages: PdfPage[] = [
      { kind: "text", lines: INVOICE },
      { kind: "scan", lines: SCAN },
    ];
    const stopped = fileStore();
    const error = await refusal(
      convertPdf({
        file: pdf(pages),
        props: { method: "digital" },
        files: stopped.files,
      }),
    );
    expect(error).toBeInstanceOf(ConversionIncompleteError);
    expect(error.message).toMatch(/\bpage 2\b/);
    expect(stopped.stored.size).toBe(0);

    const { output } = await convert(pages, {
      method: "digital",
      onIncomplete: "continue",
    });
    expect(output.completeness).toBe("partial");
    expect(statuses(output)).toEqual(["1:read/digital", "2:unresolved"]);
  });

  it("converts only the pages asked for", async () => {
    const { output, read } = await convert(
      [
        { kind: "text", lines: ["First page text that is long enough"] },
        { kind: "text", lines: INVOICE },
      ],
      { pages: "2" },
    );
    expect(statuses(output)).toEqual(["2:read/digital"]);
    expect(read(output.markdown.ref)).not.toContain("First page");
  });

  it("refuses AI reading a step saved earlier may still name, before reading or storing", async () => {
    const store = fileStore();
    for (const props of [
      { method: "ai" },
      { method: "smart", recognition: "ai" },
    ]) {
      const error = await refusal(
        convertPdf({
          file: pdf([{ kind: "text", lines: INVOICE }]),
          props,
          files: store.files,
        }),
      );
      expect(error).toBeInstanceOf(ConversionInputError);
    }
    expect(store.stored.size).toBe(0);
  });

  it.skipIf(probeEngines().paddleocr.status === "unavailable")(
    "reads with the PaddleOCR model the form names",
    async () => {
      const store = fileStore();
      const error = await refusal(
        convertPdf({
          file: pdf([{ kind: "scan", lines: SCAN }]),
          props: {
            method: "ocr",
            recognition: "paddleocr",
            paddleModel: "no-such-model",
          },
          files: store.files,
        }),
      );
      expect(error).toMatchObject({ code: "model-unavailable" });
      expect(store.stored.size).toBe(0);
    },
  );

  it("enforces its limits", async () => {
    const twoPages: PdfPage[] = [
      { kind: "text", lines: INVOICE },
      { kind: "text", lines: INVOICE },
    ];
    expect(
      await refusal(convert(twoPages, { limits: { maxBytes: 10 } })),
    ).toBeInstanceOf(ConversionInputError);
    expect(
      await refusal(convert(twoPages, { limits: { maxPages: 1 } })),
    ).toMatchObject({
      code: "too-many-pages",
    });
    expect(
      await refusal(convert(twoPages, { limits: "{ not json" })),
    ).toBeInstanceOf(ConversionInputError);
  });

  it("fails when the workflow cannot store files as attachments", async () => {
    const inline: ArtifactStore = {
      upload: () =>
        Promise.resolve({ id: "data:application/octet-stream;base64,AA==" }),
    };
    expect(
      await refusal(
        convertPdf({
          file: pdf([{ kind: "text", lines: INVOICE }]),
          props: {},
          files: inline,
        }),
      ),
    ).toBeInstanceOf(ArtifactStoreError);
  });
});

/* -------------------------------------------------------- a pinned plan */

describe("with a plan pinned by an earlier step", () => {
  const probe = probeEngines();
  const digital = resolvePlan(
    {
      ...defaultConversionProfile,
      reading: { kind: "digital" },
    },
    probe,
  );

  it("reads with the pinned plan, also given as JSON text, ignoring the form's method", async () => {
    for (const resolvedPlan of [digital, JSON.stringify(digital)]) {
      const { output } = await convert([{ kind: "text", lines: INVOICE }], {
        method: "ocr",
        resolvedPlan,
      });
      expect(output.plan).toEqual(digital);
      expect(statuses(output)).toEqual(["1:read/digital"]);
    }
  });

  it("refuses a plan edited after it was resolved", async () => {
    const edited: ResolvedConversionPlan = {
      ...digital,
      pages: { kind: "selected", pages: [1] },
    };
    const error = await refusal(
      convert([{ kind: "text", lines: INVOICE }], { resolvedPlan: edited }),
    );
    expect(error).toBeInstanceOf(ConversionInputError);
    expect(error.message).toContain("fingerprint");
  });

  it("refuses a plan resolved for other engine versions", async () => {
    const unsigned = {
      ...digital,
      reading: { ...digital.reading, readerVersion: "pdfjs-dist@0.0.1" },
    };
    const stale = { ...unsigned, fingerprint: planFingerprint(unsigned) };
    const error = await refusal(
      convert([{ kind: "text", lines: INVOICE }], { resolvedPlan: stale }),
    );
    expect(error).toMatchObject({ code: "engine-unavailable" });
  });
});

describe("workflow reading inputs", () => {
  it.each(["9007199254740992", "1-9007199254740992", "9".repeat(400)])(
    "rejects an unsafe page number: %s",
    (input) => {
      expect(() => pagesOf(input)).toThrow(ConversionInputError);
    },
  );
  it("expands ordinary page ranges", () => {
    expect(pagesOf("1-3, 7")).toEqual({
      kind: "selected",
      pages: [1, 2, 3, 7],
    });
  });
  it.each(["v6Tiny", "v6Medium"])(
    "keeps the Smart PaddleOCR model %s",
    (model) => {
      const plan = planOf(
        { method: "smart", recognition: "paddleocr", paddleModel: model },
        probeEngines(),
      );
      expect(plan.reading).toMatchObject({
        kind: "smart",
        fallback: { engine: "paddleocr", model },
      });
    },
  );
  it("rejects an unknown Smart PaddleOCR model", () => {
    expect(() =>
      planOf(
        {
          method: "smart",
          recognition: "paddleocr",
          paddleModel: "no-such-model",
        },
        probeEngines(),
      ),
    ).toThrow();
  });
});
