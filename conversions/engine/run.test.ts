import { prepareTestScanners } from "../test-support/models.js";
prepareTestScanners(true);
import { describe, expect, it } from "vitest";
import type {
  ConversionProfile,
  OcrSelection,
  PageOutcome,
  ResolvedConversionPlan,
} from "../contracts.js";
import { damagedPdf, makePdf, type PdfPage } from "../test-support/pdfs.js";
import { probeEngines } from "./engines.js";
import { ExecutionFailure } from "./executor.js";
import { planFingerprint, resolvePlan } from "./plan.js";
import { runConversion } from "./run.js";

const probe = probeEngines();
const tesseract: OcrSelection = {
  kind: "ocr",
  engine: "tesseract",
  languages: ["eng"],
};
const profiles = {
  digital: {
    reading: { kind: "digital" },
    pages: { kind: "all" },
  },
  smart: {
    reading: { kind: "smart", fallback: tesseract },
    pages: { kind: "all" },
  },
  ocr: {
    reading: { kind: "recognize", engine: tesseract },
    pages: { kind: "all" },
  },
} satisfies Record<string, ConversionProfile>;

async function convert(
  pages: readonly PdfPage[] | Uint8Array,
  profile: ConversionProfile,
  options: { signal?: AbortSignal; maxPages?: number } = {},
) {
  return runConversion(
    {
      bytes: pages instanceof Uint8Array ? pages : makePdf(pages),
      fileName: "test.pdf",
      plan: resolvePlan(profile, probe),
      maxPages: options.maxPages ?? 100,
      maxDurationMs: 120_000,
    },
    options.signal ?? new AbortController().signal,
  );
}

async function failure(promise: Promise<unknown>): Promise<ExecutionFailure> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ExecutionFailure) return error;
    throw error;
  }
  throw new Error("expected the conversion to fail");
}

const statuses = (pages: readonly PageOutcome[]) =>
  pages.map((page) =>
    page.status === "read" || page.status === "blank"
      ? `${page.page}:${page.status}/${page.method}`
      : `${page.page}:${page.status}`,
  );

const INVOICE = [
  "Northwind Supplies",
  "Invoice 2026-0042",
  "Total due 1,250.00 EUR",
];
const SCAN = ["RECEIPT 7731", "Paid in full", "Thank you"];

