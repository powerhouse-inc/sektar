import { describe, expect, it } from "vitest";
import {
  defaultConversionProfile,
  type ConversionProfile,
  type ResolvedConversionPlan,
} from "../../../conversions/contracts.js";
import {
  localOcrOf,
  READING_METHODS,
  withLanguages,
  withMethod,
  withOcrModel,
  withRecognition,
} from "../../../pieces/docture/lib/profile.js";
import {
  capabilities,
  completeJob,
  failedJob,
  HOST_LIMITS,
  MAIL_SOURCE,
  pages,
  PLAN,
  settings,
  queuedJob,
  runningJob,
} from "./conversion-fixtures.js";
import {
  blockersOf,
  coverageOf,
  coverageText,
  countsOf,
  downloadName,
  draftOf,
  jobsOf,
  methodAvailable,
  pageList,
  profileLabel,
  progressText,
  provenanceDetail,
  provenanceLabel,
  readingSummary,
  sameDraft,
  fullWhen,
  methodOfPlan,
  missingPageReason,
  pagesReadText,
  profileOfPlan,
  scanningProfile,
  shortWhen,
  startedAgo,
  versionsOf,
  versionWhen,
  warningLines,
  warningNote,
} from "./conversion-model.js";

const smart = defaultConversionProfile;
const digital = withMethod(smart, "digital");

describe("the words for a profile, a settings and a finished conversion", () => {
  it("names how a profile and a job's plan read pages", () => {
    expect(profileLabel(smart)).toBe("PDF.js + Tesseract");
    expect(profileLabel(withMethod(smart, "ocr"))).toBe("Tesseract");
    expect(profileLabel(digital)).toBe("PDF.js");
    expect(profileLabel(PLAN)).toBe("PDF.js + Tesseract");
  });

  it("sums up how a profile reads by method and language, not by engine", () => {
    expect(readingSummary(smart)).toBe("Standard, English");
    expect(readingSummary(digital)).toBe("Text only");
    expect(
      readingSummary(withLanguages(withMethod(smart, "ocr"), ["eng", "spa"])),
    ).toBe("Scan every page, English, Spanish");
  });

  it("uses the host's own name for an engine", () => {
    const named = capabilities({
      ocr: [
        {
          id: "tesseract",
          label: "Tesseract 7",
          availability: { status: "available", version: "7" },
          languages: ["eng"],
          models: [],
        },
      ],
    });
    expect(profileLabel(smart, named)).toBe("PDF.js + Tesseract 7");
  });

  it("names the engines a document recorded, as the host writes them", () => {
    const recorded = [
      "digital:pdfjs@pdfjs-dist@6.4.299",
      "ocr:paddleocr@ppu-paddle-ocr@6.3.0+onnxruntime-node@1.27.0",
    ];
    expect(recorded.map((method) => provenanceLabel(method))).toEqual([
      "PDF.js",
      "PaddleOCR",
    ]);
    expect(recorded.map((method) => provenanceDetail(method))).toEqual([
      "PDF.js (pdfjs-dist@6.4.299)",
      "PaddleOCR (ppu-paddle-ocr@6.3.0+onnxruntime-node@1.27.0)",
    ]);
    expect(provenanceLabel("something else")).toBe("something else");
    expect(provenanceDetail("something else")).toBe("something else");
  });
});

describe("what this host cannot run", () => {
  it("finds nothing wrong with a profile the host has everything for", () => {
    expect(blockersOf(smart, capabilities())).toEqual([]);
    expect(blockersOf(digital, capabilities())).toEqual([]);
  });

  it("names a language the engine has no data for", () => {
    const german = withLanguages(smart, ["eng", "deu"]);
    expect(blockersOf(german, capabilities())).toEqual([
      {
        what: "Tesseract",
        reason: "Tesseract has no language data for German on this host.",
        setup: "Install it on the host, or use English, Spanish.",
      },
    ]);
  });

  const withPaddle = (models: string[]) =>
    capabilities({
      ocr: [
        {
          id: "paddleocr",
          label: "PaddleOCR",
          availability: { status: "available", version: "6.3.0" },
          languages: [],
          models,
        },
      ],
    });

  it("asks no language of an engine that lists none", () => {
    // The host passes a profile's languages through to such an engine.
    const paddle = withRecognition(smart, "paddleocr", ["eng", "deu"]);
    expect(blockersOf(paddle, withPaddle(["mobile", "server"]))).toEqual([]);
  });

  it("names a model the engine does not have, and none where the engine has no models", () => {
    const paddle = withOcrModel(withRecognition(smart, "paddleocr"), "huge");
    expect(blockersOf(paddle, withPaddle(["mobile", "server"]))).toEqual([
      {
        what: "PaddleOCR",
        reason: 'PaddleOCR has no model "huge".',
        setup: "Choose mobile, server.",
      },
    ]);
    expect(
      blockersOf(
        withOcrModel(paddle, "server"),
        withPaddle(["mobile", "server"]),
      ),
    ).toEqual([]);
    // Tesseract takes no model: the host ignores one, so it blocks nothing.
    expect(blockersOf(withOcrModel(smart, "anything"), capabilities())).toEqual(
      [],
    );
  });

  it("names PDF.js when the host cannot read text layers", () => {
    const [blocker] = blockersOf(
      digital,
      capabilities({
        digital: {
          status: "unavailable",
          reason: "PDF.js is not installed.",
          setup: "Reinstall Sektar's dependencies.",
        },
      }),
    );
    expect(blocker).toMatchObject({
      what: "PDF.js",
      reason: "PDF.js is not installed.",
    });
  });

  it("knows which methods the host can run at all", () => {
    const host = capabilities();
    expect(
      READING_METHODS.filter((method) => methodAvailable(method, host)),
    ).toEqual(["smart", "digital", "ocr"]);
    const bare = capabilities({ ocr: [] });
    expect(
      READING_METHODS.filter((method) => methodAvailable(method, bare)),
    ).toEqual(["digital"]);
  });
});

