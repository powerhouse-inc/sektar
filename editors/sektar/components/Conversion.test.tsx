// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversionJobView,
  ConversionProfile,
  ResolvedConversionPlan,
} from "../../../conversions/contracts.js";
import type { ConversionRenditionView } from "../../../conversions/model-adapter.js";
import {
  publicationManifestSchema,
  publicationRowId,
} from "../../../conversions/publication.js";
import {
  withLanguages,
  withMethod,
  withOcrModel,
  withRecognition,
} from "../../../pieces/docture/lib/profile.js";
import {
  cancelledJob,
  capabilities,
  completeJob,
  converted,
  failedJob,
  needsAttentionJob,
  partialJob,
  pdfFile,
  PLAN,
  settings,
  queuedJob,
  ref,
  renditionView,
  runningJob,
  workflowRun,
} from "../kit/conversion-fixtures.js";
import { shortWhen } from "../kit/conversion-model.js";
import {
  ConversionApiError,
  createConversionClient,
} from "../kit/conversion.js";
import type { SourceConversion } from "../kit/use-conversion.js";
import {
  ConversionPendingRow,
  ConversionStatus,
  convertAction,
  ConvertButton,
  ConvertDialog,
  ConvertedMarkdown,
} from "./Conversion.js";
import { RenditionList } from "./FileDetail.js";
import { listedRenditions } from "./FilePreview.js";
import { Markdown } from "./Markdown.js";

// The attachment store: one Markdown file behind an object URL, and a save.
const store = vi.hoisted(() => ({
  saved: [] as { ref: string; fileName: string | undefined }[],
  markdown: "",
}));