describe("converting a PDF", () => {
  it.each([
    "pdfjsVersion",
    "rasterizerVersion",
    "converterVersion",
    "contractVersion",
  ] as const)("refuses a saved OCR plan after %s changes", async (field) => {
    const current = resolvePlan(profiles.ocr, probe);
    const changed: ResolvedConversionPlan =
      field === "contractVersion"
        ? { ...current, contractVersion: 1 }
        : field === "converterVersion"
          ? {
              ...current,
              converterVersion: current.converterVersion.replace(
                "sektar-conversion/2",
                "sektar-conversion/0",
              ),
            }
          : {
              ...current,
              renderer: { ...current.renderer, [field]: "old-renderer" },
            };
    const error = await failure(
      runConversion(
        {
          bytes: makePdf([{ kind: "scan", lines: SCAN }]),
          fileName: "scan.pdf",
          plan: { ...changed, fingerprint: planFingerprint(changed) },
          maxPages: 100,
          maxDurationMs: 10_000,
        },
        new AbortController().signal,
      ),
    );
    expect(error.code).toBe("engine-unavailable");
    expect(error.message).toMatch(
      field === "contractVersion"
        ? /older converter/
        : /reading tools.*changed/,
    );
  });

  it("keeps short text layers without requiring OCR", async () => {
    const bundle = await convert(
      [{ kind: "text", lines: ["APPROVED"] }],
      profiles.digital,
    );
    expect(bundle.markdown).toContain("APPROVED");
    expect(statuses(bundle.pages)).toEqual(["1:read/digital"]);
  });

  it("reads a digital PDF and keeps page markers", async () => {
    const bundle = await convert(
      [
        { kind: "text", lines: INVOICE },
        {
          kind: "text",
          lines: ["Page two of the invoice", "Payment terms 30 days"],
        },
      ],
      profiles.digital,
    );
    expect(statuses(bundle.pages)).toEqual([
      "1:read/digital",
      "2:read/digital",
    ]);
    expect(bundle.markdown).toContain("<!-- page: 1 -->");
    expect(bundle.markdown).toContain("Invoice 2026-0042");
    expect(bundle.markdown).toContain("Payment terms 30 days");
    expect(bundle.documentPages).toBe(2);
  });

  it("tells an intentionally blank page from one it could not read", async () => {
    const bundle = await convert(
      [
        { kind: "text", lines: INVOICE },
        { kind: "blank" },
        { kind: "scan", lines: SCAN },
      ],
      profiles.digital,
    );
    expect(statuses(bundle.pages)).toEqual([
      "1:read/digital",
      "2:blank/digital",
      "3:unresolved",
    ]);
    expect(bundle.markdown).toContain("<!-- page 3 not read:");
    expect(bundle.markdown).not.toContain("<!-- page 2 not read");
  });

  it("recognizes only the pages without usable text in Smart mode", async () => {
    const bundle = await convert(
      [
        { kind: "text", lines: INVOICE },
        { kind: "scan", lines: SCAN },
      ],
      profiles.smart,
    );
    expect(statuses(bundle.pages)).toEqual(["1:read/digital", "2:read/ocr"]);
    expect(bundle.markdown).toMatch(/RECEIPT\s+7731/);
    expect(
      bundle.provenance.map((entry) => `${entry.role}:${entry.engine}`),
    ).toEqual(["digital:pdfjs", "ocr:tesseract"]);
  }, 60_000);

  it("keeps OCR text for a scanned page shorter than the digital threshold", async () => {
    const bundle = await convert(
      [
        { kind: "text", lines: INVOICE },
        { kind: "scan", lines: ["APPROVED", "J SMITH"] },
      ],
      profiles.smart,
    );
    expect(statuses(bundle.pages)).toEqual(["1:read/digital", "2:read/ocr"]);
    expect(bundle.markdown).toMatch(/APPROVED\s+J SMITH/);
  }, 60_000);

  it("does not run OCR on a blank page in Smart mode", async () => {
    const bundle = await convert(
      [{ kind: "text", lines: INVOICE }, { kind: "blank" }],
      profiles.smart,
    );
    expect(statuses(bundle.pages)).toEqual([
      "1:read/digital",
      "2:blank/digital",
    ]);
    expect(bundle.provenance.map((entry) => entry.role)).toEqual(["digital"]);
  }, 60_000);

  it("recognizes every page with OCR, ignoring the text layer", async () => {
    const bundle = await convert(
      [{ kind: "text", lines: INVOICE }, { kind: "blank" }],
      profiles.ocr,
    );
    expect(statuses(bundle.pages)).toEqual(["1:read/ocr", "2:blank/ocr"]);
    expect(bundle.provenance.map((entry) => entry.role)).toEqual(["ocr"]);
  }, 60_000);

  it("refuses what cannot be converted, with a reason", async () => {
    expect(
      (
        await failure(
          convert(
            makePdf([{ kind: "text", lines: INVOICE }], {
              userPassword: "secret",
            }),
            profiles.digital,
          ),
        )
      ).code,
    ).toBe("encrypted");
    expect((await failure(convert(damagedPdf(), profiles.digital))).code).toBe(
      "damaged",
    );
    expect(
      (
        await failure(
          convert([{ kind: "blank" }, { kind: "blank" }], profiles.smart),
        )
      ).code,
    ).toBe("blank-document");
    expect(
      (
        await failure(
          convert([{ kind: "scan", lines: SCAN }], profiles.digital),
        )
      ).code,
    ).toBe("no-content");
    expect(
      (
        await failure(
          convert(
            [
              { kind: "text", lines: INVOICE },
              { kind: "text", lines: INVOICE },
            ],
            profiles.digital,
            { maxPages: 1 },
          ),
        )
      ).code,
    ).toBe("too-many-pages");
    const selected: ConversionProfile = {
      ...profiles.digital,
      pages: { kind: "selected", pages: [3] },
    };
    expect(
      (await failure(convert([{ kind: "text", lines: INVOICE }], selected)))
        .code,
    ).toBe("page-out-of-range");
  });

  it("stops when cancelled and reports it", async () => {
    const controller = new AbortController();
    const running = convert(
      [
        { kind: "scan", lines: SCAN },
        { kind: "scan", lines: SCAN },
        { kind: "scan", lines: SCAN },
      ],
      profiles.ocr,
      { signal: controller.signal },
    );
    setTimeout(() => controller.abort(), 300);
    expect((await failure(running)).code).toBe("cancelled");
  }, 60_000);
});

describe.skipIf(probe.paddleocr.status === "unavailable")("PaddleOCR", () => {
  it("recognizes the scanned pages of a Smart conversion with its default model", async () => {
    const bundle = await convert(
      [
        { kind: "text", lines: INVOICE },
        { kind: "scan", lines: SCAN },
      ],
      {
        ...profiles.smart,
        reading: {
          kind: "smart",
          fallback: { kind: "ocr", engine: "paddleocr", languages: ["eng"] },
        },
      },
    );
    expect(statuses(bundle.pages)).toEqual(["1:read/digital", "2:read/ocr"]);
    expect(bundle.markdown).toMatch(/RECEIPT\s+7731/);
    expect(
      bundle.provenance.map(
        (entry) => `${entry.role}:${entry.engine}:${entry.model ?? ""}`,
      ),
    ).toEqual(["digital:pdfjs:", "ocr:paddleocr:v6Small"]);
  }, 300_000);
});
