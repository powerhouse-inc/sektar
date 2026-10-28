import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Drive app for the "powerhouse/document-drive" document type: the Calendar */
export const CalendarApp: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive"],
  config: {
    id: "calendar",
    name: "Calendar",
  },
};
