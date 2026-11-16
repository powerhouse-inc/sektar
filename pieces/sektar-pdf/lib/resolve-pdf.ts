import type { PHDocument } from "document-model";
import {
  createAction,
  Property,
  type IndexQueryMethods,
} from "@powerhousedao/pieces-framework";
import {
  preparePdfInputSchema,
  preparedPdfSchema,
  type PreparePdfInput,
  type PreparedPdf,
} from "./contracts.js";
import { readConversionGateway } from "./gateway.js";

export type PdfResolver = IndexQueryMethods & {
  get(documentId: string): Promise<Pick<PHDocument, "header">>;
};

export async function resolvePdf(
  reactor: PdfResolver,
  input: PreparePdfInput,
): Promise<PreparedPdf> {
  const prepared = preparedPdfSchema.parse(
    await readConversionGateway(
      reactor,
      "prepare",
      preparePdfInputSchema.parse(input),
    ),
  );
  if (prepared.kind === "ready") {
    const document = await reactor.get(prepared.source.documentId);
    if (document.header.id !== prepared.source.documentId) {
      throw new Error("The reactor returned a different source document");
    }
  }
  return prepared;
}

export const resolvePdfAction = createAction({
  name: "resolve-pdf",
  displayName: "Resolve Sektar PDF",
  description:
    "Checks the app-wide conversion settings and access, pins the PDF and reading plan, and reuses matching Markdown when available.",
  requireAuth: false,
  requireReactor: "read",
  props: {
    request: Property.Json({
      displayName: "Request",
      description:
        "The original conversion request or document trigger payload.",
      required: true,
    }),
  },
  outputSchema: {
    fields: [
      { key: "kind", label: "Outcome", description: "ready or skip" },
      { key: "reason", label: "Reason for skipping" },
      { key: "source", label: "Pinned PDF source" },
      { key: "file", label: "PDF file reference" },
      { key: "plan", label: "Resolved reading plan" },
      { key: "limits", label: "Conversion limits" },
      { key: "generationId", label: "Conversion identifier" },
      { key: "createdAt", label: "Requested at" },
      { key: "reuse", label: "Saved Markdown to reuse" },
    ],
  },
  async run(context) {
    return resolvePdf(
      context.reactor,
      preparePdfInputSchema.parse({
        request: context.propsValue.request,
        workflowId: context.flows.current.id,
        runId: context.run.id,
      }),
    );
  },
});
