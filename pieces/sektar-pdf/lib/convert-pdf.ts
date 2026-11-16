import {
  createAction,
  Property,
  type IndexQueryMethods,
} from "@powerhousedao/pieces-framework";
import { conversionLimitsSchema } from "../../../conversions/contracts.js";
import {
  convertPdf,
  type ArtifactStore,
  type ConvertPdfInput,
} from "../../docture/lib/convert.js";
import { convertPdfToMarkdownAction } from "../../docture/lib/convert-pdf-to-markdown.js";
import { validatePdfInputSchema, type ValidatePdfInput } from "./contracts.js";
import { readConversionGateway } from "./gateway.js";

export async function convertManagedPdf({
  reactor,
  input,
  file,
  files,
}: {
  reactor: IndexQueryMethods;
  input: ValidatePdfInput;
  file: ConvertPdfInput["file"];
  files: ArtifactStore;
}) {
  const limits = conversionLimitsSchema.parse(
    await readConversionGateway(
      reactor,
      "extractionLimits",
      validatePdfInputSchema.parse(input),
    ),
  );
  return convertPdf({
    file,
    files,
    props: {
      resolvedPlan: input.prepared.plan,
      limits,
      onIncomplete: "continue",
    },
  });
}

export const convertManagedPdfAction = createAction({
  name: "convert-pdf",
  displayName: "Convert Sektar PDF",
  description:
    "Rechecks source access and global limits, then reads the PDF with Docture. Retries use current limits.",
  requireAuth: false,
  requireReactor: "read",
  props: {
    file: Property.File({ displayName: "PDF", required: true }),
    prepared: Property.Json({ displayName: "Prepared PDF", required: true }),
  },
  outputSchema: convertPdfToMarkdownAction.outputSchema,
  defaultTimeoutSeconds: 2 * 60 * 60,
  async run(context) {
    return convertManagedPdf({
      reactor: context.reactor,
      input: validatePdfInputSchema.parse({
        prepared: context.propsValue.prepared,
        workflowId: context.flows.current.id,
        runId: context.run.id,
      }),
      file: context.propsValue.file,
      files: context.files,
    });
  },
});
