import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Drive app for the drive document types (legacy and reactor-drive): the Mail workspace */
export const EmailWorkspace: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive", "powerhouse/reactor-drive"],
  config: {
    id: "email-workspace",
    name: "Mail",
  },
};