describe("a source's jobs", () => {
  const older = completeJob({
    id: "old",
    createdAt: "2026-11-09T08:00:00.000Z",
  });
  const newer = runningJob(undefined, {
    id: "new",
    createdAt: "2026-11-10T08:00:00.000Z",
  });
  const other = queuedJob({
    id: "other-attachment",
    source: { ...MAIL_SOURCE, attachmentId: "att-2" },
  });
  const mail = failedJob(undefined, { id: "mail", source: MAIL_SOURCE });

  it("are the ones of its document and attachment, newest first", () => {
    const all = [older, mail, other, newer];
    expect(
      jobsOf(all, { kind: "file", documentId: "file-1" }).map((job) => job.id),
    ).toEqual(["new", "old"]);
    expect(
      jobsOf(all, {
        kind: "mail",
        documentId: "email-1",
        attachmentId: "att-1",
      }).map((job) => job.id),
    ).toEqual(["mail"]);
    expect(jobsOf(all, { kind: "file", documentId: "email-1" })).toEqual([]);
  });

  it("say where they stand with only the page counts the host reports", () => {
    expect(
      progressText(
        runningJob({ stage: "reading", completedPages: null, totalPages: 1 }),
      ),
    ).toBe("Reading text · 1 page");
    expect(
      progressText(
        runningJob({
          stage: "recognizing",
          completedPages: 2,
          totalPages: null,
        }),
      ),
    ).toBe("Recognizing pages · 2 pages done");
    expect(
      progressText(
        runningJob({
          stage: "preflight",
          completedPages: null,
          totalPages: null,
        }),
      ),
    ).toBe("Checking the PDF");
    expect(progressText(older)).toBe("");
  });
});

describe("page coverage", () => {
  it("lists page numbers as a person reads them", () => {
    expect(pageList([7, 3, 4, 5, 9, 10, 3])).toBe("3 to 5, 7, 9, 10");
    expect(pageList([])).toBe("");
  });

  it("counts a blank page as processed and names the unread ones", () => {
    const outcomes = [
      ...pages(4, [2]),
      { status: "blank", page: 5, method: "digital" },
      { status: "failed", page: 6, reason: "The model did not answer." },
    ] as const;
    const coverage = coverageOf(outcomes);
    expect(coverage).toEqual({ total: 6, read: 3, blank: 1, unread: [2, 6] });
    expect(coverageText(countsOf(outcomes), coverage.unread)).toBe(
      "4 of 6 pages read, 1 blank, pages 2, 6 missing",
    );
  });
});

describe("a result's download name", () => {
  it("says partial for a partial result, once", () => {
    expect(downloadName("invoice.md", "complete")).toBe("invoice.md");
    expect(downloadName("invoice.partial.md", "partial")).toBe(
      "invoice.partial.md",
    );
    expect(downloadName("invoice", "partial")).toBe("invoice.partial");
  });
});

describe("policies", () => {
  it("start a scope the host said nothing about on demand, within the host's limits", () => {
    const draft = draftOf(undefined, HOST_LIMITS);
    expect(draft.activation).toBe("manual");
    expect(draft.profile).toEqual(defaultConversionProfile);
    expect(draft.limits).toEqual(HOST_LIMITS);
  });

  it("compare by what they choose, not by how the objects were built", () => {
    const a = draftOf(settings(), HOST_LIMITS);
    const reordered: ConversionProfile = {
      pages: { kind: "all" },
      reading: a.profile.reading,
    };
    expect(sameDraft(a, { ...a, profile: reordered })).toBe(true);
    expect(sameDraft(a, { ...a, activation: "off" })).toBe(false);
    expect(sameDraft(a, { ...a, limits: { ...a.limits, maxPages: 10 } })).toBe(
      false,
    );
  });
});

