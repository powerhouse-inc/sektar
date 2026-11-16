import { createPiece, PieceAuth } from "@powerhousedao/pieces-framework";
import { convertPdfToMarkdownAction } from "./lib/convert-pdf-to-markdown.js";
import { DOCTURE_LOGO } from "./lib/logo.js";

export const docture = createPiece({
  // Name and description shown in the workflow editor's piece list
  displayName: "Docture",
  description:
    "Read PDFs into Markdown in the workflow, with digital text extraction and local OCR, and pass the stored result to later steps.",
  // Converts locally: no account or connection to pick.
  auth: PieceAuth.None(),
  minimumSupportedRelease: "0.30.0",
  logoUrl: DOCTURE_LOGO,
  authors: [],
  actions: [convertPdfToMarkdownAction],
  triggers: [],
});

export default docture;
