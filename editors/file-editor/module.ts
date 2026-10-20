/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Document editor module for the "sektar/file" document type */
export const FileEditor: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["sektar/file"],
  config: {
    id: "file-editor",
    name: "file-editor",
  },
};