describe("a finished result, for the person reading it", () => {
  const textOnly: ResolvedConversionPlan = {
    ...PLAN,
    reading: { kind: "digital", readerVersion: "pdfjs-dist@6.4.299" },
  };
  const scanned: ResolvedConversionPlan = {
    ...PLAN,
    reading: {
      kind: "recognize",
      engine: {
        kind: "ocr",
        engine: "tesseract",
        languages: ["eng", "spa"],
        version: "tesseract.js@7.0.0+core@7.0.0",
        languageVersions: { eng: "1.0.0", spa: "1.0.0" },
      },
    },
  };

  it("reads the method and choices back from the plan that ran", () => {
    expect(methodOfPlan(PLAN)).toBe("smart");
    expect(methodOfPlan(textOnly)).toBe("digital");
    expect(methodOfPlan(scanned)).toBe("ocr");
    expect(profileOfPlan(PLAN)).toEqual(defaultConversionProfile);
    expect(readingSummary(profileOfPlan(scanned))).toBe(
      "Scan every page, English, Spanish",
    );
  });

  it("scans next with the scanner from Settings: Standard after Text only, else every page", () => {
    const app = withMethod(defaultConversionProfile, "smart", {
      kind: "ocr",
      engine: "tesseract",
      languages: ["spa"],
    });
    expect(scanningProfile(textOnly, app)).toEqual({
      reading: { kind: "smart", fallback: localOcrOf(app) },
      pages: textOnly.pages,
    });
    // The scanner the run used gives way to the one in Settings.
    expect(scanningProfile(PLAN, app)).toEqual(withMethod(app, "ocr"));
    expect(scanningProfile(PLAN, digital)).toBeNull();
  });

  it("says why a page wasn't read, from its outcome and the method that ran", () => {
    const reason = (ran: "digital" | "smart") =>
      missingPageReason({ status: "unresolved", page: 2, reason: "x" }, ran);
    expect(reason("digital")).toBe(
      "It looks like a scan, and text-only conversion skips scans.",
    );
    expect(reason("smart")).toBe("Scanning found no text on it.");
    expect(
      missingPageReason(
        { status: "failed", page: 2, reason: "OCR failed: worker crashed" },
        "ocr",
      ),
    ).toBe("Scanning it failed.");
    expect(pagesReadText(countsOf(pages(3, [2, 3])))).toBe("1 of 3 pages read");
  });

  it("turns known warnings into one plain note, and lists each raw warning once", () => {
    const layout = [1, 2, 3].map((page) => ({
      code: "LAYOUT_DEGRADED",
      message: `Page ${page} has lines but no loader-provided layout blocks.`,
      page,
    }));
    expect(warningNote([])).toBeNull();
    expect(warningNote(layout)).toBe(
      "Headings and columns may show as plain text on scanned pages.",
    );
    expect(warningNote([{ code: "NEW_CODE", message: "Something new." }])).toBe(
      "The converter left notes about this result, under Technical details.",
    );
    expect(
      warningLines([
        ...layout,
        { code: "NEW_CODE", message: "Something new." },
        { code: "NEW_CODE", message: "Something new." },
      ]),
    ).toEqual([
      "Pages 1 to 3: has lines but no loader-provided layout blocks.",
      "Something new. (2 times)",
    ]);
  });

  it("says when, in a few words", () => {
    const at = "2026-11-12T13:58:00.000Z";
    const now = Date.parse(at);
    expect(startedAgo(at, now + 4_000)).toBe("just now");
    expect(startedAgo(at, now + 20_000)).toBe("20 s ago");
    expect(startedAgo(at, now + 180_000)).toBe("3 min ago");
    expect(startedAgo(at, now + 7_200_000)).toBe(shortWhen(at));
    expect(shortWhen(at)).toMatch(/^1[23] Nov at \d{1,2}:58 [AP]M$/);
    expect(fullWhen(at)).toMatch(/^1[23] Nov 2026, \d{1,2}:58 [AP]M$/);
    expect(versionWhen(at, now)).toMatch(/^\d{1,2}:58 [AP]M$/);
    expect(versionWhen(at, now + 3 * 86_400_000)).toBe(shortWhen(at));
  });

  it("lists the current result first and the rest newest first, waiting for files still arriving", () => {
    const old = { id: "a", current: false };
    const current = { id: "b", current: true };
    const newer = { id: "c", current: false };
    expect(versionsOf([old, current, newer], false)).toEqual({
      latest: current,
      earlier: [newer, old],
    });
    expect(versionsOf([old, newer], false)).toEqual({
      latest: newer,
      earlier: [old],
    });
    expect(versionsOf([old, newer], true)).toEqual({
      latest: undefined,
      earlier: [newer, old],
    });
  });
});
