/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Document editor module for the drive document types (legacy and reactor-drive) */
export const Sektar: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive", "powerhouse/reactor-drive"],
  config: {
    id: "sektar",
    name: "sektar",
  },
};