vi.mock("@powerhousedao/reactor-browser", () => ({
  useAttachments: () => ({
    saveAttachment: (
      input: { ref: string },
      options?: { fileName?: string },
    ) => {
      store.saved.push({ ref: input.ref, fileName: options?.fileName });
      return Promise.resolve();
    },
  }),
  useAttachmentPreview: ({ ref: wanted }: { ref: string }) => ({
    stage: "done",
    loading: false,
    url: `blob:${wanted}`,
    error: undefined,
  }),
  useEditorFileDrop: () => ({ dragProps: {}, isDragOver: false }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let copied: string[];
/** What the host answers when asked what it can run. */
let offered = capabilities();

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  store.saved = [];
  store.markdown = "";
  copied = [];
  offered = capabilities();
  vi.stubGlobal("fetch", (input: string) =>
    Promise.resolve(
      input.startsWith("blob:")
        ? new Response(store.markdown, {
            headers: { "content-type": "text/markdown" },
          })
        : new Response(
            JSON.stringify(
              input.includes("models/readiness")
                ? { ready: true, files: [], totalBytes: 0, missingBytes: 0 }
                : input.includes("models/preparations")
                  ? { preparations: [] }
                  : offered,
            ),
          ),
    ),
  );
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: (value: string) => {
        copied.push(value);
        return Promise.resolve();
      },
    },
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

/** Renders and lets what the first render started (a read of the host, of a file) settle. */
async function show(node: ReactNode) {
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const client = createConversionClient({
  base: "https://host.example",
  fetch: (input, init) => fetch(input, init),
  token: () => Promise.resolve(undefined),
});

function conversionOf(over: Partial<SourceConversion> = {}): SourceConversion {
  return {
    host: { kind: "ready", client },
    availability: { kind: "ready" },
    source: { kind: "file", documentId: "file-1" },
    renditions: [],
    renditionsPending: false,
    current: undefined,
    jobs: [],
    historyJobs: [],
    active: undefined,
    jobsError: null,
    starting: false,
    startError: null,
    activation: { kind: "known", activation: "manual", settings: settings() },
    request: vi.fn(() => Promise.resolve(queuedJob())),
    cancel: vi.fn(() => Promise.resolve()),
    ...over,
  };
}

const button = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent.trim() === name ||
      candidate.getAttribute("aria-label") === name,
  );

const press = async (name: string) => {
  await settle();
  return act(async () => {
    button(name)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** A menu's item whose text begins with `name`. */
const menuItem = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].find(
    (item) => item.textContent.startsWith(name),
  );

const pressItem = (name: string) =>
  act(async () => {
    menuItem(name)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** Lets the host's answers (what it can run) arrive. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** The dialog's card for a method. */
function card(method: string): HTMLInputElement {
  const found = [
    ...document.querySelectorAll<HTMLLabelElement>(".sk-convert-choice"),
  ].find((candidate) =>
    candidate
      .querySelector(".sk-convert-choice__title")
      ?.textContent.startsWith(method),
  );
  const input = found?.querySelector("input");
  if (!input) throw new Error(`No card for ${method}`);
  return input;
}

const choose = (method: string) =>
  act(() => {
    card(method).click();
  });

const cards = () =>
  [...document.querySelectorAll(".sk-convert-choice")].map(
    (candidate) => candidate.textContent,
  );

/** The cards under the legend `legend`, by name and whether each can be picked. */
const options = (legend: string) =>
  [
    ...([...document.querySelectorAll("fieldset.sk-choice-cards")]
      .find((group) => group.querySelector("legend")?.textContent === legend)
      ?.querySelectorAll(".sk-choice-card") ?? []),
  ].map((card) => ({
    text: card.querySelector(".sk-choice-card__name")?.textContent,
    disabled: card.querySelector("input")?.disabled,
  }));

describe("asking for a conversion", () => {
  it("ignores a late answer from another host while the current host's request is pending", async () => {
    let answerOld = (_job: ConversionJobView) => {};
    let answerCurrent = (_job: ConversionJobView) => {};
    const first = conversionOf({
      request: () =>
        new Promise((resolve) => {
          answerOld = resolve;
        }),
    });
    const second = conversionOf({
      host: {
        kind: "ready",
        client: createConversionClient({
          base: "https://other-host.example",
          fetch: globalThis.fetch,
          token: () => Promise.resolve(undefined),
        }),
      },
      request: () =>
        new Promise((resolve) => {
          answerCurrent = resolve;
        }),
    });
    const oldAccepted = vi.fn();
    const currentAccepted = vi.fn();
    await show(
      <ConvertButton
        conversion={first}
        onChoose={() => {}}
        onStarted={oldAccepted}
      />,
    );
    await press("Convert to Markdown");
    await show(
      <ConvertButton
        conversion={second}
        onChoose={() => {}}
        onStarted={currentAccepted}
      />,
    );
    expect(button("Convert to Markdown")?.disabled).toBe(false);
    await press("Convert to Markdown");
    await act(async () => {
      answerOld(queuedJob());
      await Promise.resolve();
    });
    expect(button("Convert to Markdown")?.disabled).toBe(true);
    expect(oldAccepted).not.toHaveBeenCalled();
    expect(currentAccepted).not.toHaveBeenCalled();
    await act(async () => {
      answerCurrent(queuedJob());
      await Promise.resolve();
    });
    expect(currentAccepted).toHaveBeenCalledOnce();
    expect(button("Convert to Markdown")?.disabled).toBe(false);
  });

  it("says Convert again only once there is Markdown, and asks for a new result after an attempt", () => {
    expect(convertAction(conversionOf())).toMatchObject({
      label: "Convert to Markdown",
      again: false,
      disabled: false,
    });
    const stale = renditionView({ stale: true, current: false });
    expect(convertAction(conversionOf({ renditions: [stale] }))).toMatchObject({
      again: false,
    });
    const current = renditionView();
    expect(
      convertAction(conversionOf({ renditions: [current], current })),
    ).toMatchObject({
      label: "Convert again…",
      again: true,
    });
    // Without Markdown yet, a new attempt is still asked for, in first-time words.
    expect(
      convertAction(conversionOf({ jobs: [needsAttentionJob()] })),
    ).toMatchObject({
      label: "Convert to Markdown…",
      again: true,
      converted: false,
    });
    expect(
      convertAction(conversionOf({ renditionsPending: true })),
    ).toMatchObject({
      label: "Convert to Markdown…",
      again: true,
      converted: false,
    });
  });

  it("cannot be asked while one runs, or where conversion is off", () => {
    expect(convertAction(conversionOf({ active: runningJob() }))).toMatchObject(
      {
        disabled: true,
        title: "A conversion of this PDF is running.",
      },
    );
    expect(
      convertAction(
        conversionOf({
          availability: {
            kind: "blocked",
            reason: "Conversion is off in Settings.",
          },
        }),
      ),
    ).toMatchObject({
      disabled: true,
      title: "Conversion is off in Settings.",
    });
    expect(convertAction(conversionOf({ starting: true }))).toMatchObject({
      disabled: true,
      title: "A conversion of this PDF is being started.",
    });
  });

  it("converts at once with the app's settings, with no dialog", async () => {
    const conversion = conversionOf();
    const onChoose = vi.fn();
    const onStarted = vi.fn();
    await show(
      <ConvertButton
        conversion={conversion}
        onChoose={onChoose}
        onStarted={onStarted}
      />,
    );
    await press("Convert to Markdown");
    expect(conversion.request).toHaveBeenCalledOnce();
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({ profile: undefined, again: false }),
    );
    expect(onStarted).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("offers Text only and Scan every page for this once, and the dialog for anything else", async () => {
    const stored = settings({
      profile: withRecognition(settings().profile, "tesseract", ["eng", "spa"]),
    });
    const conversion = conversionOf({
      activation: { kind: "known", activation: "manual", settings: stored },
    });
    const onChoose = vi.fn();
    await show(<ConvertButton conversion={conversion} onChoose={onChoose} />);
    await press("More ways to convert");
    await settle();
    expect(
      [...document.querySelectorAll("[role=menuitem]")].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      "Text onlyFastest. Skips scanned pages.",
      "Scan every pageSlower. For scans or garbled text.",
      "Choose options…",
    ]);
    await pressItem("Scan every page");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: withMethod(stored.profile, "ocr"),
        again: false,
      }),
    );
    await press("More ways to convert");
    await pressItem("Choose options…");
    expect(onChoose).toHaveBeenCalledOnce();
  });

  it("says why a method the host can't run is not offered", async () => {
    offered = capabilities({
      ocr: capabilities().ocr.map((engine) => ({
        ...engine,
        availability: {
          status: "unavailable",
          reason: `${engine.label} is not installed on this host.`,
          setup: "Reinstall Sektar's dependencies.",
        },
      })),
    });
    await show(
      <ConvertButton conversion={conversionOf()} onChoose={() => undefined} />,
    );
    await press("More ways to convert");
    await settle();
    expect(menuItem("Text only")?.disabled).toBe(false);
    expect(menuItem("Scan every page")?.disabled).toBe(true);
    expect(menuItem("Scan every page")?.textContent).toContain(
      "is not installed on this host. Reinstall Sektar's dependencies.",
    );
  });

  it("shows a spinner until the host accepts, and says so once", async () => {
    let answer: (job: ReturnType<typeof queuedJob>) => void = () => undefined;
    const request = vi.fn<SourceConversion["request"]>(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const onStarted = vi.fn();
    const conversion = conversionOf({ request });
    const view = (over: Partial<SourceConversion> = {}) => (
      <ConvertButton
        conversion={{ ...conversion, ...over }}
        onChoose={() => undefined}
        onStarted={onStarted}
      />
    );
    await show(view());
    await press("Convert to Markdown");
    expect(button("Convert to Markdown")?.disabled).toBe(true);
    expect(host.querySelector(".sk-spinner")).not.toBeNull();
    expect(onStarted).not.toHaveBeenCalled();

    // The run shows on the source before the host answers the request.
    const run = workflowRun(runningJob(), false);
    await show(view({ starting: true, jobs: [run], active: run }));
    expect(onStarted).toHaveBeenCalledOnce();
    await act(async () => {
      answer(queuedJob());
      await Promise.resolve();
    });
    expect(onStarted).toHaveBeenCalledOnce();
  });
});

describe("the options dialog", () => {
  const dialog = (
    conversion: SourceConversion,
    over: { onClose?: () => void; onStarted?: () => void } = {},
  ) => (
    <ConvertDialog
      conversion={conversion}
      fileName="invoice.pdf"
      onClose={over.onClose ?? (() => undefined)}
      onStarted={over.onStarted}
    />
  );

  it("names each method by what it does and marks the source's default", async () => {
    offered = capabilities({
      execution: {
        kind: "workflow",
        runningCancellation: false,
        pageProgress: false,
      },
    });
    await show(dialog(conversionOf()));
    expect(document.body.textContent).toContain(
      "Makes a Markdown copy of invoice.pdf. The PDF isn't changed.",
    );
    expect(cards()).toEqual([
      "StandardApp defaultWorks for most PDFs. Copies the text in the PDF and reads pages that are pictures, like scanned paper.",
      "Text onlyFastest. Copies only the text in the PDF and skips pages that are pictures, like scanned paper.",
      "Scan every pageSlower. Reads every page as a picture. Try it when text comes out jumbled or in the wrong order.",
    ]);
    expect(card("Standard").checked).toBe(true);
    expect(
      document.querySelector(".sk-convert-app-scanner__name")?.textContent,
    ).toBe("Tesseract · English");
    expect(document.body.textContent).not.toContain("cancelled");
    expect(document.body.textContent).not.toContain("Waiting for the host");
  });

  it("uses the app's settings unless another method is picked, and closes once the host accepts", async () => {
    const conversion = conversionOf();
    const onClose = vi.fn();
    const onStarted = vi.fn();
    await show(dialog(conversion, { onClose, onStarted }));
    await press("Convert");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({ profile: undefined, again: false }),
    );
    expect(onStarted).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("waits for saved defaults before allowing a method override", async () => {
    const conversion = conversionOf({ activation: { kind: "unknown" } });
    await show(dialog(conversion));
    expect(card("Scan every page").disabled).toBe(true);
    expect(button("Convert")?.disabled).toBe(true);
    choose("Scan every page");
    expect(conversion.request).not.toHaveBeenCalled();
    const stored = settings({
      profile: withRecognition(settings().profile, "tesseract", ["spa"]),
    });
    await show(
      dialog({
        ...conversion,
        activation: { kind: "known", activation: "manual", settings: stored },
      }),
    );
    expect(card("Scan every page").disabled).toBe(false);
    choose("Scan every page");
    await press("Convert");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: withMethod(stored.profile, "ocr"),
      }),
    );
  });

  it("sends the method picked for this once, with the source's other choices", async () => {
    const stored = settings({
      profile: withRecognition(settings().profile, "tesseract", ["eng", "spa"]),
    });
    const conversion = conversionOf({
      activation: { kind: "known", activation: "manual", settings: stored },
    });
    await show(dialog(conversion));
    choose("Scan every page");
    await press("Convert");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: {
          reading: {
            kind: "recognize",
            engine: {
              kind: "ocr",
              engine: "tesseract",
              languages: ["eng", "spa"],
            },
          },
          pages: { kind: "all" },
        },
      }),
    );
  });

  it.each(["Standard", "Scan every page"])(
    "keeps scanner choices through Text only back to %s",
    async (method) => {
      offered = capabilities({
        ocr: [
          {
            id: "paddleocr",
            label: "PaddleOCR",
            availability: { status: "available", version: "test" },
            languages: ["spa"],
            models: ["v6Medium"],
          },
        ],
      });
      const scanner = {
        kind: "ocr",
        engine: "paddleocr",
        languages: ["spa"],
        model: "v6Medium",
      } as const;
      const stored = settings({
        profile: {
          reading: {
            kind: "smart",
            fallback: { ...scanner, languages: ["spa"] },
          },
          pages: { kind: "all" },
        },
      });
      const conversion = conversionOf({
        activation: { kind: "known", activation: "manual", settings: stored },
      });
      await show(dialog(conversion));
      choose("Text only");
      choose(method);
      await press("Convert");
      // Back on the app's own method, the request carries no override.
      expect(conversion.request).toHaveBeenCalledWith(
        expect.objectContaining({
          profile:
            method === "Standard"
              ? undefined
              : {
                  reading: { kind: "recognize", engine: scanner },
                  pages: stored.profile.pages,
                },
        }),
      );
    },
  );

  it("names the scanner from Settings and offers no other scanner, model or language", async () => {
    offered = capabilities({
      ocr: [
        {
          id: "paddleocr",
          label: "PaddleOCR",
          availability: { status: "available", version: "test" },
          languages: [],
          models: ["v6Tiny", "v6Small", "v6Medium"],
        },
        {
          id: "tesseract",
          label: "Tesseract",
          availability: { status: "available", version: "test" },
          languages: ["eng", "spa", "deu", "fra"],
          models: [],
        },
      ],
    });
    const stored = settings({
      profile: withOcrModel(
        withRecognition(settings().profile, "paddleocr"),
        "v6Medium",
      ),
    });
    await show(
      dialog(
        conversionOf({
          activation: { kind: "known", activation: "manual", settings: stored },
        }),
      ),
    );
    expect(
      document.querySelector(".sk-convert-app-scanner__name")?.textContent,
    ).toBe("PaddleOCR · Most accurate");
    expect(document.querySelectorAll("fieldset.sk-choice-cards")).toHaveLength(
      0,
    );
    expect(document.querySelector(".sk-convert-languages")).toBeNull();
    expect(document.body.textContent).toContain(
      "To use another scanner, model or language, change it there.",
    );
    expect(document.body.textContent).not.toContain("Download");
    choose("Text only");
    expect(document.querySelector(".sk-convert-app-scanner")).toBeNull();
  });

  it("reads fewer of the languages in Settings for this PDF, never others", async () => {
    const stored = settings({
      profile: withRecognition(settings().profile, "tesseract", ["eng", "spa"]),
    });
    const conversion = conversionOf({
      activation: { kind: "known", activation: "manual", settings: stored },
    });
    await show(dialog(conversion));
    const chips = () =>
      [
        ...document.querySelectorAll<HTMLInputElement>(
          ".sk-convert-languages input",
        ),
      ].map((input) => ({
        name: input.parentElement?.textContent,
        checked: input.checked,
        disabled: input.disabled,
      }));
    expect(chips()).toEqual([
      { name: "English", checked: true, disabled: false },
      { name: "Spanish", checked: true, disabled: false },
    ]);
    act(() => {
      document
        .querySelector<HTMLInputElement>(".sk-convert-languages input")
        ?.click();
    });
    expect(chips()).toEqual([
      { name: "English", checked: false, disabled: false },
      { name: "Spanish", checked: true, disabled: true },
    ]);
    await press("Convert");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: withLanguages(stored.profile, ["spa"]),
      }),
    );
  });

  it("leaves scanning out when Settings has no scanner", async () => {
    const stored = settings({
      profile: withMethod(settings().profile, "digital"),
    });
    await show(
      dialog(
        conversionOf({
          activation: { kind: "known", activation: "manual", settings: stored },
        }),
      ),
    );
    for (const method of ["Standard", "Scan every page"]) {
      expect(card(method).disabled).toBe(true);
      expect(card(method).closest("label")?.textContent).toContain(
        "No scanner is set in Settings. Choose one in Settings → Document conversion.",
      );
    }
    expect(card("Text only").checked).toBe(true);
  });

  it("refuses a profile the host lacks an engine for, in the host's words", async () => {
    const paddle = settings({
      profile: withRecognition(settings().profile, "paddleocr"),
    });
    await show(
      dialog(
        conversionOf({
          activation: { kind: "known", activation: "manual", settings: paddle },
        }),
      ),
    );
    expect(document.body.textContent).toContain(
      "PaddleOCR is not installed on this host.",
    );
    expect(document.body.textContent).toContain(
      "Reinstall Sektar's dependencies.",
    );
    expect(button("Convert")?.disabled).toBe(true);
  });

  it("shows the host's refusal and keeps the same request for another try", async () => {
    const current = renditionView();
    const request = vi
      .fn<SourceConversion["request"]>()
      .mockRejectedValueOnce(
        new ConversionApiError(
          422,
          "scanner-not-in-settings",
          "This conversion asks for a scanner that isn't chosen in Settings.",
        ),
      )
      .mockResolvedValue(queuedJob());
    const onClose = vi.fn();
    await show(
      dialog(conversionOf({ renditions: [current], current, request }), {
        onClose,
      }),
    );
    await press("Convert");
    expect(document.body.textContent).toContain(
      "This conversion asks for a scanner that isn't chosen in Settings.",
    );
    expect(onClose).not.toHaveBeenCalled();
    await press("Convert");
    expect(onClose).toHaveBeenCalledOnce();
    const [first, second] = request.mock.calls.map(([input]) => input);
    expect(first.again).toBe(true);
    expect(first.requestId).toBeTruthy();
    expect(second.requestId).toBe(first.requestId);
  });

  it("closes as soon as the run shows, before the host answers", async () => {
    let answer: (job: ReturnType<typeof queuedJob>) => void = () => undefined;
    const request = vi.fn<SourceConversion["request"]>(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const onClose = vi.fn();
    const conversion = conversionOf({ request });
    await show(dialog(conversion, { onClose }));
    await press("Convert");
    expect(button("Convert")?.disabled).toBe(true);
    expect(document.querySelector("[role=dialog] .sk-spinner")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    const run = workflowRun(runningJob(), false);
    await show(
      dialog(
        { ...conversion, starting: true, jobs: [run], active: run },
        {
          onClose,
        },
      ),
    );
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => {
      answer(queuedJob());
      await Promise.resolve();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a refusal apart from a run that is under way all the same", async () => {
    const request = vi
      .fn<SourceConversion["request"]>()
      .mockRejectedValue(new ConversionApiError(504, null, "Timed out."));
    const conversion = conversionOf({ request });
    const run = workflowRun(runningJob(), false);
    await show(dialog(conversion));
    await press("Convert");
    await show(dialog({ ...conversion, jobs: [run], active: run }));
    expect(document.body.textContent).toContain("Timed out.");
    expect(document.body.textContent).toContain(
      "A conversion of this PDF is running anyway.",
    );
    expect(button("Convert")?.disabled).toBe(true);
  });

  it("cannot be confirmed where conversion is off", async () => {
    await show(
      dialog(
        conversionOf({
          availability: {
            kind: "blocked",
            reason: "Conversion is off in Settings.",
          },
        }),
      ),
    );
    expect(button("Convert")?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Conversion is off in Settings.",
    );
  });

  it("retries an attention job with its exact profile instead of the source defaults", async () => {
    const attempted: ConversionProfile = {
      ...withMethod(settings().profile, "digital"),
      pages: { kind: "selected", pages: [2] },
    };
    const sourcePolicy = settings({
      profile: withMethod(settings().profile, "ocr", {
        kind: "ocr",
        engine: "tesseract",
        languages: ["eng", "spa"],
      }),
    });
    const conversion = conversionOf({
      jobs: [needsAttentionJob(undefined, { profile: attempted })],
      activation: {
        kind: "known",
        activation: "manual",
        settings: sourcePolicy,
      },
    });
    await show(dialog(conversion));
    expect(card("Text only").checked).toBe(true);
    await press("Convert");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({ profile: attempted, again: true }),
    );
  });

});

