import type { PHAppConfig } from "@powerhousedao/reactor-browser";

export const editorConfig: PHAppConfig = {
  isDragAndDropEnabled: true,
  allowedDocumentTypes: [
    "sektar/invoice",
    "sektar/expense-report",
    "sektar/contact",
    "sektar/bank-account",
  ],
};
