import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Document editor module for the "sektar/email" document type */
export const EmailEditor: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["sektar/email"],
  config: {
    id: "email-editor",
    name: "email-editor",
  },
};
