/**
 * Docture → Convert PDF to Markdown, the workflow step: the form, and what
 * it hands on. The work is lib/convert.ts, in the step's own process.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import {
  DEFAULT_PADDLE_MODEL,
  PADDLE_MODEL_PRESETS,
} from "../../../conversions/engine/engines.js";
import { convertPdf, INTEGRATED_AI } from "./convert.js";

/**
 * The workflow editor's form hint: the property is shown only while a
 * sibling holds one of `oneOf`. A hidden property keeps what it held, so the
 * step never reads one its other choices make irrelevant.
 */
const shownWhen = <P extends object>(
  property: P,
  prop: string,
  oneOf: readonly string[],
) => ({ ...property, showWhen: { prop, oneOf: [...oneOf] } });

const props = {
  file: Property.File({
    displayName: "PDF",
    description:
      "The PDF to read, e.g. a file from the trigger or an earlier step.",
    required: true,
  }),
  method: Property.StaticDropdown<string, true>({
    displayName: "Reading method",
    description:
      "Smart reads the text layer and recognizes only the pages without one. Digital only reads the text layer. OCR recognizes every page. AI transcription needs Sektar's integrated model, which workflow steps cannot reach yet.",
    required: true,
    defaultValue: "smart",
    options: {
      options: [
        { label: "Smart", value: "smart" },
        { label: "Digital only", value: "digital" },
        { label: "OCR", value: "ocr" },
        { label: "AI transcription", value: "ai" },
      ],
    },
  }),
  recognition: shownWhen(
    Property.StaticDropdown<string, false>({
      displayName: "Recognition",
      description:
        "What recognizes the pages that need it (Smart), or every page (OCR). Integrated AI is not available to workflow steps yet.",
      required: false,
      defaultValue: "tesseract",
      options: {
        options: [
          { label: "Tesseract", value: "tesseract" },
          { label: "PaddleOCR", value: "paddleocr" },
          { label: "Integrated AI (Smart only)", value: INTEGRATED_AI },
        ],
      },
    }),
    "method",
    ["smart", "ocr"],
  ),
  paddleModel: shownWhen(
    Property.StaticDropdown<string, false>({
      displayName: "PaddleOCR model",
      description:
        "The PaddleOCR model to read with. Download it in Settings → Document conversion before running this step.",
      required: false,
      defaultValue: DEFAULT_PADDLE_MODEL,
      options: {
        options: PADDLE_MODEL_PRESETS.map((preset) => ({
          label: preset.label,
          value: preset.id,
        })),
      },
    }),
    "recognition",
    ["paddleocr"],
  ),
  languages: shownWhen(
    Property.ShortText({
      displayName: "OCR languages",
      description:
        "Tesseract language codes, e.g. eng or eng, spa. Download each language in Settings → Document conversion before running this step.",
      required: false,
      defaultValue: "eng",
      advanced: true,
    }),
    "method",
    ["smart", "ocr"],
  ),
  aiLayout: shownWhen(
    Property.Checkbox({
      displayName: "Improve layout with AI",
      description:
        "Adjusts headings and reading order with the integrated model. Not available to workflow steps yet: the step stops and says so.",
      required: false,
      defaultValue: false,
      advanced: true,
    }),
    "method",
    ["smart", "digital", "ocr"],
  ),
  pages: Property.ShortText({
    displayName: "Pages",
    description:
      "Optional. The pages to convert, e.g. 1-3, 7. Empty converts every page.",
    required: false,
    advanced: true,
  }),
  onIncomplete: Property.StaticDropdown<string, true>({
    displayName: "If pages could not be read",
    description:
      "A partial result leaves out the pages that could not be read. Continue only when later steps handle missing pages: Completeness is then partial and Pages says which were not read.",
    required: true,
    defaultValue: "stop",
    options: {
      options: [
        { label: "Stop the step", value: "stop" },
        { label: "Continue with a partial result", value: "continue" },
      ],
    },
  }),
  resolvedPlan: Property.Json({
    displayName: "Resolved plan",
    description:
      "Optional. A conversion plan already pinned to engines and versions, as Sektar's own steps resolve it. When set, the reading options above are ignored, and the step stops if this host's engines differ.",
    required: false,
    advanced: true,
  }),
  limits: Property.Json({
    displayName: "Limits",
    description:
      "Optional. Any of maxBytes, maxPages and maxDurationMs. By default a step converts up to 50 MiB, 500 pages and 30 minutes.",
    required: false,
    advanced: true,
  }),
};

export const convertPdfToMarkdownAction = createAction({
  // Saved workflows refer to the action by name: don't rename it once published
  name: "convert-pdf-to-markdown",
  requireAuth: false,
  displayName: "Convert PDF to Markdown",
  description:
    "Reads a PDF with Docture in the workflow and stores its Markdown and a manifest as files. Hands on references to them, the outcome of every page and the engines used. Converting runs locally: digital text with PDF.js, scanned pages with Tesseract or PaddleOCR.",
  props,
  outputSchema: {
    fields: [
      {
        key: "markdown",
        label: "Markdown",
        description: "The stored Markdown file",
        children: [
          { key: "ref", label: "Reference" },
          { key: "fileName", label: "File name" },
          { key: "sizeBytes", label: "Size", format: "number" },
        ],
      },
      {
        key: "artifacts",
        label: "Other files",
        description: "The stored manifest: the plan, pages and engines as JSON",
      },
      {
        key: "completeness",
        label: "Completeness",
        description:
          "complete: every requested page was processed. partial: some could not be read.",
      },
      {
        key: "pages",
        label: "Pages",
        description:
          "One outcome per requested page: read, blank, unresolved or failed",
      },
      { key: "warnings", label: "Warnings" },
      {
        key: "provenance",
        label: "Engines",
        description: "What read the pages, by version",
      },
      { key: "usage", label: "AI usage" },
      {
        key: "plan",
        label: "Plan",
        description: "The resolved plan the PDF was read with",
      },
      { key: "documentPages", label: "Pages in the PDF", format: "number" },
    ],
  },
  errorHandlingOptions: {
    retryOnFailure: { defaultValue: false },
    continueOnFailure: { defaultValue: false },
  },
  defaultTimeoutSeconds: 30 * 60,
  async run(context) {
    return convertPdf({
      file: context.propsValue.file,
      props: context.propsValue,
      files: context.files,
    });
  },
});
