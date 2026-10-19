import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Drive app for the "powerhouse/document-drive" document type: the Backfills workspace */
export const BackfillsWorkspace: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive"],
  config: {
    id: "backfills",
    name: "Backfills",
  },
};