/** The pending row, in a list as a surface shows it. */
const pending = (conversion: SourceConversion) => (
  <ul>
    <ConversionPendingRow conversion={conversion} />
  </ul>
);

describe("a conversion under way", () => {
  it("shows a running workflow's step where its result will appear, with no Cancel and no warning", async () => {
    const job = workflowRun(
      runningJob({
        stage: "recognizing",
        completedPages: null,
        totalPages: null,
      }),
      false,
    );
    const conversion = conversionOf({ jobs: [job], active: job });
    await show(pending(conversion));
    expect(host.querySelector(".sk-file-row__name")?.textContent).toBe(
      "Markdown",
    );
    expect(host.querySelector(".sk-file-row__meta")?.textContent).toMatch(
      /^Converting the PDF, started /,
    );
    expect(host.querySelector(".sk-spinner")).not.toBeNull();
    expect(button("Cancel")).toBeUndefined();
    expect(host.textContent).not.toContain("cancelled");
    // The status line says nothing more about it.
    await show(<ConversionStatus conversion={conversion} />);
    expect(host.textContent).toBe("");
  });

  it("cancels a run that waits to start, where the host says it can be", async () => {
    const job = workflowRun(queuedJob(), true);
    const conversion = conversionOf({ jobs: [job], active: job });
    await show(pending(conversion));
    expect(host.textContent).toMatch(/Waiting to start, asked /);
    await press("Cancel");
    expect(conversion.cancel).toHaveBeenCalledWith(job.id);
    expect(host.textContent).toContain("Cancelling");
    expect(button("Cancel")).toBeUndefined();
  });

  it("shows the host's refusal when a run started before it could be cancelled", async () => {
    const job = workflowRun(queuedJob(), true);
    const cancel = vi.fn(() =>
      Promise.reject(
        new ConversionApiError(409, "not-cancellable", "It is running now."),
      ),
    );
    await show(pending(conversionOf({ jobs: [job], active: job, cancel })));
    await press("Cancel");
    expect(host.textContent).toContain("It is running now.");
    expect(host.textContent).not.toContain("Cancelling");
  });

  it("shows a request being started before the host lists its run", async () => {
    const current = renditionView();
    await show(
      pending(conversionOf({ starting: true, renditions: [current], current })),
    );
    expect(host.querySelector(".sk-file-row__meta")?.textContent).toBe(
      "Converting, started just now",
    );
    expect(button("Cancel")).toBeUndefined();
  });

  it("keeps showing a run that is under way when its request failed", async () => {
    const job = workflowRun(runningJob(), false);
    await show(
      pending(
        conversionOf({
          jobs: [job],
          active: job,
          startError: "The host took too long to answer.",
        }),
      ),
    );
    expect(host.textContent).toContain(
      "Converting the PDF · 3 of 12 pages, started",
    );
    expect(host.textContent).toContain(
      "The conversion is running, even though asking for it reported a problem.",
    );
    expect(host.textContent).not.toContain("The host took too long to answer.");
  });

  it("shows nothing when no conversion is under way", async () => {
    await show(pending(conversionOf({ jobs: [completeJob()] })));
    expect(host.textContent).toBe("");
  });
});

