import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Drive app for the "powerhouse/document-drive" document type: the Mail workspace */
export const EmailWorkspace: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive"],
  config: {
    id: "email-workspace",
    name: "Mail",
  },
};
