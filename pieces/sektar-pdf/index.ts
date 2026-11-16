import { createPiece, PieceAuth } from "@powerhousedao/pieces-framework";
import { publishRenditionAction } from "./lib/publish-rendition.js";
import { convertManagedPdfAction } from "./lib/convert-pdf.js";
import { resolvePdfAction } from "./lib/resolve-pdf.js";

export const sektarPdf = createPiece({
  displayName: "Sektar PDF",
  description:
    "Source, extraction and publication steps for Sektar's managed conversion workflows. Use the Docture piece in your own workflows.",
  auth: PieceAuth.None(),
  minimumSupportedRelease: "0.30.0",
  logoUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#1d4ed8"/><path d="M15 11h12l7 7v19H15z" fill="none" stroke="white" stroke-width="3"/><path d="M26 11v9h8M20 26h9M20 31h9" fill="none" stroke="white" stroke-width="3"/></svg>',
    ),
  authors: [],
  actions: [resolvePdfAction, convertManagedPdfAction, publishRenditionAction],
  triggers: [],
});

export default sektarPdf;