describe("what else needs saying", () => {
  it("shows nothing for a PDF that was never converted", async () => {
    await show(<ConversionStatus conversion={conversionOf()} />);
    expect(host.textContent).toBe("");
  });

  it("leaves a saved result to its row, even after a partial attempt", async () => {
    const current = renditionView();
    await show(
      <ConversionStatus
        conversion={conversionOf({
          renditions: [current],
          current,
          jobs: [completeJob()],
        })}
      />,
    );
    expect(host.textContent).toBe("");
    const attempt = partialJob([3], {
      id: "job-2",
      createdAt: "2026-11-10T10:00:00.000Z",
    });
    await show(
      <ConversionStatus
        conversion={conversionOf({
          renditions: [current],
          current,
          jobs: [attempt, completeJob()],
        })}
      />,
    );
    expect(host.textContent).toBe("");
  });

  it("says why a request started nothing, and offers another try", async () => {
    const current = renditionView();
    const onRetry = vi.fn();
    await show(
      <ConversionStatus
        conversion={conversionOf({
          renditions: [current],
          current,
          jobs: [completeJob()],
          startError: "Conversion is off for this source.",
        })}
        onRetry={onRetry}
      />,
    );
    expect(host.textContent).toContain("Conversion is off for this source.");
    expect(host.textContent).not.toContain("The conversion didn't start:");
    expect(host.textContent).not.toContain("Converted");
    await press("Try again");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("gives the reason a conversion failed and offers another try", async () => {
    const onRetry = vi.fn();
    await show(
      <ConversionStatus
        conversion={conversionOf({ jobs: [failedJob()] })}
        onRetry={onRetry}
      />,
    );
    expect(host.textContent).toContain("This PDF is password protected.");
    expect(host.textContent).not.toContain("Couldn't convert:");
    await press("Try again");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers to discard an attempt whose cleanup failed, where the host can cancel it", async () => {
    const stuck = needsAttentionJob({
      code: "cleanup-failed",
      message: "The unfinished rendition could not be removed.",
      retryable: true,
    });
    await show(
      <ConversionStatus conversion={conversionOf({ jobs: [stuck] })} />,
    );
    expect(button("Discard attempt")).toBeUndefined();
    const conversion = conversionOf({ jobs: [workflowRun(stuck, true)] });
    await show(<ConversionStatus conversion={conversion} />);
    await press("Discard attempt");
    expect(conversion.cancel).toHaveBeenCalledWith("job-1");
    expect(conversion.request).not.toHaveBeenCalled();
  });

  it("requires an explicit new attempt when an attempt's outcome is unknown", async () => {
    const conversion = conversionOf({ jobs: [needsAttentionJob()] });
    const onRetry = vi.fn();
    await show(<ConversionStatus conversion={conversion} onRetry={onRetry} />);
    expect(host.textContent).toContain("Needs attention");
    expect(host.textContent).toContain(
      "Check the workflow's run history. Nothing is tried again on its own.",
    );
    expect(button("Try again")).toBeUndefined();
    expect(conversion.request).not.toHaveBeenCalled();
    await press("Convert to Markdown…");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("says why a cancelled conversion stopped", async () => {
    await show(
      <ConversionStatus
        conversion={conversionOf({
          jobs: [cancelledJob("Document conversion was turned off.")],
        })}
      />,
    );
    expect(host.textContent).toContain("Document conversion was turned off.");
    expect(host.textContent).not.toContain("Cancelled:");
  });
});

/** A plan that read only the text layer. */
const TEXT_ONLY: ResolvedConversionPlan = {
  ...PLAN,
  reading: { kind: "digital", readerVersion: "pdfjs-dist@6.4.299" },
};

/** A view whose result was read with `plan`. */
const readWith = (
  view: ConversionRenditionView,
  plan: ResolvedConversionPlan,
): ConversionRenditionView => ({
  ...view,
  publication: publicationManifestSchema.parse({
    ...view.publication,
    output: { ...view.publication.output, plan },
  }),
});

describe("reading the Markdown", () => {
  const markdown = [
    "<!-- page: 1 -->",
    "",
    "# Invoice",
    "",
    "| Item | Amount |",
    "| --- | --- |",
    "| Design | $1,200.00 |",
    "",
    "<script>window.hacked = true</script>",
    "",
    "[terms](https://example.com/terms) and [a trap](javascript:alert(1))",
    "",
    '<img src=x onerror="window.hacked = true">',
  ].join("\n");

  const read = (
    rendition: ConversionRenditionView,
    over: Partial<SourceConversion> = {},
    props: {
      onOpenPage?: (page: number) => void;
      replacedAt?: string;
      revealDetails?: number;
    } = {},
  ) => (
    <ConvertedMarkdown
      documentId="file-1"
      rendition={rendition}
      conversion={conversionOf({
        renditions: [rendition],
        current: rendition.current ? rendition : undefined,
        ...over,
      })}
      {...props}
    />
  );

  it("shows it as a document, and nothing in it can run", async () => {
    store.markdown = markdown;
    await show(read(renditionView()));
    expect(host.querySelector(".sk-markdown h1")?.textContent).toBe("Invoice");
    expect(
      [...host.querySelectorAll(".sk-markdown td")].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["Design", "$1,200.00"]);
    expect(host.querySelector(".sk-markdown script")).toBeNull();
    expect(host.querySelector(".sk-markdown img")).toBeNull();
    expect(host.textContent).toContain("<script>window.hacked = true</script>");
    const links = [
      ...host.querySelectorAll<HTMLAnchorElement>(".sk-markdown a"),
    ];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://example.com/terms",
    ]);
    expect(links[0].target).toBe("_blank");
    expect(links[0].rel).toBe("noreferrer noopener");
    expect(host.querySelector(".sk-markdown")?.textContent).toContain("a trap");
    expect((globalThis as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it("keeps copy and download in the toolbar and everything else in its menu", async () => {
    store.markdown = markdown;
    await show(read(renditionView()));
    const toolbar = host.querySelector(".sk-preview__toolbar");
    expect(
      [...(toolbar?.querySelectorAll("button") ?? [])].map((each) =>
        each.getAttribute("aria-label"),
      ),
    ).toEqual(["Copy Markdown", "Download Markdown", "More actions"]);
    expect(toolbar?.querySelector("a")).toBeNull();
    // No status line with engine names between the toolbar and the document.
    expect(toolbar?.nextElementSibling?.className).toBe(
      "sk-file-preview__sheet",
    );
    await press("More actions");
    expect(
      [...document.querySelectorAll("[role=menuitem]")].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      "Show raw Markdown",
      "Open in a new tab",
      "Convert again…",
      "Conversion details",
    ]);
  });

  it("switches to the Markdown as written and back from its menu", async () => {
    store.markdown = markdown;
    await show(read(renditionView()));
    await press("More actions");
    await pressItem("Show raw Markdown");
    expect(host.querySelector("h1")).toBeNull();
    expect(host.querySelector("pre")?.textContent).toBe(markdown);
    await press("More actions");
    await pressItem("Show as document");
    expect(host.querySelector("h1")?.textContent).toBe("Invoice");
  });

  it("opens the options dialog from Convert again… and its details from the menu", async () => {
    store.markdown = "# Invoice";
    await show(read(renditionView()));
    await press("More actions");
    await pressItem("Conversion details");
    expect(host.querySelector<HTMLDetailsElement>("details")?.open).toBe(true);
    await press("More actions");
    await pressItem("Convert again…");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain(
      "Convert again",
    );
  });

  it("offers the raw text to select where copying is not allowed", async () => {
    store.markdown = "# Title";
    vi.stubGlobal("navigator", {});
    await show(read(renditionView()));
    await press("Copy Markdown");
    expect(host.textContent).toContain(
      "Copying isn't allowed here. Select the raw Markdown.",
    );
    expect(host.querySelector("pre")?.textContent).toBe("# Title");
  });

  it("marks each missing page where it belongs, with why and how to read it", async () => {
    store.markdown = [
      "<!-- page: 1 -->",
      "",
      "NORTHWIND SUPPLIES",
      "",
      "<!-- page: 2 -->",
      "",
      "Total due",
      "",
      "<!-- page: 3 -->",
      "",
      "<!-- page 3 not read: No text layer. -->",
    ].join("\n");
    const rendition = readWith(
      renditionView({ completeness: "partial", ref: ref("e5") }),
      TEXT_ONLY,
    );
    const onOpenPage = vi.fn();
    const conversion = conversionOf({
      renditions: [rendition],
      current: rendition,
    });
    await show(
      <ConvertedMarkdown
        documentId="file-1"
        rendition={rendition}
        conversion={conversion}
        onOpenPage={onOpenPage}
      />,
    );
    expect(host.querySelector(".sk-preview__toolbar")?.textContent).toContain(
      "2 of 3 pages read",
    );
    expect(host.textContent).not.toContain("check the original");
    const notes = [...host.querySelectorAll(".sk-markdown__missing")];
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain(
      "Page 3 wasn't read. It looks like a scan, and text-only conversion skips scans.",
    );
    // Right after page 3 begins.
    expect(notes[0].previousElementSibling?.textContent).toBe("Page 3");

    await press("Open page 3");
    expect(onOpenPage).toHaveBeenCalledWith(3);
    await press("Convert with scanning");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: withMethod(
          {
            reading: { kind: "digital" },
              pages: { kind: "all" },
          },
          "smart",
          { kind: "ocr", engine: "tesseract", languages: ["eng"] },
        ),
        again: true,
      }),
    );
    expect(document.querySelector("[role=dialog]")).toBeNull();

    await press("Download the partial Markdown");
    expect(store.saved).toEqual([
      { ref: ref("e5"), fileName: "invoice.partial.md" },
    ]);
  });

  it("scans every page next when scanning already ran, and offers no page without the original", async () => {
    store.markdown =
      "<!-- page: 1 -->\n\nOne\n\n<!-- page: 2 -->\n\n<!-- page: 3 -->\n";
    const rendition = renditionView({ completeness: "partial" });
    const conversion = conversionOf({
      renditions: [rendition],
      current: rendition,
    });
    await show(
      <ConvertedMarkdown
        documentId="file-1"
        rendition={rendition}
        conversion={conversion}
      />,
    );
    expect(host.querySelector(".sk-markdown__missing")?.textContent).toContain(
      "Page 3 wasn't read. Scanning found no text on it.",
    );
    expect(button("Open page 3")).toBeUndefined();
    await press("Convert with scanning");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: withMethod(settings().profile, "ocr"),
      }),
    );
  });

  it("says when the Markdown was made from a replaced PDF, and converts the new one", async () => {
    store.markdown = "# Old";
    const rendition = renditionView({ stale: true, current: false });
    const conversion = conversionOf({ renditions: [rendition] });
    await show(
      <ConvertedMarkdown
        documentId="file-1"
        rendition={rendition}
        conversion={conversion}
        replacedAt="2026-11-12T14:09:00.000Z"
      />,
    );
    expect(host.textContent).toContain(
      `This Markdown was made from the previous PDF, which was replaced on ${shortWhen("2026-11-12T14:09:00.000Z")}.`,
    );
    await press("Convert the new PDF");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({ profile: undefined, again: false }),
    );
  });

  it("sums up how it was made, with the engines folded under Technical details", async () => {
    store.markdown = "# Invoice";
    const rendition = renditionView({
      jobId: "run-pruned",
      model: "v6Small",
      methods: [
        "digital:pdfjs@pdfjs-dist@6.4.299",
        "ocr:paddleocr@ppu-paddle-ocr@6.3.0",
      ],
    });
    await show(
      read(
        rendition,
        {
          jobsError:
            "Sektar's conversion service ran into a problem. Try again in a moment.",
        },
        { revealDetails: 1 },
      ),
    );
    expect(host.querySelector("h1")?.textContent).toBe("Invoice");
    expect(button("Download Markdown")).toBeDefined();
    const details = host.querySelector("details");
    const summary = details?.querySelector(":scope > dl")?.textContent ?? "";
    expect(summary).toContain("Made frominvoice.pdf Current PDF");
    expect(summary).toContain("PagesAll 3 pages");
    expect(summary).toContain("MethodStandard, English");
    expect(summary).not.toMatch(/pdfjs-dist|Note|AI|model request/);
    const technical = details?.querySelector("details");
    expect(technical?.open).toBe(false);
    expect(technical?.textContent).toContain(
      "EnginesPDF.js (pdfjs-dist@6.4.299), PaddleOCR (ppu-paddle-ocr@6.3.0)",
    );
    expect(technical?.textContent).toContain("Modelv6Small");
  });

  it("turns the converter's warnings into one note, with each raw warning once under Technical details", async () => {
    store.markdown = "# Invoice";
    const rendition = renditionView();
    rendition.publication.output.warnings = [1, 2, 3].map((page) => ({
      code: "LAYOUT_DEGRADED",
      message: `Page ${page} has lines but no loader-provided layout blocks.`,
      page,
    }));
    const later = failedJob(
      {
        code: "workflow-failed",
        message: "This PDF is password protected.",
        retryable: true,
        detail: 'Step "convert" failed: PasswordException',
      },
      { id: "job-2", createdAt: "2026-11-10T11:00:00.000Z" },
    );
    await show(
      read(rendition, { jobs: [later, completeJob()] }, { revealDetails: 1 }),
    );
    const details = host.querySelector("details");
    expect(details?.open).toBe(true);
    const summary = details?.querySelector(":scope > dl")?.textContent ?? "";
    expect(summary).not.toContain("AI");
    expect(summary).toContain(
      "NoteHeadings and columns may show as plain text on scanned pages.",
    );
    expect(summary).toContain(
      "Latest attemptThis PDF is password protected. This Markdown was kept.",
    );
    expect(summary).not.toContain("PasswordException");
    expect(details?.querySelector("details")?.textContent).toContain(
      'Latest attemptStep "convert" failed: PasswordException',
    );
    const warnings = [
      ...(details?.querySelectorAll(".sk-convert-warnings li") ?? []),
    ].map((item) => item.textContent);
    expect(warnings).toEqual([
      "Pages 1 to 3: has lines but no loader-provided layout blocks.",
    ]);
  });

  it("renders only the beginning of a very long document, and says so", async () => {
    store.markdown = `# Long\n\n${"A paragraph of text.\n\n".repeat(20_000)}`;
    await show(read(renditionView()));
    expect(host.textContent).toContain(
      "This is the beginning of a long document.",
    );
    expect(host.querySelectorAll("p").length).toBeLessThan(20_000);
    await press("Copy Markdown");
    expect(copied).toEqual([store.markdown]);
    expect(host.textContent).toContain("Copied");
  });
});

