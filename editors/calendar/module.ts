import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Drive app for the drive document types (legacy and reactor-drive): the Calendar */
export const CalendarApp: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive", "powerhouse/reactor-drive"],
  config: {
    id: "calendar",
    name: "Calendar",
  },
};