describe("Extracted content", () => {
  /** A File converted twice: a partial attempt, then a complete one. */
  function twice() {
    const doc = converted(
      converted(pdfFile(), true, {
        completeness: "partial",
        pages: [
          { status: "read", page: 1, method: "digital", characters: 1200 },
          { status: "unresolved", page: 2, reason: "No text layer." },
        ],
      }),
      true,
      {
        jobId: "job-2",
        createdAt: "2026-11-10T10:00:00.000Z",
        markdown: {
          id: "artifact-md-2",
          role: "markdown",
          ref: ref("e5"),
          fileName: "invoice.md",
          mimeType: "text/markdown",
          sizeBytes: 900,
        },
      },
    );
    const partial = renditionView({
      completeness: "partial",
      pageCount: 2,
      current: false,
    });
    const complete = renditionView({
      id: publicationRowId("job-2", "markdown"),
      jobId: "job-2",
      createdAt: "2026-11-10T10:00:00.000Z",
      pageCount: 2,
    });
    return { doc, views: [partial, complete] };
  }

  const list = (
    conversion: SourceConversion,
    doc = twice().doc,
    active: string | null = null,
  ) => (
    <RenditionList
      doc={doc}
      dispatch={() => undefined}
      active={active}
      onShow={() => undefined}
      conversion={conversion}
      renditions={listedRenditions(doc, conversion.renditions)}
      onDetails={() => undefined}
    />
  );

  const rows = (scope: ParentNode) =>
    [...scope.querySelectorAll(".sk-file-row")].map((row) => ({
      name: row.querySelector(".sk-file-row__name")?.textContent,
      meta: row.querySelector(".sk-file-row__meta")?.textContent,
    }));

  it("lists the latest Markdown with its state, and folds the earlier ones", async () => {
    const { views } = twice();
    const conversion = conversionOf({
      renditions: views,
      current: views[1],
      jobs: [completeJob({ id: "job-2" })],
    });
    await show(list(conversion));
    const main = host.querySelector(".sk-file-renditions > ul");
    expect(rows(main ?? host)).toEqual([
      {
        name: "Markdown",
        meta: `All 2 pages, ${shortWhen("2026-11-10T10:00:00.000Z")}`,
      },
    ]);
    expect(main?.querySelector(".sk-file-type")?.textContent).toBe("MD");
    const earlier = host.querySelector<HTMLDetailsElement>(
      "details.sk-convert-earlier",
    );
    expect(earlier?.open).toBe(false);
    expect(earlier?.querySelector("summary")?.textContent).toBe(
      "Earlier versions (1)",
    );
    expect(rows(earlier ?? host)).toEqual([
      {
        name: "MarkdownPartial",
        meta: `1 of 2 pages read, page 2 missing, ${shortWhen("2026-11-10T09:44:00.000Z")}`,
      },
    ]);
    expect(host.textContent).not.toMatch(/not current|earlier source/i);
    // Convert again lives in the row's menu, not beside the other actions.
    expect(button("Convert to Markdown")).toBeUndefined();
    expect(button("Convert again…")).toBeUndefined();
  });

  it("opens the earlier versions when one of them is shown", async () => {
    const { doc, views } = twice();
    const conversion = conversionOf({ renditions: views, current: views[1] });
    await show(list(conversion, doc, views[0].id));
    expect(
      host.querySelector<HTMLDetailsElement>("details.sk-convert-earlier")
        ?.open,
    ).toBe(true);
  });

  it("names a partial result's missing pages on its row, and a replaced PDF's Markdown as such", async () => {
    const { doc, views } = twice();
    const partial = { ...views[0], current: true };
    await show(
      list(conversionOf({ renditions: [partial], current: partial }), doc),
    );
    expect(rows(host)).toEqual([
      { name: "MarkdownPartial", meta: "1 of 2 pages read, page 2 missing" },
    ]);
    const stale = { ...views[1], stale: true, current: false };
    await show(list(conversionOf({ renditions: [stale] }), doc));
    expect(rows(host)[0].name).toBe("MarkdownPrevious PDF");
    // Nothing current: the PDF itself can be converted.
    expect(button("Convert to Markdown")).toBeDefined();
  });

  it("shows a conversion under way where its result will appear, with Cancel only when the host allows it", async () => {
    const doc = pdfFile();
    const running = workflowRun(runningJob(), false);
    await show(list(conversionOf({ jobs: [running], active: running }), doc));
    expect(rows(host).map((row) => row.name)).toEqual(["Markdown"]);
    expect(rows(host)[0].meta).toMatch(
      /^Converting the PDF · 3 of 12 pages, started /,
    );
    expect(button("Cancel")).toBeUndefined();
    expect(host.textContent).not.toContain("Nothing extracted yet");

    const queued = workflowRun(queuedJob(), true);
    const conversion = conversionOf({ jobs: [queued], active: queued });
    await show(list(conversion, doc));
    await press("Cancel");
    expect(conversion.cancel).toHaveBeenCalledWith(queued.id);
  });

  it("converts a PDF at once from its button, and says so in a toast", async () => {
    const doc = pdfFile();
    const conversion = conversionOf();
    await show(list(conversion, doc));
    await press("Convert to Markdown");
    expect(conversion.request).toHaveBeenCalledWith(
      expect.objectContaining({ profile: undefined, again: false }),
    );
    expect(document.querySelector(".sk-toast")?.textContent).toBe(
      "Converting. You can keep working.",
    );
  });
});

describe("the Markdown document", () => {
  it("labels where each page begins when there are several", async () => {
    await show(
      <Markdown
        source={"<!-- page: 1 -->\n\nOne\n\n<!-- page: 2 -->\n\nTwo"}
      />,
    );
    expect(host.textContent).toContain("Page 1");
    expect(host.textContent).toContain("Page 2");
    await show(<Markdown source={"<!-- page: 1 -->\n\nOnly"} />);
    expect(host.textContent).not.toContain("Page 1");
  });

  it("shows a note where its page begins, or first in a document without pages", async () => {
    const notes = new Map([[2, <p key="2">Two is missing</p>]]);
    await show(
      <Markdown
        source={
          "<!-- page: 1 -->\n\nOne\n\n<!-- page: 2 -->\n\n<!-- page: 3 -->\n\nThree"
        }
        notes={notes}
      />,
    );
    expect(
      [...host.querySelectorAll(".sk-markdown > *")].map(
        (block) => block.textContent,
      ),
    ).toEqual(["Page 1", "One", "Page 2", "Two is missing", "Page 3", "Three"]);
    await show(<Markdown source={"Just text"} notes={notes} />);
    expect(
      [...host.querySelectorAll(".sk-markdown > *")].map(
        (block) => block.textContent,
      ),
    ).toEqual(["Two is missing", "Just text"]);
  });

  it("names an image without fetching it", async () => {
    await show(
      <Markdown source={"![A chart](https://tracker.example/pixel.png)"} />,
    );
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("Image: A chart");
  });
});

/** A host whose scanner from Settings isn't downloaded yet; Text only needs none. */
const missingScanner = {
  ...client,
  modelReadiness: (profile: ConversionProfile) =>
    Promise.resolve(
      profile.reading.kind === "digital"
        ? { ready: true, files: [], totalBytes: 0, missingBytes: 0 }
        : {
            ready: false,
            files: [
              { id: "english", label: "English", bytes: 100, ready: false },
            ],
            totalBytes: 100,
            missingBytes: 100,
          },
    ),
};

it("sends a person to Settings when its scanner isn't downloaded, and still converts Text only", async () => {
  const source = conversionOf({
    host: { kind: "ready", client: missingScanner },
  });
  const onChoose = vi.fn();
  await show(<ConvertButton conversion={source} onChoose={onChoose} />);
  await settle();
  await press("Convert to Markdown…");
  expect(onChoose).toHaveBeenCalledOnce();
  expect(source.request).not.toHaveBeenCalled();
  await press("More ways to convert");
  expect(menuItem("Scan every page")?.disabled).toBe(true);
  expect(menuItem("Scan every page")?.textContent).toContain(
    "The scanner in Settings isn't downloaded yet. Download it in Settings → Document conversion.",
  );
  await pressItem("Text only");
  expect(source.request).toHaveBeenCalledWith(
    expect.objectContaining({
      profile: withMethod(settings().profile, "digital"),
    }),
  );
});

it("never downloads from the Convert dialog: scanning waits for Settings, Text only converts", async () => {
  const source = conversionOf({
    host: { kind: "ready", client: missingScanner },
  });
  await show(
    <ConvertDialog
      conversion={source}
      fileName="invoice.pdf"
      onClose={() => undefined}
    />,
  );
  await settle();
  expect(card("Standard").checked).toBe(true);
  expect(button("Convert")?.disabled).toBe(true);
  expect(document.body.textContent).toContain(
    "The scanner in Settings isn't downloaded yet. Download it in Settings → Document conversion. Text only works without it.",
  );
  expect(card("Scan every page").disabled).toBe(true);
  expect(button("Download and convert")).toBeUndefined();
  choose("Text only");
  expect(button("Convert")?.disabled).toBe(false);
  await press("Convert");
  expect(source.request).toHaveBeenCalledWith(
    expect.objectContaining({
      profile: withMethod(settings().profile, "digital"),
    }),
  );
});

it("leaves the decision to the host when it can't say whether the scanner is there", async () => {
  const unchecked = {
    ...client,
    modelReadiness: () =>
      Promise.reject(new ConversionApiError(422, "unsupported", "No.")),
  };
  const source = conversionOf({ host: { kind: "ready", client: unchecked } });
  await show(<ConvertButton conversion={source} onChoose={() => undefined} />);
  await settle();
  expect(button("Convert to Markdown")?.disabled).toBe(false);
  await show(
    <ConvertDialog
      conversion={source}
      fileName="invoice.pdf"
      onClose={() => undefined}
    />,
  );
  await settle();
  expect(button("Convert")?.disabled).toBe(false);
  choose("Text only");
  await press("Convert");
  expect(source.request).toHaveBeenCalledWith(
    expect.objectContaining({
      profile: withMethod(settings().profile, "digital"),
    }),
  );
});
